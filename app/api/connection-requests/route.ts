import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth/session';
import { getSupabaseAdminClient } from '../../../lib/supabase/server';

function text(v: unknown, max = 300) {
  return String(v || '').trim().slice(0, max);
}

function pair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const toUserId = text(body?.to_user_id || body?.toId, 64);
  const message = text(body?.message, 220);
  if (!toUserId || toUserId === user.id) return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  const { error: reqErr } = await supabase.from('connection_requests').insert({
    sender_user_id: user.id,
    receiver_user_id: toUserId,
    status: 'accepted',
    message,
    updated_at: new Date().toISOString(),
  });
  if (reqErr && !reqErr.message.toLowerCase().includes('duplicate')) {
    return NextResponse.json({ error: reqErr.message }, { status: 500 });
  }

  const [userA, userB] = pair(user.id, toUserId);
  const { data: connection, error: connErr } = await supabase
    .from('connections')
    .upsert({ user_a_id: userA, user_b_id: userB }, { onConflict: 'user_a_id,user_b_id' })
    .select('id,user_a_id,user_b_id,created_at')
    .single();

  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, connection });
}
