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

  // Verify the completion belongs to this fan
  const { data: completion } = await supabase
    .from('task_completions')
    .select('id, fan_id, status, task_id')
    .eq('id', completionId)
    .maybeSingle()

  if (!completion || completion.fan_id !== profile.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (completion.status !== 'ACCEPTED') {
    return NextResponse.json({ error: 'Completion is not in ACCEPTED state' }, { status: 400 })
  }

  const { submissionText, evidenceUrl, repetitionCount } = await req.json()

  const { error } = await supabase
    .from('task_completions')
    .update({
      status: 'SUBMITTED',
      submission_text: submissionText ?? null,
      evidence_url: evidenceUrl ?? null,
      repetition_count: repetitionCount ?? null,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', completionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
