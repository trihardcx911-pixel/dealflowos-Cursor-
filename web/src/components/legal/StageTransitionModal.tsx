import { useState } from 'react'
import { X, AlertTriangle, AlertCircle } from 'lucide-react'

interface StageTransitionModalProps {
  isOpen: boolean
  onClose: () => void
  currentStage: string
  blockers: string[]
  warnings: string[]
  onAdvance: (targetStage: string) => void
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

export function StageTransitionModal({
  isOpen,
  onClose,
  currentStage,
  blockers,
  warnings,
  onAdvance,
}: StageTransitionModalProps) {
  const [confirming, setConfirming] = useState(false)
  const currentIndex = stageOrder.indexOf(currentStage)
  const nextStage = currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null

  if (!isOpen || !nextStage) return null

  const handleConfirm = () => {
    setConfirming(true)
    onAdvance(nextStage)
    setConfirming(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#0f0f14]/90 backdrop-blur-xl border border-[#ff0a45]/30 shadow-[0_0_20px_#ff0a45] p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-[#ff0a45] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-semibold text-white mb-2">Advance Legal Stage</h3>
        <p className="text-sm text-white/70 mb-6">
          Transition from <strong>{stageLabels[currentStage]}</strong> to{' '}
          <strong>{stageLabels[nextStage]}</strong>
        </p>

        {blockers.length > 0 && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h4 className="text-sm font-semibold text-red-400">Blockers</h4>
            </div>
            <ul className="space-y-1">
              {blockers.map((blocker, idx) => (
                <li key={idx} className="text-sm text-red-300">
                  • {blocker}
                </li>
              ))}
            </ul>
            <p className="text-xs text-red-300/80 mt-2">
              Please resolve these blockers before advancing.
            </p>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h4 className="text-sm font-semibold text-yellow-400">Warnings</h4>
            </div>
            <ul className="space-y-1">
              {warnings.map((warning, idx) => (
                <li key={idx} className="text-sm text-yellow-300">
                  • {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={blockers.length > 0 || confirming}
            className="flex-1 px-4 py-2 bg-[#ff0a45] hover:bg-[#ff0a45]/80 disabled:bg-white/10 disabled:text-white/40 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {confirming ? 'Advancing...' : 'Confirm Advance'}
          </button>
        </div>
      </div>
    </div>
  )
}



