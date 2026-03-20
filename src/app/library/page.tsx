'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

interface LibraryItem {
  id: string
  task_id: string
  accepted_at: string
  task: {
    id: string
    title: string
    cover_image_url: string | null
    media_id: string | null
    media_asset: {
      id: string
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
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)

  // Lightbox state
  const [activeItem, setActiveItem] = useState<LibraryItem | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaEmbed, setMediaEmbed] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(false)

  const fetchLibrary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/library')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items ?? [])
    } catch (err) {
      console.error('Library fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLibrary() }, [fetchLibrary])

  // Open lightbox — fetch signed URL
  const openLightbox = useCallback(async (item: LibraryItem) => {
    const mediaId = item.task.media_asset?.id || item.task.media_id
    if (!mediaId) return

    setActiveItem(item)
    setMediaUrl(null)
    setMediaEmbed(false)
    setMediaLoading(true)

    try {
      const res = await fetch(`/api/content/${mediaId}/signed-url`)
      if (!res.ok) throw new Error('Failed to load content')
      const data = await res.json()
      setMediaUrl(data.url)
      setMediaEmbed(!!data.embed)
    } catch (err) {
      console.error('Failed to load content:', err)
    } finally {
      setMediaLoading(false)
    }
  }, [])

  const closeLightbox = useCallback(() => {
    setActiveItem(null)
    setMediaUrl(null)
    setMediaEmbed(false)
    setMediaLoading(false)
  }, [])

  // Close on Escape key
  useEffect(() => {
    if (!activeItem) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeItem, closeLightbox])

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="font-serif text-2xl font-light text-white mb-1">Your Collection</h1>
        <p className="text-sm text-gray-500 mb-6">Content you&apos;ve unlocked</p>

        {loading ? (
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
                <button
                  key={item.id}
                  onClick={() => openLightbox(item)}
                  className="block bg-gray-950 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors text-left w-full"
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
                    {/* Play icon overlay for videos */}
                    {isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
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
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Lightbox modal */}
      {activeItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-gray-900/80 border border-gray-700 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title bar */}
          <div className="absolute top-4 left-4 right-16 z-10">
            <p className="text-white font-semibold text-sm truncate">{activeItem.task.title}</p>
            <p className="text-gray-400 text-xs">
              {activeItem.task.dom.display_name || activeItem.task.dom.handle}
            </p>
          </div>

          {/* Content area */}
          <div
            className="relative max-w-3xl w-full mx-4 mt-16 mb-4 max-h-[calc(100vh-6rem)] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            {mediaLoading ? (
              <div className="flex flex-col items-center gap-3 py-20">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Loading content...</p>
              </div>
            ) : mediaUrl ? (
              mediaEmbed ? (
                <iframe
                  src={mediaUrl}
                  loading="lazy"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="w-full rounded-xl bg-gray-950"
                  style={{ aspectRatio: '16/9', maxHeight: 'calc(100vh - 8rem)' }}
                />
              ) : activeItem.task.media_asset?.type === 'VIDEO' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={mediaUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[calc(100vh-8rem)] w-full rounded-xl bg-gray-950"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl}
                  alt={activeItem.task.title}
                  className="max-h-[calc(100vh-8rem)] w-full object-contain rounded-xl"
                />
              )
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-400">Unable to load content</p>
                <button
                  onClick={() => openLightbox(activeItem)}
                  className="mt-3 text-sm text-blue-400 hover:text-blue-300"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
