'use client'

import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

interface TaskVisualBlockProps {
  taskType: string | null
  title: string
  repetitionPhrase: string | null
  requiredRepetitions: number | null
  instructions: string | null
  domName: string
  coverImageUrl: string | null
  mediaAsset: {
    type: string | null
    thumbnail_url: string | null
    bunny_preview_url: string | null
    bunny_url: string | null
    playback_ref: string | null
  } | null
  isUnlocked: boolean
  secureMediaUrl: { url: string; type: string; embed: boolean } | null
  meta: { icon: React.ReactNode }
}

export default function TaskVisualBlock({
  taskType,
  title,
  repetitionPhrase,
  requiredRepetitions,
  instructions,
  domName,
  coverImageUrl,
  mediaAsset,
  isUnlocked,
  secureMediaUrl,
  meta,
}: TaskVisualBlockProps) {
  // ── REPETITION: The Oath Block ──
  if (taskType === 'REPETITION' && repetitionPhrase) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 relative overflow-hidden">
        <span className="absolute top-1 left-4 font-serif text-8xl text-white/[0.04] leading-none select-none pointer-events-none">
          &ldquo;
        </span>
        <p className="font-sans text-xs tracking-[0.15em] uppercase text-white/30 mb-4 relative z-10">
          You will type this {requiredRepetitions}&times; without pasting
        </p>
        <p className="font-serif text-xl italic text-white/80 leading-snug relative z-10">
          {repetitionPhrase}
        </p>
        <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
          <p className="text-xs text-white/30">
            {requiredRepetitions} repetitions · paste disabled · auto-approved on completion
          </p>
        </div>
      </div>
    )
  }

  // ── SUBMISSION: The Confession Prompt ──
  if (taskType === 'SUBMISSION') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="font-sans text-xs tracking-[0.15em] uppercase text-white/30 mb-4">
          Your declaration
        </p>
        <p className="font-serif text-lg text-white/60 leading-relaxed italic">
          {instructions || 'Write your personal declaration for review.'}
        </p>
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          <p className="text-xs text-white/30">
            Reviewed personally by {domName} · paste disabled
          </p>
        </div>
      </div>
    )
  }

  // ── EVIDENCE: The Challenge Card ──
  if (taskType === 'EVIDENCE') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="font-sans text-xs tracking-[0.15em] uppercase text-white/30 mb-4">
          Prove it
        </p>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 text-white/40">
            {meta.icon}
          </div>
          <div>
            <p className="font-serif text-lg text-white/80 leading-snug">
              {instructions || 'Upload photo evidence of your devotion.'}
            </p>
            <p className="text-xs text-white/30 mt-2">
              {domName} reviews all evidence before approving.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── CONTENT: locked preview or unlocked player ──
  if (taskType === 'CONTENT') {
    const asset = mediaAsset
    const isVideo = asset?.type === 'VIDEO'

    // Unlocked: show playable content via secure API URL
    if (isUnlocked) {
      if (!secureMediaUrl) {
        return (
          <div className="rounded-2xl overflow-hidden flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )
      }
      if (secureMediaUrl.embed) {
        return (
          <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '9/16' }}>
            <iframe
              src={secureMediaUrl.url}
              className="w-full h-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )
      }
      return (
        <div className="rounded-2xl overflow-hidden flex items-center justify-center bg-black" style={{ maxHeight: 'calc(100vh - 160px)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={secureMediaUrl.url}
            alt={title}
            className="w-full h-full object-contain"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          />
        </div>
      )
    }

    // Locked: blurred preview
    const previewPath = isVideo
      ? (coverImageUrl || asset?.bunny_preview_url || asset?.thumbnail_url || null)
      : (asset?.bunny_preview_url || asset?.thumbnail_url || coverImageUrl || null)
    const previewUrl = previewPath ? getBunnyStorageUrl(previewPath) : null
    const blurredPreviewUrl = previewUrl ? `${previewUrl}?blur=20` : null

    return (
      <div className="rounded-2xl overflow-hidden relative" style={{ aspectRatio: '1/1' }}>
        {/* Top-left type badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide backdrop-blur-sm ${
            isVideo
              ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
              : 'bg-black/60 text-white/70 border border-white/20'
          }`}>
            {isVideo ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            {isVideo ? 'Video' : 'Image'}
          </span>
        </div>
        {blurredPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blurredPreviewUrl}
            alt="Locked content preview"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'brightness(0.55)' }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
            {isVideo ? (
              <svg className="w-6 h-6 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </div>
          <p className="font-serif text-white/80 text-base drop-shadow-lg">
            {isVideo ? 'Unlock this video' : 'Unlock this photo'}
          </p>
          <p className="text-xs text-white/40">Access granted instantly on payment.</p>
        </div>
      </div>
    )
  }

  return null
}
