import { ChevronRight } from 'lucide-react'

interface LegalStageIndicatorProps {
  currentStage: string
  onAdvanceClick: () => void
}

const stageLabels: Record<string, string> = {
  PRE_CONTRACT: 'Pre-Contract',
  UNDER_CONTRACT: 'Under Contract',
  ASSIGNMENT_IN_PROGRESS: 'Assignment In Progress',
  ASSIGNED: 'Assigned',
  TITLE_CLEARING: 'Title Clearing',
  CLEARED_TO_CLOSE: 'Cleared to Close',
  CLOSED: 'Closed',
  DEAD: 'Dead',
}

const stageOrder = [
  'PRE_CONTRACT',
  'UNDER_CONTRACT',
  'ASSIGNMENT_IN_PROGRESS',
  'ASSIGNED',
  'TITLE_CLEARING',
  'CLEARED_TO_CLOSE',
  'CLOSED',
  'DEAD',
]

export function LegalStageIndicator({ currentStage, onAdvanceClick }: LegalStageIndicatorProps) {
  const currentIndex = stageOrder.indexOf(currentStage)
  const nextStage = currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null

  return (
    <div className="neon-glass p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-white/60 mb-2">Current Stage</p>
          <h3 className="text-xl font-semibold text-white">{stageLabels[currentStage] || currentStage}</h3>
        </div>
        {nextStage && nextStage !== 'CLOSED' && nextStage !== 'DEAD' && (
          <button
            onClick={onAdvanceClick}
            className="neon-glass px-6 py-3 text-sm font-semibold text-white hover:bg-[#ff0a45]/20 transition-colors flex items-center gap-2"
          >
            Advance to {stageLabels[nextStage]}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Stage Progress Bar */}
      <div className="mt-6">
        <div className="flex items-center gap-2">
          {stageOrder.map((stage, idx) => {
            const isActive = idx <= currentIndex
            const isCurrent = stage === currentStage
            return (
              <div
                key={stage}
                className={`flex-1 h-2 rounded-full transition-all ${
                  isActive
                    ? isCurrent
                      ? 'bg-[#ff0a45] shadow-[0_0_10px_#ff0a45]'
                      : 'bg-[#ff0a45]/60'
                    : 'bg-white/10'
                }`}
                title={stageLabels[stage]}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}



