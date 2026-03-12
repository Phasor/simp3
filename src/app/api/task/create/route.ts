import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const {
    title,
    description,
    task_type,
    price_usdc,
    points,
    instructions,
    repetition_phrase,
    required_repetitions,
    media_id,
    status = 'PUBLISHED',
  } = body

  if (!title || !task_type) {
    return NextResponse.json({ error: 'title and task_type are required' }, { status: 400 })
  }

  // Generate a slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) + '-' + Date.now()

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      creator_id: profile.id,
      slug,
      title,
      description: description || null,
      task_type,
      price_usdc: price_usdc ?? null,
      points: points ?? 0,
      instructions: instructions || null,
      repetition_phrase: repetition_phrase || null,
      required_repetitions: required_repetitions ?? null,
      media_id: media_id || null,
      status,
      active: status === 'PUBLISHED',
    })
    .select('id')
    .single()

  if (error) {
    console.error('task create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ taskId: task.id })
}
