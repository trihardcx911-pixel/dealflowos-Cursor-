interface AttentionSignalItemProps {
  message: string
  severity: 'info' | 'warning' | 'attention'
}

export function AttentionSignalItem({ message, severity }: AttentionSignalItemProps) {
  const severityStyles = {
    info: 'border-l-white/20',
    warning: 'border-l-yellow-400/40',
    attention: 'border-l-red-400/40',
  }

  const textStyles = {
    info: 'text-white/70',
    warning: 'text-yellow-300/90',
    attention: 'text-red-300/90',
  }

  return (
    <div
      className={`p-3 bg-white/3 border-l-2 ${severityStyles[severity]} border-t border-r border-b border-white/8 rounded`}
    >
      <div className={`text-sm ${textStyles[severity]}`}>{message}</div>
    </div>
  )
}



