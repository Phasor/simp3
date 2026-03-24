import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function adminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function isAdmin(): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return false
  const sb = await getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user?.email) return false
  return user.email.toLowerCase() === adminEmail.toLowerCase()
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type')
  const sb = adminSupabase()

  if (type === 'users') {
    const { data, error } = await sb
      .from('profiles')
      .select('id, email, user_type, handle, tribute_alias, created_at, age_verified, kyc_status, wallet_address, onboarding_completed')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'tasks') {
    const { data, error } = await sb
      .from('tasks')
      .select('id, title, task_type, status, price_usdc, points, created_at, creator_id, profiles(handle, display_name)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'transactions') {
    const { data, error } = await sb
      .from('purchases')
      .select('id, fan_id, task_id, amount_usdc, purchase_type, usdc_tx_hash, wallet_address, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'uploads') {
    const { data, error } = await sb
      .from('media_assets')
      .select('id, creator_id, type, title, mime_type, file_size, price_usdc, created_at, profiles(handle, display_name)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
