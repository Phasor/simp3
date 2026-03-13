'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

interface DomProfile {
  id: string
  display_name: string | null
  banner_image_url: string | null
  profile_picture_url: string | null
  handle: string | null
  vip_cta_text: string | null
}

interface Task {
  id: string
  title: string
  description: string | null
  task_type: string
  price_usdc: number | null
  points: number
  dom: DomProfile
}

interface Props {
  task: Task
  fanId: string
}

export default function SendMomentClient({ task, fanId }: Props) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<'form' | 'animating' | 'done'>('form')
  const [completionId, setCompletionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const domName = task.dom.display_name || task.dom.handle || 'Your Dom'
  const ctaText = task.dom.vip_cta_text || 'Submit Tribute'
  const bannerUrl = task.dom.banner_image_url ? getBunnyStorageUrl(task.dom.banner_image_url) : null
  const profilePicUrl = task.dom.profile_picture_url ? getBunnyStorageUrl(task.dom.profile_picture_url) : null

  async function handleSubmit() {
    if (!message.trim()) {
      toast.error('Write your tribute message first')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/task/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, tributeMessage: message }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Payment failed — please try again')
        return
      }

      setCompletionId(data.completionId)
      setPhase('animating')
      setTimeout(() => setPhase('done'), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  function handleContinue() {
    if (task.task_type === 'CONTENT') {
      // CONTENT tasks are auto-approved — go back to dom profile
      router.push(task.dom.handle ? `/${task.dom.handle}` : '/')
    } else {
      router.push(`/task/${task.id}/complete?completion=${completionId}`)
    }
  }

  // === ANIMATING PHASE ===
  if (phase === 'animating') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 overflow-hidden">
        {/* Radial pulse */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-96 h-96 rounded-full bg-white/5 animate-ping" style={{ animationDuration: '1.5s' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '1s' }} />
        </div>

        {/* Dom picture */}
        {profilePicUrl && (
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/30 mb-8 z-10">
            <Image src={profilePicUrl} alt={domName} fill className="object-cover" />
          </div>
        )}

        <div className="z-10 text-center px-8">
          <div className="text-5xl mb-6">🖤</div>
          <h2 className="text-2xl font-bold text-white mb-2">{ctaText}</h2>
          <p className="text-gray-400">Sending to {domName}…</p>
        </div>
      </div>
    )
  }

  // === DONE PHASE ===
  if (phase === 'done') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 px-6">
        {profilePicUrl && (
          <div className="relative w-20 h-20 rounded-full overflow-hidden border border-white/20 mb-8">
            <Image src={profilePicUrl} alt={domName} fill className="object-cover" />
          </div>
        )}
        <p className="text-gray-400 text-sm mb-2">{domName}</p>
        <h2 className="text-2xl font-bold text-white text-center mb-3">
          Your tribute has been received.
        </h2>
        <p className="text-gray-500 text-sm text-center mb-10">
          {task.task_type === 'CONTENT'
            ? 'Your content has been unlocked.'
            : 'Now complete your task to earn your points.'}
        </p>
        <button
          onClick={handleContinue}
          className="w-full max-w-xs py-4 rounded-2xl bg-white text-black font-bold text-base hover:bg-gray-100 transition-colors"
        >
          {task.task_type === 'CONTENT' ? 'View content' : 'Begin task'}
        </button>
      </div>
    )
  }

  // === FORM PHASE ===
  return (
    <div className="fixed inset-0 bg-black overflow-y-auto">
      {/* Hero */}
      <div className="relative w-full" style={{ height: '60vh' }}>
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt={domName}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gray-900" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black" />

        {/* Dom info */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <p className="text-gray-400 text-sm mb-1">{domName}</p>
          <h1 className="text-2xl font-bold text-white leading-tight">{task.title}</h1>
          {task.price_usdc && (
            <p className="text-gray-300 text-sm mt-2">
              ${task.price_usdc} USDC
              {task.points ? ` · ${task.points} points on completion` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="px-6 py-6 space-y-5 max-w-lg mx-auto">
        {task.description && (
          <p className="text-gray-400 text-sm leading-relaxed">{task.description}</p>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Write your tribute message to {domName} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Tell ${domName} why you're submitting this tribute…`}
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
          />
          <div className="text-right text-xs text-gray-600 mt-1">{message.length}/500</div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!message.trim() || submitting}
          className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting
            ? 'Processing payment…'
            : `${ctaText}${task.price_usdc ? ` · $${task.price_usdc} USDC` : ''}`}
        </button>

        <p className="text-center text-xs text-gray-600 pb-4">
          Payment processed securely. Non-refundable once submitted.
        </p>
      </div>
    </div>
  )
}
