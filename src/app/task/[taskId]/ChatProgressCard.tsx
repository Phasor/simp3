'use client'

import { useState, useEffect } from 'react'

interface ChatProgressData {
  hasGroupTier: boolean
  fanScore?: number
  cutoffScore?: number
  fansWithAccess?: number
  hasChatAccess?: boolean
}

interface ChatProgressCardProps {
  domId: string
  domName: string
  taskPoints: number
  isAuthenticated: boolean
}

export default function ChatProgressCard({ domId, domName, taskPoints, isAuthenticated }: ChatProgressCardProps) {
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

  const { fanScore = 0, cutoffScore = 100, fansWithAccess = 0, hasChatAccess = false } = data

  if (hasChatAccess) {
    return (
      <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-sm font-semibold text-emerald-400">Chat Access Active</p>
        </div>
        <p className="text-xs text-white/40">
          You have VIP chat access with {domName}. Keep earning to maintain your rank.
        </p>
      </div>
    )
  }

  const scoreAfterTask = fanScore + taskPoints
  const progress = Math.min(scoreAfterTask / cutoffScore, 1)
  const remaining = Math.max(0, cutoffScore - scoreAfterTask)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Chat Access Progress</p>
        {taskPoints > 0 && (
          <span className="text-xs font-medium text-gold bg-gold/10 px-2 py-0.5 rounded-full">
            +{taskPoints} pts
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.max(progress * 100, 2)}%`,
              background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/30">
          <span>{isAuthenticated ? scoreAfterTask : 0} pts</span>
          <span>{cutoffScore} pts</span>
        </div>
      </div>

      {/* Motivational text */}
      <p className="text-sm text-white/50 leading-relaxed">
        {remaining > 0
          ? `${remaining} more points to chat 1-on-1 with ${domName} for 30 days`
          : `You're close! Complete this task to reach chat access with ${domName}`
        }
      </p>

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
