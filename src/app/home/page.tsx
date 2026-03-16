'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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

  return (
    <Link href={`/task/${item.id}`} className="block bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors">
      {/* Cover image — blurred to tease */}
      {coverUrl && (
        <div className="relative w-full overflow-hidden" style={{ height: 180 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={item.title}
            className="w-full h-full object-cover filter blur-md scale-110"
          />
          <div className="absolute inset-0 bg-black/40" />
          {/* Type badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-medium text-gray-300 border border-gray-700">
            <span>{TYPE_ICON[item.task_type] ?? '📋'}</span>
            {TYPE_LABEL[item.task_type] ?? item.task_type}
          </div>
          {/* Price */}
          {item.price_usdc != null && (
            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full text-sm font-bold text-white">
              ${item.price_usdc} USDC
            </div>
          )}
        </div>
      )}

      {/* Card body */}
      <div className="p-4">
        {/* Dom row */}
        <div className="flex items-center gap-2 mb-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={domName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-400 shrink-0">
              {domName[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-white">{domName}</span>
            {dom.handle && <span className="text-gray-500 text-xs ml-1.5">@{dom.handle}</span>}
          </div>
          <span className="text-gray-600 text-xs shrink-0">{timeAgo(item.created_at)}</span>
        </div>

        {/* Task info */}
        <p className="text-white font-semibold text-sm leading-snug mb-1">{item.title}</p>
        {item.description && (
          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{item.description}</p>
        )}

        {/* Chips — shown when no cover image (price is on the cover otherwise) */}
        {!coverUrl && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.price_usdc != null && (
              <span className="bg-gray-900 border border-gray-800 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                ${item.price_usdc} USDC
              </span>
            )}
            {item.points > 0 && (
              <span className="bg-gray-900 border border-gray-800 text-yellow-400 text-xs font-medium px-2.5 py-1 rounded-full">
                +{item.points} pts
              </span>
            )}
            <span className="bg-gray-900 border border-gray-800 text-gray-500 text-xs px-2.5 py-1 rounded-full ml-auto">
              {TYPE_ICON[item.task_type]} {TYPE_LABEL[item.task_type]}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [tab, setTab] = useState<'for-you' | 'following'>('for-you')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

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
        <div className="max-w-lg mx-auto flex">
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
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
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
          items.map(item => <FeedCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
