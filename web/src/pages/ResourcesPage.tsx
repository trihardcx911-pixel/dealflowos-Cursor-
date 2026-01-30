import BackToDashboard from '../components/BackToDashboard'
import { t } from '../i18n/i18n'

export default function ResourcesPage() {
  return (
    <div className="font-sans">
      <BackToDashboard />
      <header className="space-y-dfos-2 mb-dfos-8 px-dfos-12">
        <p className="text-xs tracking-normal text-white/60">{t('dashboard.library')}</p>
        <h1 className="text-2xl font-semibold leading-tight tracking-normal text-white">{t('resources.title')}</h1>
        <p className="text-sm leading-relaxed text-white/60 tracking-normal">{t('resources.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-dfos-6 px-dfos-12 pb-dfos-12">
        {/* 1. What Wholesaling Really Is */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-dfos-4 min-h-[160px] flex flex-col gap-dfos-2 font-sans">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <path d="M4 7l8-4 8 4-8 4z"/>
            <path d="M4 12l8-4 8 4-8 4z"/>
          </svg>
          <h3 className="text-base font-semibold leading-snug tracking-normal text-white mb-dfos-2 font-sans">{t('resources.cards.wholesaling.title')}</h3>
          <ul className="text-sm leading-relaxed text-white/80 space-y-dfos-2 font-sans">
            <li>{t('resources.cards.wholesaling.items.0')}</li>
            <li>{t('resources.cards.wholesaling.items.1')}</li>
            <li>{t('resources.cards.wholesaling.items.2')}</li>
            <li>{t('resources.cards.wholesaling.items.3')}</li>
            <li>{t('resources.cards.wholesaling.items.4')}</li>
          </ul>
        </div>

        {/* 2. What Makes a Good Deal */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-dfos-4 min-h-[160px] flex flex-col gap-dfos-2 font-sans">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          <h3 className="text-base font-semibold leading-snug tracking-normal text-white mb-dfos-2 font-sans">{t('resources.cards.goodDeal.title')}</h3>
          <ul className="text-sm leading-relaxed text-white/80 space-y-dfos-2 font-sans">
            <li>{t('resources.cards.goodDeal.items.0')}</li>
            <li>{t('resources.cards.goodDeal.items.1')}</li>
            <li>{t('resources.cards.goodDeal.items.2')}</li>
            <li>{t('resources.cards.goodDeal.items.3')}</li>
            <li>{t('resources.cards.goodDeal.items.4')}</li>
          </ul>
        </div>

        {/* 3. Best Places to Find Leads */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-dfos-4 min-h-[160px] flex flex-col gap-dfos-2 font-sans">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <circle cx="11" cy="11" r="6"/>
            <path d="M16 16l4 4"/>
          </svg>
          <h3 className="text-base font-semibold leading-snug tracking-normal text-white mb-dfos-2 font-sans">{t('resources.cards.findLeads.title')}</h3>
          <ul className="text-sm leading-relaxed text-white/80 space-y-dfos-2 font-sans">
            <li>{t('resources.cards.findLeads.items.0')}</li>
            <li>{t('resources.cards.findLeads.items.1')}</li>
            <li>{t('resources.cards.findLeads.items.2')}</li>
            <li>{t('resources.cards.findLeads.items.3')}</li>
            <li>{t('resources.cards.findLeads.items.4')}</li>
            <li>{t('resources.cards.findLeads.items.5')}</li>
          </ul>
          <p className="text-xs leading-relaxed text-white/50 mt-dfos-2 font-sans">{t('resources.cards.findLeads.note')}</p>
        </div>

        {/* 4. How to Talk to Sellers */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-dfos-4 min-h-[160px] flex flex-col gap-dfos-2 font-sans">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <path d="M4 6h16v10H7l-3 3z"/>
          </svg>
          <h3 className="text-base font-semibold leading-snug tracking-normal text-white mb-dfos-2 font-sans">{t('resources.cards.talkToSellers.title')}</h3>
          <ul className="text-sm leading-relaxed text-white/80 space-y-dfos-2 font-sans">
            <li>{t('resources.cards.talkToSellers.items.0')}</li>
            <li>{t('resources.cards.talkToSellers.items.1')}</li>
            <li>{t('resources.cards.talkToSellers.items.2')}</li>
            <li>{t('resources.cards.talkToSellers.items.3')}</li>
            <li>{t('resources.cards.talkToSellers.items.4')}</li>
          </ul>
        </div>

        {/* 5. Rules to Stay Safe Legally */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-dfos-4 min-h-[160px] flex flex-col gap-dfos-2 font-sans">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <path d="M12 3l7 4v6c0 5-3.5 8-7 8s-7-3-7-8V7z"/>
          </svg>
          <h3 className="text-base font-semibold leading-snug tracking-normal text-white mb-dfos-2 font-sans">{t('resources.cards.legal.title')}</h3>
          <ul className="text-sm leading-relaxed text-white/80 space-y-dfos-2 font-sans">
            <li>{t('resources.cards.legal.items.0')}</li>
            <li>{t('resources.cards.legal.items.1')}</li>
            <li>{t('resources.cards.legal.items.2')}</li>
            <li>{t('resources.cards.legal.items.3')}</li>
            <li>{t('resources.cards.legal.items.4')}</li>
            <li>{t('resources.cards.legal.items.5')}</li>
          </ul>
        </div>

        {/* 6. Tools Every Wholesaler Should Use */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-dfos-4 min-h-[160px] flex flex-col gap-dfos-2 font-sans">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <path d="M6 8l4 4-4 4"/>
            <path d="M14 16h4"/>
          </svg>
          <h3 className="text-base font-semibold leading-snug tracking-normal text-white mb-dfos-2 font-sans">{t('resources.cards.tools.title')}</h3>
          <ul className="text-sm leading-relaxed text-white/80 space-y-dfos-2 font-sans">
            <li>{t('resources.cards.tools.items.0')}</li>
            <li>{t('resources.cards.tools.items.1')}</li>
            <li>{t('resources.cards.tools.items.2')}</li>
            <li>{t('resources.cards.tools.items.3')}</li>
          </ul>
          <p className="text-xs leading-relaxed text-white/50 mt-dfos-2 font-sans">{t('resources.cards.tools.note')}</p>
        </div>
      </div>
    </div>
  )
}
