import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error_code = url.searchParams.get('error');
  const error_description = url.searchParams.get('error_description');

  if (error_code) {
    const errorMessage = error_description || error_code || 'Authentication failed';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  try {
    const supabase = await createClient();

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin));
    }

    const user = sessionData.user;
    if (!user) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('No user found after authentication')}`, url.origin));
    }

    // Check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, onboarding_completed')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const next = url.searchParams.get('next') ?? ''
    const safeNext = next.startsWith('/') ? next : '/'

    // New user or incomplete onboarding → go to onboarding (preserve next for post-onboarding redirect)
    if (!profile || !profile.onboarding_completed) {
      const dest = next ? `/onboarding?next=${encodeURIComponent(safeNext)}` : '/onboarding'
      return NextResponse.redirect(new URL(dest, url.origin), { status: 303 });
    }

    // Returning user → honour next param, fall back to role default
    return NextResponse.redirect(new URL(safeNext || '/', url.origin), { status: 303 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, url.origin));
  }
}
