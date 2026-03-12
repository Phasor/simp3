import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// STUB: In Phase 10 this will be replaced by a Privy webhook handler.
// For now, we create the task_completion row directly (simulating a completed payment).

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, age_verified')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'FAN') {
    return NextResponse.json({ error: 'Only subs can accept tasks' }, { status: 403 })
  }

  // Age gate
  if (!profile.age_verified) {
    return NextResponse.json({ error: 'Age verification required', code: 'AGE_UNVERIFIED' }, { status: 403 })
  }

  const { taskId, tributeMessage, amountUsdc } = await req.json()

  if (!taskId || !tributeMessage) {
    return NextResponse.json({ error: 'taskId and tributeMessage are required' }, { status: 400 })
  }

  // Verify task exists and is published
  const { data: task } = await supabase
    .from('tasks')
    .select('id, task_type, price_usdc, creator_id, status')
    .eq('id', taskId)
    .maybeSingle()

  if (!task || task.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'Task not found or not available' }, { status: 404 })
  }

  // STUB payment: generate a fake tx hash
  const stubTxHash = `0xSTUB_${Date.now()}_${Math.random().toString(36).slice(2)}`

  // Determine initial status: CONTENT tasks auto-approve, others start as ACCEPTED
  const initialStatus = task.task_type === 'CONTENT' ? 'APPROVED' : 'ACCEPTED'

  const { data: completion, error } = await supabase
    .from('task_completions')
    .insert({
      task_id: taskId,
      fan_id: profile.id,
      status: initialStatus,
      payment_tx_hash: stubTxHash,
      amount_usdc: amountUsdc ?? task.price_usdc,
      tribute_message: tributeMessage,
      accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('task_completion insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also create a purchases row for accounting
  await supabase.from('purchases').insert({
    fan_id: profile.id,
    task_id: taskId,
    usdc_tx_hash: stubTxHash,
    amount_usdc: amountUsdc ?? task.price_usdc,
    purchase_type: 'TASK',
  })

  return NextResponse.json({
    completionId: completion.id,
    status: initialStatus,
    taskType: task.task_type,
  })
}
