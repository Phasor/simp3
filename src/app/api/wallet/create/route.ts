import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Base64 auth header for Privy REST API
function privyAuth() {
  const id = process.env.PRIVY_APP_ID!
  const secret = process.env.PRIVY_APP_SECRET!
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
}

function privyHeaders() {
  return {
    Authorization: privyAuth(),
    'privy-app-id': process.env.PRIVY_APP_ID!,
    'Content-Type': 'application/json',
  }
}

export async function POST(req: Request) {
  const PRIVY_APP_ID = process.env.PRIVY_APP_ID
  const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET

  const { profileId } = await req.json()
  if (!profileId) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 })
  }

  const supabase = await createClient()

  // If Privy credentials are configured, create a real server wallet
  if (PRIVY_APP_ID && PRIVY_APP_SECRET && !PRIVY_APP_SECRET.startsWith('privy_app_secret_PLACEHOLDER')) {
    try {
      const res = await fetch('https://auth.privy.io/api/v1/wallets', {
        method: 'POST',
        headers: privyHeaders(),
        body: JSON.stringify({ chain_type: 'ethereum' }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('[wallet/create] Privy API error:', res.status, err)
        return NextResponse.json({ error: 'Wallet creation failed' }, { status: 502 })
      }

      const wallet = await res.json()
      // wallet.id = Privy wallet cluster ID (walletcluster_...)
      // wallet.address = 0x Ethereum address

      await supabase
        .from('profiles')
        .update({
          wallet_address: wallet.address,
          privy_wallet_id: wallet.id,
        })
        .eq('id', profileId)

      console.log('[wallet/create] Created real Privy wallet:', wallet.address)
      return NextResponse.json({ walletAddress: wallet.address, method: 'PRIVY' })
    } catch (err) {
      console.error('[wallet/create] Unexpected error:', err)
      return NextResponse.json({ error: 'Wallet creation failed' }, { status: 500 })
    }
  }

  // Stub: generate a mock address for development (no Privy keys)
  console.warn('[wallet/create] PRIVY_APP_ID/PRIVY_APP_SECRET not set — using stub wallet')
  const walletAddress = `0x${Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')}`

  await supabase
    .from('profiles')
    .update({ wallet_address: walletAddress })
    .eq('id', profileId)

  return NextResponse.json({ walletAddress, method: 'STUB' })
}
