import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../../api/client'
import { AttentionSignalList } from './AttentionSignalList'

interface DealNeedsAttentionProps {
  dealId: string
}

interface BlockersResponse {
  blockers: string[]
  warnings: string[]
  currentStage: string
}

interface DealEvent {
  id: string
  eventType: string
  metadata: any
  createdAt: string
}

interface LegalState {
  dealId: string
  legalStage: string
  contractMetadata: any
  assignmentMetadata: any
  titleMetadata: any
  recentEvents: DealEvent[]
}

interface Signal {
  message: string
  severity: 'info' | 'warning' | 'attention'
}

export function DealNeedsAttention({ dealId }: DealNeedsAttentionProps) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [blockersData, setBlockersData] = useState<BlockersResponse | null>(null)
  const [eventsData, setEventsData] = useState<{ events: DealEvent[] } | null>(null)
  const [legalState, setLegalState] = useState<LegalState | null>(null)

  useEffect(() => {
    const computeSignals = async () => {
      try {
        setLoading(true)

        // Fetch data from existing endpoints
        const [blockersResult, eventsResult, legalStateResult] = await Promise.all([
          api.get<BlockersResponse>(`/deals/${dealId}/legal/blockers`).catch(() => null),
          api.get<{ events: DealEvent[] }>(`/deals/${dealId}/legal/events`).catch(() => null),
          api.get<LegalState>(`/deals/${dealId}/legal`).catch(() => null),
        ])

        // Store data for expanded view
        setBlockersData(blockersResult)
        setEventsData(eventsResult)
        setLegalState(legalStateResult)

        const blockersData = blockersResult
        const eventsData = eventsResult
        const legalState = legalStateResult

        const computedSignals: Signal[] = []
        const now = new Date()

        // Signal 1: No deal activity in 14 days
        if (eventsData?.events && eventsData.events.length > 0) {
          const lastEvent = eventsData.events[0]
          const lastEventDate = new Date(lastEvent.createdAt)
          const daysSinceLastEvent = Math.floor(
            (now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSinceLastEvent >= 14) {
            computedSignals.push({
              message: 'No legal activity in the last 14 days',
              severity: 'warning',
            })
          }
        } else if (legalState?.recentEvents && legalState.recentEvents.length > 0) {
          // Use recentEvents from legalState if events endpoint fails
          const lastEvent = legalState.recentEvents[0]
          const lastEventDate = new Date(lastEvent.createdAt)
          const daysSinceLastEvent = Math.floor(
            (now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSinceLastEvent >= 14) {
            computedSignals.push({
              message: 'No legal activity in the last 14 days',
              severity: 'warning',
            })
          }
        }

        // Signal 2: Legal stage unchanged in 21 days
        const allEvents = eventsData?.events || legalState?.recentEvents || []
        const lastStageChange = allEvents.find(
          (e: DealEvent) => e.eventType === 'stage_transition'
        )
        if (lastStageChange) {
          const daysSinceStageChange = Math.floor(
            (now.getTime() - new Date(lastStageChange.createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
          if (daysSinceStageChange >= 21) {
            computedSignals.push({
              message: 'Legal stage hasn\'t changed in 21 days',
              severity: 'warning',
            })
          }
        }

        // Signal 3: Open blockers exist
        if (blockersData?.blockers && blockersData.blockers.length > 0) {
          computedSignals.push({
            message: 'There\'s an open issue that usually needs to be resolved',
            severity: 'attention',
          })
        }

        // Signal 4: Blockers unresolved for 30 days
        // Check if we have old events to estimate deal age
        if (blockersData?.blockers && blockersData.blockers.length > 0) {
          const allEvents = eventsData?.events || legalState?.recentEvents || []
          if (allEvents.length > 0) {
            const oldestEvent = allEvents[allEvents.length - 1]
            const dealAge = Math.floor(
              (now.getTime() - new Date(oldestEvent.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
            if (dealAge >= 30) {
              computedSignals.push({
                message: 'An open issue has been unresolved for 30 days',
                severity: 'attention',
              })
            }
          }
        }

        // Signal 5: Expected close date approaching or passed
        if (legalState?.titleMetadata?.expectedCloseDate) {
          const closeDate = new Date(legalState.titleMetadata.expectedCloseDate)
          const daysUntilClose = Math.floor(
            (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )

          if (daysUntilClose < 0) {
            computedSignals.push({
              message: 'The expected close date has passed',
              severity: 'attention',
            })
          } else if (daysUntilClose <= 7) {
            computedSignals.push({
              message: 'The expected close date is coming up',
              severity: 'warning',
            })
          }
        }

        // Signal 6: Late legal stage with open issues
        if (legalState && blockersData) {
          const lateStages = ['ASSIGNED', 'TITLE_CLEARING']
          if (
            lateStages.includes(legalState.legalStage) &&
            blockersData.blockers.length > 0
          ) {
            computedSignals.push({
              message: 'Deal is in a later stage with open issues still recorded',
              severity: 'warning',
            })
          }
        }

        // Signal 7: Closed deal with unresolved issues
        // We'd need deal status, but we don't have it in the current endpoints
        // This signal would require additional data

        setSignals(computedSignals)
      } catch (err) {
        console.error('Failed to compute attention signals:', err)
        setSignals([])
      } finally {
        setLoading(false)
      }
    }

    computeSignals()
  }, [dealId])

  if (loading) {
    return null
  }

  if (signals.length === 0) {
    return null
  }

  // Determine highest severity for card accent color
  const getHighestSeverity = (): 'info' | 'warning' | 'attention' => {
    if (signals.some((s) => s.severity === 'attention')) return 'attention'
    if (signals.some((s) => s.severity === 'warning')) return 'warning'
    return 'info'
  }

  const cardSeverity = getHighestSeverity()

  const severityStyles = {
    info: {
      borderLeft: 'border-l-white/10',
      chevron: 'text-slate-300',
      summary: 'text-slate-300',
    },
    warning: {
      borderLeft: 'border-l-yellow-400/60',
      chevron: 'text-yellow-300',
      summary: 'text-yellow-300/90',
    },
    attention: {
      borderLeft: 'border-l-red-400/60',
      chevron: 'text-red-300',
      summary: 'text-red-300/90',
    },
  }

  const currentStyle = severityStyles[cardSeverity]

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDaysAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  const getStageLabel = (stage: string): string => {
    const labels: Record<string, string> = {
      PRE_CONTRACT: 'Pre-Contract',
      UNDER_CONTRACT: 'Under Contract',
      ASSIGNMENT_IN_PROGRESS: 'Assignment In Progress',
      ASSIGNED: 'Assigned',
      TITLE_CLEARING: 'Title Clearing',
      CLEARED_TO_CLOSE: 'Cleared to Close',
      CLOSED: 'Closed',
      DEAD: 'Dead',
    }
    return labels[stage] || stage
  }

  const handleCardClick = () => {
    // Toggle expanded state
    setExpanded(!expanded)

    // Scroll to LegalHub and highlight it
    const legalHub = document.getElementById('legal-hub')
    if (legalHub) {
      legalHub.scrollIntoView({ behavior: 'smooth', block: 'start' })
      
      // Apply temporary highlight
      legalHub.classList.add('legal-hub-highlight')
      setTimeout(() => {
        legalHub.classList.remove('legal-hub-highlight')
      }, 1500)
    }
  }

  return (
    <div
      className={`relative rounded-[14px] p-5 cursor-pointer transition-colors hover:bg-white/5 border-l-4 ${currentStyle.borderLeft}`}
      style={{
        background: 'rgba(18,18,28,0.6)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        pointerEvents: 'auto',
      }}
      onClick={handleCardClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white/90 mb-1">Needs Attention</h3>
          {!expanded && (
            <p className={`text-sm ${currentStyle.summary}`}>
              This deal has a few things that may need attention
            </p>
          )}
        </div>
        {expanded ? (
          <ChevronDown className={`w-4 h-4 ${currentStyle.chevron} flex-shrink-0 ml-3`} />
        ) : (
          <ChevronRight className={`w-4 h-4 ${currentStyle.chevron} flex-shrink-0 ml-3`} />
        )}
      </div>

      {expanded ? (
        <>
          <div className="mb-4">
            <div className="text-xs uppercase tracking-[0.15em] text-white/50 mb-2">Signals</div>
            <AttentionSignalList signals={signals} />
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-white/50 mb-2">Context</div>
              <div className="space-y-2 text-xs text-white/60">
                {legalState && (
                  <div>
                    <span className="text-white/80">Current legal stage:</span>{' '}
                    <span className="text-white/90">{getStageLabel(legalState.legalStage)}</span>
                  </div>
                )}
                {eventsData?.events && eventsData.events.length > 0 && (
                  <div>
                    <span className="text-white/80">Last legal activity:</span>{' '}
                    <span className="text-white/90">
                      {formatDaysAgo(eventsData.events[0].createdAt)}
                    </span>
                  </div>
                )}
                {legalState?.titleMetadata?.expectedCloseDate && (
                  <div>
                    <span className="text-white/80">Expected close date:</span>{' '}
                    <span className="text-white/90">
                      {formatDate(legalState.titleMetadata.expectedCloseDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {blockersData?.blockers && blockersData.blockers.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-[0.15em] text-white/50 mb-2">
                  Open Issues
                </div>
                <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-white/70">
                  {blockersData.blockers.map((blocker, idx) => (
                    <li key={idx}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      ) : (
        <AttentionSignalList signals={signals} />
      )}
    </div>
  )
}

