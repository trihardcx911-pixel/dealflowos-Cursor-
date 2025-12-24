import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NeonCard } from './NeonCard'
import { t, useLanguage } from '../i18n/i18n'

type LeadsStats = {
  total: number
  active: number
  newThisMonth: number
}

export function LeadsOverviewCard() {
  const navigate = useNavigate()
  const lang = useLanguage()
  const [stats, setStats] = useState<LeadsStats>({ total: 0, active: 0, newThisMonth: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch leads stats from backend
    fetch('/api/leads/summary')
      .then(res => res.json())
      .then(data => {
        setStats({
          total: data.total || 0,
          active: data.active || 0,
          newThisMonth: data.newThisMonth || 0
        })
        setLoading(false)
      })
      .catch(() => {
        // Fallback to dummy data if API fails
        setStats({ total: 147, active: 89, newThisMonth: 23 })
        setLoading(false)
      })
  }, [])

  return (
    <NeonCard
      sectionLabel={t('dashboard.pipeline')}
      title={t('dashboard.leadsOverview')}
      colSpan={4}
      onClick={() => navigate('/leads')}
    >
      <div className="flex-1 flex flex-col justify-center mt-1 space-y-4">
        <div>
          <p className="text-sm text-white/60 uppercase tracking-wider mb-1">
            {t('dashboard.totalLeads')}
          </p>
          <p className="text-4xl font-bold text-white">
            {loading ? '...' : stats.total.toLocaleString()}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">
              {t('dashboard.active')}
            </p>
            <p className="text-2xl font-semibold text-[#ff0a45]">
              {loading ? '...' : stats.active}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">
              {t('dashboard.newThisMonth')}
            </p>
            <p className="text-2xl font-semibold text-[#ff0a45]">
              {loading ? '...' : stats.newThisMonth}
            </p>
          </div>
        </div>
      </div>
    </NeonCard>
  )
}
