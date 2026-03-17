'use client'

import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'

type TaskType = 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT'

interface EditTask {
  id: string
  title: string
  task_type: TaskType
  price_usdc: number | null
  points: number
  cover_image_url: string | null
  description: string | null
  instructions: string | null
  repetition_phrase: string | null
  required_repetitions: number | null
}

interface Props {
  onClose: () => void
  onCreated: () => void
  editTask?: EditTask
}

const TYPE_OPTIONS: { value: TaskType; label: string; description: string }[] = [
  { value: 'REPETITION', label: 'Repetition', description: 'Sub types a phrase N times — auto-approved on completion.' },
  { value: 'SUBMISSION', label: 'Submission', description: 'Sub writes a personal declaration — you review and approve.' },
  { value: 'EVIDENCE', label: 'Evidence', description: 'Sub uploads a photo proving completion — you review.' },
  { value: 'CONTENT', label: 'Content', description: 'Sub pays to unlock a specific photo or video you choose.' },
]

async function extractVideoFrame(videoFile: File): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(videoFile)
    video.src = objectUrl
    video.muted = true
    video.currentTime = 0

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(objectUrl); resolve(null); return }
      ctx.drawImage(video, 0, 0)
      URL.revokeObjectURL(objectUrl)
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], 'cover.jpg', { type: 'image/jpeg' }) : null)
      }, 'image/jpeg', 0.85)
    }, { once: true })

    video.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl)
      resolve(null)
    }, { once: true })

    video.load()
  })
}

export default function TaskBuilder({ onClose, onCreated, editTask }: Props) {
  const isEditing = !!editTask
  const [step, setStep] = useState<'type' | 'details'>(isEditing ? 'details' : 'type')
  const [taskType, setTaskType] = useState<TaskType | null>(editTask?.task_type ?? null)
  const [loading, setLoading] = useState(false)

  // Fields
  const [title, setTitle] = useState(editTask?.title ?? '')
  const [description, setDescription] = useState(editTask?.description ?? '')
  const [instructions, setInstructions] = useState(editTask?.instructions ?? '')
  const [priceUsdc, setPriceUsdc] = useState(editTask?.price_usdc != null ? String(editTask.price_usdc) : '')
  const [points, setPoints] = useState(editTask?.points != null ? String(editTask.points) : '')
  const [repetitionPhrase, setRepetitionPhrase] = useState(editTask?.repetition_phrase ?? '')
  const [requiredRepetitions, setRequiredRepetitions] = useState(editTask?.required_repetitions != null ? String(editTask.required_repetitions) : '')

  // Cover image (non-CONTENT tasks)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(editTask?.cover_image_url ?? null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Content media (CONTENT tasks)
  const [contentMediaId, setContentMediaId] = useState<string | null>(null)
  const [contentPreview, setContentPreview] = useState<string | null>(null)
  const [contentIsVideo, setContentIsVideo] = useState(false)
  const contentInputRef = useRef<HTMLInputElement>(null)

  // When editing a CONTENT task, show existing cover as preview via proxy URL
  useEffect(() => {
    if (isEditing && editTask.task_type === 'CONTENT' && editTask.cover_image_url) {
      setContentPreview(`/api/image/${editTask.cover_image_url.replace(/^https?:\/\/[^/]+\//, '')}`)
    }
  }, [isEditing, editTask])

  async function handleCoverUpload(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Please upload an image or video file')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload/task-cover', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
      setCoverImageUrl(data.url)
      setCoverPreview(URL.createObjectURL(file))
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleContentUpload(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Please upload an image or video file')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload/media', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }

      setContentMediaId(data.id)
      setContentIsVideo(file.type.startsWith('video/'))
      setContentPreview(URL.createObjectURL(file))

      const relativePath = (() => {
        try { const u = new URL(data.url); return u.pathname.replace(/^\//, '') } catch { return data.url }
      })()

      if (file.type.startsWith('image/')) {
        setCoverImageUrl(relativePath)
      } else {
        const frame = await extractVideoFrame(file)
        if (frame) {
          const coverForm = new FormData()
          coverForm.append('file', frame)
          const coverRes = await fetch('/api/upload/task-cover', { method: 'POST', body: coverForm })
          const coverData = await coverRes.json()
          if (coverRes.ok) setCoverImageUrl(coverData.url)
        }
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!taskType || !title) return
    setLoading(true)
    try {
      if (isEditing) {
        const res = await fetch('/api/task/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: editTask.id,
            title,
            description: description || '',
            instructions: instructions || '',
            price_usdc: priceUsdc || '',
            points: points || 0,
            repetition_phrase: repetitionPhrase || '',
            required_repetitions: requiredRepetitions || '',
            cover_image_url: coverImageUrl,
            ...(contentMediaId ? { media_id: contentMediaId } : {}),
          }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
        toast.success('Task updated!')
      } else {
        const res = await fetch('/api/task/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || undefined,
            task_type: taskType,
            price_usdc: priceUsdc ? parseFloat(priceUsdc) : undefined,
            points: points ? parseInt(points) : 0,
            instructions: instructions || undefined,
            repetition_phrase: repetitionPhrase || undefined,
            required_repetitions: requiredRepetitions ? parseInt(requiredRepetitions) : undefined,
            media_id: contentMediaId || undefined,
            cover_image_url: coverImageUrl || undefined,
            status: 'PUBLISHED',
          }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? 'Failed to create task'); return }
        toast.success('Task published!')
      }
      onCreated()
    } catch {
      toast.error(isEditing ? 'Failed to save task' : 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">
            {isEditing
              ? `Edit ${taskType?.charAt(0) + taskType!.slice(1).toLowerCase()} task`
              : step === 'type' ? 'Create a task' : `New ${taskType?.charAt(0) + taskType!.slice(1).toLowerCase()} task`}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Step 1: choose type (create only) */}
          {step === 'type' && !isEditing && (
            <div className="space-y-2">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setTaskType(opt.value); setStep('details') }}
                  className="w-full text-left p-4 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors group"
                >
                  <div className="font-medium text-white group-hover:text-white text-sm">{opt.label}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: details */}
          {step === 'details' && taskType && (
            <>
              {!isEditing && (
                <button onClick={() => setStep('type')} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Change type
                </button>
              )}

              {taskType === 'CONTENT' ? (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Content <span className="text-red-500">*</span>{' '}
                    <span className="text-gray-600">(sub unlocks this — shown blurred in feed)</span>
                  </label>
                  <input
                    ref={contentInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleContentUpload(f) }}
                  />
                  {contentPreview ? (
                    <div className="relative rounded-xl overflow-hidden bg-gray-900">
                      {contentIsVideo ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={contentPreview} className="w-full max-h-64 object-contain" muted playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={contentPreview} alt="Content" className="w-full max-h-64 object-contain" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <button
                          onClick={() => { setContentMediaId(null); setContentPreview(null); setCoverImageUrl(null) }}
                          className="text-xs text-white bg-black/60 px-3 py-1.5 rounded-full hover:bg-black/80 transition-colors"
                        >
                          {isEditing ? 'Replace' : 'Remove'}
                        </button>
                      </div>
                      {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => contentInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleContentUpload(f) }}
                      disabled={uploading}
                      className="w-full h-24 rounded-xl border border-dashed border-gray-700 hover:border-gray-500 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-400"
                    >
                      {uploading ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          <span className="text-xs">Upload image or video</span>
                        </>
                      )}
                    </button>
                  )}
                  {contentPreview && !uploading && (
                    <p className="text-xs text-gray-600 mt-1.5">
                      {contentIsVideo ? 'First frame extracted as cover image' : 'This image will appear blurred in subs\' feed'}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Cover image <span className="text-gray-600">(shown blurred in subs&apos; feed)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }}
                  />
                  {coverPreview ? (
                    <div className="relative rounded-xl overflow-hidden bg-gray-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverPreview} alt="Cover" className="w-full max-h-64 object-contain" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <button
                          onClick={() => { setCoverImageUrl(null); setCoverPreview(null) }}
                          className="text-xs text-white bg-black/60 px-3 py-1.5 rounded-full hover:bg-black/80 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleCoverUpload(f) }}
                      disabled={uploading}
                      className="w-full h-24 rounded-xl border border-dashed border-gray-700 hover:border-gray-500 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-400"
                    >
                      {uploading ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          <span className="text-xs">Upload or drag cover image</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={taskType === 'CONTENT' ? 'e.g. Buy my coffee video' : 'e.g. Write 100 lines for me'}
                  maxLength={100}
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600"
                />
              </div>

              {taskType !== 'CONTENT' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What subs see on your profile"
                    rows={2}
                    maxLength={300}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
                  />
                </div>
              )}

              {taskType !== 'CONTENT' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Instructions</label>
                  <textarea
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder="Exactly what the sub must do"
                    rows={2}
                    maxLength={500}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
                  />
                </div>
              )}

              {taskType === 'REPETITION' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Phrase to repeat <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={repetitionPhrase}
                      onChange={e => setRepetitionPhrase(e.target.value)}
                      placeholder="e.g. I exist to serve and tribute"
                      maxLength={200}
                      className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Number of repetitions <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={requiredRepetitions}
                      onChange={e => setRequiredRepetitions(e.target.value)}
                      placeholder="e.g. 100"
                      min={1}
                      max={10000}
                      className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">Price (USDC)</label>
                  <input
                    type="number"
                    value={priceUsdc}
                    onChange={e => setPriceUsdc(e.target.value)}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">Points on completion</label>
                  <input
                    type="number"
                    value={points}
                    onChange={e => setPoints(e.target.value)}
                    placeholder="0"
                    min={0}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {step === 'details' && (
          <div className="px-5 py-4 border-t border-gray-800">
            <button
              onClick={handleSave}
              disabled={
                loading || uploading || !title ||
                (taskType === 'REPETITION' && (!repetitionPhrase || !requiredRepetitions)) ||
                (!isEditing && taskType === 'CONTENT' && !contentMediaId)
              }
              className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? 'Saving…' : uploading ? 'Uploading…' : isEditing ? 'Save changes' : 'Publish task'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
