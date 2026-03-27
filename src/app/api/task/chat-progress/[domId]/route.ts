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

  // Get authenticated user (optional — unauthenticated users get fanScore: 0)
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
  const now = new Date()
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Run all queries in parallel
  const [tierResult, fanScoreResult, allScoresResult, accessCountResult, hasAccessResult] = await Promise.all([
    // 1. Get dom's GROUP tier config
    admin
      .from('vip_tiers')
      .select('threshold_type, threshold_value')
      .eq('dom_id', domId)
      .eq('tier_type', 'GROUP')
      .maybeSingle(),

    // 2. Get fan's tribute score for this dom this month
    fanProfileId
      ? admin
          .from('tribute_scores')
          .select('total_score')
          .eq('fan_id', fanProfileId)
          .eq('dom_id', domId)
          .eq('month_year', monthYear)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // 3. Get all scores for this dom this month (ordered DESC) for cutoff calculation
    admin
      .from('tribute_scores')
      .select('total_score')
      .eq('dom_id', domId)
      .eq('month_year', monthYear)
      .order('total_score', { ascending: false }),

    // 4. Count fans with active chat access for this dom
    admin
      .from('chat_access')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', domId)
      .eq('state', 'granted'),

    // 5. Check if fan already has access
    fanProfileId
      ? admin
          .from('chat_access')
          .select('id')
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
  const fanScore = fanScoreResult.data?.total_score ?? 0
  const allScores = (allScoresResult.data ?? []).map((s: { total_score: number }) => s.total_score)
  const fansWithAccess = accessCountResult.count ?? 0
  const hasChatAccess = !!hasAccessResult.data

  // Calculate cutoff score based on threshold type
  let cutoffScore = 100 // default minimum target when no fans exist yet
  if (tier.threshold_type === 'TOP_N') {
    const cutoffRank = Math.max(1, Math.floor(Number(tier.threshold_value)))
    if (allScores.length >= cutoffRank) {
      cutoffScore = allScores[cutoffRank - 1]
    } else if (allScores.length > 0) {
      // Fewer fans than slots — any score qualifies, but show a reasonable target
      cutoffScore = Math.max(1, allScores[allScores.length - 1])
    }
  } else if (tier.threshold_type === 'TOP_PERCENT') {
    const pct = Number(tier.threshold_value) / 100
    const cutoffRank = Math.max(1, Math.floor(allScores.length * pct))
    if (allScores.length > 0 && cutoffRank <= allScores.length) {
      cutoffScore = allScores[cutoffRank - 1]
    }
  }

  // Ensure cutoff is at least 1 for the progress bar to make sense
  cutoffScore = Math.max(cutoffScore, 1)

  return NextResponse.json({
    hasGroupTier: true,
    fanScore,
    cutoffScore,
    fansWithAccess,
    hasChatAccess,
  })
}
