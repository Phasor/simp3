import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props {
  params: Promise<{ domId: string }>
}

export async function GET(_req: Request, { params }: Props) {
  const { domId } = await params

  // Get authenticated user (optional — unauthenticated users get fanSpend: 0)
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let fanProfileId: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    fanProfileId = profile?.id ?? null
  }

  const admin = getAdmin()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  // Run all queries in parallel
  const [tierResult, fanSpendResult, allSpendsResult, accessCountResult, hasAccessResult] = await Promise.all([
    // 1. Get dom's GROUP tier config
    admin
      .from('vip_tiers')
      .select('threshold_type, threshold_value, min_spend_usdc')
      .eq('dom_id', domId)
      .eq('tier_type', 'GROUP')
      .maybeSingle(),

    // 2. Get fan's 30-day spend with this dom
    fanProfileId
      ? admin.rpc('get_fan_30d_spend_raw', { p_fan_id: fanProfileId, p_dom_id: domId }).then(r => r)
      : Promise.resolve({ data: null }),

    // 3. Get all fans' 30-day spends for ranking
    admin.rpc('get_dom_fan_spends_30d_raw', { p_dom_id: domId }).then(r => r),

    // 4. Count fans with active chat access for this dom
    admin
      .from('chat_access')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', domId)
      .eq('state', 'granted'),

    // 5. Check if fan already has access (must be granted AND not expired)
    fanProfileId
      ? admin
          .from('chat_access')
          .select('id, access_until')
          .eq('fan_id', fanProfileId)
          .eq('creator_id', domId)
          .eq('state', 'granted')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // If no GROUP tier configured, return null (no progress card shown)
  if (!tierResult.data) {
    return NextResponse.json({ hasGroupTier: false })
  }

  const tier = tierResult.data
  const minSpendUsdc = Number(tier.min_spend_usdc ?? 0)
  const fansWithAccess = accessCountResult.count ?? 0
  const accessRow = hasAccessResult.data as { id: string; access_until: string } | null
  const hasChatAccess = !!accessRow

  // Calculate fan's 30-day spend using direct query (RPC functions may not exist yet)
  // Fallback: query task_completions directly
  let fanSpend30d = 0
  if (fanProfileId) {
    if (fanSpendResult.data != null && typeof fanSpendResult.data === 'number') {
      fanSpend30d = fanSpendResult.data
    } else {
      // Direct query fallback
      const { data: rows } = await admin
        .from('task_completions')
        .select('amount_usdc, tasks!inner(creator_id)')
        .eq('fan_id', fanProfileId)
        .eq('tasks.creator_id', domId)
        .eq('status', 'APPROVED')
        .gte('reviewed_at', thirtyDaysAgo)
      fanSpend30d = (rows ?? []).reduce((sum: number, r: { amount_usdc: number | null }) => sum + Number(r.amount_usdc ?? 0), 0)
    }
  }

  // Get all fans' 30-day spends for ranking calculation
  let allSpends: number[] = []
  if (allSpendsResult.data && Array.isArray(allSpendsResult.data)) {
    allSpends = allSpendsResult.data
      .filter((r: { spend_30d: number }) => r.spend_30d >= minSpendUsdc)
      .map((r: { spend_30d: number }) => Number(r.spend_30d))
      .sort((a: number, b: number) => b - a)
  } else {
    // Direct query fallback
    const { data: rows } = await admin
      .from('task_completions')
      .select('fan_id, amount_usdc, tasks!inner(creator_id)')
      .eq('tasks.creator_id', domId)
      .eq('status', 'APPROVED')
      .gte('reviewed_at', thirtyDaysAgo)

    const spendByFan: Record<string, number> = {}
    for (const r of rows ?? []) {
      spendByFan[r.fan_id] = (spendByFan[r.fan_id] ?? 0) + Number(r.amount_usdc ?? 0)
    }
    allSpends = Object.values(spendByFan)
      .filter(s => s >= minSpendUsdc)
      .sort((a, b) => b - a)
  }

  const meetsMinSpend = fanSpend30d >= minSpendUsdc
  const totalQualifying = allSpends.length

  // Calculate the cutoff (how many fans get access)
  let cutoffCount = 0
  if (tier.threshold_type === 'TOP_PERCENT') {
    cutoffCount = Math.max(1, Math.floor(totalQualifying * Number(tier.threshold_value) / 100))
  } else {
    cutoffCount = Number(tier.threshold_value)
  }

  // Fan's rank among qualifying fans (1-based, lower is better)
  const fanRank = meetsMinSpend ? allSpends.filter(s => s > fanSpend30d).length + 1 : null
  const meetsRanking = fanRank !== null && fanRank <= cutoffCount

  return NextResponse.json({
    hasGroupTier: true,
    fanSpend30d,
    minSpendUsdc,
    meetsMinSpend,
    fanRank,
    cutoffCount,
    totalQualifying,
    meetsRanking,
    fansWithAccess,
    hasChatAccess,
  })
}
