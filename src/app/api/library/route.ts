import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/library
 * Returns the authenticated sub's purchased content library.
 * Auth is handled server-side via cookies — no client auth state needed.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ items: [] })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ items: [] })

  const { data } = await supabase
    .from('task_completions')
    .select(`
      id,
      task_id,
      accepted_at,
      task:tasks!task_id (
        id, title, cover_image_url, media_id,
        media_asset:media_assets!media_id ( id, type, thumbnail_url, bunny_preview_url ),
        dom:profiles!creator_id ( display_name, handle, profile_picture_url )
      )
    `)
    .eq('fan_id', profile.id)
    .eq('status', 'APPROVED')
    .not('task_id', 'is', null)
    .order('accepted_at', { ascending: false })

  // Filter to content tasks only (those with a media_asset)
  const items = (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.task?.media_asset != null
  )

  return NextResponse.json({ items })
}
