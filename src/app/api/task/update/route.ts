import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(req: Request) {
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
  const { taskId, status, title, description, instructions, price_usdc, points, repetition_phrase, required_repetitions } = body
  if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

  // Build update payload — only include fields that were provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (status !== undefined) updates.status = status
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (instructions !== undefined) updates.instructions = instructions
  if (price_usdc !== undefined) updates.price_usdc = price_usdc === '' ? null : Number(price_usdc)
  if (points !== undefined) updates.points = Number(points) || 0
  if (repetition_phrase !== undefined) updates.repetition_phrase = repetition_phrase
  if (required_repetitions !== undefined) updates.required_repetitions = required_repetitions === '' ? null : Number(required_repetitions)

  const { error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('creator_id', profile.id)  // RLS: dom can only update their own tasks

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
