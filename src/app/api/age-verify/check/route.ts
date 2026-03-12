import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// STUB: Replace with real Verifymy API call when VERIFYMY_API_KEY is available.
// Verifymy performs a silent, email-based age check (~85% pass rate).
// On real integration: POST to Verifymy API with email, await async webhook callback,
// or poll for result. On pass, set age_verified = true on the profile.

export async function POST(req: Request) {
  const VERIFYMY_API_KEY = process.env.VERIFYMY_API_KEY

  const { email, profileId } = await req.json()

  if (!email || !profileId) {
    return NextResponse.json({ error: 'email and profileId required' }, { status: 400 })
  }

  let verified = false
  let method = 'STUB'

  if (VERIFYMY_API_KEY) {
    // TODO: Real Verifymy integration
    // const res = await fetch('https://api.verifymy.io/v1/check', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${VERIFYMY_API_KEY}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email }),
    // })
    // const data = await res.json()
    // verified = data.result === 'pass'
    // method = 'VERIFYMY'
    verified = true
    method = 'VERIFYMY_STUB'
  } else {
    // Stub: auto-pass so development flow works end-to-end
    verified = true
    method = 'STUB'
  }

  if (verified) {
    const supabase = await createClient()
    await supabase
      .from('profiles')
      .update({ age_verified: true, age_verified_at: new Date().toISOString() })
      .eq('id', profileId)
  }

  return NextResponse.json({ verified, method })
}
