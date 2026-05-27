import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth/session';
import { getSupabaseAdminClient } from '../../../lib/supabase/server';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const [{ data: profile }, { data: availability }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('availability').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  return NextResponse.json({ authenticated: true, user: { id: user.id, phone: user.phone }, profile, availability });
}
