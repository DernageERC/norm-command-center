import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth/session';
import { getSupabaseAdminClient } from '../../../lib/supabase/server';

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function geobucket(lat: number, lng: number) {
  const latB = Math.floor(lat * 10);
  const lngB = Math.floor(lng * 10);
  return `${latB}:${lngB}`;
}

function neighborBuckets(lat: number, lng: number) {
  const latB = Math.floor(lat * 10);
  const lngB = Math.floor(lng * 10);
  const out: string[] = [];
  for (let a = -1; a <= 1; a++) {
    for (let b = -1; b <= 1; b++) out.push(`${latB + a}:${lngB + b}`);
  }
  return out;
}

function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const lat = toNumber(url.searchParams.get('lat'));
  const lng = toNumber(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ people: [] });
  }

  const buckets = neighborBuckets(lat, lng);
  const supabase = getSupabaseAdminClient();

  const { data: availRows, error: availErr } = await supabase
    .from('availability')
    .select('user_id,status,is_visible,visibility_expires_at')
    .eq('is_visible', true)
    .neq('user_id', user.id);
  if (availErr) return NextResponse.json({ error: availErr.message }, { status: 500 });

  const now = Date.now();
  const visibleIds = (availRows || [])
    .filter((r: any) => !r.visibility_expires_at || new Date(r.visibility_expires_at).getTime() > now)
    .map((r: any) => r.user_id);

  if (!visibleIds.length) return NextResponse.json({ people: [] });

  const { data: blockRows } = await supabase
    .from('blocks')
    .select('blocker_user_id,blocked_user_id')
    .or(`and(blocker_user_id.eq.${user.id}),and(blocked_user_id.eq.${user.id})`);

  const blockedIds = new Set<string>();
  for (const row of blockRows || []) {
    if (row.blocker_user_id === user.id) blockedIds.add(row.blocked_user_id);
    if (row.blocked_user_id === user.id) blockedIds.add(row.blocker_user_id);
  }

  const filteredIds = visibleIds.filter((id: string) => !blockedIds.has(id));
  if (!filteredIds.length) return NextResponse.json({ people: [] });

  const { data: locationRows, error: locErr } = await supabase
    .from('presence_locations')
    .select('user_id,geohash,lat_approx,lng_approx,captured_at')
    .in('user_id', filteredIds)
    .in('geohash', buckets)
    .order('captured_at', { ascending: false })
    .limit(300);
  if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 });

  const latestByUser = new Map<string, any>();
  for (const row of locationRows || []) {
    if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row);
  }
  const nearIds = Array.from(latestByUser.keys());
  if (!nearIds.length) return NextResponse.json({ people: [] });

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('user_id,display_name,bio,city,what_building,photo_url,skills,interests,open_to')
    .in('user_id', nearIds);
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  const availMap = new Map((availRows || []).map((r: any) => [r.user_id, r]));
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  const people = nearIds.map((id) => {
    const loc = latestByUser.get(id);
    const profile = profileMap.get(id) || {};
    const avail = availMap.get(id) || {};
    const pLat = Number(loc.lat_approx);
    const pLng = Number(loc.lng_approx);
    const distanceMiles = Number.isFinite(pLat) && Number.isFinite(pLng) ? milesBetween(lat, lng, pLat, pLng) : null;

    return {
      id,
      realName: profile.display_name || 'Builder',
      signal: avail.status || 'open_connect',
      bio: profile.bio || '',
      building: profile.what_building || profile.bio || 'Building',
      locationLabel: profile.city || 'Nearby',
      tags: (profile.skills || []).slice(0, 3),
      lat: pLat,
      lng: pLng,
      distanceMiles,
      updatedAt: new Date(loc.captured_at).getTime(),
      avatarUrl: profile.photo_url || '',
    };
  }).sort((a,b) => (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999));

  return NextResponse.json({ people: people.slice(0, 50), bucket: geobucket(lat, lng) });
}
