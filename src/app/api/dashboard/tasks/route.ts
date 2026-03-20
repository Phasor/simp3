import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR')
    return NextResponse.json({ error: 'Not a creator' }, { status: 403 })

  const { data: tasksData } = await supabase
    .from('tasks')
    .select('id, title, task_type, status, price_usdc, points, cover_image_url, description, instructions, repetition_phrase, required_repetitions, created_at')
    .eq('creator_id', profile.id)
    .order('created_at', { ascending: false })

  const taskIds = (tasksData ?? []).map(t => t.id)

  let completionsData: unknown[] = []
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from('task_completions')
      .select(`
        id, status, tribute_message, submission_text, evidence_url, repetition_count,
        accepted_at, submitted_at,
        tasks ( title, task_type ),
        fan_profile:profiles!fan_id ( tribute_alias, display_name )
      `)
      .in('task_id', taskIds)
      .eq('status', 'SUBMITTED')
      .order('submitted_at', { ascending: true })

    completionsData = data ?? []
  }

  return NextResponse.json({ tasks: tasksData ?? [], completions: completionsData })
}
