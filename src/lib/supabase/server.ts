import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieSetOptions = Parameters<ReturnType<typeof cookies>['set']>[2];

export async function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        async get(name: string) {
          return (await cookies()).get(name)?.value;
        },
        async set(name: string, value: string, options?: CookieSetOptions) {
          try {
            (await cookies()).set(name, value, options);
          } catch {
            // Called in an RSC render path; safe to ignore if middleware or
            // subsequent requests refresh the auth cookies.
          }
        },
        async remove(name: string, options?: CookieSetOptions) {
          try {
            // Next doesn't expose remove; emulate with expired cookie.
            (await cookies()).set(name, '', { ...options, maxAge: 0, path: '/' });
          } catch {
            /* ignore in RSC */
          }
        },
      },
    }
  );
}

// Legacy export for backward compatibility
export async function createClient() {
  return getServerSupabase();
}