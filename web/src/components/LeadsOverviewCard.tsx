import { useNavigate } from 'react-router-dom'
import { NeonCard } from './NeonCard'
import { t, useLanguage } from '../i18n/i18n'
import { useKpisSummary } from '../api/hooks'

export function LeadsOverviewCard() {
  const navigate = useNavigate()
  const lang = useLanguage()
  const { data, isLoading, isError } = useKpisSummary()

  // Map KPI summary to Leads Overview fields
  const total = data?.totalLeads ?? 0
  const active = data?.activeLeads ?? 0
  const newThisMonth = data?.monthlyNewLeads ?? 0

  return (
    <NeonCard
      sectionLabel={t('dashboard.pipeline')}
      title={t('dashboard.leadsOverview')}
      colSpan={4}
      onClick={() => navigate('/leads')}
    >
      <div className="flex-1 min-h-0 flex flex-col justify-center mt-1 space-y-dfos-4">
        <div>
          <p className="text-sm text-white/60 uppercase tracking-wider mb-1">
            {t('dashboard.totalLeads')}
          </p>
          <p className="text-4xl font-bold text-white">
            {isLoading || isError ? '—' : total.toLocaleString()}
          </p>
          {isError && (
            <p className="text-xs text-red-400 mt-1">Failed to load</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-dfos-3 pt-dfos-4 border-t border-white/10">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">
              {t('dashboard.active')}
            </p>
            <p className="text-2xl font-semibold text-[#ff0a45]">
              {isLoading || isError ? '—' : active}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">
              {t('dashboard.newThisMonth')}
            </p>
            <p className="text-2xl font-semibold text-[#ff0a45]">
              {isLoading || isError ? '—' : newThisMonth}
            </p>
          </div>
        </div>
      </div>
    </NeonCard>
  )
}
