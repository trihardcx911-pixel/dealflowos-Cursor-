import { useNavigate } from 'react-router-dom'
import { NeonCard } from './NeonCard'
import { t, useLanguage } from '../i18n/i18n'

export function KpiCard() {
  const navigate = useNavigate()
  const lang = useLanguage()

  return (
    <NeonCard
      sectionLabel={t('dashboard.analytics')}
      title={t('dashboard.viewKpis')}
      onClick={() => navigate('/kpis')}
      colSpan={4}
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between py-1">
          <span className="text-sm text-white/60">{t('dashboard.activeLeads')}</span>
          <span className="text-5xl font-bold text-[#ff0a45]">
            247
          </span>
        </div>

        <div className="flex items-baseline justify-between py-1">
          <span className="text-sm text-white/60">{t('dashboard.conversionRate')}</span>
          <span className="text-5xl font-bold text-[#ff0a45]">
            12.4%
          </span>
        </div>

        <div className="flex items-baseline justify-between py-1">
          <span className="text-sm text-white/60">{t('dashboard.thisMonth')}</span>
          <span className="text-xl font-semibold text-[#ff0a45] tracking-tight leading-none">
            +18
          </span>
        </div>
      </div>
    </NeonCard>
  )
}
