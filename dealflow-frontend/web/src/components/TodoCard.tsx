import { Link } from 'react-router-dom'
import { NeonCard } from './NeonCard'

export function TodoCard() {
  const todos = [
    { id: '1', title: 'Call seller follow-ups', urgent: true },
    { id: '2', title: 'Prep deal review packet', urgent: false },
    { id: '3', title: 'Update CRM records', urgent: false },
  ]

  return (
    <Link to="/tasks" className="block">
      <NeonCard
        sectionLabel="TASKS"
        title="To-Do List"
        colSpan={4}
      >
        <div className="space-y-3 flex-1">
          {todos.slice(0, 3).map((todo) => (
            <div key={todo.id} className="flex items-center gap-3">
              <div
                className="h-2 w-2"
                style={
                  todo.urgent
                    ? { 
                        background: '#ff0a45', 
                        boxShadow: '0 0 6px rgba(255, 10, 69, 0.4)',
                        borderRadius: '50%'
                      }
                    : { background: 'rgba(255, 255, 255, 0.35)', borderRadius: '50%' }
                }
              />
              <span className="flex-1 text-sm text-white">{todo.title}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <span className="text-xs text-white/60 uppercase tracking-[0.25em]">
            {todos.length} items →
          </span>
        </div>
      </NeonCard>
    </Link>
  )
}
