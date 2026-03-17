import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSupabase } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}

interface Props {
  params: Promise<{ subId: string }>
}

export default async function SubScorePage({ params }: Props) {
  const { subId } = await params
  const supabase = await getServerSupabase()

  const { data: sub } = await supabase
    .from('profiles')
    .select('id, user_type, created_at, tribute_alias')
    .eq('id', subId)
    .eq('user_type', 'FAN')
    .maybeSingle()

  if (!sub) notFound()

  const now = new Date()
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data: rawScores } = await supabase
    .from('tribute_scores')
    .select('dom_id, total_score, spend_score, task_score')
    .eq('fan_id', subId)
    .eq('month_year', monthYear)

  const domIds = (rawScores ?? []).map(s => s.dom_id)

  // Fetch dom profiles + VIP tier config in parallel
  const [{ data: domProfiles }, { data: vipTiers }] = await Promise.all([
    domIds.length
      ? supabase.from('profiles').select('id, display_name, handle, profile_picture_url').in('id', domIds)
      : Promise.resolve({ data: [] }),
    domIds.length
      ? supabase.from('vip_tiers').select('dom_id, tier_type, threshold_type, threshold_value').in('dom_id', domIds).eq('tier_type', 'GROUP')
      : Promise.resolve({ data: [] }),
  ])

  // For each dom: rank + total sub count
  const domScores = await Promise.all(
    (rawScores ?? []).map(async (s) => {
      const [{ count: higherCount }, { count: totalCount }] = await Promise.all([
        supabase
          .from('tribute_scores')
          .select('id', { count: 'exact', head: true })
          .eq('dom_id', s.dom_id)
          .eq('month_year', monthYear)
          .gt('total_score', s.total_score),
        supabase
          .from('tribute_scores')
          .select('id', { count: 'exact', head: true })
          .eq('dom_id', s.dom_id)
          .eq('month_year', monthYear),
      ])

      const rank = (higherCount ?? 0) + 1
      const total = totalCount ?? 0

      // Resolve VIP cutoff for this dom
      const tier = (vipTiers ?? []).find(t => t.dom_id === s.dom_id)
      let vipCutoff: number | null = null
      if (tier) {
        if (tier.threshold_type === 'TOP_PERCENT') {
          vipCutoff = Math.max(1, Math.floor(total * Number(tier.threshold_value) / 100))
        } else {
          vipCutoff = Number(tier.threshold_value)
        }
      }

      const isVip = vipCutoff !== null && rank <= vipCutoff

      // If not qualifying, fetch the score of the sub at the cutoff position
      let pointsNeeded: number | null = null
      if (!isVip && vipCutoff !== null) {
        const { data: cutoffRow } = await supabase
          .from('tribute_scores')
          .select('total_score')
          .eq('dom_id', s.dom_id)
          .eq('month_year', monthYear)
          .order('total_score', { ascending: false })
          .range(vipCutoff - 1, vipCutoff - 1)
          .maybeSingle()

        if (cutoffRow) {
          pointsNeeded = Math.max(1, cutoffRow.total_score - (s.total_score ?? 0) + 1)
        }
      }

      const dom = (domProfiles ?? []).find(p => p.id === s.dom_id)
      return {
        domId: s.dom_id,
        domName: dom?.display_name ?? 'Unknown',
        domHandle: dom?.handle ?? null,
        domAvatar: dom?.profile_picture_url ?? null,
        totalScore: s.total_score ?? 0,
        rank,
        vipCutoff,
        isVip,
        pointsNeeded,
      }
    })
  )

  domScores.sort((a, b) => b.totalScore - a.totalScore)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full md:w-[40vw] mx-auto px-5 pt-10 pb-24">

        {domScores.length === 0 ? (
          <p className="text-gray-600 text-sm text-center pt-16">No scores yet this month.</p>
        ) : (
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1 mb-3">
              Your Doms this month
            </h2>
            {domScores.map(ds => {
              const initials = ds.domName[0].toUpperCase()
              const avatarSrc = ds.domAvatar ? `/api/image/${ds.domAvatar.replace(/^\//, '')}` : null
              return (
                <div
                  key={ds.domId}
                  className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-800 flex items-center justify-center">
                    {avatarSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarSrc} alt={ds.domName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">{initials}</span>
                    )}
                  </div>

                  {/* Name + rank + VIP status */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {ds.domHandle ? (
                        <Link href={`/${ds.domHandle}`} className="hover:text-gray-300 transition-colors">
                          {ds.domName}
                        </Link>
                      ) : ds.domName}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Rank <span className="text-white font-semibold">#{ds.rank}</span> this month
                    </div>
                    <div className={`text-xs mt-1 font-medium ${
                      ds.vipCutoff === null
                        ? 'text-gray-600'
                        : ds.isVip
                          ? 'text-emerald-400'
                          : 'text-red-400'
                    }`}>
                      {ds.vipCutoff === null
                        ? 'VIP not configured'
                        : ds.isVip
                          ? 'Currently DO qualify for next month\'s VIP group chat'
                          : ds.pointsNeeded !== null
                            ? `Currently DO NOT qualify — need ${ds.pointsNeeded.toLocaleString()} more pts at this rate`
                            : 'Currently DO NOT qualify for next month\'s VIP group chat'}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-white tabular-nums">{ds.totalScore.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">pts</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
