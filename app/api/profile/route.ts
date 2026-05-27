import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth/session';
import { getSupabaseAdminClient } from '../../../lib/supabase/server';

function text(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const payload = {
    user_id: user.id,
    display_name: text(body?.display_name || body?.realName, 80),
    bio: text(body?.bio, 220),
    city: text(body?.city || body?.locationLabel, 120),
    photo_url: text(body?.photo_url || body?.avatarUrl, 2000),
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' }).select('*').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}
