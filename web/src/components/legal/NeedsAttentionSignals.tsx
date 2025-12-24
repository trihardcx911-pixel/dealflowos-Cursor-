import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { api } from '../../api/client'

interface NeedsAttentionSignal {
  dealId: string
  signalType: string
  message: string
  detectedAt: string
}

interface NeedsAttentionSignalsProps {
  dealId: string
}

export function NeedsAttentionSignals({ dealId }: NeedsAttentionSignalsProps) {
  const [signals, setSignals] = useState<NeedsAttentionSignal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSignals = async () => {
      try {
        setLoading(true)
        const response = await api.get<{ signals: NeedsAttentionSignal[] }>(
          '/deals/needs-attention'
        )
        // Filter to only signals for this deal
        const dealSignals = response.signals.filter((s) => s.dealId === dealId)
        setSignals(dealSignals)
      } catch (err) {
        console.error('Failed to load needs attention signals:', err)
        setSignals([])
      } finally {
        setLoading(false)
      }
    }

    loadSignals()
  }, [dealId])

  if (loading) {
    return null
  }

  if (signals.length === 0) {
    return null
  }

  return (
    <div className="neon-glass p-6 md:p-8">
      <h3 className="text-lg font-semibold text-white mb-4">Needs Attention</h3>
      <div className="space-y-2">
        {signals.map((signal, idx) => (
          <div
            key={idx}
            className="p-3 bg-white/5 border border-white/10 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/50" />
              <span className="text-sm text-white/80">{signal.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}



