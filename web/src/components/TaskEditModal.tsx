import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { patch } from '../api'
import { parseDueDateFromTitle } from '../utils/parseDueDateFromTitle'

const MAX_TASK_TITLE_LEN = 80

interface TaskEditModalProps {
  isOpen: boolean
  task: {
    id: string
    title: string
    status: 'pending' | 'completed' | 'cancelled'
    urgency?: 'low' | 'medium' | 'critical'
    dueAt?: string | null
  } | null
  onClose: () => void
  onSave: () => void
  onSavedTask?: (info: { id: string; status: 'pending' | 'completed' | 'cancelled' }) => void
  onRequestDelete?: (taskId: string) => void
}

export function TaskEditModal({ isOpen, task, onClose, onSave, onSavedTask, onRequestDelete }: TaskEditModalProps) {
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'critical'>('medium')
  const [status, setStatus] = useState<'pending' | 'completed' | 'cancelled'>('pending')
  const [clearDueAt, setClearDueAt] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setUrgency(task.urgency || 'medium')
      setStatus(task.status)
      setClearDueAt(false)
      setError(null)
    }
  }, [task])

  const handleSave = async () => {
    if (!task) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Title is required')
      return
    }
    if (trimmedTitle.length > MAX_TASK_TITLE_LEN) {
      setError(`Title must be ${MAX_TASK_TITLE_LEN} characters or less`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: {
        title?: string
        urgency?: 'low' | 'medium' | 'critical'
        status?: 'pending' | 'completed' | 'cancelled'
        dueAt?: string | null
      } = {}

      // Clear due date if requested (takes precedence)
      if (clearDueAt && task.dueAt) {
        payload.dueAt = null
      }

      // Title changed
      if (trimmedTitle !== task.title) {
        if (!clearDueAt) {
          // Parse dueAt from title (regardless of existing dueAt)
          const { cleanedTitle, dueAtISO } = parseDueDateFromTitle(trimmedTitle)
          if (cleanedTitle.length > MAX_TASK_TITLE_LEN) {
            setError(`Title must be ${MAX_TASK_TITLE_LEN} characters or less`)
            setSaving(false)
            return
          }
          payload.title = cleanedTitle
          // Only set dueAt when parser found one (overwrites existing dueAt)
          if (dueAtISO) {
            payload.dueAt = dueAtISO
          }
          // If dueAtISO is null, do not set payload.dueAt (preserves existing dueAt)
        } else {
          // Clearing due date, but still allow title update without parsing
          payload.title = trimmedTitle
        }
      }

      // Urgency changed
      if (urgency !== (task.urgency || 'medium')) {
        payload.urgency = urgency
      }

      // Status changed
      if (status !== task.status) {
        payload.status = status
      }

      // If user is attempting to save with Completed=true, trigger delete confirmation instead
      if (status === 'completed') {
        onRequestDelete?.(task.id)
        onClose()
        return
      }

      // Only send if there are changes
      if (Object.keys(payload).length > 0) {
        await patch(`/tasks/${task.id}`, payload)
        // Determine the final status after save
        const finalStatus = payload.status !== undefined ? payload.status : task.status
        onSave()
        onSavedTask?.({ id: task.id, status: finalStatus })
        onClose()
      } else {
        onClose()
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  const formatDueDate = (dueAt: string | null | undefined): string => {
    if (!dueAt) return 'No due date'
    try {
      const date = new Date(dueAt)
      if (isNaN(date.getTime())) return 'Invalid date'
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      if (isToday) {
        return `Today ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`
      }
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
    } catch {
      return 'Invalid date'
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 ${isOpen ? '' : 'hidden'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-edit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="neon-glass w-full max-w-[520px] max-h-[calc(100vh-24px)] sm:max-h-[80vh] overflow-hidden rounded-2xl flex flex-col shadow-[0_0_20px_rgba(255,10,69,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 sm:px-6 sm:py-4 border-b border-white/10">
          <h2 id="task-edit-modal-title" className="text-lg sm:text-xl font-semibold text-white">Edit Task</h2>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0a45]/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto min-h-0 px-5 py-5 sm:px-6 sm:py-6 space-y-5 sm:space-y-6 pb-2">

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_TASK_TITLE_LEN}
                disabled={saving}
                className="w-full px-4 py-2.5 sm:py-3 text-base neon-glass border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60 focus:border-[#ff0a45]/40 transition-all disabled:opacity-50"
              />
              <div className="text-xs text-white/50 mt-1 text-right">
                {title.length}/{MAX_TASK_TITLE_LEN}
              </div>
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Urgency</label>
              <div className="neon-glass border border-white/10 rounded-xl p-1 flex gap-1">
                {(['low', 'medium', 'critical'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setUrgency(level)}
                    disabled={saving}
                    className={`flex-1 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50 ${
                      urgency === level
                        ? level === 'low'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                          : level === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.15)]'
                          : 'bg-[#ff0a45]/20 text-[#ff0a45] border border-[#ff0a45]/40 shadow-[0_0_8px_rgba(255,10,69,0.15)]'
                        : 'bg-transparent text-white/60 border border-transparent hover:bg-white/5 hover:text-white/80'
                    }`}
                  >
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Status (Completed toggle) */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={status === 'completed'}
                  onChange={(e) => setStatus(e.target.checked ? 'completed' : 'pending')}
                  disabled={saving}
                  className="tron-checkbox"
                />
                <span className="text-sm text-white/80 group-hover:text-white transition-colors">Completed</span>
              </label>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Due Date</label>
              <div className="neon-glass border border-white/10 rounded-xl px-4 py-2.5 sm:py-3 text-sm text-white/70">
                {formatDueDate(task?.dueAt || null)}
              </div>
              {task?.dueAt && (
                <button
                  onClick={() => setClearDueAt(!clearDueAt)}
                  disabled={saving}
                  className="mt-2 text-xs text-white/50 hover:text-white/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed underline underline-offset-2"
                >
                  {clearDueAt ? 'Keep due date' : 'Clear due date'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-3 px-5 py-3 sm:px-6 sm:py-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={saving}
            className="w-full sm:flex-1 h-10 sm:h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:flex-1 h-10 sm:h-11 px-4 rounded-xl bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_8px_rgba(255,10,69,0.4)] hover:shadow-[0_0_12px_rgba(255,10,69,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
