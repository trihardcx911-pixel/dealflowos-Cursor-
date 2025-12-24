import { useNavigate } from 'react-router-dom'
import { NeonCard } from './NeonCard'

export function KpiCard() {
  const navigate = useNavigate()

  return (
    <NeonCard
      sectionLabel="ANALYTICS"
      title="View Your KPIs"
      onClick={() => navigate('/kpis')}
      colSpan={4}
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between py-1">
          <span className="text-sm text-white/60">Active Leads</span>
          <span className="text-5xl font-bold text-[#ff0a45]">
            247
          </span>
        </div>

        <div className="flex items-baseline justify-between py-1">
          <span className="text-sm text-white/60">Conversion Rate</span>
          <span className="text-5xl font-bold text-[#ff0a45]">
            12.4%
          </span>
        </div>

        <div className="flex items-baseline justify-between py-1">
          <span className="text-sm text-white/60">This Month</span>
          <span className="text-xl font-semibold text-[#ff0a45] tracking-tight leading-none">
            +18
          </span>
        </div>
      </div>
    </NeonCard>
  )
}
