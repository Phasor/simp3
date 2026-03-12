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

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const supabase = await supabaseFromCookies()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Use JPEG, PNG, WebP or GIF.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 400 })
  }

  // TODO: Phase 11 — Hive moderation check before upload
  // const hiveResult = await checkHiveModeration(buffer)
  // if (hiveResult.flagged) return NextResponse.json({ error: 'Content flagged' }, { status: 422 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${user.id}-${Date.now()}.${ext}`

  const result = await uploadToBunnyStorage(buffer, fileName, 'evidence')
  if (!result.success || !result.url) {
    return NextResponse.json({ error: result.error ?? 'Upload failed' }, { status: 500 })
  }

  return NextResponse.json({ url: result.url })
}
