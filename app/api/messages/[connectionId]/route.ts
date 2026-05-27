import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/auth/session';
import { getSupabaseAdminClient } from '../../../../lib/supabase/server';

function clean(v: unknown, max = 500) {
  return String(v || '').trim().slice(0, max);
}

async function ensureParticipant(connectionId: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('connections')
    .select('id,user_a_id,user_b_id')
    .eq('id', connectionId)
    .maybeSingle();
  if (!data) return false;
  return data.user_a_id === userId || data.user_b_id === userId;
}

export async function GET(request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { connectionId } = await params;

  const ok = await ensureParticipant(connectionId, user.id);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id,connection_id,sender_user_id,body,created_at')
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = (data || []).map((m: any) => ({
    id: m.id,
    fromId: m.sender_user_id,
    toId: '',
    fromName: m.sender_user_id === user.id ? 'You' : 'Builder',
    body: m.body,
    createdAt: new Date(m.created_at).getTime(),
  }));

  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { connectionId } = await params;

  const ok = await ensureParticipant(connectionId, user.id);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const text = clean(body?.body, 500);
  if (!text) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ connection_id: connectionId, sender_user_id: user.id, body: text })
    .select('id,connection_id,sender_user_id,body,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const message = {
    id: data.id,
    fromId: data.sender_user_id,
    toId: '',
    fromName: 'You',
    body: data.body,
    createdAt: new Date(data.created_at).getTime(),
  };

  return NextResponse.json({ ok: true, message });
}
