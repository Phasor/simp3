import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function handleSignOut(requestUrl: string) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const origin = new URL(requestUrl).origin
  return NextResponse.redirect(new URL('/login', origin))
}

export async function POST(request: Request) {
  return handleSignOut(request.url)
}

export async function GET(request: Request) {
  return handleSignOut(request.url)
}
