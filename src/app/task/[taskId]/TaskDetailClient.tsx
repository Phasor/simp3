'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

// ── Types ──────────────────────────────────────────────────────────────────────
interface DomProfile {
  id: string
  display_name: string | null
  handle: string | null
  tagline: string | null
  banner_image_url: string | null
  profile_picture_url: string | null
  vip_cta_text: string | null
}

interface Task {
  id: string
  title: string
  description: string | null
  task_type: string | null
  status: string | null
  price_usdc: number | null
  points: number
  instructions: string | null
  repetition_phrase: string | null
  required_repetitions: number | null
  dom: DomProfile
}

// ── Type label & icon ──────────────────────────────────────────────────────────
const TYPE_META: Record<string, { label: string; icon: React.ReactNode; flavour: string }> = {
  REPETITION: {
    label: 'Repetition',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    flavour: 'Devotion through repetition. You will type every word yourself.',
  },
  SUBMISSION: {
    label: 'Submission',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
      </svg>
    ),
    flavour: 'Write your declaration and submit it for review.',
  },
  EVIDENCE: {
    label: 'Evidence',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    flavour: 'Prove your devotion. Upload photo evidence for review.',
  },
  CONTENT: {
    label: 'Content',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    flavour: 'Exclusive content. Access granted instantly on payment.',
  },
}

// ── Auth prompt modal ──────────────────────────────────────────────────────────
function AuthPromptModal({ onClose, taskId }: { onClose: () => void; taskId: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">Create an account to tribute</h2>
        <p className="text-sm text-gray-400">Join Tribute to accept tasks and show your devotion.</p>
        <div className="space-y-2">
          <Link
            href={`/signup?next=/task/${taskId}`}
            className="block w-full py-3 rounded-xl bg-white text-black font-semibold text-center hover:bg-gray-100 transition-colors"
          >
            Create account
          </Link>
          <Link
            href={`/login?next=/task/${taskId}`}
            className="block w-full py-3 rounded-xl border border-gray-700 text-white font-semibold text-center hover:border-gray-500 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Editable field helpers ─────────────────────────────────────────────────────
function EditField({
  label, value, onChange, type = 'text', placeholder, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'textarea'
  placeholder?: string
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          step={type === 'number' ? 'any' : undefined}
          min={type === 'number' ? '0' : undefined}
          className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      )}
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TaskDetailClient({ task }: { task: Task }) {
  const router = useRouter()
  const { profile, resolved } = useAuth()

  const dom = task.dom
  const domName = dom.display_name || dom.handle || 'Your Dom'
  const meta = TYPE_META[task.task_type ?? ''] ?? TYPE_META.SUBMISSION
  const ctaText = dom.vip_cta_text || 'Accept Task'

  const bannerUrl = dom.banner_image_url ? getBunnyStorageUrl(dom.banner_image_url) : null
  const avatarUrl = dom.profile_picture_url ? getBunnyStorageUrl(dom.profile_picture_url) : null

  const isOwner = resolved && profile?.id === task.dom.id

  // ── Sub state ──
  const [showAuth, setShowAuth] = useState(false)
  // ── Payment modal state ──
  const [showPayModal, setShowPayModal] = useState(false)
  const [tributeMessage, setTributeMessage] = useState('')
  const [payPhase, setPayPhase] = useState<'form' | 'animating' | 'done'>('form')
  const [completionId, setCompletionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Dom edit state ──
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    instructions: task.instructions ?? '',
    price_usdc: task.price_usdc?.toString() ?? '',
    points: task.points.toString(),
    repetition_phrase: task.repetition_phrase ?? '',
    required_repetitions: task.required_repetitions?.toString() ?? '',
    status: task.status ?? 'DRAFT',
  })

  function set(field: keyof typeof form) {
    return (value: string) => setForm(prev => ({ ...prev, [field]: value }))
  }

  // ── Sub payment handlers ──
  function handleAccept() {
    if (!resolved) return
    if (!profile) { setShowAuth(true); return }
    setShowPayModal(true)
  }

  async function handlePay() {
    if (!tributeMessage.trim()) { toast.error('Write your tribute message first'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/task/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, tributeMessage }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Payment failed — please try again'); return }
      setCompletionId(data.completionId)
      setPayPhase('animating')
      setTimeout(() => setPayPhase('done'), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  function handleContinue() {
    setShowPayModal(false)
    setPayPhase('form')
    setTributeMessage('')
    if (task.task_type === 'CONTENT') {
      router.push(task.dom.handle ? `/${task.dom.handle}` : '/')
    } else {
      router.push(`/task/${task.id}/complete?completion=${completionId}`)
    }
  }

  // ── Dom save handler ──
  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/task/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, ...form }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return }
      toast.success('Task saved')
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setForm({
      title: task.title,
      description: task.description ?? '',
      instructions: task.instructions ?? '',
      price_usdc: task.price_usdc?.toString() ?? '',
      points: task.points.toString(),
      repetition_phrase: task.repetition_phrase ?? '',
      required_repetitions: task.required_repetitions?.toString() ?? '',
      status: task.status ?? 'DRAFT',
    })
    setEditing(false)
  }

  // ── Payment overlay (animating / done) ─────────────────────────────────────
  if (showPayModal && payPhase === 'animating') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-96 h-96 rounded-full bg-white/5 animate-ping" style={{ animationDuration: '1.5s' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '1s' }} />
        </div>
        {avatarUrl && (
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/30 mb-8 z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={domName} className="w-full h-full object-cover" />
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

  if (showPayModal && payPhase === 'done') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 px-6">
        {avatarUrl && (
          <div className="relative w-20 h-20 rounded-full overflow-hidden border border-white/20 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={domName} className="w-full h-full object-cover" />
          </div>
        )}
        <p className="text-gray-400 text-sm mb-2">{domName}</p>
        <h2 className="text-2xl font-bold text-white text-center mb-3">Your tribute has been received.</h2>
        <p className="text-gray-500 text-sm text-center mb-10">
          {task.task_type === 'CONTENT' ? 'Your content has been unlocked.' : 'Now complete your task to earn your points.'}
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

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <>
      {showAuth && <AuthPromptModal onClose={() => setShowAuth(false)} taskId={task.id} />}

      {/* Payment modal */}
      {showPayModal && payPhase === 'form' && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowPayModal(false)}
        >
          <div
            className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{domName}</p>
                <h2 className="text-base font-bold text-white leading-tight">{task.title}</h2>
              </div>
              <div className="text-right shrink-0">
                {task.price_usdc != null && (
                  <p className="text-xl font-bold text-white">${task.price_usdc}</p>
                )}
                <p className="text-xs text-gray-500">USDC</p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Write your tribute message to {domName} <span className="text-red-400">*</span>
              </label>
              <textarea
                value={tributeMessage}
                onChange={e => setTributeMessage(e.target.value)}
                placeholder={`Tell ${domName} why you're submitting this tribute…`}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
              />
              <div className="text-right text-xs text-gray-600 mt-1">{tributeMessage.length}/500</div>
            </div>

            <button
              onClick={handlePay}
              disabled={!tributeMessage.trim() || submitting}
              className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Processing…' : `${ctaText}${task.price_usdc != null ? ` · $${task.price_usdc} USDC` : ''}`}
            </button>
            <p className="text-center text-xs text-gray-600">
              Payment processed securely. Non-refundable once submitted.
            </p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-black text-white pb-32">

        {/* ── Hero ── */}
        <div className="relative w-full" style={{ height: '45vh', minHeight: 220, maxHeight: 420 }}>
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt={domName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          {/* Back button */}
          {dom.handle && (
            <Link
              href={isOwner ? '/dashboard/tasks' : `/${dom.handle}`}
              className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {isOwner ? 'My tasks' : domName}
            </Link>
          )}

          {/* Type badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-gray-700">
            {meta.icon}
            {meta.label}
          </div>

          {/* Draft/Archived badge for dom */}
          {isOwner && task.status !== 'PUBLISHED' && (
            <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">
              {task.status === 'DRAFT' ? 'Draft' : 'Archived'}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="max-w-lg mx-auto px-4 -mt-8 relative z-10 space-y-5">

          {/* Not available for non-owners viewing non-published tasks */}
          {!isOwner && task.status !== 'PUBLISHED' && (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">This task is not currently available.</p>
            </div>
          )}

          {/* Title + price */}
          {editing ? (
            <div className="space-y-4">
              <EditField label="Title" value={form.title} onChange={set('title')} placeholder="Task title" />
              <div className="flex gap-3">
                <div className="flex-1">
                  <EditField label="Price (USDC)" value={form.price_usdc} onChange={set('price_usdc')} type="number" placeholder="0.00" hint="Leave blank for free" />
                </div>
                <div className="flex-1">
                  <EditField label="Points" value={form.points} onChange={set('points')} type="number" placeholder="0" />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-3">{task.title}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                {task.price_usdc != null && (
                  <span className="text-xl font-bold text-white">
                    ${task.price_usdc} <span className="text-sm font-normal text-gray-400">USDC</span>
                  </span>
                )}
                {task.points > 0 && (
                  <span className="flex items-center gap-1 text-sm text-yellow-400 font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    +{task.points} pts
                  </span>
                )}
              </div>
            </div>
          )}

          {!editing && <p className="text-xs text-gray-500 italic">{meta.flavour}</p>}

          {/* Description */}
          {editing ? (
            <EditField label="Description" value={form.description} onChange={set('description')} type="textarea" placeholder="Describe this task to your subs…" />
          ) : task.description ? (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">About this task</h2>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          ) : null}

          {/* Instructions */}
          {editing ? (
            <EditField label="Instructions" value={form.instructions} onChange={set('instructions')} type="textarea" placeholder="Step-by-step instructions for the sub…" />
          ) : task.instructions && task.instructions !== task.description ? (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Instructions</h2>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{task.instructions}</p>
            </div>
          ) : null}

          {/* Repetition details */}
          {task.task_type === 'REPETITION' && (
            editing ? (
              <div className="space-y-4">
                <EditField label="Phrase to type" value={form.repetition_phrase} onChange={set('repetition_phrase')} placeholder="e.g. I exist to serve you" />
                <EditField label="Required repetitions" value={form.required_repetitions} onChange={set('required_repetitions')} type="number" placeholder="e.g. 100" />
              </div>
            ) : (task.required_repetitions ? (
              <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Task details</h2>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Repetitions required</span>
                  <span className="font-semibold text-white">{task.required_repetitions}×</span>
                </div>
                {task.repetition_phrase && (
                  <div className="mt-2 bg-gray-900 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">Phrase to type</p>
                    <p className="text-sm text-white font-medium">&ldquo;{task.repetition_phrase}&rdquo;</p>
                  </div>
                )}
              </div>
            ) : null)
          )}

          {/* Status selector (dom only, edit mode) */}
          {editing && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">Status</label>
              <div className="flex gap-2">
                {(['PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => set('status')(s)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      form.status === s
                        ? 'bg-white text-black'
                        : 'bg-gray-900 border border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* What you earn (sub view only) */}
          {!isOwner && task.status === 'PUBLISHED' && (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">What you receive</h2>
              <div className="space-y-2">
                {task.task_type === 'CONTENT' && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Instant access to exclusive content
                  </div>
                )}
                {task.points > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    +{task.points} Tribute Points toward VIP access
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Spend recorded toward your Tribute Score
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Proximity to {domName} — earned, not bought
                </div>
              </div>
            </div>
          )}

          {/* Dom card (sub view only) */}
          {!isOwner && (
            <div className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-2xl p-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={domName} className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-400 shrink-0">
                  {domName[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{domName}</p>
                {dom.handle && <p className="text-xs text-gray-500">@{dom.handle}</p>}
                {dom.tagline && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dom.tagline}</p>}
              </div>
              {dom.handle && (
                <Link href={`/${dom.handle}`} className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                  View profile →
                </Link>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Fixed bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-black via-black/95 to-transparent pt-8">
        <div className="max-w-lg mx-auto space-y-2">

          {isOwner ? (
            editing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-2xl bg-white text-black font-bold text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={saving}
                  className="px-5 py-3.5 rounded-2xl border border-gray-700 text-gray-300 font-semibold text-sm hover:border-gray-500 transition-colors"
                >
                  Discard
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3.5 rounded-2xl border border-gray-700 text-white font-semibold text-sm hover:border-gray-500 transition-colors"
              >
                Edit task
              </button>
            )
          ) : task.status === 'PUBLISHED' ? (
            <>
              <button
                onClick={handleAccept}
                disabled={!resolved}
                className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {ctaText}{task.price_usdc != null ? ` · $${task.price_usdc} USDC` : ''}
              </button>
              <p className="text-center text-xs text-gray-600">
                ⚡ Instant · 🔒 Secure · Non-refundable
              </p>
            </>
          ) : null}

        </div>
      </div>
    </>
  )
}
