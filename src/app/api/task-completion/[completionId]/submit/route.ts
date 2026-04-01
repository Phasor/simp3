import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface Params { params: Promise<{ completionId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { completionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the completion belongs to this fan (join task_type for REPETITION auto-approve)
  const { data: completion } = await supabase
    .from('task_completions')
    .select('id, fan_id, status, task_id, tasks!inner(task_type, creator_id)')
    .eq('id', completionId)
    .maybeSingle()

  if (!completion || completion.fan_id !== profile.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (completion.status !== 'ACCEPTED') {
    return NextResponse.json({ error: 'Completion is not in ACCEPTED state' }, { status: 400 })
  }

  const { submissionText, evidenceUrl, repetitionCount } = await req.json()

  // REPETITION tasks auto-approve on submit; others go to dom review
  const task = completion.tasks as unknown as { task_type: string; creator_id: string }
  const newStatus = task.task_type === 'REPETITION' ? 'APPROVED' : 'SUBMITTED'

  const { error } = await supabase
    .from('task_completions')
    .update({
      status: newStatus,
      submission_text: submissionText ?? null,
      evidence_url: evidenceUrl ?? null,
      repetition_count: repetitionCount ?? null,
      submitted_at: new Date().toISOString(),
      reviewed_at: task.task_type === 'REPETITION' ? new Date().toISOString() : null,
    })
    .eq('id', completionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Instant VIP qualification check for auto-approved tasks (fire-and-forget)
  if (newStatus === 'APPROVED') {
    supabase.rpc('check_fan_vip_qualification', {
      p_fan_id: profile.id,
      p_dom_id: task.creator_id,
    }).then(({ error }) => { if (error) console.error('VIP qualification check failed:', error) })
  }

  return NextResponse.json({ ok: true })
}
