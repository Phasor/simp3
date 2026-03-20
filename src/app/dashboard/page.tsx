'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface MonthBucket { month: string; usdc: number }

export default function DashboardOverview() {
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
    try {
      const res = await fetch('/api/dashboard/overview')
      if (!res.ok) return
      const data = await res.json()
      setStats(data.stats)
      setChartData(data.chartData)
    } catch (err) {
      console.error('Dashboard fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

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
