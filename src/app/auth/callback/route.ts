import { NextResponse } from 'next/server'
import { createServerClientStrict } from '@/lib/supabase/server'

// Allowlist of safe redirect paths
const ALLOWED_REDIRECTS = ['/', '/chat', '/dashboard', '/creator/dashboard', '/fan/dashboard', '/settings', '/creator/settings']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/'
  
  // Validate and sanitize the next parameter - prevent open redirects
  const isPathOnly = rawNext.startsWith('/') && !rawNext.startsWith('//')
  const next = (ALLOWED_REDIRECTS.includes(rawNext) && isPathOnly) ? rawNext : '/'

  if (code) {
    const supabase = await createServerClientStrict()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    // After successful authentication, check if user has a profile
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      
      // If no profile exists, redirect to signup instead of home
      if (!profile) {
        return NextResponse.redirect(`${origin}/signup`)
      }
    }
  }
  return NextResponse.redirect(`${origin}${next}`)
}
