import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST — request a payout
// Checks kyc_status; if not APPROVED redirects to Sumsub stub
// Otherwise flags the request for manual admin processing
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, kyc_status')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (profile.kyc_status !== 'APPROVED') {
    return NextResponse.json({ error: 'KYC_REQUIRED', kycStatus: profile.kyc_status }, { status: 403 })
  }

  const { amountUsdc, walletAddress } = await req.json()
  if (!amountUsdc || amountUsdc <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  // Manual payout — just log the request for admin to action within 24h
  // TODO: Phase 10 — automate via Privy wallet-to-wallet transfer
  const { error } = await supabase.from('purchases').insert({
    fan_id: profile.id,
    usdc_tx_hash: null,
    amount_usdc: -Math.abs(amountUsdc),  // negative = payout
    wallet_address: walletAddress ?? null,
    purchase_type: 'PAYOUT_REQUEST',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
