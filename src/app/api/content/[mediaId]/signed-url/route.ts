import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

/**
 * GET /api/content/[mediaId]/signed-url
 * Returns a short-TTL signed Bunny URL for content the sub has already unlocked.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 401 })

  // Fetch asset
  const { data: asset } = await supabase
    .from('media_assets')
    .select('id, type, bunny_url, playback_ref, creator_id')
    .eq('id', mediaId)
    .maybeSingle()

  if (!asset || !asset.bunny_url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Dom can always view their own content
  const isOwner = profile.user_type === 'CREATOR' && asset.creator_id === profile.id

  if (!isOwner) {
    // Check the sub has paid — either via content_unlocks or an approved task_completion
    const { data: unlock } = await supabase
      .from('content_unlocks')
      .select('id')
      .eq('fan_id', profile.id)
      .eq('media_id', mediaId)
      .maybeSingle()

    if (!unlock) {
      // Also check task_completions for CONTENT tasks that reference this media
      const { data: completions } = await supabase
        .from('task_completions')
        .select('id, task:tasks!task_id ( media_id )')
        .eq('fan_id', profile.id)
        .eq('status', 'APPROVED')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasAccess = (completions ?? []).some((c: any) => c.task?.media_id === mediaId)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Not unlocked' }, { status: 403 })
      }
    }
  }

  // For videos: return Bunny Stream embed URL (HLS m3u8 can't play natively in Chrome)
  // For images: return signed CDN URL
  if (asset.type === 'VIDEO' && asset.playback_ref) {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID
    const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${asset.playback_ref}?autoplay=true`
    return NextResponse.json({ url: embedUrl, type: 'VIDEO', embed: true })
  }

  const proxyUrl = getBunnyStorageUrl(asset.bunny_url)
  return NextResponse.json({ url: proxyUrl, type: asset.type, embed: false })
}
