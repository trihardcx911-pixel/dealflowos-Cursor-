import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { api } from '../../api/client'

interface LegalCondition {
  id: string
  category: string
  severity: string
  status: string
  summary: string
  details?: string
  discoveredAt: string
  resolvedAt?: string
  source?: string
  externalRef?: string
}

interface OpenIssuesPanelProps {
  dealId: string
}

const categoryLabels: Record<string, string> = {
  TITLE: 'Title',
  PROBATE: 'Probate',
  LIEN: 'Lien',
  HOA: 'HOA',
  JUDGMENT: 'Judgment',
  HEIRSHIP: 'Heirship',
  MUNICIPAL: 'Municipal',
  CONTRACTUAL: 'Contractual',
  OTHER: 'Other',
}

const sourceLabels: Record<string, string> = {
  TITLE_COMPANY: 'Title Company',
  ATTORNEY: 'Attorney',
  WHOLESALER: 'Wholesaler',
  BUYER: 'Buyer',
  SELLER: 'Seller',
  OTHER: 'Other',
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return '1 day ago'
  return `${diffDays} days ago`
}

export function OpenIssuesPanel({ dealId }: OpenIssuesPanelProps) {
  const [openIssues, setOpenIssues] = useState<LegalCondition[]>([])
  const [resolvedIssues, setResolvedIssues] = useState<LegalCondition[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    const loadIssues = async () => {
      try {
        setLoading(true)
        const response = await api.get<{
          openIssues: LegalCondition[]
          resolvedIssues: LegalCondition[]
        }>(`/deals/${dealId}/legal/issues`)
        setOpenIssues(response.openIssues)
        setResolvedIssues(response.resolvedIssues)
      } catch (err) {
        console.error('Failed to load open issues:', err)
      } finally {
        setLoading(false)
      }
    }

    loadIssues()
  }, [dealId])

  if (loading) {
    return (
      <div className="neon-glass p-6 md:p-8">
        <div className="text-white/60 text-sm">Loading issues...</div>
      </div>
    )
  }

  const getSeverityLabel = (severity: string): string | null => {
    if (severity === 'RISKY') return 'May cause delay'
    if (severity === 'BLOCKING') return 'Needs to be resolved first'
    return null
  }

  return (
    <div className="neon-glass p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Open Issues</h3>
          <p className="text-xs text-white/60 mt-1">
            These are things that may slow down or complicate the deal. They're common in wholesaling.
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-white/60 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <>
          {openIssues.length === 0 && resolvedIssues.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-white/80 mb-2">✅ No open issues recorded</div>
              <div className="text-sm text-white/60">
                Based on what's been added so far, nothing is currently flagged as slowing this deal down.
              </div>
            </div>
          ) : (
            <>
              {openIssues.length > 0 && (
                <div className="space-y-3 mb-6">
                  {openIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-4 bg-white/5 border border-white/10 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white mb-1">
                            {issue.summary}
                          </div>
                          {issue.details && (
                            <div className="text-sm text-white/70 mb-2">{issue.details}</div>
                          )}
                          {getSeverityLabel(issue.severity) && (
                            <div className="text-xs text-yellow-400/80 mb-2">
                              {getSeverityLabel(issue.severity)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-white/50 flex items-center gap-2">
                        {issue.source && (
                          <>
                            <span>Reported by: {sourceLabels[issue.source] || issue.source}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>Added {formatTimeAgo(issue.discoveredAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resolvedIssues.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowResolved(!showResolved)}
                    className="text-sm text-white/60 hover:text-white/80 mb-3 flex items-center gap-1"
                  >
                    {showResolved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {resolvedIssues.length} resolved {resolvedIssues.length === 1 ? 'issue' : 'issues'}
                  </button>
                  {showResolved && (
                    <div className="space-y-2">
                      {resolvedIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-3 bg-white/3 border border-white/5 rounded text-sm text-white/60"
                        >
                          <div className="line-through">{issue.summary}</div>
                          {issue.resolvedAt && (
                            <div className="text-xs text-white/40 mt-1">
                              Resolved {formatTimeAgo(issue.resolvedAt)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40 flex items-start gap-2">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                This is not legal advice. It's a summary of items recorded so far.
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  )
}



