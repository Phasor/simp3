import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, kyc_status, wallet_address')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR')
    return NextResponse.json({ error: 'Not a creator' }, { status: 403 })

  const [{ data: completions }, { data: unlocks }] = await Promise.all([
    supabase.from('task_completions')
      .select('id, amount_usdc, accepted_at, tasks!inner(title, creator_id)')
      .eq('tasks.creator_id', profile.id)
      .eq('status', 'APPROVED')
      .order('accepted_at', { ascending: false })
      .limit(50),
    supabase.from('content_unlocks')
      .select('id, amount_usdc, unlocked_at, media_assets!inner(title, creator_id)')
      .eq('media_assets.creator_id', profile.id)
      .order('unlocked_at', { ascending: false })
      .limit(50),
  ])

  const txns = [
    ...(completions ?? []).map(c => ({
      id: c.id,
      date: c.accepted_at,
      label: (c.tasks as unknown as { title: string })?.title ?? 'Task',
      amountUsdc: (c.amount_usdc as number) ?? 0,
      type: 'task' as const,
    })),
    ...(unlocks ?? []).map(u => ({
      id: u.id,
      date: u.unlocked_at,
      label: (u.media_assets as unknown as { title: string })?.title ?? 'Content unlock',
      amountUsdc: (u.amount_usdc as number) ?? 0,
      type: 'content' as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const balance = txns.reduce((s, t) => s + t.amountUsdc, 0)

  return NextResponse.json({
    txns,
    balance,
    kycStatus: profile.kyc_status ?? 'PENDING',
    walletAddress: profile.wallet_address ?? '',
  })
}
