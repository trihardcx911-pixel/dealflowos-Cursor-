import { NeonCard } from './NeonCard'
import { t, useLanguage } from '../i18n/i18n'

export function ScheduleCard() {
  const lang = useLanguage()
  const todayEvents = [
    { time: '10:00 AM', title: 'Broker sync', type: 'meeting' },
    { time: '14:30 PM', title: 'Seller pitch', type: 'call' },
    { time: '16:00 PM', title: 'Site walkthrough', type: 'visit' },
  ]

  return (
    <NeonCard
      sectionLabel={t('dashboard.calendar')}
      title={t("dashboard.todaysSchedule")}
      colSpan={4}
    >
      <div className="space-y-3 flex-1">
        {todayEvents.length > 0 ? (
          todayEvents.map((event, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="text-xs text-white/60 font-semibold">{event.time}</span>
              <span className="flex-1 text-sm text-white">{event.title}</span>
              <span className="text-xs text-white/60 uppercase tracking-[0.2em]">{event.type}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/60">{t('dashboard.noEvents')}</p>
        )}
      </div>

      <div className="mt-auto pt-4">
        <a
          href="/calendar"
          className="text-xs text-white/60 uppercase tracking-[0.25em] hover:text-white transition-colors"
        >
          {t('dashboard.viewFullCalendar')}
        </a>
      </div>
    </NeonCard>
  )
}
