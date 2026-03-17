'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

// ── Types ──────────────────────────────────────────────────────────────────────
interface DomInfo {
  id: string
  display_name: string | null
  handle: string | null
  profile_picture_url: string | null
}

interface FeedItem {
  id: string
  title: string
  description: string | null
  task_type: string
  price_usdc: number | null
  points: number
  cover_image_url: string | null
  created_at: string
  dom: DomInfo
  media_asset: { type: string | null } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  REPETITION: 'Repetition',
  SUBMISSION: 'Submission',
  EVIDENCE: 'Evidence',
  CONTENT: 'Content',
}

const TYPE_ICON: Record<string, string> = {
  REPETITION: '🔁',
  SUBMISSION: '✍️',
  EVIDENCE: '📸',
  CONTENT: '🔒',
}

function contentLabel(item: FeedItem): string {
  if (item.task_type !== 'CONTENT') return TYPE_LABEL[item.task_type] ?? item.task_type
  const t = item.media_asset?.type
  if (t === 'VIDEO') return 'Video'
  if (t === 'IMAGE') return 'Image'
  return 'Content'
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Feed card ─────────────────────────────────────────────────────────────────
function FeedCard({ item }: { item: FeedItem }) {
  const dom = item.dom
  const domName = dom.display_name || dom.handle || 'Dom'
  const avatarUrl = dom.profile_picture_url ? getBunnyStorageUrl(dom.profile_picture_url) : null
  const coverUrl = item.cover_image_url ? getBunnyStorageUrl(item.cover_image_url) : null
  const shouldBlur = item.task_type === 'CONTENT' && item.media_asset?.type === 'IMAGE'

  return (
    <Link href={`/task/${item.id}`} className="block bg-gray-950 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
      {/* Cover image */}
      <div className="relative w-full overflow-hidden bg-gray-900" style={{ aspectRatio: '4/3' }}>
        {coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={item.title}
              className={`w-full h-full object-cover ${shouldBlur ? 'filter blur-md scale-110' : ''}`}
            />
            {shouldBlur && <div className="absolute inset-0 bg-black/40" />}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {TYPE_ICON[item.task_type] ?? '📋'}
          </div>
        )}
        {/* Type badge — top left */}
        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium text-gray-300 border border-gray-700">
          {TYPE_ICON[item.task_type] ?? '📋'} {contentLabel(item)}
        </div>
        {/* Price — bottom right */}
        {item.price_usdc != null && (
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-bold text-white">
            ${item.price_usdc}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-2.5">
        {/* Dom row */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={domName} className="w-5 h-5 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
              {domName[0].toUpperCase()}
            </div>
          )}
          <span className="text-xs text-gray-400 truncate">{domName}</span>
          <span className="text-gray-600 text-xs shrink-0 ml-auto">{timeAgo(item.created_at)}</span>
        </div>

        {/* Title */}
        <p className="text-white font-semibold text-xs leading-snug line-clamp-2">{item.title}</p>

        {/* Points chip */}
        {item.points > 0 && (
          <p className="text-yellow-400 text-xs mt-1">+{item.points} pts</p>
        )}
      </div>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const { profile, resolved } = useAuth()
  const [tab, setTab] = useState<'for-you' | 'following'>('for-you')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  // Doms should not see the sub feed — redirect to dashboard
  useEffect(() => {
    if (resolved && profile?.user_type === 'CREATOR') {
      router.replace('/dashboard')
    }
  }, [resolved, profile, router])

  const fetchFeed = useCallback(async (t: 'for-you' | 'following') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/feed?tab=${t}`)
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items ?? [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFeed(tab) }, [tab, fetchFeed])

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Sticky tabs */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-sm border-b border-gray-900">
        <div className="max-w-4xl mx-auto flex">
          {(['for-you', 'following'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
                tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'for-you' ? 'For you' : 'Following'}
              {tab === t && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-4xl mx-auto px-3 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          tab === 'following' ? (
            <div className="py-16 text-center px-6">
              <div className="text-4xl mb-4">👁</div>
              <p className="text-white font-semibold mb-2">No one followed yet</p>
              <p className="text-gray-500 text-sm">Visit a dom&apos;s profile and hit Follow to see their tasks here.</p>
            </div>
          ) : (
            <div className="py-16 text-center px-6">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-white font-semibold mb-2">No tasks yet</p>
              <p className="text-gray-500 text-sm">Tasks posted by doms will appear here.</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {items.map(item => <FeedCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  )
}
