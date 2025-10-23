import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_REDIRECTS = new Set([
  '/', '/signup', '/chat', '/dashboard', '/creator/dashboard', '/fan/dashboard', '/settings', '/creator/settings'
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const rawNext = url.searchParams.get('next') ?? '/';
  const ut = url.searchParams.get('ut'); // CREATOR | FAN
  const error_code = url.searchParams.get('error');
  const error_description = url.searchParams.get('error_description');

  console.log('🔄 Auth callback received:', { 
    code: !!code, 
    rawNext, 
    ut, 
    error_code, 
    error_description,
    fullUrl: req.url 
  });

  // Handle auth errors from Supabase
  if (error_code) {
    console.error('❌ Auth error from Supabase:', { error_code, error_description });
    const errorMessage = error_description || error_code || 'Authentication failed';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, url.origin));
  }

  const next = (rawNext.startsWith('/') && ALLOWED_REDIRECTS.has(rawNext))
    ? rawNext
    : '/';

  if (!code) {
    console.log('❌ No code provided, redirecting to:', next);
    return NextResponse.redirect(new URL(next, url.origin));
  }

  try {
    const supabase = await createClient();

    // 1) Exchange code → sets the auth cookie on this response
    console.log('🔑 Exchanging code for session...');
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('❌ Auth exchange error:', exchangeError);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin));
    }

    console.log('✅ Session exchange successful:', { 
      hasSession: !!sessionData.session,
      hasUser: !!sessionData.user,
      userId: sessionData.user?.id 
    });

    // 2) Check if a profile exists
    const user = sessionData.user;
    if (!user) {
      console.error('❌ No user in session after exchange');
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('No user found after authentication')}`, url.origin));
    }

    console.log('👤 User authenticated:', { userId: user.id, email: user.email });

    // Check for existing profile with error handling
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('❌ Profile check error:', profileError);
        // Continue anyway, treat as no profile
      }

      console.log('📊 Profile check result:', { 
        profile: !!profile, 
        profileId: profile?.id,
        profileError: profileError?.code 
      });

      if (!profile) {
        // Handle different flows for fans vs creators
        if (ut === 'FAN') {
          // For fans, create a basic profile automatically and redirect to dashboard
          console.log('🔄 No profile found for fan, creating basic profile');
          try {
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                auth_user_id: user.id,
                email: user.email,
                display_name: user.email?.split('@')[0] || 'Fan',
                user_type: 'FAN'
              })
              .select('id')
              .single();

            if (createError) {
              console.error('❌ Failed to create fan profile:', createError);
              // Fall back to signup completion
              const dest = new URL('/signup', url.origin);
              dest.searchParams.set('step', 'complete');
              dest.searchParams.set('ut', ut);
              return NextResponse.redirect(dest, { status: 303 });
            }

            console.log('✅ Fan profile created, redirecting to dashboard');
            return NextResponse.redirect(new URL('/', url.origin), { status: 303 });
          } catch (fanProfileError) {
            console.error('❌ Exception creating fan profile:', fanProfileError);
            // Fall back to signup completion
            const dest = new URL('/signup', url.origin);
            dest.searchParams.set('step', 'complete');
            dest.searchParams.set('ut', ut);
            return NextResponse.redirect(dest, { status: 303 });
          }
        } else {
          // For creators, go to the completion step
          console.log('🔄 No profile found for creator, redirecting to signup completion step');
          const dest = new URL('/signup', url.origin);
          dest.searchParams.set('step', 'complete');
          if (ut) dest.searchParams.set('ut', ut);
          // 303 avoids re-POST and forces a new navigation with fresh cookies
          return NextResponse.redirect(dest, { status: 303 });
        }
      } else {
        console.log('✅ Profile exists, proceeding with normal redirect');
      }
    } catch (profileCheckError) {
      console.error('❌ Profile check exception:', profileCheckError);
      // Treat as no profile and handle fan vs creator differently
      if (ut === 'FAN') {
        // For fans, try to create a basic profile
        console.log('🔄 Profile check failed for fan, attempting to create basic profile');
        try {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              auth_user_id: user.id,
              email: user.email,
              display_name: user.email?.split('@')[0] || 'Fan',
              user_type: 'FAN'
            })
            .select('id')
            .single();

          if (!createError) {
            console.log('✅ Fan profile created after exception, redirecting to dashboard');
            return NextResponse.redirect(new URL('/', url.origin), { status: 303 });
          }
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError);
        }
      }
      
      // Fall back to signup completion for creators or if fan profile creation failed
      console.log('🔄 Redirecting to signup completion step');
      const dest = new URL('/signup', url.origin);
      dest.searchParams.set('step', 'complete');
      if (ut) dest.searchParams.set('ut', ut);
      return NextResponse.redirect(dest, { status: 303 });
    }

    console.log('🏁 Final redirect to:', `${url.origin}${next}`);
    return NextResponse.redirect(new URL(next, url.origin), { status: 303 });

  } catch (error) {
    console.error('💥 Auth callback exception:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, url.origin));
  }
}
