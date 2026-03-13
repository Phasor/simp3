'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type TaskType = 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT'

interface Task {
  id: string
  title: string
  task_type: TaskType
  instructions: string | null
  repetition_phrase: string | null
  required_repetitions: number | null
  points: number
  dom: { display_name: string | null; handle: string | null }
}

interface Props {
  task: Task
  completionId: string
}

export default function TaskCompleteClient({ task, completionId }: Props) {
  const router = useRouter()
  const dom = task.dom as { display_name: string | null; handle: string | null }
  const backHref = dom.handle ? `/${dom.handle}` : '/'

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Minimal header */}
      <div className="flex items-center px-4 py-4 border-b border-gray-900">
        <button
          onClick={() => router.push(backHref)}
          className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-white mx-auto pr-7 truncate">{task.title}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {task.task_type === 'REPETITION' && (
          <RepetitionUI task={task} completionId={completionId} backHref={backHref} />
        )}
        {task.task_type === 'SUBMISSION' && (
          <SubmissionUI task={task} completionId={completionId} backHref={backHref} />
        )}
        {task.task_type === 'EVIDENCE' && (
          <EvidenceUI task={task} completionId={completionId} backHref={backHref} />
        )}
      </div>
    </div>
  )
}

// ============================================================
// REPETITION
// ============================================================
function RepetitionUI({ task, completionId, backHref }: { task: Task; completionId: string; backHref: string }) {
  const required = task.required_repetitions ?? 10
  const phrase = task.repetition_phrase ?? ''
  const [input, setInput] = useState('')
  const [count, setCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value

    // Check if user just completed a repetition (typed the phrase + Enter or it exactly matches)
    if (val.trim().toLowerCase() === phrase.trim().toLowerCase()) {
      const next = count + 1
      setCount(next)
      setInput('')

      if (next >= required) {
        handleAutoSubmit(next)
      }
    } else {
      setInput(val)
    }
  }

  async function handleAutoSubmit(finalCount: number) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/task-completion/${completionId}/submit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repetitionCount: finalCount }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        toast.error('Failed to submit — please try again')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <CompletionDone task={task} message="Repetitions complete. Auto-approved!" backHref={backHref} />
  }

  const progress = Math.min((count / required) * 100, 100)

  return (
    <div className="space-y-6">
      {task.instructions && (
        <p className="text-gray-400 text-sm leading-relaxed">{task.instructions}</p>
      )}

      {/* Progress */}
      <div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-4xl font-bold tabular-nums">{count}</span>
          <span className="text-gray-500 text-sm">/ {required}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phrase reference */}
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-1">Type this phrase exactly:</p>
        <p className="text-white font-medium">{phrase}</p>
      </div>

      {/* Input */}
      <input
        type="text"
        value={input}
        onChange={handleInput}
        onPaste={e => e.preventDefault()}
        disabled={submitting}
        placeholder="Type the phrase here…"
        className="w-full px-4 py-3.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 text-sm"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <p className="text-xs text-gray-600 text-center">
        Paste is disabled. You must type each repetition yourself.
      </p>

      {submitting && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

// ============================================================
// SUBMISSION
// ============================================================
function SubmissionUI({ task, completionId, backHref }: { task: Task; completionId: string; backHref: string }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/task-completion/${completionId}/submit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionText: text }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to submit')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <CompletionDone task={task} message="Submission sent. Your dom will review it." backHref={backHref} />
  }

  return (
    <div className="space-y-5">
      {task.instructions && (
        <p className="text-gray-400 text-sm leading-relaxed">{task.instructions}</p>
      )}

      <div>
        <label className="block text-xs text-gray-400 mb-2">Your submission</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onPaste={e => e.preventDefault()}
          placeholder="Write your declaration here…"
          rows={8}
          maxLength={2000}
          className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
          autoComplete="off"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-600">Paste is disabled.</p>
          <span className="text-xs text-gray-600">{text.length}/2000</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
        className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Submitting…' : 'Submit for review'}
      </button>
    </div>
  )
}

// ============================================================
// EVIDENCE
// ============================================================
function EvidenceUI({ task, completionId, backHref }: { task: Task; completionId: string; backHref: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleSubmit() {
    if (!file) return
    setUploading(true)
    try {
      // Upload to Bunny first
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload/evidence', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        toast.error(uploadData.error ?? 'Upload failed')
        return
      }

      // Submit with evidence URL
      const submitRes = await fetch(`/api/task-completion/${completionId}/submit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceUrl: uploadData.url }),
      })
      if (submitRes.ok) {
        setDone(true)
      } else {
        const data = await submitRes.json()
        toast.error(data.error ?? 'Submit failed')
      }
    } finally {
      setUploading(false)
    }
  }

  if (done) {
    return <CompletionDone task={task} message="Evidence uploaded. Your dom will review it." backHref={backHref} />
  }

  return (
    <div className="space-y-5">
      {task.instructions && (
        <p className="text-gray-400 text-sm leading-relaxed">{task.instructions}</p>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !preview && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl transition-colors ${
          preview ? 'border-gray-700' : 'border-gray-800 hover:border-gray-600 cursor-pointer'
        }`}
      >
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Evidence preview" className="w-full rounded-2xl max-h-80 object-cover" />
            <button
              onClick={() => { setFile(null); setPreview(null) }}
              className="absolute top-3 right-3 bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black transition-colors"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="py-14 flex flex-col items-center gap-3 text-gray-500">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Tap to upload or drag image here</span>
            <span className="text-xs text-gray-600">JPEG, PNG, WebP or GIF · max 10 MB</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Uploading…' : 'Submit evidence'}
      </button>
    </div>
  )
}

// ============================================================
// SHARED: done state
// ============================================================
function CompletionDone({ task, message, backHref }: { task: Task; message: string; backHref: string }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-6">✓</div>
      <h2 className="text-xl font-bold text-white mb-3">Complete</h2>
      <p className="text-gray-400 text-sm mb-2">{message}</p>
      {task.points > 0 && (
        <p className="text-gray-500 text-sm mb-10">+{task.points} points earned</p>
      )}
      <button
        onClick={() => router.push(backHref)}
        className="px-8 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-colors"
      >
        Return to profile
      </button>
    </div>
  )
}
