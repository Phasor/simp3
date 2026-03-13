'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'
import Image from 'next/image'

interface MediaAsset {
  id: string
  title: string | null
  type: 'IMAGE' | 'VIDEO'
  bunny_url: string | null
  thumbnail_url: string | null
  is_on_wall: boolean
  price_usdc: number | null
  created_at: string
}

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function DashboardMediaPage() {
  const router = useRouter()
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchAssets = useCallback(async () => {
    const sb = supabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await sb
      .from('profiles')
      .select('id, user_type')
      .eq('auth_user_id', user.id)
      .single()

    if (!profile || profile.user_type !== 'CREATOR') { router.push('/'); return }

    const { data } = await sb
      .from('media_assets')
      .select('id, title, type, bunny_url, thumbnail_url, is_on_wall, price_usdc, created_at')
      .eq('creator_id', profile.id)
      .order('created_at', { ascending: false })

    setAssets(data as MediaAsset[] ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('title', file.name.replace(/\.[^.]+$/, ''))
      const res = await fetch('/api/upload/media', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
      toast.success('Uploaded!')
      fetchAssets()
    } finally {
      setUploading(false)
    }
  }

  async function toggleWall(asset: MediaAsset) {
    const next = !asset.is_on_wall
    // Require price before putting on wall
    if (next && !asset.price_usdc) {
      setEditingId(asset.id)
      setEditPrice('')
      toast('Set a price before publishing to wall', { icon: '💬' })
      return
    }
    const res = await fetch(`/api/media/${asset.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_on_wall: next }),
    })
    if (res.ok) {
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_on_wall: next } : a))
    } else {
      toast.error('Failed to update')
    }
  }

  async function savePrice(assetId: string) {
    const price = parseFloat(editPrice)
    if (isNaN(price) || price <= 0) { toast.error('Enter a valid price'); return }
    const res = await fetch(`/api/media/${assetId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_usdc: price }),
    })
    if (res.ok) {
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, price_usdc: price } : a))
      setEditingId(null)
      toast.success('Price saved')
    } else {
      toast.error('Failed to save price')
    }
  }

  async function deleteAsset(assetId: string) {
    const res = await fetch(`/api/media/${assetId}/settings`, { method: 'DELETE' })
    if (res.ok) {
      setAssets(prev => prev.filter(a => a.id !== assetId))
      toast.success('Deleted')
    } else {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-8">
      <div className="max-w-3xl mx-auto px-4 pt-6">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Content wall</h1>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Uploading…' : '+ Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}
          />
        </div>

        <p className="text-xs text-gray-500 mb-6">
          Upload photos or videos. Toggle &ldquo;On wall&rdquo; to make them visible on your public profile as locked content.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm mb-4">No media yet.</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-6 py-3 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100"
            >
              Upload your first photo or video
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map(asset => {
              const thumb = asset.thumbnail_url ?? asset.bunny_url
              return (
                <div key={asset.id} className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-900 shrink-0">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt={asset.title ?? 'Media'}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700 text-xl">
                        {asset.type === 'VIDEO' ? '▶' : '🖼'}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{asset.title ?? 'Untitled'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{asset.type}</p>

                    {/* Price */}
                    {editingId === asset.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          placeholder="e.g. 5.00"
                          min={0.01}
                          step={0.01}
                          className="w-24 px-2 py-1 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-gray-500"
                          autoFocus
                        />
                        <span className="text-xs text-gray-500">USDC</span>
                        <button onClick={() => savePrice(asset.id)} className="text-xs text-white hover:text-gray-300">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-600 hover:text-gray-400">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(asset.id); setEditPrice(asset.price_usdc?.toString() ?? '') }}
                        className="text-xs text-gray-500 hover:text-gray-300 mt-1 transition-colors"
                      >
                        {asset.price_usdc ? `$${asset.price_usdc} USDC` : 'Set price'}
                      </button>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* On wall toggle */}
                    <button
                      onClick={() => toggleWall(asset)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        asset.is_on_wall
                          ? 'bg-white text-black'
                          : 'bg-gray-900 border border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {asset.is_on_wall ? 'On wall' : 'Off wall'}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => deleteAsset(asset.id)}
                      className="text-gray-700 hover:text-red-400 transition-colors"
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
