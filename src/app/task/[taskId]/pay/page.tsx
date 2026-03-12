import { notFound, redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import SendMomentClient from './SendMomentClient'

interface DomProfile {
  id: string
  display_name: string | null
  banner_image_url: string | null
  profile_picture_url: string | null
  handle: string | null
  vip_cta_text: string | null
}

interface TaskWithDom {
  id: string
  title: string
  description: string | null
  task_type: string
  price_usdc: number | null
  points: number
  dom: DomProfile
}

interface Props {
  params: Promise<{ taskId: string }>
}

export default async function SendMomentPage({ params }: Props) {
  const { taskId } = await params
  const supabase = await getServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/task/${taskId}/pay`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, age_verified')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'FAN') redirect('/')
  if (!profile.age_verified) redirect(`/onboarding?next=/task/${taskId}/pay`)

  const { data: task } = await supabase
    .from('tasks')
    .select(`
      id, title, description, task_type, price_usdc, points,
      dom:profiles!creator_id ( id, display_name, banner_image_url, profile_picture_url, handle, vip_cta_text )
    `)
    .eq('id', taskId)
    .eq('status', 'PUBLISHED')
    .single()

  if (!task) notFound()

  return <SendMomentClient task={task as unknown as TaskWithDom} fanId={profile.id} />
}
