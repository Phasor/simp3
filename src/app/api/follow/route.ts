import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'FAN') {
    return NextResponse.json({ error: 'Only subs can follow doms' }, { status: 403 })
  }

  const { domId } = await req.json()
  if (!domId) return NextResponse.json({ error: 'domId required' }, { status: 400 })

  // Check if already following
  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('fan_id', profile.id)
    .eq('dom_id', domId)
    .maybeSingle()

  if (existing) {
    await supabase.from('follows').delete().eq('id', existing.id)
    return NextResponse.json({ following: false })
  } else {
    await supabase.from('follows').insert({ fan_id: profile.id, dom_id: domId })
    return NextResponse.json({ following: true })
  }
}
