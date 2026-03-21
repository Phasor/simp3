'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

interface ContentAsset {
  id: string
  title: string | null
  type: string
  bunny_preview_url: string | null
  thumbnail_url: string | null
  price_usdc: number | null
  dom: { display_name: string | null; handle: string | null; banner_image_url: string | null; vip_cta_text: string | null }
}

interface Props {
  asset: ContentAsset
  fanId: string
}

export default function ContentUnlockClient({ asset }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const dom = asset.dom
  const domName = dom.display_name || dom.handle || 'Your Dom'
  const ctaText = dom.vip_cta_text || 'Unlock content'
  const rawPreview = asset.bunny_preview_url ?? asset.thumbnail_url
  // Server-side blur so unblurred URL never appears in page source
  const preview = rawPreview ? `${getBunnyStorageUrl(rawPreview)}?blur=20` : null

  async function handleUnlock() {
    setLoading(true)
    try {
      const res = await fetch(`/api/content/${asset.id}/unlock`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to unlock')
        return
      }
      // Navigate to the signed CDN URL via the content page
      router.push(`/content/${asset.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Preview (blurred) */}
      <div className="relative w-full" style={{ height: '55vh' }}>
        {preview ? (
          <Image
            src={preview}
            alt={asset.title ?? 'Locked content'}
            fill
            className="object-cover scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gray-900" />
        )}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info + CTA */}
      <div className="px-6 py-6 max-w-lg mx-auto space-y-5">
        <div>
          <p className="text-gray-400 text-sm mb-1">{domName}</p>
          <h1 className="text-xl font-bold text-white">{asset.title ?? 'Exclusive content'}</h1>
        </div>

        {asset.price_usdc != null && (
          <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">Unlock price</span>
            <span className="text-white font-semibold">${asset.price_usdc} USDC</span>
          </div>
        )}

        <button
          onClick={handleUnlock}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Unlocking…' : `${ctaText}${asset.price_usdc ? ` · $${asset.price_usdc} USDC` : ''}`}
        </button>

        <button
          onClick={() => router.push(dom.handle ? `/${dom.handle}` : '/')}
          className="w-full py-3 text-gray-500 text-sm hover:text-gray-300 transition-colors"
        >
          Back to profile
        </button>
      </div>
    </div>
  )
}
