import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface Params { params: Promise<{ completionId: string }> }

// PATCH body: { action: 'approve' | 'reject', feedback?: string }
export async function PATCH(req: Request, { params }: Params) {
  const { completionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'CREATOR') {
    return NextResponse.json({ error: 'Only doms can review completions' }, { status: 403 })
  }

  // Verify the completion is on a task owned by this dom
  const { data: completion } = await supabase
    .from('task_completions')
    .select('id, status, task_id, fan_id, tasks!inner(creator_id)')
    .eq('id', completionId)
    .maybeSingle()

  if (!completion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Type assertion for joined table
  const task = completion.tasks as unknown as { creator_id: string }
  if (task.creator_id !== profile.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (completion.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'Completion is not in SUBMITTED state' }, { status: 400 })
  }

  const { action, feedback } = await req.json()
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const { error } = await supabase
    .from('task_completions')
    .update({
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      dom_feedback: feedback ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', completionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // recalculate_tribute_score() fires automatically via DB trigger on APPROVED
  // Instant VIP qualification check (fire-and-forget — don't block the response)
  if (action === 'approve') {
    supabase.rpc('check_fan_vip_qualification', {
      p_fan_id: completion.fan_id,
      p_dom_id: profile.id,
    }).then(({ error }) => { if (error) console.error('VIP qualification check failed:', error) })
  }

  return NextResponse.json({ ok: true })
}
