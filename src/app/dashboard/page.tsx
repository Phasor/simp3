'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface MonthBucket { month: string; usdc: number }

export default function DashboardOverview() {
  const router = useRouter()
  const { user, profile, resolved, supabase: sb } = useAuth()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalEarnings: 0,
    thisMonthEarnings: 0,
    activeTasks: 0,
    vipCount: 0,
    vvipCount: 0,
  })
  const [chartData, setChartData] = useState<MonthBucket[]>([])

  const fetchData = useCallback(async () => {
    if (!resolved) return
    if (!user) { router.push('/login'); return }
    if (!profile) return // profile still loading
    if (profile.user_type !== 'CREATOR') { router.push('/'); return }

    try {
      const domId = profile.id
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const [
        { data: completions },
        { data: unlocks },
        { count: activeTasks },
        { data: vipAccess },
      ] = await Promise.all([
        sb.from('task_completions')
          .select('amount_usdc, accepted_at, tasks!inner(creator_id)')
          .eq('tasks.creator_id', domId)
          .eq('status', 'APPROVED'),

        sb.from('content_unlocks')
          .select('amount_usdc, unlocked_at, media_assets!inner(creator_id)')
          .eq('media_assets.creator_id', domId),

        sb.from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', domId)
          .eq('status', 'PUBLISHED'),

        sb.from('chat_access')
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

      setStats({ totalEarnings, thisMonthEarnings, activeTasks: activeTasks ?? 0, vipCount, vvipCount })

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
      const chart = Object.entries(buckets).map(([key, usdc]) => {
        const [yr, mo] = key.split('-')
        const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        return { month: label, usdc: Math.round(usdc * 100) / 100 }
      })
      setChartData(chart)
    } catch (err) {
      console.error('Dashboard fetchData error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id, resolved, router, sb])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white pb-10">
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <h1 className="text-xl font-semibold">Overview</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total earnings" value={`$${stats.totalEarnings.toFixed(2)}`} sub="USDC lifetime" />
          <StatCard label="This month" value={`$${stats.thisMonthEarnings.toFixed(2)}`} sub="USDC" />
          <StatCard label="Active tasks" value={String(stats.activeTasks)} />
          <StatCard label="VIP members" value={String(stats.vipCount)} sub="group channel" />
          <StatCard label="VVIP members" value={String(stats.vvipCount)} sub="private DMs" />
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Monthly earnings (USDC)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                itemStyle={{ color: '#fff', fontWeight: 600 }}
                formatter={(v: number) => [`$${v.toFixed(2)} USDC`, 'Earnings']}
              />
              <Bar dataKey="usdc" fill="#ffffff" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Manage tasks', href: '/dashboard/tasks', icon: '📋' },
            { label: 'Sub leaderboard', href: '/dashboard/subs', icon: '🏆' },
            { label: 'Earnings & payouts', href: '/dashboard/earnings', icon: '💰' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-600 transition-colors">
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-medium text-white">{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}
