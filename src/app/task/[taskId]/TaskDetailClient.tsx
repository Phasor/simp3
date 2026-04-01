'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'
import { createClient } from '@/lib/supabase/client'
import TaskVisualBlock from './TaskVisualBlock'
import DomCard from './DomCard'
import ChatProgressCard from './ChatProgressCard'

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

// ── CTA copy by task type ──────────────────────────────────────────────────────
function getCtaCopy(taskType: string | null, priceUsdc: number | null) {
  const priceStr = priceUsdc != null ? `  $${priceUsdc}` : ''
  if (taskType === 'CONTENT') return `View Now${priceStr}`
  return `Accept Task${priceStr}`
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
  const searchParams = useSearchParams()
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
  const [isUnlocked, setIsUnlocked] = useState(searchParams.get('from') === 'library')
  const [secureMediaUrl, setSecureMediaUrl] = useState<{ url: string; type: string; embed: boolean } | null>(null)

  useEffect(() => {
    if (task.task_type !== 'CONTENT' || !profile?.id) return
    const sb = createClient()
    sb.from('task_completions')
      .select('id')
      .eq('task_id', task.id)
      .eq('fan_id', profile.id)
      .eq('status', 'APPROVED')
      .maybeSingle()
      .then(({ data }) => setIsUnlocked(!!data))
  }, [task.id, task.task_type, profile?.id])

  useEffect(() => {
    if (!isUnlocked || !task.media_id || !profile?.id) return
    fetch(`/api/content/${task.media_id}/signed-url`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.url) setSecureMediaUrl(data) })
      .catch(() => {})
  }, [isUnlocked, task.media_id, profile?.id])

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
      setIsUnlocked(true)
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

  const ctaCopy = getCtaCopy(task.task_type, task.price_usdc)
  const showSubCta = !isOwner && task.status === 'PUBLISHED' && !isUnlocked

  // ── Ceremony: animating ────────────────────────────────────────────────────
  if (payPhase === 'animating') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 overflow-hidden">
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

  // ── Edit mode: full-width single column ──────────────────────────────────
  if (editing) {
    return (
      <>
        <div className="min-h-screen bg-black text-white pb-[calc(100px+env(safe-area-inset-bottom))]">
          {/* Nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <Link
              href="/dashboard/tasks"
              className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              My tasks
            </Link>
            <div className="flex items-center gap-2">
              {task.status !== 'PUBLISHED' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">
                  {task.status === 'DRAFT' ? 'Draft' : 'Archived'}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs font-medium text-white/40 px-2.5 py-1.5 rounded-full border border-white/10">
                {meta.icon}
                {meta.label}
              </span>
            </div>
          </div>

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
        </div>

        {/* Edit mode bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
          <div className="h-16 bg-gradient-to-t from-black to-transparent pointer-events-none" />
          <div className="bg-black px-4 pb-4 pt-1">
            <div className="max-w-[612px] mx-auto flex gap-2">
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
          </div>
        </div>
      </>
    )
  }

  // ── Main render: two-column layout ────────────────────────────────────────
  return (
    <>
      {showAuth && <AuthPromptModal onClose={() => setShowAuth(false)} taskId={task.id} />}

      <div className="min-h-screen bg-black text-white pb-24 lg:pb-8">

        {/* ── Navbar: shown only for logged-out users and dom owners (subs get SubBottomNav) ── */}
        {resolved && (!profile || isOwner) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
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

        {/* ── Page header: full width above two columns ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 mb-6">
          {/* Back link (sub view, mobile only — desktop has nav) */}
          {!isOwner && !!profile && dom.handle && (
            <Link
              href={`/${dom.handle}`}
              className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-4 lg:hidden"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          )}

          {/* Task title + dom name */}
          <div>
            {task.task_type !== 'CONTENT' && (
              <p className="font-serif italic text-sm mb-3 leading-relaxed text-gold">
                {meta.flavour}
              </p>
            )}
            <h1
              className="font-serif font-medium leading-tight text-white mb-2"
              style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)' }}
            >
              {task.title}
            </h1>
            <Link
              href={dom.handle ? `/${dom.handle}` : '#'}
              className="inline-flex items-center gap-2 text-white/50 hover:text-white/70 transition-colors"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 ring-1 ring-gold/30">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={domName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-900 flex items-center justify-center font-serif text-xs text-white/40">
                    {domName[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium">by {domName}</span>
            </Link>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_420px] lg:gap-8">

          {/* ── LEFT COLUMN: visual content ── */}
          <div className="min-w-0">
            {/* Unavailable notice for non-owners on non-published tasks */}
            {!isOwner && task.status !== 'PUBLISHED' && (
              <div className="mb-6">
                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 text-center">
                  <p className="text-gray-400 text-sm">This task is not currently available.</p>
                </div>
              </div>
            )}

            {/* Task-type visual block */}
            <div className="mb-8">
              <TaskVisualBlock
                taskType={task.task_type}
                title={task.title}
                repetitionPhrase={task.repetition_phrase}
                requiredRepetitions={task.required_repetitions}
                instructions={task.instructions}
                domName={domName}
                coverImageUrl={task.cover_image_url}
                mediaAsset={task.media_asset}
                isUnlocked={isUnlocked}
                secureMediaUrl={secureMediaUrl}
                meta={meta}
              />
            </div>

          </div>

          {/* ── RIGHT COLUMN: CTA + progress + about + dom card ── */}
          <div className="lg:sticky lg:top-6 lg:self-start space-y-5 mt-8 lg:mt-0">

            {/* 1. CTA button (desktop — inline; mobile uses fixed bottom bar) */}
            {showSubCta && (
              <button
                onClick={handleAccept}
                disabled={!resolved || submitting}
                className="hidden lg:block w-full py-4 rounded-2xl font-sans font-semibold text-base bg-white text-black hover:bg-gray-100 animate-gold-pulse disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Processing…' : ctaCopy}
              </button>
            )}

            {/* Dom edit button (desktop) */}
            {isOwner && (
              <button
                onClick={handleEditStart}
                className="hidden lg:block w-full py-3.5 rounded-2xl border border-gray-700 text-white font-semibold text-sm hover:border-gray-500 transition-colors"
              >
                Edit task
              </button>
            )}

            {/* 2. Description */}
            {task.description && (
              <div>
                <p className="font-sans font-semibold text-white mb-4">{task.title}</p>
                <p className="font-sans text-xs font-semibold text-white/30 mb-1.5">Item Description</p>
                <p className="font-sans text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* 3. Points badge */}
            {!isOwner && task.points > 0 && task.status === 'PUBLISHED' && !isUnlocked && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gold/[0.06] border border-gold/15">
                <span className="text-2xl">💎</span>
                <div>
                  <p className="text-sm font-semibold text-gold">+{task.points} points</p>
                  <p className="text-xs text-white/40">Earn toward VIP chat access</p>
                </div>
              </div>
            )}

            {/* 3. Chat Access Progress card */}
            {!isOwner && task.status === 'PUBLISHED' && !isUnlocked && (
              <ChatProgressCard
                domId={dom.id}
                domName={domName}
                taskPriceUsdc={Number(task.price_usdc ?? 0)}
                isAuthenticated={!!profile}
              />
            )}

            {/* 4. Instructions */}
            {task.instructions && task.instructions !== task.description && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                <p className="font-sans text-xs font-semibold tracking-[0.15em] uppercase text-white/30">
                  Instructions
                </p>
                <p className="font-sans text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                  {task.instructions}
                </p>
              </div>
            )}

            {/* 5. Dom profile card */}
            <DomCard
              id={dom.id}
              displayName={dom.display_name}
              handle={dom.handle}
              tagline={dom.tagline}
              profilePictureUrl={dom.profile_picture_url}
            />
          </div>
        </div>
      </div>

      {/* ── Fixed bottom CTA bar (mobile only for subs, always for dom owner) ── */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] ${showSubCta ? 'lg:hidden' : ''}`}>
        <div className="h-16 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        <div className="bg-black px-4 pb-4 pt-1">
          <div className="max-w-[612px] mx-auto space-y-2">
            {isOwner ? (
              <button
                onClick={handleEditStart}
                className="w-full py-3.5 rounded-2xl border border-gray-700 text-white font-semibold text-sm hover:border-gray-500 transition-colors lg:hidden"
              >
                Edit task
              </button>
            ) : showSubCta ? (
              <button
                onClick={handleAccept}
                disabled={!resolved || submitting}
                className="w-full py-4 rounded-2xl font-sans font-semibold text-base bg-white text-black hover:bg-gray-100 animate-gold-pulse disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Processing…' : ctaCopy}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
