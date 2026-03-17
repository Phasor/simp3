import { notFound } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import TaskDetailClient from './TaskDetailClient'

export const revalidate = 60

interface Props {
  params: Promise<{ taskId: string }>
}

interface TaskRow {
  id: string
  title: string
  description: string | null
  task_type: string | null
  status: string | null
  price_usdc: number | null
  points: number
  instructions: string | null
  repetition_phrase: string | null
  required_repetitions: number | null
  cover_image_url: string | null
  media_id: string | null
  media_asset: {
    type: string | null
    thumbnail_url: string | null
    bunny_preview_url: string | null
  } | null
  dom: {
    id: string
    display_name: string | null
    handle: string | null
    tagline: string | null
    banner_image_url: string | null
    profile_picture_url: string | null
    vip_cta_text: string | null
  }
}

export default async function TaskDetailPage({ params }: Props) {
  const { taskId } = await params
  const supabase = await getServerSupabase()

  const { data: task } = await supabase
    .from('tasks')
    .select(`
      id, title, description, task_type, status, price_usdc, points, instructions,
      repetition_phrase, required_repetitions, cover_image_url, media_id,
      dom:profiles!creator_id (
        id, display_name, handle, tagline,
        banner_image_url, profile_picture_url, vip_cta_text
      ),
      media_asset:media_assets!media_id (
        type, thumbnail_url, bunny_preview_url
      )
    `)
    .eq('id', taskId)
    .single()

  if (!task) notFound()

  return <TaskDetailClient task={task as unknown as TaskRow} />
}
