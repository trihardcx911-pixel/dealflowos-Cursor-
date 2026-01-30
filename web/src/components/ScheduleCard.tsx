import { Link } from 'react-router-dom'
import { NeonCard } from './NeonCard'
import { t } from '../i18n/i18n'

export function ScheduleCard() {
  return (
    <Link to="/calendar" className="block">
      <NeonCard
        sectionLabel={t('dashboard.calendar')}
        title={t("dashboard.todaysSchedule")}
        colSpan={4}
      >
        <div className="space-y-dfos-3 flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm text-white/70 uppercase tracking-[0.15em]">
            View my schedule
          </p>
        </div>

        <div className="mt-auto pt-dfos-4">
          <span className="text-xs text-white/60 uppercase tracking-[0.25em] hover:text-white transition-colors">
            {t('dashboard.viewFullCalendar')}
          </span>
        </div>
      </NeonCard>
    </Link>
  )
}
