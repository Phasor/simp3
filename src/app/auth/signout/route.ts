import { NextResponse } from 'next/server'
import { createServerClientStrict } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerClientStrict()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
}
