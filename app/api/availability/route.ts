import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth/session';
import { getSupabaseAdminClient } from '../../../lib/supabase/server';

const ALLOWED = new Set(['open_connect', 'focus', 'hidden']);

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const status = String(body?.status || 'hidden');
  const isVisible = Boolean(body?.is_visible);
  const expiresInMinutes = Number(body?.expires_in_minutes || 0);

  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const visibility_expires_at = isVisible && expiresInMinutes > 0
    ? new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
    : null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('availability')
    .upsert(
      {
        user_id: user.id,
        status,
        is_visible: isVisible,
        visibility_expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, availability: data });
}
