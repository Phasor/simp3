'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import toast from 'react-hot-toast'

interface Txn {
  id: string
  date: string
  label: string
  amountUsdc: number
  type: 'task' | 'content' | 'payout'
}

export default function DashboardEarningsPage() {
  const router = useRouter()
  const { user, profile, resolved, supabase: sb } = useAuth()

  const [loading, setLoading] = useState(true)
  const [txns, setTxns] = useState<Txn[]>([])
  const [balance, setBalance] = useState(0)
  const [kycStatus, setKycStatus] = useState<string>('PENDING')
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutWallet, setPayoutWallet] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!resolved) return
    if (!user) { router.push('/login'); return }
    if (!profile) return // profile still loading
    if (profile.user_type !== 'CREATOR') { router.push('/'); return }

    try {
    setKycStatus(profile.kyc_status ?? 'PENDING')
    setPayoutWallet(profile.wallet_address ?? '')

    const [{ data: completions }, { data: unlocks }] = await Promise.all([
      sb.from('task_completions')
        .select('id, amount_usdc, accepted_at, tasks!inner(title, creator_id)')
        .eq('tasks.creator_id', profile!.id)
        .eq('status', 'APPROVED')
        .order('accepted_at', { ascending: false })
        .limit(50),

      sb.from('content_unlocks')
        .select('id, amount_usdc, unlocked_at, media_assets!inner(title, creator_id)')
        .eq('media_assets.creator_id', profile!.id)
        .order('unlocked_at', { ascending: false })
        .limit(50),
    ])

    const rows: Txn[] = [
      ...(completions ?? []).map(c => ({
        id: c.id,
        date: c.accepted_at,
        label: (c.tasks as unknown as { title: string })?.title ?? 'Task',
        amountUsdc: (c.amount_usdc as number) ?? 0,
        type: 'task' as const,
      })),
      ...(unlocks ?? []).map(u => ({
        id: u.id,
        date: u.unlocked_at,
        label: (u.media_assets as unknown as { title: string })?.title ?? 'Content unlock',
        amountUsdc: (u.amount_usdc as number) ?? 0,
        type: 'content' as const,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    setTxns(rows)
    setBalance(rows.reduce((s, t) => s + t.amountUsdc, 0))
    } catch (err) {
      console.error('Earnings fetch error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id, resolved, router, sb])

  useEffect(() => { fetchData() }, [fetchData])

  async function handlePayoutRequest() {
    const amount = parseFloat(payoutAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (amount > balance) { toast.error('Amount exceeds available balance'); return }

    if (kycStatus !== 'APPROVED') {
      // TODO: Phase 10 — redirect to real Sumsub flow
      // For now: stub — just tell them KYC is required
      toast.error('KYC verification required before first payout. Sumsub integration coming soon.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/payout/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsdc: amount, walletAddress: payoutWallet }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'KYC_REQUIRED') {
          toast.error('KYC verification required. Complete identity verification first.')
        } else {
          toast.error(data.error ?? 'Request failed')
        }
        return
      }
      toast.success('Payout requested. Processed within 24 hours.')
      setShowPayoutModal(false)
      setPayoutAmount('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-10">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <h1 className="text-xl font-semibold mb-6">Earnings</h1>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Balance + payout */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Available balance</p>
                <p className="text-3xl font-bold tabular-nums">${balance.toFixed(2)}</p>
                <p className="text-xs text-gray-600 mt-0.5">USDC</p>
              </div>
              <button
                onClick={() => setShowPayoutModal(true)}
                disabled={balance <= 0}
                className="px-5 py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                Request payout
              </button>
            </div>

            {/* KYC notice */}
            {kycStatus !== 'APPROVED' && (
              <div className="bg-yellow-950/30 border border-yellow-800/50 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
                <span className="text-yellow-500 text-lg shrink-0">⚠</span>
                <div>
                  <p className="text-sm text-yellow-400 font-medium">KYC verification required</p>
                  <p className="text-xs text-yellow-600 mt-0.5">Complete identity verification before requesting your first payout.</p>
                </div>
              </div>
            )}

            {/* Transaction history */}
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Transaction history</h2>
            {txns.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-10">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {txns.map(txn => (
                  <div key={txn.id} className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-sm shrink-0">
                      {txn.type === 'task' ? '📋' : '🖼'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{txn.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(txn.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-green-400 tabular-nums shrink-0">
                      +${txn.amountUsdc.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Payout modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowPayoutModal(false)}>
          <div className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">Request payout</h2>
            <p className="text-xs text-gray-500">Payouts are processed manually within 24 hours to your USDC wallet.</p>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Amount (USDC)</label>
              <input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                placeholder="0.00" min={1} step={0.01} max={balance}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600" />
              <p className="text-xs text-gray-600 mt-1">Available: ${balance.toFixed(2)} USDC</p>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">USDC wallet address (Base)</label>
              <input type="text" value={payoutWallet} onChange={e => setPayoutWallet(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-gray-600" />
            </div>

            <button
              onClick={handlePayoutRequest}
              disabled={submitting || !payoutAmount || !payoutWallet}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
