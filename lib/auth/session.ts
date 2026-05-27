import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '../supabase/server';

export async function getSessionUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('nn-access-token')?.value;
  if (!accessToken) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return data.user;
}
