import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR')
    return NextResponse.json({ error: 'Not a creator' }, { status: 403 })

  const [{ data: tiers }, { count }] = await Promise.all([
    supabase.from('vip_tiers').select('*').eq('dom_id', profile.id),
    supabase.from('tribute_scores')
      .select('fan_id', { count: 'exact', head: true })
      .eq('dom_id', profile.id),
  ])

  return NextResponse.json({
    tiers: tiers ?? [],
    subCount: count ?? 0,
  })
}
