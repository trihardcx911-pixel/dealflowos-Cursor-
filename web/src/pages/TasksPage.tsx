import { useMemo, useState } from 'react'
import BackToDashboard from '../components/BackToDashboard'

type Task = {
  id: string
  title: string
  status: 'due soon' | 'today' | 'new'
}

const presetTasks: Task[] = [
  { id: '1', title: 'Call seller follow-ups', status: 'due soon' },
  { id: '2', title: 'Prep deal review packet', status: 'today' },
]

const makeId = () => crypto.randomUUID?.() ?? `task-${Date.now().toString(36)}`

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(presetTasks)
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const statusTag = useMemo(() => (tasks.length % 2 === 0 ? 'today' : 'new'), [tasks.length])

  const handleAddTask = () => {
    if (!draft.trim()) return
    setTasks((prev) => [{ id: makeId(), title: draft.trim(), status: statusTag }, ...prev])
    setDraft('')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddTask()
    }
  }

  return (
    <section className="space-y-6">
      <BackToDashboard />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Focus</p>
        <h1 className="text-3xl font-semibold text-white">Tasks</h1>
        <p className="text-sm text-slate-400">Swipe-in reminders inspired by Apple’s stack.</p>
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
          className="neon-glass grid h-11 w-11 place-items-center text-2xl font-bold text-white cursor-pointer glass-tile neon-border"
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
          className="flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
          style={{
            minWidth: 120,
            transition: 'max-width 0.25s ease',
            maxWidth: focused || draft ? '100%' : '60%',
          }}
        />
      </div>

      <ul className="space-y-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="neon-glass flex items-center justify-between px-4 py-4"
          >
            <div>
              <p className="text-lg font-semibold text-white">{task.title}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">{task.status}</p>
            </div>
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80">
              local
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500">Backend wiring TBD — tasks persist locally for now.</p>
    </section>
  )
}
