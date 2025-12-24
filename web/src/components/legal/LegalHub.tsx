import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { LegalStageIndicator } from './LegalStageIndicator'
import { OpenIssuesPanel } from './OpenIssuesPanel'
import { NeedsAttentionSignals } from './NeedsAttentionSignals'
import { ContractMetadataPanel } from './ContractMetadataPanel'
import { AssignmentMetadataPanel } from './AssignmentMetadataPanel'
import { TitleMetadataPanel } from './TitleMetadataPanel'
import { LegalEventsTimeline } from './LegalEventsTimeline'
import { StageTransitionModal } from './StageTransitionModal'
import { useToast } from '../../useToast'

interface LegalState {
  dealId: string
  legalStage: string
  contractMetadata: any
  assignmentMetadata: any
  titleMetadata: any
  recentEvents: any[]
}

interface BlockersResponse {
  blockers: string[]
  warnings: string[]
  currentStage: string
}

interface LegalHubProps {
  dealId: string
}

export function LegalHub({ dealId }: LegalHubProps) {
  const [legalState, setLegalState] = useState<LegalState | null>(null)
  const [blockers, setBlockers] = useState<BlockersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false)
  const { notify } = useToast()

  const loadLegalState = async () => {
    try {
      setLoading(true)
      setError(null)
      const state = await api.get<LegalState>(`/deals/${dealId}/legal`)
      setLegalState(state)

      // Load blockers
      const blockersData = await api.get<BlockersResponse>(`/deals/${dealId}/legal/blockers`)
      setBlockers(blockersData)
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Failed to load legal state'
      setError(msg)
      notify('error', msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLegalState()
  }, [dealId])

  const handleStageAdvance = async (targetStage: string) => {
    try {
      await api.patch(`/deals/${dealId}/legal/stage`, { stage: targetStage })
      notify('success', 'Legal stage advanced successfully')
      setIsTransitionModalOpen(false)
      await loadLegalState()
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Failed to advance stage'
      notify('error', msg)
    }
  }

  const handleMetadataUpdate = async () => {
    await loadLegalState()
  }

  if (loading) {
    return (
      <div className="neon-glass p-6 md:p-8">
        <div className="text-white/60">Loading legal state...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="neon-glass p-6 md:p-8">
        <div className="text-red-400">Error: {error}</div>
      </div>
    )
  }

  if (!legalState) {
    return null
  }

  return (
    <div id="legal-hub" className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-white/60 mb-1">LEGAL WORKFLOW</p>
        <h2 className="text-2xl font-semibold text-white">Legal Hub</h2>
      </div>

      {/* Current Stage Indicator */}
      <LegalStageIndicator
        currentStage={legalState.legalStage}
        onAdvanceClick={() => setIsTransitionModalOpen(true)}
      />

      {/* Open Issues Panel */}
      <OpenIssuesPanel dealId={dealId} />

      {/* Needs Attention Signals (for this deal) */}
      <NeedsAttentionSignals dealId={dealId} />

      {/* Blockers & Warnings */}
      {blockers && (blockers.blockers.length > 0 || blockers.warnings.length > 0) && (
        <div className="neon-glass p-6 md:p-8 space-y-4">
          {blockers.blockers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-2 uppercase tracking-[0.2em]">
                Blockers
              </h3>
              <ul className="space-y-1">
                {blockers.blockers.map((blocker, idx) => (
                  <li key={idx} className="text-sm text-red-300">
                    • {blocker}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {blockers.warnings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-400 mb-2 uppercase tracking-[0.2em]">
                Warnings
              </h3>
              <ul className="space-y-1">
                {blockers.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-yellow-300">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Metadata Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContractMetadataPanel
          dealId={dealId}
          metadata={legalState.contractMetadata}
          onUpdate={handleMetadataUpdate}
        />
        <AssignmentMetadataPanel
          dealId={dealId}
          metadata={legalState.assignmentMetadata}
          onUpdate={handleMetadataUpdate}
        />
        <TitleMetadataPanel
          dealId={dealId}
          metadata={legalState.titleMetadata}
          onUpdate={handleMetadataUpdate}
        />
      </div>

      {/* Legal Events Timeline */}
      <LegalEventsTimeline dealId={dealId} />

      {/* Stage Transition Modal */}
      <StageTransitionModal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        currentStage={legalState.legalStage}
        blockers={blockers?.blockers || []}
        warnings={blockers?.warnings || []}
        onAdvance={handleStageAdvance}
      />
    </div>
  )
}

