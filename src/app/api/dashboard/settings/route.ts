import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const [{ data: tiers }, { count }] = await Promise.all([
    supabase.from('vip_tiers').select('*').eq('dom_id', profile.id),
    supabase.from('tribute_scores')
      .select('fan_id', { count: 'exact', head: true })
      .eq('dom_id', profile.id),
  ])

  return NextResponse.json({
    profile,
    tiers: tiers ?? [],
    subCount: count ?? 0,
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
