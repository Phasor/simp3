import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSupabase } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const revalidate = 300 // 5 min cache

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}

interface Props {
  params: Promise<{ subId: string }>
}

// Score tier thresholds (intentionally broad — don't reveal exact values to subs)
const TIERS = [
  { label: 'Elite', min: 5000, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30' },
  { label: 'Dedicated', min: 1500, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/30' },
  { label: 'Devoted', min: 500, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30' },
  { label: 'Verified Payer', min: 100, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30' },
  { label: 'Tribute Initiate', min: 1, color: 'text-gray-400', bg: 'bg-gray-400/10 border-gray-400/30' },
  { label: 'Unverified', min: 0, color: 'text-gray-600', bg: 'bg-gray-900 border-gray-800' },
] as const

function getTier(total: number) {
  return TIERS.find(t => total >= t.min) ?? TIERS[TIERS.length - 1]
}

// Spend bracket — show range, not exact
function spendBracket(spendScore: number): string {
  // spend_score = floor(usdc * 10), capped at 500
  // So usdc ≈ spendScore / 10
  const approx = spendScore / 10
  if (approx < 5) return 'Under $5'
  if (approx < 25) return '$5 – $25'
  if (approx < 100) return '$25 – $100'
  if (approx < 250) return '$100 – $250'
  if (approx < 500) return '$250 – $500'
  return '$500+'
}

export default async function SubScorePage({ params }: Props) {
  const { subId } = await params
  const supabase = await getServerSupabase()

  // Fetch the sub's profile (minimal — no personal info)
  const { data: sub } = await supabase
    .from('profiles')
    .select('id, user_type, created_at, tribute_alias')
    .eq('id', subId)
    .eq('user_type', 'FAN')
    .maybeSingle()

  if (!sub) notFound()

  // Aggregate scores across all doms for the current month
  const now = new Date()
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data: scores } = await supabase
    .from('tribute_scores')
    .select('total_score, spend_score, task_score, tenure_score, diversity_score')
    .eq('fan_id', subId)
    .eq('month_year', monthYear)

  // Aggregate across all doms
  const totalScore = (scores ?? []).reduce((sum, s) => sum + (s.total_score ?? 0), 0)
  const totalSpendScore = (scores ?? []).reduce((sum, s) => sum + (s.spend_score ?? 0), 0)
  const totalTaskScore = (scores ?? []).reduce((sum, s) => sum + (s.task_score ?? 0), 0)

  // Task completions count (all time)
  const { count: taskCount } = await supabase
    .from('task_completions')
    .select('id', { count: 'exact', head: true })
    .eq('fan_id', subId)
    .eq('status', 'APPROVED')

  const tier = getTier(totalScore)
  const memberSince = new Date(sub.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const alias = sub.tribute_alias ?? 'Anonymous'

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Wordmark */}
      <div className="px-5 py-4">
        <Link href="/" className="text-white font-bold text-lg tracking-tight">Tribute</Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm space-y-5">

          {/* Tier badge */}
          <div className={`rounded-2xl border px-5 py-4 text-center ${tier.bg}`}>
            <div className={`text-xs font-semibold uppercase tracking-widest mb-1 ${tier.color}`}>
              {tier.label}
            </div>
            <div className="text-3xl font-bold text-white tabular-nums">{totalScore.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Tribute Score · {monthYear}</div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Member since" value={memberSince} />
            <StatCard label="Tasks completed" value={String(taskCount ?? 0)} />
            <StatCard label="Spend (approx)" value={spendBracket(totalSpendScore)} />
            <StatCard label="Task score" value={String(totalTaskScore)} />
          </div>

          {/* Verified stamp */}
          <div className="border border-gray-800 rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Verified Tribute Member</div>
              <div className="text-xs text-gray-500 mt-0.5">Identity verified · Age verified</div>
            </div>
          </div>

          {/* Alias line */}
          <p className="text-center text-xs text-gray-600">
            Tribute alias: <span className="text-gray-400">{alias}</span>
          </p>

        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  )
}
