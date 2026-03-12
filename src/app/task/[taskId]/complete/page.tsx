import { notFound, redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import TaskCompleteClient from './TaskCompleteClient'

type TaskType = 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT'

interface TaskWithDom {
  id: string
  title: string
  task_type: TaskType
  instructions: string | null
  repetition_phrase: string | null
  required_repetitions: number | null
  points: number
  dom: { display_name: string | null; handle: string | null }
}

interface Props {
  params: Promise<{ taskId: string }>
  searchParams: Promise<{ completion?: string }>
}

export default async function TaskCompletePage({ params, searchParams }: Props) {
  const { taskId } = await params
  const { completion: completionId } = await searchParams

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/task/${taskId}/complete`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'FAN') redirect('/')

  const { data: task } = await supabase
    .from('tasks')
    .select(`
      id, title, task_type, instructions, repetition_phrase, required_repetitions, points,
      dom:profiles!creator_id ( display_name, handle )
    `)
    .eq('id', taskId)
    .eq('status', 'PUBLISHED')
    .single()

  if (!task) notFound()

  const taskTyped = task as unknown as TaskWithDom
  const domHandle = (taskTyped.dom as { handle: string | null }).handle

  let completion = null
  if (completionId) {
    const { data } = await supabase
      .from('task_completions')
      .select('id, status')
      .eq('id', completionId)
      .eq('fan_id', profile.id)
      .eq('task_id', taskId)
      .single()
    completion = data
  }

  if (!completion || completion.status === 'APPROVED' || completion.status === 'REJECTED') {
    redirect(domHandle ? `/${domHandle}` : '/')
  }

  return <TaskCompleteClient task={taskTyped} completionId={completion.id} />
}
