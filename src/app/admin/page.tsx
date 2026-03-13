'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type Tab = 'users' | 'tasks' | 'transactions' | 'uploads'

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'uploads', label: 'Uploads' },
]

function fmt(val: unknown) {
  if (val === null || val === undefined) return <span className="text-gray-600">—</span>
  if (typeof val === 'boolean') return val ? <span className="text-green-400">✓</span> : <span className="text-red-500">✗</span>
  if (typeof val === 'object') return <span className="text-gray-400">{JSON.stringify(val)}</span>
  const s = String(val)
  // truncate long strings
  if (s.length > 40) return <span title={s}>{s.slice(0, 38)}…</span>
  return <span>{s}</span>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtBytes(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Users table ─────────────────────────────────────────────────────────────
function UsersTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-800">
          <th className="pb-2 pr-4">Email</th>
          <th className="pb-2 pr-4">Role</th>
          <th className="pb-2 pr-4">Handle / Alias</th>
          <th className="pb-2 pr-4">Age ✓</th>
          <th className="pb-2 pr-4">KYC</th>
          <th className="pb-2 pr-4">Onboarded</th>
          <th className="pb-2">Joined</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id as string} className="border-b border-gray-900 hover:bg-gray-950">
            <td className="py-2 pr-4 font-mono text-xs text-gray-300">{fmt(r.email)}</td>
            <td className="py-2 pr-4">
              <span className={r.user_type === 'CREATOR' ? 'text-pink-400' : 'text-blue-400'}>
                {r.user_type === 'CREATOR' ? 'Dom' : 'Sub'}
              </span>
            </td>
            <td className="py-2 pr-4 text-gray-300">{fmt(r.handle ?? r.tribute_alias)}</td>
            <td className="py-2 pr-4">{fmt(r.age_verified)}</td>
            <td className="py-2 pr-4">
              <span className={
                r.kyc_status === 'APPROVED' ? 'text-green-400' :
                r.kyc_status === 'REJECTED' ? 'text-red-400' :
                r.kyc_status === 'SUBMITTED' ? 'text-yellow-400' : 'text-gray-500'
              }>
                {String(r.kyc_status ?? 'PENDING')}
              </span>
            </td>
            <td className="py-2 pr-4">{fmt(r.onboarding_completed)}</td>
            <td className="py-2 text-gray-500 text-xs">{fmtDate(r.created_at as string)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tasks table ──────────────────────────────────────────────────────────────
function TasksTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-800">
          <th className="pb-2 pr-4">Title</th>
          <th className="pb-2 pr-4">Dom</th>
          <th className="pb-2 pr-4">Type</th>
          <th className="pb-2 pr-4">Status</th>
          <th className="pb-2 pr-4">Price (USDC)</th>
          <th className="pb-2 pr-4">Points</th>
          <th className="pb-2">Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const profile = r.profiles as Record<string, unknown> | null
          return (
            <tr key={r.id as string} className="border-b border-gray-900 hover:bg-gray-950">
              <td className="py-2 pr-4 text-gray-200">{fmt(r.title)}</td>
              <td className="py-2 pr-4 text-pink-400">{profile?.handle ? `@${profile.handle}` : fmt(profile?.display_name)}</td>
              <td className="py-2 pr-4 text-gray-400 text-xs">{fmt(r.task_type)}</td>
              <td className="py-2 pr-4">
                <span className={
                  r.status === 'PUBLISHED' ? 'text-green-400' :
                  r.status === 'ARCHIVED' ? 'text-gray-500' : 'text-yellow-400'
                }>
                  {String(r.status ?? '—')}
                </span>
              </td>
              <td className="py-2 pr-4 font-mono">{r.price_usdc ? `$${r.price_usdc}` : '—'}</td>
              <td className="py-2 pr-4 text-gray-400">{fmt(r.points)}</td>
              <td className="py-2 text-gray-500 text-xs">{fmtDate(r.created_at as string)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Transactions table ───────────────────────────────────────────────────────
function TransactionsTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-800">
          <th className="pb-2 pr-4">Type</th>
          <th className="pb-2 pr-4">Amount (USDC)</th>
          <th className="pb-2 pr-4">Task ID</th>
          <th className="pb-2 pr-4">Wallet</th>
          <th className="pb-2 pr-4">Tx Hash</th>
          <th className="pb-2">Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id as string} className="border-b border-gray-900 hover:bg-gray-950">
            <td className="py-2 pr-4 text-gray-300">{fmt(r.purchase_type)}</td>
            <td className="py-2 pr-4 font-mono text-green-400">{r.amount_usdc ? `$${r.amount_usdc}` : '—'}</td>
            <td className="py-2 pr-4 font-mono text-xs text-gray-500">{fmt(r.task_id)}</td>
            <td className="py-2 pr-4 font-mono text-xs text-gray-500">{fmt(r.wallet_address)}</td>
            <td className="py-2 pr-4 font-mono text-xs text-gray-500">{fmt(r.usdc_tx_hash)}</td>
            <td className="py-2 text-gray-500 text-xs">{fmtDate(r.created_at as string)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Uploads table ────────────────────────────────────────────────────────────
function UploadsTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-800">
          <th className="pb-2 pr-4">Title</th>
          <th className="pb-2 pr-4">Dom</th>
          <th className="pb-2 pr-4">Type</th>
          <th className="pb-2 pr-4">MIME</th>
          <th className="pb-2 pr-4">Size</th>
          <th className="pb-2 pr-4">On Wall</th>
          <th className="pb-2 pr-4">Price</th>
          <th className="pb-2">Uploaded</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const profile = r.profiles as Record<string, unknown> | null
          return (
            <tr key={r.id as string} className="border-b border-gray-900 hover:bg-gray-950">
              <td className="py-2 pr-4 text-gray-200">{fmt(r.title)}</td>
              <td className="py-2 pr-4 text-pink-400">{profile?.handle ? `@${profile.handle}` : fmt(profile?.display_name)}</td>
              <td className="py-2 pr-4 text-gray-400">{fmt(r.type)}</td>
              <td className="py-2 pr-4 font-mono text-xs text-gray-500">{fmt(r.mime_type)}</td>
              <td className="py-2 pr-4 text-gray-400">{fmtBytes(r.file_size as number)}</td>
              <td className="py-2 pr-4">{fmt(r.is_on_wall)}</td>
              <td className="py-2 pr-4 font-mono">{r.price_usdc ? `$${r.price_usdc}` : '—'}</td>
              <td className="py-2 text-gray-500 text-xs">{fmtDate(r.created_at as string)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)

  // Auth check
  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login')
      else setAuthed(true)
    })
  }, [router])

  const fetchTab = useCallback(async (tab: Tab) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/data?type=${tab}`)
      if (res.status === 401) {
        setError('Access denied. Make sure ADMIN_EMAIL is set and you are logged in with that account.')
        setData([])
        return
      }
      if (!res.ok) {
        setError('Failed to load data')
        setData([])
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) fetchTab(activeTab)
  }, [authed, activeTab, fetchTab])

  if (!authed) return null

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-white font-bold tracking-tight">Tribute</span>
          <span className="text-gray-600 text-xs px-2 py-0.5 bg-gray-900 rounded">ADMIN</span>
        </div>
        <span className="text-gray-500 text-xs">{data.length} rows</span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-6 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-white text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-950 border border-red-800 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-600">Loading…</div>
        ) : data.length === 0 && !error ? (
          <div className="flex items-center justify-center h-48 text-gray-600">No data</div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'users' && <UsersTable rows={data} />}
            {activeTab === 'tasks' && <TasksTable rows={data} />}
            {activeTab === 'transactions' && <TransactionsTable rows={data} />}
            {activeTab === 'uploads' && <UploadsTable rows={data} />}
          </div>
        )}
      </div>
    </div>
  )
}
