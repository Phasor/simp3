import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, display_name, tagline, about_text, vip_cta_text, wallet_address, banner_image_url, profile_picture_url')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR')
    return NextResponse.json({ error: 'Not a creator' }, { status: 403 })

  const { data: tiers } = await supabase
    .from('vip_tiers')
    .select('*')
    .eq('dom_id', profile.id)

  // Count qualifying subs per tier (30-day rolling spend >= min_spend_usdc)
  const admin = getAdmin()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const qualifyingCounts: Record<string, number> = {}

  for (const tier of tiers ?? []) {
    const minSpend = Number(tier.min_spend_usdc ?? 0)
    const { data: rows } = await admin
      .from('task_completions')
      .select('fan_id, amount_usdc, tasks!inner(creator_id)')
      .eq('tasks.creator_id', profile.id)
      .eq('status', 'APPROVED')
      .gte('reviewed_at', thirtyDaysAgo)

    // Sum spend per fan, count those meeting min spend
    const spendByFan: Record<string, number> = {}
    for (const r of rows ?? []) {
      spendByFan[r.fan_id] = (spendByFan[r.fan_id] ?? 0) + Number(r.amount_usdc ?? 0)
    }
    const qualifying = Object.values(spendByFan).filter(s => s >= minSpend)

    // Apply ranking filter
    let accessCount: number
    if (tier.threshold_type === 'TOP_PERCENT') {
      accessCount = Math.max(1, Math.floor(qualifying.length * Number(tier.threshold_value) / 100))
    } else {
      accessCount = Math.min(Number(tier.threshold_value), qualifying.length)
    }
    qualifyingCounts[tier.tier_type] = Math.min(accessCount, qualifying.length)
  }

  return NextResponse.json({
    profile,
    tiers: tiers ?? [],
    qualifyingCounts,
  })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR')
    return NextResponse.json({ error: 'Not a creator' }, { status: 403 })

  const body = await req.json()
  const { display_name, tagline, about_text, vip_cta_text, wallet_address } = body

  // Validate wallet address if provided
  if (wallet_address && !/^0x[0-9a-fA-F]{40}$/.test(wallet_address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: display_name || null,
      tagline: tagline || null,
      about_text: about_text || null,
      vip_cta_text: vip_cta_text || null,
      wallet_address: wallet_address || null,
    })
    .eq('id', profile.id)

  if (error) {
    console.error('Settings save error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
