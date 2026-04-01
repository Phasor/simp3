import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Verify cron secret (Vercel cron sends this automatically)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all doms with configured tiers
  const { data: tiers } = await admin
    .from('vip_tiers')
    .select('dom_id')

  const domIds = [...new Set((tiers ?? []).map(t => t.dom_id))]

  if (domIds.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0 })
  }

  const results = await Promise.allSettled(
    domIds.map(domId => admin.rpc('recalculate_vip_access', { p_dom_id: domId }))
  )

  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ processed: domIds.length, failed })
}
