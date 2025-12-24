import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Clock } from 'lucide-react'

interface DealEvent {
  id: string
  eventType: string
  metadata: any
  createdAt: string
}

interface LegalEventsTimelineProps {
  dealId: string
}

export function LegalEventsTimeline({ dealId }: LegalEventsTimelineProps) {
  const [events, setEvents] = useState<DealEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true)
        const response = await api.get<{ events: DealEvent[] }>(`/deals/${dealId}/legal/events`)
        setEvents(response.events)
      } catch (err) {
        console.error('Failed to load legal events:', err)
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [dealId])

  const formatEventType = (eventType: string): string => {
    return eventType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  if (loading) {
    return (
      <div className="neon-glass p-6 md:p-8">
        <div className="text-white/60">Loading events...</div>
      </div>
    )
  }

  return (
    <div className="neon-glass p-6 md:p-8">
      <h3 className="text-lg font-semibold text-white mb-4">Legal Events Timeline</h3>
      {events.length === 0 ? (
        <div className="text-white/40 italic">No legal events yet</div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex gap-4 pb-4 border-b border-white/10 last:border-0">
              <div className="flex-shrink-0">
                <Clock className="w-4 h-4 text-white/40 mt-1" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">
                    {formatEventType(event.eventType)}
                  </span>
                  <span className="text-xs text-white/40">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="text-xs text-white/60 mt-1">
                    {event.metadata.previousStage && event.metadata.newStage && (
                      <div>
                        {event.metadata.previousStage} → {event.metadata.newStage}
                        {event.metadata.isRollback && (
                          <span className="ml-2 text-yellow-400">(Rollback)</span>
                        )}
                      </div>
                    )}
                    {event.metadata.userId && (
                      <div className="mt-1">User: {event.metadata.userId}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



