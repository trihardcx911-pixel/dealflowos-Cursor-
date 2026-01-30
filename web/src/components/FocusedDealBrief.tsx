// TEMP: Focused Deal Brief
// Frontend-only context view for Needs Attention flow
// Safe to remove or merge later

interface FocusedDealBriefProps {
  dealAddress: string
  propertySummary: string
  motivationLevel: 'Low' | 'Medium' | 'High'
  motivationReason?: string
  sellerNotes: string[]
  attentionReason: string
  recommendedAction: string
  lastActivityLabel: string
  onBack: () => void
  onPrimaryAction: () => void
}

export function FocusedDealBrief({
  dealAddress,
  propertySummary,
  motivationLevel,
  motivationReason,
  sellerNotes,
  attentionReason,
  recommendedAction,
  lastActivityLabel,
  onBack,
  onPrimaryAction,
}: FocusedDealBriefProps) {
  const displayedNotes = sellerNotes.slice(0, 4)

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-[720px] mx-4 rounded-2xl bg-[#070512]/95 border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.4)] p-6">
        {/* SECTION 1 — Deal Identity */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white/90 mb-2">
            {dealAddress}
          </h1>
          <p className="text-sm text-white/60">
            {propertySummary}
          </p>
        </div>

        {/* SECTION 2 — Motivation Snapshot */}
        <div className="mb-6 pb-6 border-b border-white/10">
          <p className="text-sm text-white/70 mb-1">
            Seller motivation: <span className="font-semibold text-white/90">{motivationLevel}</span>
          </p>
          {motivationReason && (
            <p className="text-sm text-white/60">
              {motivationReason}
            </p>
          )}
        </div>

        {/* SECTION 3 — Seller Notes (Read-only) */}
        {displayedNotes.length > 0 && (
          <div className="mb-6 pb-6 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white/80 mb-3">
              Seller notes
            </h2>
            <ul className="space-y-2">
              {displayedNotes.map((note, idx) => (
                <li key={idx} className="text-sm text-white/60">
                  • {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* SECTION 4 — Why This Needs Attention */}
        <div className="mb-6 pb-6 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white/80 mb-2">
            Why this needs attention
          </h2>
          <p className="text-sm text-white/60 mb-1">
            {attentionReason}
          </p>
          <p className="text-xs text-white/50 font-mono">
            Last activity: {lastActivityLabel}
          </p>
        </div>

        {/* SECTION 5 — Primary Action */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={onPrimaryAction}
            className="px-6 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            {recommendedAction}
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-lg text-white/60 hover:text-white/80 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            Mark as handled
          </button>
        </div>

        {/* SECTION 6 — Exit */}
        <div>
          <button
            onClick={onBack}
            className="text-sm text-white/60 hover:text-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 rounded px-2 py-1"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}










