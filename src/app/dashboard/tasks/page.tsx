'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import toast from 'react-hot-toast'
import TaskBuilder from '@/components/dashboard/TaskBuilder'
import Image from 'next/image'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

function TaskIcon({ task }: { task: Task }) {
  if (task.task_type === 'CONTENT' && task.cover_image_url) {
    return null // rendered separately as a full-height panel
  }
  return <span className="text-xl shrink-0">{TYPE_ICON[task.task_type]}</span>
}

type TaskType = 'REPETITION' | 'SUBMISSION' | 'EVIDENCE' | 'CONTENT'
type TaskStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type CompletionStatus = 'ACCEPTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

interface Task {
  id: string
  title: string
  task_type: TaskType
  status: TaskStatus
  price_usdc: number | null
  points: number
  cover_image_url: string | null
  description: string | null
  instructions: string | null
  repetition_phrase: string | null
  required_repetitions: number | null
  created_at: string
  _count?: number
}

interface Completion {
  id: string
  status: CompletionStatus
  tribute_message: string
  submission_text: string | null
  evidence_url: string | null
  repetition_count: number | null
  accepted_at: string
  submitted_at: string | null
  tasks: { title: string; task_type: TaskType }
  fan_profile: { tribute_alias: string | null; display_name: string | null }
}

const TYPE_ICON: Record<TaskType, string> = {
  REPETITION: '🔁',
  SUBMISSION: '✍️',
  EVIDENCE: '📸',
  CONTENT: '🔒',
}

export default function DashboardTasksPage() {
  const router = useRouter()
  const { user, profile, resolved, supabase: sb } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [tab, setTab] = useState<'tasks' | 'inbox'>('tasks')
  const [showBuilder, setShowBuilder] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const fetchData = useCallback(async (showSpinner = false) => {
    if (!resolved) return
    if (!user) { router.push('/login'); return }
    if (!profile) return // profile still loading
    if (profile.user_type !== 'CREATOR') { router.push('/'); return }

    if (showSpinner) setLoading(true)
    try {
      const { data: tasksData } = await sb
        .from('tasks')
        .select('id, title, task_type, status, price_usdc, points, cover_image_url, description, instructions, repetition_phrase, required_repetitions, created_at')
        .eq('creator_id', profile!.id)
        .order('created_at', { ascending: false })

      const taskIds = (tasksData ?? []).map(t => t.id)

      let completionsData: Completion[] = []
      if (taskIds.length > 0) {
        const { data, error: completionsError } = await sb
          .from('task_completions')
          .select(`
            id, status, tribute_message, submission_text, evidence_url, repetition_count,
            accepted_at, submitted_at,
            tasks ( title, task_type ),
            fan_profile:profiles!fan_id ( tribute_alias, display_name )
          `)
          .in('task_id', taskIds)
          .eq('status', 'SUBMITTED')
          .order('submitted_at', { ascending: true })

        if (completionsError) console.error('Completions query error:', completionsError)
        completionsData = (data as unknown as Completion[]) ?? []
      }

      setTasks(tasksData ?? [])
      setCompletions(completionsData)
    } catch (err) {
      console.error('fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }, [user, profile, resolved, router, sb])

  useEffect(() => { fetchData(true) }, [fetchData])

  async function handleReview(completionId: string, action: 'approve' | 'reject') {
    setReviewing(true)
    try {
      const res = await fetch(`/api/task-completion/${completionId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback: feedbackText || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success(action === 'approve' ? 'Approved!' : 'Rejected')
      setFeedbackId(null)
      setFeedbackText('')
      fetchData()
    } finally {
      setReviewing(false)
    }
  }

  async function handleArchive(taskId: string) {
    await fetch('/api/task/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status: 'ARCHIVED' }),
    })
    fetchData()
  }

  const published = tasks.filter(t => t.status === 'PUBLISHED')
  const drafts = tasks.filter(t => t.status === 'DRAFT')
  const archived = tasks.filter(t => t.status === 'ARCHIVED')

  return (
    <div className="min-h-screen bg-black text-white pb-8">
      <div className="max-w-3xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Tasks</h1>
          <button
            onClick={() => setShowBuilder(true)}
            className="px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            + Create task
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-800">
          {(['tasks', 'inbox'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'tasks' ? 'Tasks' : 'Review Inbox'}
              {t === 'inbox' && completions.length > 0 && (
                <span className="ml-1.5 bg-white text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {completions.length}
                </span>
              )}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : tab === 'tasks' ? (
          <div className="space-y-8">
            {/* Published */}
            <TaskSection
              label="Published"
              tasks={published}
              onEdit={setEditTask}
              onArchive={handleArchive}
              emptyText="No published tasks yet."
            />
            {/* Drafts */}
            {drafts.length > 0 && (
              <TaskSection
                label="Drafts"
                tasks={drafts}
                onEdit={setEditTask}
                onArchive={handleArchive}
              />
            )}
            {/* Archived */}
            {archived.length > 0 && (
              <TaskSection
                label="Archived"
                tasks={archived}
                onEdit={setEditTask}
                onArchive={handleArchive}
                muted
              />
            )}
            {tasks.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-500 text-sm mb-4">No tasks yet.</p>
                <button
                  onClick={() => setShowBuilder(true)}
                  className="px-6 py-3 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100"
                >
                  Create your first task
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Review Inbox */
          <div className="space-y-4">
            {completions.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">
                No pending submissions.
              </div>
            ) : completions.map(c => {
              const alias = c.fan_profile?.tribute_alias ?? c.fan_profile?.display_name ?? 'Anonymous'
              const task = c.tasks as unknown as { title: string; task_type: TaskType }
              return (
                <div key={c.id} className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">{alias}</div>
                      <div className="font-medium text-sm text-white">
                        {TYPE_ICON[task.task_type]} {task.title}
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">
                      {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString() : ''}
                    </span>
                  </div>

                  {/* Tribute message */}
                  {c.tribute_message && (
                    <div className="bg-gray-900 rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-1">Tribute message</div>
                      <p className="text-sm text-gray-300 italic">&ldquo;{c.tribute_message}&rdquo;</p>
                    </div>
                  )}

                  {/* Submission text */}
                  {c.submission_text && (
                    <div className="bg-gray-900 rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-1">Submission</div>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{c.submission_text}</p>
                    </div>
                  )}

                  {/* Evidence image */}
                  {c.evidence_url && (
                    <div>
                      <div className="text-xs text-gray-500 mb-2">Evidence</div>
                      <a href={getBunnyStorageUrl(c.evidence_url)} target="_blank" rel="noreferrer">
                        <Image
                          src={getBunnyStorageUrl(c.evidence_url)}
                          alt="Evidence"
                          width={400}
                          height={300}
                          className="rounded-xl max-h-64 object-cover w-full"
                        />
                      </a>
                    </div>
                  )}

                  {/* Repetition count */}
                  {task.task_type === 'REPETITION' && c.repetition_count != null && (
                    <div className="text-xs text-gray-400">
                      Completed {c.repetition_count} repetitions
                    </div>
                  )}

                  {/* Feedback input (shown when a button is clicked) */}
                  {feedbackId === c.id && (
                    <textarea
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      placeholder="Optional feedback for the sub…"
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
                    />
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (feedbackId !== c.id) { setFeedbackId(c.id); setFeedbackText('') }
                        else handleReview(c.id, 'approve')
                      }}
                      disabled={reviewing}
                      className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      {feedbackId === c.id ? 'Confirm approve' : 'Approve'}
                    </button>
                    <button
                      onClick={() => {
                        if (feedbackId !== c.id) { setFeedbackId(c.id); setFeedbackText('') }
                        else handleReview(c.id, 'reject')
                      }}
                      disabled={reviewing}
                      className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm font-semibold hover:border-gray-500 disabled:opacity-50 transition-colors"
                    >
                      {feedbackId === c.id ? 'Confirm reject' : 'Reject'}
                    </button>
                    {feedbackId === c.id && (
                      <button
                        onClick={() => { setFeedbackId(null); setFeedbackText('') }}
                        className="px-3 py-2.5 rounded-xl border border-gray-800 text-gray-500 text-sm hover:text-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showBuilder && (
        <TaskBuilder
          onClose={() => setShowBuilder(false)}
          onCreated={() => { setShowBuilder(false); fetchData() }}
        />
      )}
      {editTask && (
        <TaskBuilder
          editTask={editTask}
          onClose={() => setEditTask(null)}
          onCreated={() => { setEditTask(null); fetchData() }}
        />
      )}
    </div>
  )
}

function TaskSection({
  label,
  tasks,
  onEdit,
  onArchive,
  emptyText,
  muted = false,
}: {
  label: string
  tasks: Task[]
  onEdit: (task: Task) => void
  onArchive: (id: string) => void
  emptyText?: string
  muted?: boolean
}) {
  return (
    <div>
      <h2 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${muted ? 'text-gray-600' : 'text-gray-400'}`}>
        {label}
      </h2>
      {tasks.length === 0 && emptyText ? (
        <p className="text-gray-600 text-sm">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const isContentWithCover = task.task_type === 'CONTENT' && task.cover_image_url
            return (
              <div
                key={task.id}
                onClick={() => onEdit(task)}
                className={`flex items-center h-16 rounded-xl border px-2 gap-3 hover:border-gray-600 transition-colors cursor-pointer ${muted ? 'border-gray-900 bg-gray-950/50' : 'border-gray-800 bg-gray-950'}`}
              >
                {isContentWithCover && (
                  <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden">
                    <Image
                      src={getBunnyStorageUrl(task.cover_image_url!)}
                      alt={task.title}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-1 items-center gap-4 pr-1 min-w-0">
                  {!isContentWithCover && <TaskIcon task={task} />}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm truncate ${muted ? 'text-gray-500' : 'text-white'}`}>
                      {task.title}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {task.task_type.charAt(0) + task.task_type.slice(1).toLowerCase()}
                      {task.price_usdc ? ` · $${task.price_usdc} USDC` : ''}
                      {task.points ? ` · ${task.points} pts` : ''}
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
