import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface Params { params: Promise<{ mediaId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { mediaId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, age_verified')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'FAN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!profile.age_verified) {
    return NextResponse.json({ error: 'Age verification required' }, { status: 403 })
  }

  // Fetch the asset
  const { data: asset } = await supabase
    .from('media_assets')
    .select('id, price_usdc, is_on_wall, creator_id')
    .eq('id', mediaId)
    .eq('is_on_wall', true)
    .maybeSingle()

  if (!asset) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

  // Check if already unlocked
  const { data: existing } = await supabase
    .from('content_unlocks')
    .select('id')
    .eq('fan_id', profile.id)
    .eq('media_id', mediaId)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, alreadyUnlocked: true })

  // TODO: Phase 10 — verify USDC payment via Privy webhook before inserting unlock
  // For now: stub — create unlock immediately (dev/testing mode)
  const stubTxHash = `0xstub_${Date.now()}`

  const { error } = await supabase
    .from('content_unlocks')
    .insert({
      fan_id: profile.id,
      media_id: mediaId,
      payment_tx_hash: stubTxHash,
      amount_usdc: asset.price_usdc ?? 0,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also record in purchases
  await supabase.from('purchases').insert({
    fan_id: profile.id,
    task_id: mediaId, // repurpose task_id field for media ID
    usdc_tx_hash: stubTxHash,
    amount_usdc: asset.price_usdc ?? 0,
    purchase_type: 'CONTENT_UNLOCK',
  })

  return NextResponse.json({ ok: true })
}
