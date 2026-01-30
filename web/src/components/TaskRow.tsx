import React from 'react'

type TaskRowProps = {
  left: React.ReactNode
  right: React.ReactNode
  isCompleted?: boolean
  onClick?: () => void
  className?: string
  divider?: boolean
}

export function TaskRow({
  left,
  right,
  isCompleted = false,
  onClick,
  className = '',
  divider = true,
}: TaskRowProps) {
  return (
    <li
      className={`
        neon-glass flex items-center justify-between px-dfos-4 py-dfos-3 h-[64px] min-h-[64px] rounded-dfos-xl
        ${isCompleted ? 'opacity-60' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
        relative
      `.trim()}
      onClick={onClick}
    >
      <div className="flex items-center gap-dfos-3 min-w-0 flex-1">
        {left}
      </div>
      <div className="w-32 flex items-center justify-end gap-dfos-2 flex-shrink-0">
        {right}
      </div>
      {divider && (
        <div className="absolute left-dfos-4 right-dfos-4 bottom-0 border-b border-white/5" />
      )}
    </li>
  )
}







