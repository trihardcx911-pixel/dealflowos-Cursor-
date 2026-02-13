import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import BackToDashboard from '../components/BackToDashboard'
import { get, post, del } from '../api'
import { extractTasksArray } from '../api/tasks'
import { parseDueDateFromTitle } from '../utils/parseDueDateFromTitle'
import { TaskEditModal } from '../components/TaskEditModal'

const MAX_TASK_TITLE_LEN = 80

type Task = {
  id: string
  title: string
  status: 'pending' | 'completed' | 'cancelled'
  urgency?: 'low' | 'medium' | 'critical'
  dueAt?: string | null
}

export default function TasksPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await get<{ tasks: Task[] }>('/tasks')
      return extractTasksArray(res)
    },
  })

  const tasks = data ?? []
  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null

  const normalizeUrgency = (urgency?: string): 'low' | 'medium' | 'critical' => {
    if (urgency && ['low', 'medium', 'critical'].includes(urgency)) {
      return urgency as 'low' | 'medium' | 'critical'
    }
    return 'medium'
  }

  const getUrgencyBadge = (urgency?: string) => {
    const normalized = normalizeUrgency(urgency)
    const styles = {
      low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      critical: 'bg-[#ff0a45]/20 text-[#ff0a45] border-[#ff0a45]/30',
    }
    const labels = {
      low: 'LOW',
      medium: 'MEDIUM',
      critical: 'CRITICAL',
    }
    return {
      className: `rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${styles[normalized]}`,
      label: labels[normalized],
    }
  }

  const handleAddTask = async () => {
    const trimmedTitle = draft.trim()
    if (!trimmedTitle) return

    // Parse due date from title
    const { cleanedTitle, dueAtISO } = parseDueDateFromTitle(trimmedTitle)
    
    // Validate cleaned title length
    if (cleanedTitle.length > MAX_TASK_TITLE_LEN) return
    if (!cleanedTitle) return // Don't create empty tasks

    setIsCreating(true)
    try {
      const payload: { title: string; dueAt?: string } = {
        title: cleanedTitle,
      }
      if (dueAtISO) {
        payload.dueAt = dueAtISO
      }
      
      await post('/tasks', payload)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setDraft('')
    } catch (err) {
      console.error('[TasksPage] Failed to create task:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddTask()
    }
  }

  const handleEdit = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTaskId(taskId)
  }

  const handleDeleteClick = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirmId(taskId)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    
    setIsDeleting(true)
    
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['tasks'] })
    
    // Snapshot previous value
    const previousTasks = queryClient.getQueryData<Task[]>(['tasks'])
    
    // Optimistically remove task from cache
    queryClient.setQueryData<Task[]>(['tasks'], (oldTasks) => {
      if (!oldTasks) return oldTasks
      return oldTasks.filter((t) => t.id !== deleteConfirmId)
    })
    
    try {
      await del(`/tasks/${deleteConfirmId}`)
      setDeleteConfirmId(null)
    } catch (err) {
      console.error('[TasksPage] Failed to delete task:', err)
      // Rollback on error
      queryClient.setQueryData(['tasks'], previousTasks)
    } finally {
      setIsDeleting(false)
      // Sync with server truth
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null)
  }

  const handleTaskSave = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleDirectDelete = async (taskId: string) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['tasks'] })
    
    // Snapshot previous value
    const previousTasks = queryClient.getQueryData<Task[]>(['tasks'])
    
    // Optimistically remove task from cache
    queryClient.setQueryData<Task[]>(['tasks'], (oldTasks) => {
      if (!oldTasks) return oldTasks
      return oldTasks.filter((t) => t.id !== taskId)
    })
    
    try {
      await del(`/tasks/${taskId}`)
    } catch (err) {
      console.error('[TasksPage] Failed to delete task:', err)
      // Rollback on error
      queryClient.setQueryData(['tasks'], previousTasks)
    } finally {
      // Sync with server truth
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  }

  return (
    <section className="space-y-6">
      <BackToDashboard />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Focus</p>
        <h1 className="text-3xl font-semibold text-white">Tasks</h1>
      </header>

      <div
        className={[
          'neon-glass flex items-center gap-3 px-4 py-3',
          focused || draft ? 'ring-2 ring-[#ff0a45]/60' : '',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={handleAddTask}
          disabled={isCreating}
          className="neon-glass grid h-11 w-11 place-items-center text-2xl font-bold text-white cursor-pointer glass-tile neon-border disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Quick add a reminder"
          maxLength={MAX_TASK_TITLE_LEN}
          disabled={isCreating}
          className="flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none disabled:opacity-50"
          style={{
            minWidth: 120,
            transition: 'max-width 0.25s ease',
            maxWidth: focused || draft ? '100%' : '60%',
          }}
        />
      </div>

      <ul className="space-y-3">
        {isLoading && (
          <li className="neon-glass flex items-center justify-center px-4 py-8">
            <p className="text-sm text-slate-400">Loading tasks...</p>
          </li>
        )}
        {isError && (
          <li className="neon-glass flex flex-col items-center justify-center gap-3 px-4 py-8">
            <p className="text-sm text-red-400">
              {error instanceof Error ? error.message : 'Failed to load tasks'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-[#ff0a45]/20 border border-[#ff0a45]/40 text-[#ff0a45] hover:bg-[#ff0a45]/30 transition-colors text-sm font-medium"
            >
              Retry
            </button>
          </li>
        )}
        {!isLoading && !isError && tasks.length === 0 && (
          <li className="neon-glass flex items-center justify-center px-4 py-8">
            <p className="text-sm text-slate-400">No tasks yet. Add one above to get started.</p>
          </li>
        )}
        {!isLoading && !isError && tasks.map((task) => {
          const badge = getUrgencyBadge(task.urgency)
          return (
            <li
              key={task.id}
              onClick={() => setEditingTaskId(task.id)}
              className="neon-glass flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div>
                <p className="text-lg font-semibold text-white">{task.title}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">{task.status}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={badge.className}>
                  {badge.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleEdit(task.id, e)}
                  className="h-8 w-8 neon-glass border border-white/10 rounded-lg grid place-items-center text-white/60 hover:text-white/80 hover:bg-white/10 hover:border-[#ff0a45]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0a45]/50 transition-colors"
                  aria-label="Edit task"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(task.id, e)}
                  className="h-8 w-8 neon-glass border border-white/10 rounded-lg grid place-items-center text-white/60 hover:text-white/80 hover:text-[#ff0a45] hover:bg-white/10 hover:border-[#ff0a45]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0a45]/50 transition-colors"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <TaskEditModal
        isOpen={editingTaskId !== null}
        task={editingTask}
        onClose={() => setEditingTaskId(null)}
        onSave={handleTaskSave}
        onRequestDelete={(taskId) => {
          setEditingTaskId(null)
          handleDirectDelete(taskId)
        }}
      />

      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 ${deleteConfirmId ? '' : 'hidden'}`}>
        <div className="neon-glass border border-white/10 rounded-2xl max-w-[420px] w-full p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Delete Task</h3>
          <p className="text-sm text-white/70 mb-6">Are you sure you want to delete this task?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              className="flex-1 h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              No
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="flex-1 h-10 px-4 rounded-xl bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_8px_rgba(255,10,69,0.4)] hover:shadow-[0_0_12px_rgba(255,10,69,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm font-medium"
            >
              {isDeleting ? 'Deleting...' : 'Yes, delete'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
