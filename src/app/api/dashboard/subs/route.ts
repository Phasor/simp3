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

  const now = new Date()
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data: scores } = await supabase
    .from('tribute_scores')
    .select('fan_id, total_score, spend_score, task_score')
    .eq('dom_id', profile.id)
    .eq('month_year', monthYear)
    .order('total_score', { ascending: false })

  if (!scores || scores.length === 0) return NextResponse.json({ subs: [] })

  const fanIds = scores.map(s => s.fan_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, tribute_alias, display_name')
    .in('id', fanIds)

  const profileMap = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p.tribute_alias ?? p.display_name ?? 'Anonymous'])
  )

  const subs = scores.map(s => ({
    fan_id: s.fan_id,
    total_score: s.total_score,
    spend_score: s.spend_score,
    task_score: s.task_score,
    alias: profileMap[s.fan_id] ?? 'Anonymous',
  }))

  return NextResponse.json({ subs })
}
