'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'
import { createClient } from '@/lib/supabase/client'

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
  cover_image_url: string | null
  media_id: string | null
  media_asset: {
    type: string | null
    thumbnail_url: string | null
    bunny_preview_url: string | null
    bunny_url: string | null
    playback_ref: string | null
  } | null
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
        <h2 className="font-serif text-xl font-light text-white">Create an account to tribute</h2>
        <p className="font-sans text-sm text-gray-400">Join Tribute to accept tasks and show your devotion.</p>
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
export default function TaskDetailClient({
  task,
}: {
  task: Task
}) {
  const router = useRouter()
  const { profile, resolved } = useAuth()
  const editBlockRef = useRef<HTMLDivElement>(null)

  const dom = task.dom
  const domName = dom.display_name || dom.handle || 'Your Dom'
  const meta = TYPE_META[task.task_type ?? ''] ?? TYPE_META.SUBMISSION
  const ctaText = dom.vip_cta_text || `Tribute ${domName}`

  const avatarUrl = dom.profile_picture_url ? getBunnyStorageUrl(dom.profile_picture_url) : null

  const isOwner = resolved && profile?.id === task.dom.id

  // ── Sub state ──
  const [showAuth, setShowAuth] = useState(false)
  const [payPhase, setPayPhase] = useState<'idle' | 'animating' | 'done'>('idle')
  const [isUnlocked, setIsUnlocked] = useState(false)

  // Check if this sub has already unlocked this CONTENT task
  useEffect(() => {
    if (task.task_type !== 'CONTENT' || !profile?.id) return
    const sb = createClient()
    sb.from('task_completions')
      .select('id')
      .eq('task_id', task.id)
      .eq('fan_id', profile.id)
      .eq('status', 'APPROVED')
      .maybeSingle()
      .then(({ data }) => { if (data) setIsUnlocked(true) })
  }, [task.id, task.task_type, profile?.id])
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


  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleEditStart() {
    setEditing(true)
    setTimeout(() => {
      const container = document.querySelector('main')
      if (container && editBlockRef.current) {
        container.scrollTo({ top: editBlockRef.current.offsetTop - 16, behavior: 'smooth' })
      }
    }, 100)
  }

  function handleAccept() {
    if (!resolved) return
    if (!profile) { setShowAuth(true); return }
    handlePay()
  }

  async function handlePay() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/task/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, tributeMessage: '' }),
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
    setPayPhase('idle')
    if (task.task_type === 'CONTENT') {
      setIsUnlocked(true) // show content immediately without a full page reload
    } else {
      router.push(`/task/${task.id}/complete?completion=${completionId}`)
    }
  }

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



  // ── Ceremony: animating ────────────────────────────────────────────────────
  if (payPhase === 'animating') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 overflow-hidden">
        {/* Gold ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-80 h-80 rounded-full border border-gold/20 animate-ping" style={{ animationDuration: '1.2s' }} />
        </div>
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
          <h2 className="font-serif text-3xl font-light text-white mb-2">{ctaText}</h2>
          <p className="font-sans text-gray-400">Sending to {domName}…</p>
        </div>
      </div>
    )
  }

  // ── Ceremony: done ─────────────────────────────────────────────────────────
  if (payPhase === 'done') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 px-6">
        {avatarUrl && (
          <div className="relative w-20 h-20 rounded-full overflow-hidden ring-1 ring-gold/30 shadow-[0_0_20px_rgba(201,168,76,0.2)] mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={domName} className="w-full h-full object-cover" />
          </div>
        )}
        <p className="font-sans text-gray-400 text-sm mb-2">{domName}</p>
        <h2 className="font-serif text-[2rem] font-light text-white text-center mb-3 leading-tight">
          Your tribute has been received.
        </h2>
        <p className="font-sans text-gray-500 text-sm text-center mb-10">
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

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <>
      {showAuth && <AuthPromptModal onClose={() => setShowAuth(false)} taskId={task.id} />}

      <div className="min-h-screen bg-black text-white pb-[calc(100px+env(safe-area-inset-bottom))]">

        {/* ── Navbar: shown only for logged-out users and dom owners (subs get SubBottomNav) ── */}
        {resolved && (!profile || isOwner) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            {/* Left: back */}
            {dom.handle ? (
              <Link
                href={isOwner ? '/dashboard/tasks' : `/${dom.handle}`}
                className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {isOwner ? 'My tasks' : 'Back'}
              </Link>
            ) : <div />}

            {/* Right: Sign Up (logged-out) or dom draft badge */}
            <div className="flex items-center gap-2">
              {isOwner && task.status !== 'PUBLISHED' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">
                  {task.status === 'DRAFT' ? 'Draft' : 'Archived'}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs font-medium text-white/40 px-2.5 py-1.5 rounded-full border border-white/10">
                {meta.icon}
                {meta.label}
              </span>
              {!profile && (
                <Link
                  href={`/signup?next=/task/${task.id}`}
                  className="ml-1 px-4 py-1.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors"
                >
                  Sign Up
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Dom identity (compact) ── */}
        <Link
          href={dom.handle ? `/${dom.handle}` : '#'}
          className="flex items-center gap-[18px] px-6 py-[18px] group border-b border-white/[0.04]"
        >
          <div className="w-[60px] h-[60px] rounded-full overflow-hidden shrink-0 ring-1 ring-gold/30 group-hover:ring-gold/50 transition-all">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={domName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-900 flex items-center justify-center font-serif text-2xl text-white/40">
                {domName[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-serif text-2xl font-medium text-white group-hover:text-white/80 transition-colors">
              {domName}
            </div>
            {dom.tagline && (
              <div className="font-serif italic text-white/35 text-[21px]">{dom.tagline}</div>
            )}
          </div>
        </Link>

        {/* ── Content: view mode or edit mode ── */}
        {!editing ? (
          <div className="max-w-[612px] mx-auto">

            {/* Unavailable notice for non-owners on non-published tasks */}
            {!isOwner && task.status !== 'PUBLISHED' && (
              <div className="px-6 pt-10">
                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 text-center">
                  <p className="text-gray-400 text-sm">This task is not currently available.</p>
                </div>
              </div>
            )}

            {/* ── Section 2: Task identity ── */}
            <div className="px-6 pt-5 pb-6">
              {/* Flavour text above title — emotional priming (not shown for CONTENT tasks) */}
              {task.task_type !== 'CONTENT' && (
                <p className="font-serif italic text-sm mb-5 leading-relaxed text-gold">
                  {meta.flavour}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 mb-6">
                <h2
                  className="font-serif font-medium leading-tight text-white"
                  style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)' }}
                >
                  {task.title}
                </h2>
                {task.task_type === 'CONTENT' && task.media_asset?.type && (
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    task.media_asset.type === 'VIDEO'
                      ? 'bg-blue-950 text-blue-300 border border-blue-800'
                      : 'bg-gray-900 text-gray-300 border border-gray-700'
                  }`}>
                    {task.media_asset.type === 'VIDEO' ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    {task.media_asset.type === 'VIDEO' ? 'Video' : 'Image'}
                  </span>
                )}
              </div>
              {task.task_type === 'CONTENT' && task.media_asset?.type && (
                <p className="font-serif italic text-white/40 text-xl -mt-3 mb-6">
                  Unlock this exclusive {task.media_asset.type === 'VIDEO' ? 'video' : 'photo'} and earn points toward VIP chat access
                </p>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                {task.price_usdc != null && (
                  <span className="font-sans text-3xl font-semibold text-white tracking-tight">
                    ${task.price_usdc}
                    <span className="text-sm font-normal text-white/40 ml-1.5">USDC</span>
                  </span>
                )}
                {task.points > 0 && (
                  <span className="flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full text-gold border border-gold/20 bg-gold/[0.08]">
                    ✦ {task.points} devotion points
                  </span>
                )}
              </div>
            </div>

            {/* ── Section 3: Description + instructions ── */}
            {(task.description || (task.instructions && task.instructions !== task.description)) && (
              <div className="px-6 py-8 space-y-6">
                {task.description && (
                  <div className="space-y-2">
                    <p className="font-sans text-xs font-semibold tracking-[0.15em] uppercase text-white/30">
                      The task
                    </p>
                    <p className="font-sans text-[15px] text-white/70 leading-relaxed whitespace-pre-wrap">
                      {task.description}
                    </p>
                  </div>
                )}
                {task.instructions && task.instructions !== task.description && (
                  <div className="space-y-2">
                    <p className="font-sans text-xs font-semibold tracking-[0.15em] uppercase text-white/30">
                      Instructions
                    </p>
                    <p className="font-sans text-[15px] text-white/70 leading-relaxed whitespace-pre-wrap">
                      {task.instructions}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Section 4: Task-type specific design moment ── */}
            <div className="px-6 mb-8">
              {/* REPETITION: The Oath Block */}
              {task.task_type === 'REPETITION' && task.repetition_phrase && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 relative overflow-hidden">
                  <span className="absolute top-1 left-4 font-serif text-8xl text-white/[0.04] leading-none select-none pointer-events-none">
                    &ldquo;
                  </span>
                  <p className="font-sans text-xs tracking-[0.15em] uppercase text-white/30 mb-4 relative z-10">
                    You will type this {task.required_repetitions}× without pasting
                  </p>
                  <p className="font-serif text-xl italic text-white/80 leading-snug relative z-10">
                    {task.repetition_phrase}
                  </p>
                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                    <p className="text-xs text-white/30">
                      {task.required_repetitions} repetitions · paste disabled · auto-approved on completion
                    </p>
                  </div>
                </div>
              )}

              {/* SUBMISSION: The Confession Prompt */}
              {task.task_type === 'SUBMISSION' && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <p className="font-sans text-xs tracking-[0.15em] uppercase text-white/30 mb-4">
                    Your declaration
                  </p>
                  <p className="font-serif text-lg text-white/60 leading-relaxed italic">
                    {task.instructions || 'Write your personal declaration for review.'}
                  </p>
                  <div className="mt-5 pt-4 border-t border-white/[0.06]">
                    <p className="text-xs text-white/30">
                      Reviewed personally by {domName} · paste disabled
                    </p>
                  </div>
                </div>
              )}

              {/* EVIDENCE: The Challenge Card */}
              {task.task_type === 'EVIDENCE' && (
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
                        {task.instructions || 'Upload photo evidence of your devotion.'}
                      </p>
                      <p className="text-xs text-white/30 mt-2">
                        {domName} reviews all evidence before approving.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENT: preview (locked) or player (unlocked) */}
              {task.task_type === 'CONTENT' && (() => {
                const asset = task.media_asset
                const isVideo = asset?.type === 'VIDEO'
                const libraryId = process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID

                // ── Unlocked: show playable content ──
                if (isUnlocked) {
                  if (isVideo && asset?.playback_ref && libraryId) {
                    return (
                      <div className="-mx-6 overflow-hidden" style={{ aspectRatio: '9/16' }}>
                        <iframe
                          src={`https://iframe.mediadelivery.net/embed/${libraryId}/${asset.playback_ref}?autoplay=false&responsive=true`}
                          className="w-full h-full"
                          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )
                  }
                  // Image unlock — show full image
                  const fullPath = asset?.bunny_url || asset?.bunny_preview_url || asset?.thumbnail_url || task.cover_image_url
                  const fullUrl = fullPath ? getBunnyStorageUrl(fullPath) : null
                  return fullUrl ? (
                    <div className="rounded-2xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fullUrl} alt={task.title} className="w-full object-contain" />
                    </div>
                  ) : null
                }

                // ── Locked: blurred preview ──
                const previewPath = isVideo
                  ? (task.cover_image_url || asset?.bunny_preview_url || asset?.thumbnail_url || null)
                  : (asset?.bunny_preview_url || asset?.thumbnail_url || task.cover_image_url || null)
                const previewUrl = previewPath ? getBunnyStorageUrl(previewPath) : null

                return (
                  <div className="rounded-2xl overflow-hidden relative" style={{ aspectRatio: '1/1' }}>
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Locked content preview"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={isVideo ? { filter: 'brightness(0.7)' } : { filter: 'blur(7px) brightness(0.55)' }}
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
              })()}
            </div>


            {/* ── Section 6: Your devotion earns (sub, published tasks only, not yet unlocked) ── */}
            {!isOwner && task.status === 'PUBLISHED' && !isUnlocked && (
              <div className="px-6 pb-8">
                <p className="font-sans text-xs tracking-[0.15em] uppercase text-white/25 mb-4">
                  Your devotion earns
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-0.5 h-4 rounded-full bg-white/20 shrink-0" />
                    <p className="font-sans text-sm text-white/50">Unlock this exclusive content instantly</p>
                  </div>
                  {task.points > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-0.5 h-4 rounded-full bg-gold shrink-0" />
                      <p className="font-sans text-sm text-white/50">
                        Earn <span className="text-gold font-medium">{task.points} devotion points</span> toward VIP chat access
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-0.5 h-4 rounded-full bg-white/20 shrink-0" />
                    <p className="font-sans text-sm text-white/50">
                      Build your standing with {domName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-0.5 h-4 rounded-full bg-white/20 shrink-0" />
                    <p className="font-sans text-sm text-white/50">Permanent access in your collection</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        ) : (

          /* ── Edit mode: consolidated block ── */
          <div ref={editBlockRef} className="max-w-[612px] mx-auto px-4 mt-6">
            <div className="bg-gray-950/90 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Editing task</p>
              </div>
              <EditField label="Title" value={form.title} onChange={set('title')} placeholder="Task title" />
              <div className="flex gap-3">
                <div className="flex-1">
                  <EditField label="Price (USDC)" value={form.price_usdc} onChange={set('price_usdc')} type="number" placeholder="0.00" hint="Leave blank for free" />
                </div>
                <div className="flex-1">
                  <EditField label="Points" value={form.points} onChange={set('points')} type="number" placeholder="0" />
                </div>
              </div>
              <EditField label="Description" value={form.description} onChange={set('description')} type="textarea" placeholder="Describe this task to your subs…" />
              <EditField label="Instructions" value={form.instructions} onChange={set('instructions')} type="textarea" placeholder="Step-by-step instructions for the sub…" />
              {task.task_type === 'REPETITION' && (
                <>
                  <EditField label="Phrase to type" value={form.repetition_phrase} onChange={set('repetition_phrase')} placeholder="e.g. I exist to serve you" />
                  <EditField label="Required repetitions" value={form.required_repetitions} onChange={set('required_repetitions')} type="number" placeholder="e.g. 100" />
                </>
              )}
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
            </div>
          </div>

        )}
      </div>

      {/* ── Fixed bottom CTA bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
        {/* Gradient fade above bar */}
        <div className="h-16 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        <div className="bg-black px-4 pb-4 pt-1">
          <div className="max-w-[612px] mx-auto space-y-2">

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
                  onClick={handleEditStart}
                  className="w-full py-3.5 rounded-2xl border border-gray-700 text-white font-semibold text-sm hover:border-gray-500 transition-colors"
                >
                  Edit task
                </button>
              )
            ) : task.status === 'PUBLISHED' && !isUnlocked ? (
              <button
                onClick={handleAccept}
                disabled={!resolved || submitting}
                className="w-full py-4 rounded-2xl font-sans font-semibold text-base bg-white text-black hover:bg-gray-100 animate-gold-pulse disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Processing…' : `Buy Now${task.price_usdc != null ? ` $${task.price_usdc} USDC` : ''}`}
              </button>
            ) : null}

          </div>
        </div>
      </div>
    </>
  )
}
