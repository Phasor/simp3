'use client'

import { useState, useEffect } from 'react'

interface ChatProgressData {
  hasGroupTier: boolean
  fanSpend30d?: number
  minSpendUsdc?: number
  meetsMinSpend?: boolean
  fanRank?: number | null
  cutoffCount?: number
  totalQualifying?: number
  meetsRanking?: boolean
  fansWithAccess?: number
  hasChatAccess?: boolean
}

interface ChatProgressCardProps {
  domId: string
  domName: string
  taskPriceUsdc: number
  isAuthenticated: boolean
}

export default function ChatProgressCard({ domId, domName, taskPriceUsdc, isAuthenticated }: ChatProgressCardProps) {
  const [data, setData] = useState<ChatProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/task/chat-progress/${domId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [domId])

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-2/3 mb-3" />
        <div className="h-3 bg-white/5 rounded-full w-full mb-3" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
      </div>
    )
  }

  if (!data?.hasGroupTier) return null

  const {
    fanSpend30d = 0,
    minSpendUsdc = 0,
    meetsMinSpend = false,
    fanRank = null,
    cutoffCount = 0,
    fansWithAccess = 0,
    hasChatAccess = false,
  } = data

  // Already has access
  if (hasChatAccess) {
    return (
      <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-sm font-semibold text-emerald-400">Chat Access Active</p>
        </div>
        <p className="text-xs text-white/40">
          You have VIP chat access with {domName}. Keep spending to maintain your rank.
        </p>
      </div>
    )
  }

  // Calculate progress toward min spend
  const spendAfterTask = fanSpend30d + taskPriceUsdc
  const spendProgress = minSpendUsdc > 0 ? Math.min(spendAfterTask / minSpendUsdc, 1) : 1
  const spendRemaining = Math.max(0, minSpendUsdc - spendAfterTask)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Chat Access Progress</p>
        {taskPriceUsdc > 0 && (
          <span className="text-xs font-medium text-gold bg-gold/10 px-2 py-0.5 rounded-full">
            +${taskPriceUsdc} USDC
          </span>
        )}
      </div>

      {/* Progress bar — toward min spend */}
      {minSpendUsdc > 0 && (
        <div className="space-y-2">
          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(spendProgress * 100, 2)}%`,
                background: meetsMinSpend
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #ec4899, #8b5cf6)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/30">
            <span>${isAuthenticated ? spendAfterTask.toFixed(2) : '0.00'} spent</span>
            <span>${minSpendUsdc} min</span>
          </div>
        </div>
      )}

      {/* Status text */}
      <p className="text-sm text-white/50 leading-relaxed">
        {!meetsMinSpend && spendRemaining > 0
          ? `Spend $${spendRemaining.toFixed(2)} more with ${domName} to qualify for chat access`
          : meetsMinSpend && fanRank !== null && fanRank <= cutoffCount
            ? `You qualify! Complete this task to secure chat access with ${domName}`
            : meetsMinSpend
              ? `You meet the minimum spend. Spend more to climb the rankings and earn access`
              : `Complete tasks with ${domName} to earn chat access`
        }
      </p>

      {/* Ranking info */}
      {meetsMinSpend && fanRank !== null && (
        <p className="text-xs text-white/30 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400" />
          Your rank: #{fanRank} — top {cutoffCount} get access
        </p>
      )}

      {/* Social proof */}
      {fansWithAccess > 0 && (
        <p className="text-xs text-white/30 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {fansWithAccess} {fansWithAccess === 1 ? 'fan' : 'fans'} already chatting
        </p>
      )}
    </div>
  )
}
