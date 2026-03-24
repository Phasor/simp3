import { notFound } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import DomProfileClient from './DomProfileClient'

export const revalidate = 60

interface Props {
  params: Promise<{ domHandle: string }>
}

export default async function DomProfilePage({ params }: Props) {
  const { domHandle } = await params
  const supabase = await getServerSupabase()

  // Fetch dom profile by handle
  const { data: dom } = await supabase
    .from('profiles')
    .select('id, display_name, tagline, bio, banner_image_url, profile_picture_url, vip_cta_text, handle')
    .eq('handle', domHandle)
    .eq('user_type', 'CREATOR')
    .maybeSingle()

  if (!dom) notFound()

  // Fetch published tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, task_type, price_usdc, points')
    .eq('creator_id', dom.id)
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })

  // Fetch published CONTENT tasks (for sale content)
  const { data: contentTasks } = await supabase
    .from('tasks')
    .select('id, title, price_usdc, media_asset:media_assets!media_id(type, thumbnail_url, bunny_preview_url)')
    .eq('creator_id', dom.id)
    .eq('status', 'PUBLISHED')
    .eq('task_type', 'CONTENT')
    .order('created_at', { ascending: false })

  // Fetch VIP tier configs
  const [{ data: groupTier }, { data: privateTier }] = await Promise.all([
    supabase
      .from('vip_tiers')
      .select('threshold_type, threshold_value')
      .eq('dom_id', dom.id)
      .eq('tier_type', 'GROUP')
      .maybeSingle(),
    supabase
      .from('vip_tiers')
      .select('threshold_type, threshold_value')
      .eq('dom_id', dom.id)
      .eq('tier_type', 'PRIVATE')
      .maybeSingle(),
  ])

  // Follower count
  const { count: followerCount } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('dom_id', dom.id)

  // Is current viewer following this dom?
  const { data: { user } } = await supabase.auth.getUser()
  let isFollowing = false
  if (user) {
    const { data: fanProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('user_type', 'FAN')
      .maybeSingle()
    if (fanProfile) {
      const { data: follow } = await supabase
        .from('follows')
        .select('id')
        .eq('fan_id', fanProfile.id)
        .eq('dom_id', dom.id)
        .maybeSingle()
      isFollowing = !!follow
    }
  }

  return (
    <DomProfileClient
      dom={dom}
      tasks={tasks ?? []}
      contentTasks={contentTasks ?? []}
      groupTier={groupTier ?? null}
      privateTier={privateTier ?? null}
      followerCount={followerCount ?? 0}
      initialIsFollowing={isFollowing}
    />
  )
}
