import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface Params { params: Promise<{ mediaId: string }> }

// PATCH body: { is_on_wall?: boolean, price_usdc?: number | null, title?: string }
export async function PATCH(req: Request, { params }: Params) {
  const { mediaId } = await params
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

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.is_on_wall !== undefined) updates.is_on_wall = body.is_on_wall
  if (body.price_usdc !== undefined) updates.price_usdc = body.price_usdc
  if (body.title !== undefined) updates.title = body.title

  const { error } = await supabase
    .from('media_assets')
    .update(updates)
    .eq('id', mediaId)
    .eq('creator_id', profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE — remove asset
export async function DELETE(_req: Request, { params }: Params) {
  const { mediaId } = await params
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

  const { error } = await supabase
    .from('media_assets')
    .delete()
    .eq('id', mediaId)
    .eq('creator_id', profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
