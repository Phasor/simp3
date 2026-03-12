'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface SubRow {
  fan_id: string
  total_score: number
  spend_score: number
  task_score: number
  alias: string
  tier: string
}

const TIER_COLORS: Record<string, string> = {
  Elite: 'text-yellow-400',
  Dedicated: 'text-purple-400',
  Devoted: 'text-blue-400',
  'Verified Payer': 'text-green-400',
  'Tribute Initiate': 'text-gray-400',
  Unverified: 'text-gray-600',
}

function scoreTier(total: number) {
  if (total >= 5000) return 'Elite'
  if (total >= 1500) return 'Dedicated'
  if (total >= 500) return 'Devoted'
  if (total >= 100) return 'Verified Payer'
  if (total >= 1) return 'Tribute Initiate'
  return 'Unverified'
}

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function DashboardSubsPage() {
  const router = useRouter()
  const sb = supabase()
  const [subs, setSubs] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await sb
      .from('profiles')
      .select('id, user_type')
      .eq('auth_user_id', user.id)
      .single()

    if (!profile || profile.user_type !== 'CREATOR') { router.push('/'); return }

    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const { data: scores } = await sb
      .from('tribute_scores')
      .select('fan_id, total_score, spend_score, task_score')
      .eq('dom_id', profile.id)
      .eq('month_year', monthYear)
      .order('total_score', { ascending: false })

    if (!scores || scores.length === 0) { setLoading(false); return }

    // Fetch aliases for all fans
    const fanIds = scores.map(s => s.fan_id)
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, tribute_alias, display_name')
      .in('id', fanIds)

    const profileMap = Object.fromEntries(
      (profiles ?? []).map(p => [p.id, p.tribute_alias ?? p.display_name ?? 'Anonymous'])
    )

    setSubs(scores.map(s => ({
      fan_id: s.fan_id,
      total_score: s.total_score,
      spend_score: s.spend_score,
      task_score: s.task_score,
      alias: profileMap[s.fan_id] ?? 'Anonymous',
      tier: scoreTier(s.total_score),
    })))
    setLoading(false)
  }, [sb, router])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="min-h-screen bg-black text-white pb-10">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <h1 className="text-xl font-semibold mb-2">Sub Leaderboard</h1>
        <p className="text-xs text-gray-500 mb-6">Ranked by Tribute Score this month. Only visible to you.</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : subs.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-16">No sub scores yet this month.</p>
        ) : (
          <div className="space-y-2">
            {subs.map((sub, i) => (
              <div key={sub.fan_id} className="flex items-center gap-4 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3">
                <span className={`text-sm font-bold tabular-nums w-6 shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{sub.alias}</p>
                  <p className={`text-xs mt-0.5 ${TIER_COLORS[sub.tier] ?? 'text-gray-500'}`}>{sub.tier}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="text-sm font-bold text-white tabular-nums">{sub.total_score.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">pts</p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-gray-500">spend {sub.spend_score}</p>
                  <p className="text-xs text-gray-500">tasks {sub.task_score}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
