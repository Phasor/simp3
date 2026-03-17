import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { uploadToBunnyStorage } from '@/lib/utils/bunnynet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR') {
    return NextResponse.json({ error: 'Only doms can upload task covers' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Use JPEG, PNG, WebP or GIF.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 20 MB).' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${profile.id}-${Date.now()}.${ext}`

  const result = await uploadToBunnyStorage(buffer, fileName, 'task-covers')
  if (!result.success || !result.url) {
    return NextResponse.json({ error: result.error ?? 'Upload failed' }, { status: 500 })
  }

  return NextResponse.json({ url: result.url })
}
