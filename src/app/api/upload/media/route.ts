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
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]
const MAX_IMAGE_BYTES = 20 * 1024 * 1024  // 20 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024 // 500 MB

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

  // TODO: Phase 11 — Hive moderation check
  // const hiveResult = await checkHiveModeration(buffer)
  // if (hiveResult.flagged) return NextResponse.json({ error: 'Content flagged' }, { status: 422 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg')
  const fileName = `${profile.id}-${Date.now()}.${ext}`
  const folder = isVideo ? 'wall-videos' : 'wall-images'

  const result = await uploadToBunnyStorage(buffer, fileName, folder)
  if (!result.success || !result.url) {
    return NextResponse.json({ error: result.error ?? 'Upload failed' }, { status: 500 })
  }

  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME || `${process.env.BUNNY_STORAGE_ZONE}.b-cdn.net`
  const fullUrl = `https://${cdnHostname}/${folder}/${fileName}`

  const { data: asset, error } = await supabase
    .from('media_assets')
    .insert({
      creator_id: profile.id,
      type: isVideo ? 'VIDEO' : 'IMAGE',
      title: title || file.name.replace(/\.[^.]+$/, ''),
      bunny_url: fullUrl,
      bunny_preview_url: isVideo ? null : fullUrl, // for images preview = same URL
      thumbnail_url: isVideo ? null : fullUrl,
      is_on_wall: false,
      price_usdc: null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: asset.id, url: fullUrl })
}
