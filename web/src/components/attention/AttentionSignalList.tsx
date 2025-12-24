import { AttentionSignalItem } from './AttentionSignalItem'

interface Signal {
  message: string
  severity: 'info' | 'warning' | 'attention'
}

interface AttentionSignalListProps {
  signals: Signal[]
}

export function AttentionSignalList({ signals }: AttentionSignalListProps) {
  if (signals.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {signals.slice(0, 5).map((signal, idx) => (
        <AttentionSignalItem
          key={idx}
          message={signal.message}
          severity={signal.severity}
        />
      ))}
    </div>
  )
}



