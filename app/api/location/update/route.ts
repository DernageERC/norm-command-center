import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/auth/session';
import { getSupabaseAdminClient } from '../../../../lib/supabase/server';

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round(value: number, digits = 2) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function geobucket(lat: number, lng: number) {
  const latB = Math.floor(lat * 10);
  const lngB = Math.floor(lng * 10);
  return `${latB}:${lngB}`;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const rawLat = toNumber(body?.lat);
  const rawLng = toNumber(body?.lng);
  const accuracy = Math.max(0, Math.round(toNumber(body?.accuracy, 0)));

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  const lat = round(rawLat, 2);
  const lng = round(rawLng, 2);
  const geohash = geobucket(lat, lng);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('presence_locations').insert({
    user_id: user.id,
    geohash,
    lat_approx: lat,
    lng_approx: lng,
    accuracy_m: accuracy,
    captured_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, geohash, lat, lng });
}
