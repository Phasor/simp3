import { notFound, redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import Link from 'next/link'
import VipGroupChannel from '@/components/chat/VipGroupChannel'

interface Props {
  params: Promise<{ domHandle: string }>
}

export const dynamic = 'force-dynamic'

export default async function VipGroupPage({ params }: Props) {
  const { domHandle } = await params
  const supabase = await getServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/chat/vip/${domHandle}`)

  const { data: viewer } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('auth_user_id', user.id)
    .single()

  if (!viewer) redirect('/login')

  // Fetch the dom
  const { data: dom } = await supabase
    .from('profiles')
    .select('id, display_name, handle, profile_picture_url')
    .eq('handle', domHandle)
    .eq('user_type', 'CREATOR')
    .maybeSingle()

  if (!dom) notFound()

  // Dom can always access her own channel
  const isDom = viewer.user_type === 'CREATOR' && viewer.id === dom.id

  if (!isDom) {
    // Check fan has GROUP or PRIVATE chat_access for this dom
    const { data: access } = await supabase
      .from('chat_access')
      .select('state, tier')
      .eq('fan_id', viewer.id)
      .eq('creator_id', dom.id)
      .eq('state', 'granted')
      .maybeSingle()

    if (!access) {
      // No access — show locked screen
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center mb-6">
            <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">VIP access required</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xs">
            This channel is for {dom.display_name ?? dom.handle}&apos;s top subs. Complete tasks and tribute to earn your place.
          </p>
          <Link
            href={`/${domHandle}`}
            className="px-8 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors"
          >
            View tasks
          </Link>
        </div>
      )
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <VipGroupChannel dom={dom} />
    </div>
  )
}
