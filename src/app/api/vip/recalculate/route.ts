import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST — recalculate VIP access for a dom
// Body: { domId?: string } — if omitted, uses caller's own profile (dom calling for herself)
// Can also be called by a cron job with a service-role key for automated monthly recalc
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
    return NextResponse.json({ error: 'Only doms can trigger VIP recalculation' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const domId: string = body.domId ?? profile.id

  // Only allow a dom to recalculate for herself
  if (domId !== profile.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.rpc('recalculate_vip_access', { p_dom_id: domId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
