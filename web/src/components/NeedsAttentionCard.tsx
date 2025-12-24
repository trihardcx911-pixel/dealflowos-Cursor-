import { useEffect, useState } from 'react'
import { Info, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface NeedsAttentionSignal {
  dealId: string
  signalType: string
  message: string
  detectedAt: string
}

export function NeedsAttentionCard() {
  const [signals, setSignals] = useState<NeedsAttentionSignal[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadSignals = async () => {
      try {
        setLoading(true)
        const response = await api.get<{ signals: NeedsAttentionSignal[] }>(
          '/deals/needs-attention'
        )
        setSignals(response.signals)
      } catch (err) {
        console.error('Failed to load needs attention signals:', err)
        setSignals([])
      } finally {
        setLoading(false)
      }
    }

    loadSignals()
  }, [])

  // Group signals by dealId
  const signalsByDeal = signals.reduce((acc, signal) => {
    if (!acc[signal.dealId]) {
      acc[signal.dealId] = []
    }
    acc[signal.dealId].push(signal)
    return acc
  }, {} as Record<string, NeedsAttentionSignal[]>)

  const dealIds = Object.keys(signalsByDeal)

  if (loading) {
    return (
      <div className="dashboard-card">
        <p className="neon-section-label">Needs Attention</p>
        <h2 className="text-xl font-semibold tracking-tight text-white mb-4">
          Needs Attention
        </h2>
        <div className="dashboard-card-content">
          <div className="text-white/60 text-sm">Loading...</div>
        </div>
      </div>
    )
  }

  if (dealIds.length === 0) {
    return (
      <div className="dashboard-card">
        <p className="neon-section-label">Needs Attention</p>
        <h2 className="text-xl font-semibold tracking-tight text-white mb-4">
          Needs Attention
        </h2>
        <div className="dashboard-card-content">
          <div className="text-white/60 text-sm">
            No deals need attention right now.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-card">
      <p className="neon-section-label">Needs Attention</p>
      <h2 className="text-xl font-semibold tracking-tight text-white mb-4">
        Needs Attention
      </h2>
      <div className="dashboard-card-content">
        <div className="space-y-3">
          {dealIds.slice(0, 5).map((dealId) => {
            const dealSignals = signalsByDeal[dealId]
            return (
              <div
                key={dealId}
                onClick={() => navigate(`/deals/${dealId}`)}
                className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white mb-1">
                      Deal {dealId.slice(0, 8)}
                    </div>
                    <div className="space-y-1">
                      {dealSignals.map((signal, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-white/70 flex items-start gap-2"
                        >
                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-white/50" />
                          <span>{signal.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0 mt-1" />
                </div>
              </div>
            )
          })}
          {dealIds.length > 5 && (
            <div className="text-xs text-white/60 text-center pt-2">
              {dealIds.length - 5} more deal{dealIds.length - 5 === 1 ? '' : 's'} need attention
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



