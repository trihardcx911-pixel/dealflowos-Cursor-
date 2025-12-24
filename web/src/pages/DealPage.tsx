import { useParams } from 'react-router-dom'
import BackToDashboard from '../components/BackToDashboard'
import { DealNeedsAttention } from '../components/attention/DealNeedsAttention'
import { LegalHub } from '../components/legal/LegalHub'

export default function DealPage() {
  const { dealId } = useParams<{ dealId: string }>()

  if (!dealId) {
    return (
      <div className="space-y-6">
        <BackToDashboard />
        <div className="neon-glass p-6 md:p-8">
          <div className="text-red-400">Deal ID is required</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Deal</p>
        <h1 className="text-3xl font-semibold text-white">Deal Details</h1>
      </header>
      <DealNeedsAttention dealId={dealId} />
      <div className="opacity-90">
        <LegalHub dealId={dealId} />
      </div>
    </div>
  )
}

