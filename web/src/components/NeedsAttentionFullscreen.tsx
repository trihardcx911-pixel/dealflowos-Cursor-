import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusedDealBrief } from './FocusedDealBrief'
import { safeFocus } from '../utils/safeFocus'

interface NeedsAttentionItem {
  dealId: string
  dealTitle: string
  reason: string
  recommendedAction: string
  priority: number
  lastActivityAt?: string
}

interface NeedsAttentionFullscreenProps {
  isOpen: boolean
  onClose: () => void
  items: NeedsAttentionItem[]
  clear: boolean
}

type AttentionViewMode = 'list' | 'focused'

/**
 * Format date to relative time string (e.g., "Yesterday", "3d ago", "5d ago")
 */
function formatLastActivity(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  
  // Fallback to short date format for older dates
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * TEMP: mock data for FocusedDealBrief
 */
function getMockBriefData(dealId: string) {
  return {
    dealAddress: '123 Main St',
    propertySummary: 'Single-family • 3 bed / 2 bath • 1,450 sqft',
    motivationLevel: 'High' as const,
    motivationReason: 'Facing foreclosure, responsive previously',
    sellerNotes: [
      'Asked for more time due to family issues',
      'Prefers text messages',
      'Last conversation felt cautious but positive',
    ],
    attentionReason: 'Follow-up overdue (3 days)',
    recommendedAction: 'Call seller',
    lastActivityLabel: 'Jan 18',
  }
}

export function NeedsAttentionFullscreen({
  isOpen,
  onClose,
  items,
  clear,
}: NeedsAttentionFullscreenProps) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<AttentionViewMode>('list')
  const [focusedDealId, setFocusedDealId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Handle ESC key to exit
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewMode === 'focused') {
          setViewMode('list')
          setFocusedDealId(null)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, viewMode])

  // Focus trap: focus first focusable element when opened (prevent scroll)
  useEffect(() => {
    if (isOpen && panelRef.current && viewMode === 'list') {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      safeFocus(firstFocusable)
    }
  }, [isOpen, viewMode])

  // Reset view mode when closed
  useEffect(() => {
    if (!isOpen) {
      setViewMode('list')
      setFocusedDealId(null)
      setIsDrawerOpen(false)
    }
  }, [isOpen])

  const primaryItem = items[0]
  const otherItems = items.slice(1)
  const hasItems = items.length > 0
  const focusedItem = items.find(item => item.dealId === focusedDealId)

  const showList = viewMode === 'list' && isOpen
  const showFocused = viewMode === 'focused' && focusedDealId !== null && focusedItem !== undefined && isOpen

  const handleOpenDeal = (dealId: string) => {
    setFocusedDealId(dealId)
    setViewMode('focused')
  }

  const handleBriefBack = () => {
    setViewMode('list')
    setFocusedDealId(null)
  }

  const handleBriefPrimaryAction = () => {
    navigate(`/deals/${focusedDealId || ''}`)
    onClose()
  }

  const handleMarkAsHandled = (dealId: string) => {
    // TODO: Implement mark as handled logic
    console.log('[DEV] Mark as handled:', dealId)
    onClose()
  }

  const mockBriefData = focusedItem ? getMockBriefData(focusedItem.dealId) : null

  return (
    <div
      className="fixed inset-0 z-[10000]"
      style={{
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {isOpen && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      )}
      {showFocused && mockBriefData && (
        <FocusedDealBrief
          dealAddress={mockBriefData.dealAddress}
          propertySummary={mockBriefData.propertySummary}
          motivationLevel={mockBriefData.motivationLevel}
          motivationReason={mockBriefData.motivationReason}
          sellerNotes={mockBriefData.sellerNotes}
          attentionReason={mockBriefData.attentionReason}
          recommendedAction={mockBriefData.recommendedAction}
          lastActivityLabel={mockBriefData.lastActivityLabel}
          onBack={handleBriefBack}
          onPrimaryAction={handleBriefPrimaryAction}
        />
      )}
      {showList && (
        <div className="relative flex items-start justify-center" style={{ paddingTop: '10vh' }}>
          <div
            ref={panelRef}
            className="w-full max-w-2xl mx-4 mb-10 rounded-2xl bg-[#070512]/95 border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 pt-12 pb-8">
              <h1 className="text-2xl font-semibold text-white/90 mb-2" style={{ fontFamily: 'Inter Tight, sans-serif' }}>
                Needs attention
              </h1>
              <p className="text-sm text-white/55">
                Here's what requires action right now.
              </p>
            </div>

            {/* Content */}
            <div className="px-8 pb-8">
              {hasItems && (
                <div>
                  {/* Primary Attention Item */}
                  <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold text-white/90 mb-3">
                        {primaryItem.dealTitle}
                      </h2>
                      <p className="text-sm text-white/60 mb-2">
                        {primaryItem.reason}
                      </p>
                      <p className="text-base text-white/85 font-semibold mb-3">
                        → {primaryItem.recommendedAction}
                      </p>
                      {primaryItem.lastActivityAt && (
                        <p className="text-xs text-white/50 font-mono">
                          Last activity: {formatLastActivity(primaryItem.lastActivityAt)}
                        </p>
                      )}
                    </div>

                    {/* Primary Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={() => handleOpenDeal(primaryItem.dealId)}
                        className="px-6 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/30"
                      >
                        Open deal
                      </button>
                      <button
                        onClick={() => handleMarkAsHandled(primaryItem.dealId)}
                        className="px-4 py-2.5 rounded-lg text-white/60 hover:text-white/80 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        Mark as handled
                      </button>
                    </div>
                  </div>

                  {/* Other Items Drawer */}
                  {otherItems.length > 0 && (
                    <div className="mb-6">
                      <button
                        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        className="text-sm text-white/60 hover:text-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 rounded px-3 py-2 min-h-[44px]"
                      >
                        Other items
                      </button>
                      {isDrawerOpen && (
                        <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
                          {otherItems.map((item) => (
                            <div
                              key={item.dealId}
                              className="p-4 rounded-lg bg-white/3 border border-white/8"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-semibold text-white/70 mb-1">
                                    {item.dealTitle}
                                  </h3>
                                  <p className="text-xs text-white/50 mb-2">
                                    {item.reason} — {item.recommendedAction}
                                  </p>
                                  {item.lastActivityAt && (
                                    <p className="text-xs text-white/40 font-mono">
                                      {formatLastActivity(item.lastActivityAt)}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleOpenDeal(item.dealId)}
                                  className="px-4 py-2 rounded-lg bg-white/6 border border-white/10 text-white/70 hover:bg-white/10 transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/20 flex-shrink-0 min-h-[44px]"
                                >
                                  Open deal
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {!hasItems && (
                <div className="py-16 text-center">
                  <h2 className="text-2xl font-semibold text-white/90 mb-2">
                    You're clear.
                  </h2>
                  <p className="text-sm text-white/55 mb-6">
                    No deals need your attention right now.
                  </p>
                  <button
                    onClick={onClose}
                    className="text-sm text-white/60 hover:text-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 rounded px-3 py-1.5"
                  >
                    Back to dashboard
                  </button>
                </div>
              )}
            </div>

            {/* Exit Affordance */}
            <div className="px-8 pb-8 border-t border-white/10 pt-6">
              <button
                onClick={onClose}
                className="text-sm text-white/60 hover:text-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 rounded px-3 py-1.5"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

