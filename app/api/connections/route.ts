import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth/session';
import { getSupabaseAdminClient } from '../../../lib/supabase/server';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from('connections')
    .select('id,user_a_id,user_b_id,created_at')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const connections = rows || [];
  const otherIds = connections.map((c: any) => (c.user_a_id === user.id ? c.user_b_id : c.user_a_id));

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id,display_name,city')
    .in('user_id', otherIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  const items = connections.map((c: any) => {
    const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
    const p = profileMap.get(otherId) || {};
    return {
      id: c.id,
      fromId: c.user_a_id,
      toId: c.user_b_id,
      fromName: c.user_a_id === user.id ? 'You' : (p.display_name || 'Builder'),
      fromPhone: '',
      toName: c.user_a_id === user.id ? (p.display_name || 'Builder') : 'You',
      toPhone: '',
      message: p.city || '',
      createdAt: new Date(c.created_at).getTime(),
      contact: { id: otherId, name: p.display_name || 'Builder', phone: '' },
      connectionId: c.id,
    };
  });

  return NextResponse.json({ connections: items });
}
