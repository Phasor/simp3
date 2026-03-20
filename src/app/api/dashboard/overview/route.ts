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

  const domId = profile.id
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [
    { data: completions },
    { data: unlocks },
    { count: activeTasks },
    { data: vipAccess },
  ] = await Promise.all([
    supabase.from('task_completions')
      .select('amount_usdc, accepted_at, tasks!inner(creator_id)')
      .eq('tasks.creator_id', domId)
      .eq('status', 'APPROVED'),
    supabase.from('content_unlocks')
      .select('amount_usdc, unlocked_at, media_assets!inner(creator_id)')
      .eq('media_assets.creator_id', domId),
    supabase.from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', domId)
      .eq('status', 'PUBLISHED'),
    supabase.from('chat_access')
      .select('tier')
      .eq('creator_id', domId)
      .eq('state', 'granted'),
  ])

  const allTxns = [
    ...(completions ?? []).map(c => ({ usdc: (c.amount_usdc as number) ?? 0, date: c.accepted_at as string })),
    ...(unlocks ?? []).map(u => ({ usdc: (u.amount_usdc as number) ?? 0, date: u.unlocked_at as string })),
  ]

  const totalEarnings = allTxns.reduce((s, t) => s + t.usdc, 0)
  const thisMonthEarnings = allTxns
    .filter(t => t.date?.startsWith(thisMonth))
    .reduce((s, t) => s + t.usdc, 0)

  const vipCount = (vipAccess ?? []).filter(a => a.tier === 'GROUP').length
  const vvipCount = (vipAccess ?? []).filter(a => a.tier === 'PRIVATE').length

  // Build 6-month chart
  const buckets: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets[key] = 0
  }
  for (const t of allTxns) {
    const key = t.date?.slice(0, 7)
    if (key && key in buckets) buckets[key] += t.usdc
  }
  const chartData = Object.entries(buckets).map(([key, usdc]) => {
    const [yr, mo] = key.split('-')
    const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    return { month: label, usdc: Math.round(usdc * 100) / 100 }
  })

  return NextResponse.json({
    stats: { totalEarnings, thisMonthEarnings, activeTasks: activeTasks ?? 0, vipCount, vvipCount },
    chartData,
  })
}
