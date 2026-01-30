import { Link } from 'react-router-dom'
import { NeonCard } from './NeonCard'
import { t, useLanguage } from '../i18n/i18n'

export function ResourcesCard() {
  const lang = useLanguage()
  const resources: Array<{ name: string; type: string }> = []

  return (
    <Link to="/resources" className="block">
      <NeonCard
        sectionLabel={t('dashboard.library')}
        title={t('dashboard.resources')}
        colSpan={4}
      >
      <div className="space-y-dfos-3 flex-1 min-h-0">
        <div className="text-sm text-white/60">Wholesaling Guide</div>
        {resources.map((resource, idx) => (
          <div key={idx} className="flex items-center justify-between hover:opacity-80 transition-opacity cursor-pointer">
            <span className="text-sm flex-1 text-white">{resource.name}</span>
            <span className="text-xs text-white/60 uppercase tracking-[0.2em] px-dfos-2 py-dfos-1">
              {resource.type}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-dfos-4">
        <button className="text-xs text-white/60 uppercase tracking-[0.25em] hover:text-white transition-colors">
          {t('dashboard.browseAll')}
        </button>
      </div>
    </NeonCard>
    </Link>
  )
}






