import { notFound, redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { signBunnyUrl } from '@/lib/utils/bunnySign'

interface Props {
  params: Promise<{ mediaId: string }>
}

export const dynamic = 'force-dynamic'

export default async function ContentPage({ params }: Props) {
  const { mediaId } = await params
  const supabase = await getServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/content/${mediaId}`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Fetch asset
  const { data: asset } = await supabase
    .from('media_assets')
    .select('id, type, bunny_url, bunny_preview_url, title, creator_id, price_usdc')
    .eq('id', mediaId)
    .maybeSingle()

  if (!asset) notFound()

  // Dom can always view their own content
  const isOwner = profile.user_type === 'CREATOR' && asset.creator_id === profile.id

  if (!isOwner) {
    // Check fan has an unlock
    const { data: unlock } = await supabase
      .from('content_unlocks')
      .select('id')
      .eq('fan_id', profile.id)
      .eq('media_id', mediaId)
      .maybeSingle()

    if (!unlock) {
      // Not unlocked — redirect back with a query param so the profile page can show unlock prompt
      const { data: dom } = await supabase
        .from('profiles')
        .select('handle')
        .eq('id', asset.creator_id)
        .single()
      redirect(dom?.handle ? `/${dom.handle}?unlock=${mediaId}` : '/')
    }
  }

  // Generate a short-TTL signed Bunny URL — never exposed to unauthenticated users
  const signedUrl = asset.bunny_url ? signBunnyUrl(asset.bunny_url, 300) : null

  if (!signedUrl) notFound()

  // For images/video we redirect to the signed CDN URL directly —
  // the browser fetches it, Next.js never proxies the bytes.
  if (asset.type === 'IMAGE') {
    redirect(signedUrl)
  }

  // For video: render a minimal page that embeds the signed URL
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-white font-semibold mb-4 text-center">{asset.title ?? 'Unlocked content'}</h1>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={signedUrl}
          controls
          playsInline
          className="w-full rounded-2xl bg-gray-950"
        />
        <p className="text-center text-xs text-gray-600 mt-4">
          This link expires in 5 minutes. Refresh to renew.
        </p>
      </div>
    </div>
  )
}
