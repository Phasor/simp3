import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'FAN') {
    return NextResponse.json({ error: 'Only subs can view the feed' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') ?? 'for-you'
  const LIMIT = 30

  if (tab === 'following') {
    // Get dom IDs this sub follows
    const { data: followRows } = await supabase
      .from('follows')
      .select('dom_id')
      .eq('fan_id', profile.id)

    const domIds = (followRows ?? []).map(r => r.dom_id)
    if (domIds.length === 0) return NextResponse.json({ items: [] })

    // Get published tasks from followed doms
    const { data: tasks } = await supabase
      .from('tasks')
      .select(`
        id, title, description, task_type, price_usdc, points,
        cover_image_url, created_at,
        dom:profiles!creator_id ( id, display_name, handle, profile_picture_url ),
        media_asset:media_assets!media_id ( type, thumbnail_url, bunny_preview_url )
      `)
      .in('creator_id', domIds)
      .eq('status', 'PUBLISHED')
      .order('created_at', { ascending: false })
      .limit(LIMIT)

    return NextResponse.json({ items: tasks ?? [] })
  }

  // For You — all published tasks, newest first
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id, title, description, task_type, price_usdc, points,
      cover_image_url, created_at,
      dom:profiles!creator_id ( id, display_name, handle, profile_picture_url ),
      media_asset:media_assets!media_id ( type, thumbnail_url, bunny_preview_url )
    `)
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  return NextResponse.json({ items: tasks ?? [] })
}
