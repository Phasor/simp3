'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

type TaskType = 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT'

interface Props {
  onClose: () => void
  onCreated: () => void
}

const TYPE_OPTIONS: { value: TaskType; label: string; description: string }[] = [
  { value: 'REPETITION', label: 'Repetition', description: 'Sub types a phrase N times — auto-approved on completion.' },
  { value: 'SUBMISSION', label: 'Submission', description: 'Sub writes a personal declaration — you review and approve.' },
  { value: 'EVIDENCE', label: 'Evidence', description: 'Sub uploads a photo proving completion — you review.' },
  { value: 'CONTENT', label: 'Content', description: 'Sub pays to unlock a specific photo or video you choose.' },
]

export default function TaskBuilder({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<'type' | 'details'>('type')
  const [taskType, setTaskType] = useState<TaskType | null>(null)
  const [loading, setLoading] = useState(false)

  // Fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [priceUsdc, setPriceUsdc] = useState('')
  const [points, setPoints] = useState('')
  const [repetitionPhrase, setRepetitionPhrase] = useState('')
  const [requiredRepetitions, setRequiredRepetitions] = useState('')

  async function handleCreate() {
    if (!taskType || !title) return
    setLoading(true)
    try {
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
          status: 'PUBLISHED',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to create task'); return }
      toast.success('Task published!')
      onCreated()
    } catch {
      toast.error('Failed to create task')
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
            {step === 'type' ? 'Create a task' : `New ${taskType?.charAt(0) + taskType!.slice(1).toLowerCase()} task`}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Step 1: choose type */}
          {step === 'type' && (
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
              <button onClick={() => setStep('type')} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Change type
              </button>

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

              {/* Description — not shown for CONTENT */}
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

              {/* Instructions — not shown for CONTENT */}
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

              {/* REPETITION fields */}
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

              {/* Price + Points */}
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
              onClick={handleCreate}
              disabled={loading || !title || (taskType === 'REPETITION' && (!repetitionPhrase || !requiredRepetitions))}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? 'Publishing…' : 'Publish task'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
