'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DomProfile {
  id: string
  display_name: string | null
  tagline: string | null
  bio: string | null
  banner_image_url: string | null
  profile_picture_url: string | null
  vip_cta_text: string | null
  handle: string | null
}

interface Task {
  id: string
  title: string
  description: string | null
  task_type: string | null
  price_usdc: number | null
  points: number
}

interface ContentTask {
  id: string
  title: string
  price_usdc: number | null
  media_asset: { type: string; thumbnail_url: string | null; bunny_preview_url: string | null } | null
}

interface TierConfig {
  threshold_type: string
  threshold_value: number
}

// ── Task type icons ───────────────────────────────────────────────────────────
function TaskTypeIcon({ type }: { type: string | null }) {
  switch (type) {
    case 'REPETITION':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      )
    case 'SUBMISSION':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      )
    case 'EVIDENCE':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
      )
    case 'CONTENT':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      )
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      )
  }
}

// ── Auth prompt modal ─────────────────────────────────────────────────────────
function AuthPromptModal({ onClose, domHandle }: { onClose: () => void; domHandle: string | null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">Create an account to tribute</h2>
        <p className="text-sm text-gray-400">Join Tribute to accept tasks and show your devotion.</p>
        <div className="space-y-2">
          <Link
            href={`/signup${domHandle ? `?next=/${domHandle}` : ''}`}
            className="block w-full py-3 rounded-xl bg-white text-black font-semibold text-center hover:bg-gray-100 transition-colors"
          >
            Create account
          </Link>
          <Link
            href={`/login${domHandle ? `?next=/${domHandle}` : ''}`}
            className="block w-full py-3 rounded-xl border border-gray-700 text-white font-semibold text-center hover:border-gray-500 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task }: { task: Task }) {
  const router = useRouter()

  function handleClick() {
    router.push(`/task/${task.id}`)
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left bg-gray-950 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-gray-500 group-hover:text-gray-300 transition-colors">
          <TaskTypeIcon type={task.task_type} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-gray-500 text-xs mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        <div className="shrink-0 text-right ml-2">
          {task.price_usdc != null && (
            <p className="font-semibold text-white text-sm">${task.price_usdc} <span className="text-gray-500 font-normal text-xs">USDC</span></p>
          )}
          {task.points > 0 && (
            <p className="text-gray-600 text-xs mt-0.5">+{task.points} pts</p>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Content task item ─────────────────────────────────────────────────────────
function ContentTaskItem({ task, onClickGuest }: { task: ContentTask; onClickGuest: () => void }) {
  const { profile, resolved } = useAuth()
  const router = useRouter()

  function handleClick() {
    if (!resolved) return
    if (!profile) { onClickGuest(); return }
    router.push(`/task/${task.id}`)
  }

  const rawPreviewPath = task.media_asset?.bunny_preview_url ?? task.media_asset?.thumbnail_url
  // Server-side blur via proxy so the unblurred URL never appears in page source
  const previewSrc = rawPreviewPath ? `${getBunnyStorageUrl(rawPreviewPath)}?blur=20` : null

  return (
    <button
      onClick={handleClick}
      className="relative aspect-square rounded-xl overflow-hidden bg-gray-900 group"
    >
      {previewSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewSrc}
          alt={task.title}
          className="w-full h-full object-cover scale-105 transition-all"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-700">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
      )}
      {/* Price overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="bg-black/60 rounded-lg px-3 py-1.5 text-center">
          <svg className="w-4 h-4 text-gray-300 mx-auto mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          {task.price_usdc != null && (
            <p className="text-white text-xs font-semibold">${task.price_usdc} USDC</p>
          )}
        </div>
      </div>
    </button>
  )
}

// ── VIP Access Card ───────────────────────────────────────────────────────────
function qualificationText(tier: TierConfig): string {
  if (tier.threshold_type === 'TOP_PERCENT') {
    return `Finish in the top ${tier.threshold_value}% of subs this month`
  }
  return `Be one of the top ${tier.threshold_value} subs this month`
}

function VipAccessCard({ groupTier, privateTier, domName }: { groupTier: TierConfig | null; privateTier: TierConfig | null; domName: string }) {
  if (!groupTier && !privateTier) return null

  return (
    <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">{domName}&apos;s inner circle</h3>
            <p className="text-gray-500 text-xs mt-0.5">Earn your place through tasks and tribute</p>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className="divide-y divide-gray-800/60">
        {groupTier && (
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">VIP Group Chat</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full">VIP</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">{qualificationText(groupTier)}</p>
              <p className="text-gray-600 text-xs mt-1">Access granted at the start of each month</p>
            </div>
          </div>
        )}

        {privateTier && (
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">VVIP Private DMs</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">VVIP</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">{qualificationText(privateTier)}</p>
              <p className="text-gray-600 text-xs mt-1">Direct access to {domName} — the highest tier</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-5 py-3 bg-gray-900/40 border-t border-gray-800/60">
        <p className="text-gray-600 text-xs text-center">Score resets monthly · Complete tasks and tribute to climb the ranks</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  dom: DomProfile
  tasks: Task[]
  contentTasks: ContentTask[]
  groupTier: TierConfig | null
  privateTier: TierConfig | null
  followerCount: number
  initialIsFollowing: boolean
}

export default function DomProfileClient({ dom, tasks, contentTasks, groupTier, privateTier, followerCount, initialIsFollowing }: Props) {
  const { profile, resolved } = useAuth()
  const [activeTab, setActiveTab] = useState<'tasks' | 'content'>('tasks')
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [bannerLoaded, setBannerLoaded] = useState(false)
  const bannerRef = useRef<HTMLImageElement>(null)
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followCount, setFollowCount] = useState(followerCount)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    if (bannerRef.current?.complete) setBannerLoaded(true)
  }, [])

  const isSub = resolved && profile?.user_type === 'FAN'

  async function handleFollow() {
    if (!resolved) return
    if (!profile) { setShowAuthPrompt(true); return }
    setFollowLoading(true)
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domId: dom.id }),
      })
      const data = await res.json()
      if (!res.ok) return
      setIsFollowing(data.following)
      setFollowCount(c => data.following ? c + 1 : Math.max(0, c - 1))
    } finally {
      setFollowLoading(false)
    }
  }

  const displayName = dom.display_name ?? dom.handle ?? 'Tribute Dom'

  return (
    <>
      {showAuthPrompt && (
        <AuthPromptModal
          onClose={() => setShowAuthPrompt(false)}
          domHandle={dom.handle}
        />
      )}

      <div className="w-full md:max-w-[70vw] md:mx-auto md:pt-2.5">

      {/* Hero */}
      <div className="relative w-full bg-gray-950" style={{ height: '40vh', minHeight: 220, maxHeight: 400 }}>
        {dom.banner_image_url ? (
          <>
            {!bannerLoaded && (
              <div className="absolute inset-0 bg-gray-900 animate-pulse" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={bannerRef}
              src={getBunnyStorageUrl(dom.banner_image_url)}
              alt={displayName}
              className="w-full h-full object-cover"
              onLoad={() => setBannerLoaded(true)}
              style={{ opacity: bannerLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      </div>

      {/* Profile info */}
      <div className="px-4 pt-4 pb-2 -mt-12 relative z-10">
        <div className="flex items-end gap-3 mb-3">
          {dom.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dom.profile_picture_url}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-black shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-black flex items-center justify-center text-2xl font-bold text-gray-400 shrink-0">
              {displayName[0].toUpperCase()}
            </div>
          )}
          <div className="pb-1 min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white leading-tight truncate">{displayName}</h1>
            <div className="flex items-center gap-3 mt-0.5">
              {dom.handle && <p className="text-gray-500 text-sm">@{dom.handle}</p>}
              {followCount > 0 && (
                <p className="text-gray-600 text-xs">{followCount.toLocaleString()} {followCount === 1 ? 'follower' : 'followers'}</p>
              )}
            </div>
          </div>
          {/* Follow button — only for subs (or logged-out users) */}
          {!resolved || isSub ? (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                isFollowing
                  ? 'border border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              {followLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
            </button>
          ) : null}
        </div>
        {dom.tagline && (
          <p className="text-gray-300 text-sm leading-relaxed mb-4">{dom.tagline}</p>
        )}
      </div>

      {/* About section */}
      {dom.bio && (
        <div className="px-4 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            About {displayName}
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{dom.bio}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-900 px-4">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tasks'
              ? 'border-white text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Tasks {tasks.length > 0 && <span className="ml-1 text-xs text-gray-600">({tasks.length})</span>}
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'content'
              ? 'border-white text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Content {contentTasks.length > 0 && <span className="ml-1 text-xs text-gray-600">({contentTasks.length})</span>}
        </button>
      </div>

      {/* Tab content */}
      <div className="px-4 py-4 space-y-3 pb-24">
        {activeTab === 'tasks' && (
          <>
            {tasks.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No tasks yet.</p>
            ) : (
              tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'content' && (
          <>
            {contentTasks.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No content yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {contentTasks.map(task => (
                  <ContentTaskItem
                    key={task.id}
                    task={task}
                    onClickGuest={() => setShowAuthPrompt(true)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* VIP access card */}
        <VipAccessCard groupTier={groupTier} privateTier={privateTier} domName={displayName} />
      </div>

      </div> {/* end md:max-w-[70vw] wrapper */}
    </>
  )
}
