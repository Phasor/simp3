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

interface WallAsset {
  id: string
  title: string | null
  thumbnail_url: string | null
  bunny_preview_url: string | null
  price_usdc: number | null
  type: string
}

interface GroupTier {
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

// ── Content wall item ─────────────────────────────────────────────────────────
function WallItem({ asset, onClickGuest }: { asset: WallAsset; onClickGuest: () => void }) {
  const { profile, resolved } = useAuth()
  const router = useRouter()

  function handleClick() {
    if (!resolved) return
    if (!profile) { onClickGuest(); return }
    router.push(`/content/${asset.id}/unlock`)
  }

  const rawPreviewPath = asset.bunny_preview_url ?? asset.thumbnail_url
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
          alt={asset.title ?? 'Locked content'}
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
          {asset.price_usdc != null && (
            <p className="text-white text-xs font-semibold">${asset.price_usdc} USDC</p>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  dom: DomProfile
  tasks: Task[]
  wallAssets: WallAsset[]
  groupTier: GroupTier | null
  followerCount: number
  initialIsFollowing: boolean
}

export default function DomProfileClient({ dom, tasks, wallAssets, groupTier, followerCount, initialIsFollowing }: Props) {
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

  const vipTeaserText = groupTier
    ? groupTier.threshold_type === 'TOP_PERCENT'
      ? `Top ${groupTier.threshold_value}% of devoted subs get exclusive access.`
      : `Only ${groupTier.threshold_value} subs qualify for VIP access.`
    : 'Top subs earn exclusive access.'

  return (
    <>
      {showAuthPrompt && (
        <AuthPromptModal
          onClose={() => setShowAuthPrompt(false)}
          domHandle={dom.handle}
        />
      )}

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
              src={dom.banner_image_url.startsWith('http') ? dom.banner_image_url : getBunnyStorageUrl(dom.banner_image_url)}
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
          Content {wallAssets.length > 0 && <span className="ml-1 text-xs text-gray-600">({wallAssets.length})</span>}
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
            {wallAssets.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No content yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {wallAssets.map(asset => (
                  <WallItem
                    key={asset.id}
                    asset={asset}
                    onClickGuest={() => setShowAuthPrompt(true)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* VIP teaser — always shown */}
        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-5 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-1">Join my inner circle</h3>
          <p className="text-gray-500 text-xs leading-relaxed">{vipTeaserText}</p>
          <p className="text-gray-600 text-xs mt-2">Complete tasks and tribute to earn your place.</p>
        </div>
      </div>
    </>
  )
}
