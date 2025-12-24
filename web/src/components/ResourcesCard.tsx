import { Link } from 'react-router-dom'
import { NeonCard } from './NeonCard'
import { t, useLanguage } from '../i18n/i18n'

export function ResourcesCard() {
  const lang = useLanguage()
  const resources = [
    { name: 'Wholesaling Guide', type: 'PDF' },
    { name: 'Market Analysis Tools', type: 'Link' },
    { name: 'Video Tutorials', type: 'Video' },
  ]

  return (
    <Link to="/resources" className="block">
      <NeonCard
        sectionLabel={t('dashboard.library')}
        title={t('dashboard.resources')}
        colSpan={4}
      >
      <div className="space-y-3 flex-1">
        {resources.map((resource, idx) => (
          <div key={idx} className="flex items-center justify-between hover:opacity-80 transition-opacity cursor-pointer">
            <span className="text-sm flex-1 text-white">{resource.name}</span>
            <span className="text-xs text-white/60 uppercase tracking-[0.2em] px-2 py-1">
              {resource.type}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <button className="text-xs text-white/60 uppercase tracking-[0.25em] hover:text-white transition-colors">
          {t('dashboard.browseAll')}
        </button>
      </div>
    </NeonCard>
    </Link>
  )
}
