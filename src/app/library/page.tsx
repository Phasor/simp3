'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'
import { createClient } from '@/lib/supabase/client'

interface LibraryItem {
  id: string
  task_id: string
  accepted_at: string
  task: {
    id: string
    title: string
    cover_image_url: string | null
    media_asset: {
      type: string | null
      thumbnail_url: string | null
      bunny_preview_url: string | null
    } | null
    dom: {
      display_name: string | null
      handle: string | null
      profile_picture_url: string | null
    }
  }
}

export default function LibraryPage() {
  const { profile, resolved } = useAuth()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLibrary = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const sb = createClient()
      const { data } = await sb
        .from('task_completions')
        .select(`
          id,
          task_id,
          accepted_at,
          task:tasks!task_id (
            id, title, cover_image_url,
            media_asset:media_assets!media_id ( type, thumbnail_url, bunny_preview_url ),
            dom:profiles!creator_id ( display_name, handle, profile_picture_url )
          )
        `)
        .eq('fan_id', profile.id)
        .eq('status', 'APPROVED')
        .not('task_id', 'is', null)
        .order('accepted_at', { ascending: false })

      // Filter to CONTENT tasks only
      const contentItems = (data ?? []).filter(
        (r: any) => r.task?.media_asset != null
      ) as LibraryItem[]
      setItems(contentItems)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (resolved) fetchLibrary()
  }, [resolved, fetchLibrary])

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="font-serif text-2xl font-light text-white mb-1">Your Collection</h1>
        <p className="text-sm text-gray-500 mb-6">Content you've unlocked</p>

        {(!resolved || loading) ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-4xl mb-4">🗂️</div>
            <p className="text-white font-semibold mb-2">Nothing here yet</p>
            <p className="text-gray-500 text-sm">Content you purchase will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(item => {
              const task = item.task
              const dom = task.dom
              const domName = dom.display_name || dom.handle || 'Dom'
              const isVideo = task.media_asset?.type === 'VIDEO'

              const thumbPath = task.cover_image_url
                || task.media_asset?.bunny_preview_url
                || task.media_asset?.thumbnail_url
                || null
              const thumbUrl = thumbPath ? getBunnyStorageUrl(thumbPath) : null

              const avatarUrl = dom.profile_picture_url
                ? getBunnyStorageUrl(dom.profile_picture_url)
                : null

              return (
                <Link
                  key={item.id}
                  href={`/task/${task.id}`}
                  className="block bg-gray-950 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative w-full bg-gray-900" style={{ aspectRatio: '1/1' }}>
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt={task.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        {isVideo ? '🎬' : '🖼️'}
                      </div>
                    )}
                    {/* Type badge */}
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isVideo
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : 'bg-gray-900/80 text-gray-300 border border-gray-700'
                    }`}>
                      {isVideo ? '▶ Video' : '⬜ Image'}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt={domName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                          {domName[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-gray-500 truncate">{domName}</span>
                    </div>
                    <p className="text-white text-xs font-semibold leading-snug line-clamp-2">{task.title}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
