import { createBrowserClient } from '@supabase/ssr';
import { requireEnv } from '../env';

export function getSupabaseBrowserClient() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createBrowserClient(url, anonKey);
}
