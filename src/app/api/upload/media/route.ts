import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { uploadToBunnyStorage } from '@/lib/utils/bunnynet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function supabaseFromCookies() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg']
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]
const MAX_IMAGE_BYTES = 20 * 1024 * 1024   // 20 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024  // 500 MB

async function uploadToBunnyStream(
  buffer: Buffer,
  title: string
): Promise<{ success: boolean; videoId?: string; playbackUrl?: string; thumbnailUrl?: string; error?: string }> {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID
  const apiKey = process.env.BUNNY_STREAM_API_KEY || process.env.BUNNY_API_KEY || process.env.NEXT_PUBLIC_BUNNY_API_KEY_TEST

  if (!libraryId || !apiKey) {
    console.warn('⚠️  BUNNY_STREAM_LIBRARY_ID or BUNNY_STREAM_API_KEY not set — skipping Bunny Stream upload')
    return { success: false, error: 'Bunny Stream not configured' }
  }

  // Step 1: create video placeholder
  const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { 'AccessKey': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '')
    return { success: false, error: `Bunny Stream create failed: ${createRes.status} ${text}` }
  }
  const { guid } = await createRes.json() as { guid: string }

  // Step 2: upload video bytes
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120_000) // 2 min for large uploads
  try {
    const uploadRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
      method: 'PUT',
      headers: { 'AccessKey': apiKey, 'Content-Type': 'application/octet-stream' },
      body: buffer as BodyInit,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '')
      return { success: false, error: `Bunny Stream upload failed: ${uploadRes.status} ${text}` }
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Upload timeout — try a smaller file' }
    }
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }

  const cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME || `${process.env.BUNNY_STREAM_PULL_ZONE || 'vz-stream'}.b-cdn.net`
  const playbackUrl = `https://${cdnHostname}/${guid}/playlist.m3u8`
  const thumbnailUrl = `https://${cdnHostname}/${guid}/thumbnail.jpg`

  return { success: true, videoId: guid, playbackUrl, thumbnailUrl }
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseFromCookies()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR') {
    return NextResponse.json({ error: 'Only doms can upload content' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null) || null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed.' }, { status: 400 })
  }

  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `File too large (max ${isVideo ? '500' : '20'} MB)` }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileTitle = title || file.name.replace(/\.[^.]+$/, '')

  if (isVideo) {
    // Videos → Bunny Stream
    const result = await uploadToBunnyStream(buffer, fileTitle)
    if (!result.success || !result.videoId) {
      return NextResponse.json({ error: result.error ?? 'Video upload failed' }, { status: 500 })
    }

    const { data: asset, error } = await supabase
      .from('media_assets')
      .insert({
        creator_id: profile.id,
        type: 'VIDEO',
        title: fileTitle,
        bunny_url: result.playbackUrl ?? null,
        bunny_preview_url: result.thumbnailUrl ?? null,
        thumbnail_url: result.thumbnailUrl ?? null,
        playback_ref: result.videoId,
        price_usdc: null,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: asset.id, url: result.playbackUrl, thumbnailUrl: result.thumbnailUrl })
  } else {
    // Images → Bunny Storage
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${profile.id}-${Date.now()}.${ext}`

    const result = await uploadToBunnyStorage(buffer, fileName, 'wall-images')
    if (!result.success || !result.url) {
      return NextResponse.json({ error: result.error ?? 'Upload failed' }, { status: 500 })
    }

    const cdnHostname = process.env.BUNNY_CDN_HOSTNAME || `${process.env.BUNNY_STORAGE_ZONE}.b-cdn.net`
    const fullUrl = `https://${cdnHostname}/wall-images/${fileName}`

    const { data: asset, error } = await supabase
      .from('media_assets')
      .insert({
        creator_id: profile.id,
        type: 'IMAGE',
        title: fileTitle,
        bunny_url: fullUrl,
        bunny_preview_url: fullUrl,
        thumbnail_url: fullUrl,
        price_usdc: null,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: asset.id, url: fullUrl })
  }
}
