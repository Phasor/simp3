import { notFound, redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import ContentUnlockClient from './ContentUnlockClient'

interface Props {
  params: Promise<{ mediaId: string }>
}

export const dynamic = 'force-dynamic'

export default async function ContentUnlockPage({ params }: Props) {
  const { mediaId } = await params
  const supabase = await getServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/content/${mediaId}/unlock`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, age_verified')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'FAN') redirect('/')
  if (!profile.age_verified) redirect(`/onboarding?next=/content/${mediaId}/unlock`)

  const { data: asset } = await supabase
    .from('media_assets')
    .select(`
      id, title, type, bunny_preview_url, thumbnail_url, price_usdc,
      dom:profiles!creator_id ( display_name, handle, banner_image_url, vip_cta_text )
    `)
    .eq('id', mediaId)
    .eq('is_on_wall', true)
    .maybeSingle()

  if (!asset) notFound()

  // Already unlocked → go straight to content
  const { data: existing } = await supabase
    .from('content_unlocks')
    .select('id')
    .eq('fan_id', profile.id)
    .eq('media_id', mediaId)
    .maybeSingle()

  if (existing) redirect(`/content/${mediaId}`)

  return <ContentUnlockClient asset={asset as unknown as ContentAsset} fanId={profile.id} />
}

interface ContentAsset {
  id: string
  title: string | null
  type: string
  bunny_preview_url: string | null
  thumbnail_url: string | null
  price_usdc: number | null
  dom: { display_name: string | null; handle: string | null; banner_image_url: string | null; vip_cta_text: string | null }
}
