import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// STUB: Replace with real Privy embedded wallet creation when PRIVY_APP_ID/PRIVY_APP_SECRET are available.
// Real flow: POST to Privy API to create an embedded wallet for the user,
// then store the resulting wallet address on profiles.wallet_address.

export async function POST(req: Request) {
  const PRIVY_APP_ID = process.env.PRIVY_APP_ID
  const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET

  const { profileId } = await req.json()

  if (!profileId) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 })
  }

  let walletAddress: string
  let method = 'STUB'

  if (PRIVY_APP_ID && PRIVY_APP_SECRET) {
    // TODO: Real Privy integration
    // const res = await fetch('https://auth.privy.io/api/v1/wallets', {
    //   method: 'POST',
    //   headers: {
    //     Authorization: `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`,
    //     'privy-app-id': PRIVY_APP_ID,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ chain_type: 'ethereum' }),
    // })
    // const data = await res.json()
    // walletAddress = data.address
    // method = 'PRIVY'
    walletAddress = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
    method = 'PRIVY_STUB'
  } else {
    // Stub: generate a mock Base wallet address for development
    walletAddress = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
    method = 'STUB'
  }

  const supabase = await createClient()
  await supabase
    .from('profiles')
    .update({ wallet_address: walletAddress })
    .eq('id', profileId)

  return NextResponse.json({ walletAddress, method })
}
