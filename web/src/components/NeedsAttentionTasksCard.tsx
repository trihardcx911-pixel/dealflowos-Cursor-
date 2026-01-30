import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { get } from '../api'
import { extractTasksArray } from '../api/tasks'

type Task = {
  id: string
  title: string
  status: 'pending' | 'completed' | 'cancelled'
  urgency?: 'low' | 'medium' | 'critical'
  dueAt?: string | null
}

/**
 * Helper: Check if a Date is valid (not NaN)
 */
function isValidDate(d: Date): boolean {
  return !isNaN(d.getTime())
}

/**
 * Helper: Parse dueAt string to Date, or return null if invalid
 */
function parseDue(dueAt?: string | null): Date | null {
  if (!dueAt) return null
  const date = new Date(dueAt)
  return isValidDate(date) ? date : null
}

/**
 * Get urgency icon and color
 * - critical → AlertTriangle with red
 * - medium → AlertCircle with yellow
 * - low → Info with blue
 * - missing/unknown → defaults to medium
 */
function getUrgencyIcon(urgency?: 'low' | 'medium' | 'critical') {
  const normalized = urgency || 'medium'
  switch (normalized) {
    case 'critical':
      return { Icon: AlertTriangle, color: 'text-[#ff0a45]' }
    case 'medium':
      return { Icon: AlertCircle, color: 'text-yellow-400' }
    case 'low':
      return { Icon: Info, color: 'text-blue-400/70' }
    default:
      return { Icon: AlertCircle, color: 'text-yellow-400' }
  }
}

/**
 * Format task due date for display
 * - invalid/empty => "No due date"
 * - overdue => "Overdue Xh" (hours <24, clamped to min 1h) else "Overdue Xd"
 * - today => "Today 2:00 PM"
 * - future => "Jan 26, 2:00 PM"
 */
function formatTaskDueDate(dueAt: string | null | undefined): string {
  if (!dueAt) return 'No due date'
  const date = parseDue(dueAt)
  if (!date) return 'No due date'

  const now = new Date()

  // Overdue
  if (date < now) {
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 24) {
      // Clamp to minimum 1h to avoid "Overdue 0h"
      return `Overdue ${Math.max(1, diffHours)}h`
    }
    const diffDays = Math.floor(diffHours / 24)
    return `Overdue ${diffDays}d`
  }

  // Today
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return `Today ${date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })}`
  }

  // Future date
  return (
    date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }) +
    ', ' +
    date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  )
}

export function NeedsAttentionTasksCard() {
  const [view, setView] = useState<'triage' | 'missed'>('triage')

  const { data, isLoading, isError, refetch } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await get<{ tasks: Task[] }>('/tasks')
      return extractTasksArray(res)
    },
  })

  const tasks = data ?? []
  const now = new Date()
  const soonCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Derive Missed set (overdue only)
  const missed = tasks.filter((task) => {
    const notCompleted = task.status !== 'completed'
    if (!notCompleted) return false

    const dueDate = parseDue(task.dueAt)
    if (!dueDate) return false

    return dueDate < now
  })

  // Derive Triage set (urgent or due-soon, explicitly NOT overdue)
  const triage = tasks.filter((task) => {
    const notCompleted = task.status !== 'completed'
    if (!notCompleted) return false

    const dueDate = parseDue(task.dueAt)

    // Critical or Medium urgency (but NOT if overdue - overdue goes to Missed)
    if (task.urgency === 'critical' || task.urgency === 'medium') {
      // If it has a due date and it's overdue, exclude from triage
      if (dueDate && dueDate < now) {
        return false
      }
      return true
    }

    // Due soon (within 24h) but NOT overdue
    if (dueDate) {
      return dueDate >= now && dueDate <= soonCutoff
    }

    return false
  })

  // Dev-only assertion: verify no overlap
  if (process.env.NODE_ENV === 'development' || process.env.DEV_DIAGNOSTICS === '1') {
    const triageIds = new Set(triage.map((t) => t.id))
    const missedIds = new Set(missed.map((t) => t.id))
    const overlap = Array.from(triageIds).filter((id) => missedIds.has(id))
    if (overlap.length > 0) {
      console.warn(
        '[NeedsAttentionTasksCard] Overlap detected between Triage and Missed:',
        overlap
      )
    }
  }

  // Attention UNION: unique tasks from triage ∪ missed
  const attentionIds = new Set([...triage.map((t) => t.id), ...missed.map((t) => t.id)])
  const attentionTasks = tasks.filter((t) => attentionIds.has(t.id))

  // Stable counts (union-based, does not change when toggling)
  const total = attentionTasks.length
  const critical = attentionTasks.filter((t) => t.urgency === 'critical').length

  // Compute alert condition: critical due <1h OR any missed tasks
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
  const urgentCriticalSoon = tasks.some((task) => {
    if (task.status === 'completed') return false
    if (task.urgency !== 'critical') return false
    const dueDate = parseDue(task.dueAt)
    if (!dueDate) return false
    return dueDate >= now && dueDate <= oneHourFromNow
  })
  const hasMissed = missed.length > 0
  const shouldAlert = urgentCriticalSoon || hasMissed

  // Active list based on current view
  const activeListRaw = view === 'triage' ? triage : missed

  // Deterministic sorting: critical first, then by dueAt (earliest first), then by id
  const activeList = activeListRaw.slice().sort((a, b) => {
    // Priority 1: Critical urgency first
    const aCritical = a.urgency === 'critical' ? 1 : 0
    const bCritical = b.urgency === 'critical' ? 1 : 0
    if (aCritical !== bCritical) {
      return bCritical - aCritical
    }

    // Priority 2: Earliest dueAt first (valid dates only; invalid/none last)
    const aDue = parseDue(a.dueAt)
    const bDue = parseDue(b.dueAt)
    if (aDue && bDue) {
      return aDue.getTime() - bDue.getTime()
    }
    if (aDue && !bDue) return -1
    if (!aDue && bDue) return 1

    // Priority 3: Stable fallback (id for deterministic order)
    return a.id.localeCompare(b.id)
  })

  return (
    <div className={`dashboard-card flex flex-col min-h-0 h-[280px] min-h-[280px] overflow-hidden ${shouldAlert ? 'dfos-alert-glow' : ''}`}>
      <p className="neon-section-label">Needs Attention</p>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          Needs Attention
        </h2>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-white/10 bg-black/20 px-1 py-1 flex gap-1">
            <button
              onClick={() => setView('triage')}
              className={`px-3 py-1.5 rounded-full text-sm transition ${
                view === 'triage'
                  ? 'bg-white/8 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Triage
            </button>
            <button
              onClick={() => setView('missed')}
              className={`px-3 py-1.5 rounded-full text-sm transition ${
                view === 'missed'
                  ? 'bg-white/8 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Missed
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-white/60 mb-3">
        {critical} critical • {total} total
      </div>

      <div className="dashboard-card-content min-h-0 flex flex-col flex-1">
        <div className="flex-1 min-h-0 overflow-y-auto pb-2 pr-1 dfos-scrollbar" style={{ scrollbarGutter: 'stable' }}>
          {isLoading && (
            <div className="space-y-2 min-h-[120px] flex flex-col justify-center">
              <div className="text-white/60 text-sm">Loading...</div>
            </div>
          )}
          {isError && (
            <div className="space-y-2 min-h-[120px] flex flex-col justify-center">
              <div className="text-sm text-red-400">Failed to load tasks</div>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  refetch()
                }}
                className="px-3 py-1.5 rounded-lg bg-[#ff0a45]/20 border border-[#ff0a45]/40 text-[#ff0a45] hover:bg-[#ff0a45]/30 transition-colors text-xs font-medium w-fit"
              >
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && total === 0 && (
            <div className="text-white/60 text-sm min-h-[120px] flex items-center">
              Nothing needs attention right now.
            </div>
          )}
          {!isLoading && !isError && total > 0 && activeList.length === 0 && (
            <div className="text-white/60 text-sm min-h-[120px] flex items-center">
              {view === 'triage' ? 'No items in Triage' : 'No missed tasks'}
            </div>
          )}
          {!isLoading && !isError && activeList.length > 0 && (
            <div className="space-y-2">
              {activeList.slice(0, 20).map((task) => {
                const { Icon, color } = getUrgencyIcon(task.urgency)
                return (
                  <Link
                    key={task.id}
                    to="/tasks"
                    className="relative block w-full min-h-[64px] px-3 py-2 bg-white/70 backdrop-blur-md border border-slate-200/70 rounded-lg ring-1 ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(0,0,0,0.03)] hover:bg-white/80 hover:border-slate-300/60 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 dark:ring-0 dark:shadow-none transition-colors cursor-pointer"
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/60 via-white/10 to-transparent dark:hidden" />
                    <div className="flex items-start justify-between gap-2 relative z-10">
                      <div className="h-7 w-7 flex-shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white leading-tight line-clamp-1 truncate">
                          {task.title || 'Untitled task'}
                        </div>
                        <div className="text-xs text-white/50 leading-tight mt-0.5">Task</div>
                      </div>
                      <div className="text-xs text-white/60 flex-shrink-0 ml-2 text-right min-w-[84px] whitespace-nowrap">
                        {formatTaskDueDate(task.dueAt)}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

