import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SerializeOptions } from 'cookie'; // official type used by Next for cookie.set options

type CookieSetOptions = SerializeOptions;

export async function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

  // Next 15+: cookies() is async
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieSetOptions) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Safe to ignore when called during RSC render paths
        }
      },
      remove(name: string, options?: CookieSetOptions) {
        try {
          // Next doesn't expose delete; emulate remove with expired cookie.
          cookieStore.set(name, '', { ...options, maxAge: 0, path: '/' });
        } catch {
          /* ignore in RSC */
        }
      },
    },
  });
}

// Legacy/compat export if other code imports createClient()
export async function createClient() {
  return getServerSupabase();
}
