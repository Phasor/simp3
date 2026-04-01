import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// GET — fetch dom's current vip tiers
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: tiers } = await supabase
    .from('vip_tiers')
    .select('*')
    .eq('dom_id', profile.id)

  return NextResponse.json({ tiers: tiers ?? [] })
}

// POST — upsert a tier config
// Body: { tier_type: 'GROUP' | 'PRIVATE', threshold_type: 'TOP_PERCENT' | 'TOP_N', threshold_value: number }
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tier_type, threshold_type, threshold_value, min_spend_usdc } = await req.json()

  if (!tier_type || !threshold_type || threshold_value == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!['GROUP', 'PRIVATE'].includes(tier_type)) {
    return NextResponse.json({ error: 'Invalid tier_type' }, { status: 400 })
  }
  if (!['TOP_PERCENT', 'TOP_N'].includes(threshold_type)) {
    return NextResponse.json({ error: 'Invalid threshold_type' }, { status: 400 })
  }
  if (typeof threshold_value !== 'number' || threshold_value <= 0) {
    return NextResponse.json({ error: 'threshold_value must be a positive number' }, { status: 400 })
  }
  if (min_spend_usdc != null && (typeof min_spend_usdc !== 'number' || min_spend_usdc < 0)) {
    return NextResponse.json({ error: 'min_spend_usdc must be a non-negative number' }, { status: 400 })
  }

  const { error } = await supabase
    .from('vip_tiers')
    .upsert(
      {
        dom_id: profile.id,
        tier_type,
        threshold_type,
        threshold_value,
        min_spend_usdc: min_spend_usdc ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'dom_id,tier_type' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
