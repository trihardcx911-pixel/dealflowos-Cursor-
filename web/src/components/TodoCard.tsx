import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { NeonCard } from './NeonCard'
import { t, useLanguage } from '../i18n/i18n'
import { get } from '../api'
import { extractTasksArray } from '../api/tasks'

interface Task {
  id: string
  status: 'pending' | 'completed' | 'cancelled'
  urgency?: 'low' | 'medium' | 'critical'
}

export function TodoCard() {
  const lang = useLanguage()

  const { data, isLoading, isError, refetch } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await get<{ tasks: Task[] }>('/tasks')
      return extractTasksArray(res)
    },
  })

  const tasks = data ?? []

  // Filter to pending tasks only
  const pendingTasks = tasks.filter(t => t.status === 'pending')

  // Normalize urgency (fallback to 'medium' if missing/invalid)
  const normalizeUrgency = (urgency?: string): 'low' | 'medium' | 'critical' => {
    if (urgency && ['low', 'medium', 'critical'].includes(urgency)) {
      return urgency as 'low' | 'medium' | 'critical'
    }
    return 'medium'
  }

  // Compute counts
  const total = pendingTasks.length
  const counts = {
    low: pendingTasks.filter(t => normalizeUrgency(t.urgency) === 'low').length,
    medium: pendingTasks.filter(t => normalizeUrgency(t.urgency) === 'medium').length,
    critical: pendingTasks.filter(t => normalizeUrgency(t.urgency) === 'critical').length,
  }

  // Compute percentages
  const pct = (n: number) => total === 0 ? 0 : Math.round((n / total) * 100)
  const lowPct = pct(counts.low)
  const medPct = pct(counts.medium)
  const critPct = pct(counts.critical)

  return (
    <Link to="/tasks" className="block">
      <NeonCard
        sectionLabel={t('dashboard.tasks')}
        title={t('dashboard.todoList')}
        colSpan={4}
      >
        <div className="space-y-dfos-3 flex-1 min-h-0">
          {isLoading && (
            <div className="text-sm text-white/60">Loading tasks...</div>
          )}
          {isError && (
            <div className="space-y-2">
              <div className="text-sm text-red-400">Failed to load tasks</div>
              <button
                onClick={() => refetch()}
                className="px-3 py-1.5 rounded-lg bg-[#ff0a45]/20 border border-[#ff0a45]/40 text-[#ff0a45] hover:bg-[#ff0a45]/30 transition-colors text-xs font-medium"
              >
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && (
            <div>
              {/* Headline Metric */}
              <div>
                <div className="text-2xl font-semibold tracking-tight text-white leading-tight">
                  {total}
                </div>
                <div className="text-xs text-white/50 mt-0.5 leading-tight">
                  tasks to do
                </div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/30 mt-1 leading-tight">
                  Urgency distribution
                </div>
              </div>

              {/* Urgency Distribution Bars */}
              <div className="space-y-dfos-2">
            {/* Low */}
            <div className="flex items-center gap-dfos-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 w-10">
                LOW
              </div>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/25 rounded-full transition-all duration-300"
                  style={{ width: `${lowPct}%` }}
                >
                  {lowPct > 0 && (
                    <div className="h-full w-full bg-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]" />
                  )}
                </div>
              </div>
              <div className="text-xs text-blue-300/80 font-medium w-10 text-right">
                {lowPct}%
              </div>
            </div>

            {/* Medium */}
            <div className="flex items-center gap-dfos-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 w-10">
                MED
              </div>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500/25 rounded-full transition-all duration-300"
                  style={{ width: `${medPct}%` }}
                >
                  {medPct > 0 && (
                    <div className="h-full w-full bg-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.15)]" />
                  )}
                </div>
              </div>
              <div className="text-xs text-yellow-300/90 font-medium w-10 text-right">
                {medPct}%
              </div>
            </div>

            {/* Critical */}
            <div className="flex items-center gap-dfos-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 w-10">
                CRIT
              </div>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff0a45]/25 rounded-full transition-all duration-300"
                  style={{ width: `${critPct}%` }}
                >
                  {critPct > 0 && (
                    <div className="h-full w-full bg-[#ff0a45]/40 shadow-[0_0_10px_rgba(255,10,69,0.12)]" />
                  )}
                </div>
              </div>
              <div className="text-xs text-[#ff0a45]/90 font-medium w-10 text-right">
                {critPct}%
              </div>
            </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-dfos-2">
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/45 leading-tight">
            {total} {t('dashboard.items')}
          </span>
        </div>
      </NeonCard>
    </Link>
  )
}
