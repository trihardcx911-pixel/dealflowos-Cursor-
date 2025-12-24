import { useEffect, useState } from 'react'

export function SettingsUsage() {
  const [credits, setCredits] = useState(12840)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // TODO: Fetch actual credits from API
    // fetch('/api/usage/credits').then(res => res.json()).then(data => setCredits(data.credits))
  }, [])

  const renewalDate = new Date()
  renewalDate.setDate(renewalDate.getDate() + 7) // 7 days from now

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Usage & Billing</h2>
        <p className="text-sm text-white/60">Manage your AI credits and usage limits</p>
      </div>

      <div className="rounded-[32px] bg-[#0a0a0c]/60 border border-[#ff0a45]/25 backdrop-blur-xl shadow-[0_0_40px_rgba(255,10,69,0.18)] p-8 space-y-6">
        {/* AI Credits Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[rgba(255,0,60,0.12)] border border-[rgba(255,0,60,0.18)] rounded-lg">
                <svg className="w-6 h-6 text-[#ff0a45]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">AI Credits Remaining</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {loading ? '...' : credits.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Renewal Date</span>
              <span className="text-white font-medium">{renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-white/60">Refresh Frequency</span>
              <span className="text-white font-medium">Nightly</span>
            </div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Credits Used This Period</span>
            <span className="text-white/70">7,160 / 20,000</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#ff0a45] to-[#ff0a45]/60 rounded-full transition-all duration-500"
              style={{ width: '35.8%' }}
            />
          </div>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          className="w-full py-2.5 px-4 bg-[rgba(255,0,60,0.12)] border border-[rgba(255,0,60,0.18)] rounded-lg text-[#ff0a45] font-medium text-sm hover:bg-[rgba(255,0,60,0.18)] transition-colors"
        >
          Buy More Credits
        </button>

        <p className="text-xs text-white/40 text-center">
          Contact support for enterprise pricing and custom limits
        </p>
      </div>
    </div>
  )
}
