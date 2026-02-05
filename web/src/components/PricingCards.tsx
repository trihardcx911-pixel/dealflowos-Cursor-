import { Link } from 'react-router-dom'
import { TierBronzeIcon, TierSilverIcon, TierGoldIcon } from './TierIcons'

export interface PricingTier {
  tierKey: "bronze" | "silver" | "gold"
  name: string
  price: string
  description: string
  features: string[]
  limitations?: string[]
  badge?: string
  ctaText: string
}

export const tiers: PricingTier[] = [
  {
    tierKey: 'bronze',
    name: 'Bronze',
    price: '$19.99',
    description: 'For solo wholesalers running their first deals',
    features: [
      'Seller & property CRM (leads, deals, follow-ups)',
      'Manual follow-up tracking and reminders',
      'Deal notes and property status tracking',
      'Basic deal activity overview',
      'Email support',
    ],
    limitations: [
      'No automated follow-ups',
      'No advanced deal analytics',
      'Single-user only',
    ],
    ctaText: 'Get started',
  },
  {
    tierKey: 'silver',
    name: 'Silver (Coming soon)',
    price: '$49.99',
    description: 'For active wholesalers managing multiple sellers and deals',
    features: [
      'Automation + expanded pipeline (coming soon)',
    ],
    badge: 'Most popular',
    ctaText: 'Join waitlist',
  },
  {
    tierKey: 'gold',
    name: 'Gold (Coming soon)',
    price: '$99.99',
    description: 'For scaling wholesalers and small acquisition teams',
    features: [
      'Teams + reporting + workflows (coming soon)',
    ],
    ctaText: 'Join waitlist',
  },
]

interface PricingCardsProps {
  /** Called when user clicks Bronze CTA. If not provided, links to /signup?plan=bronze */
  onBronzeClick?: () => void
  /** Called when user clicks Silver/Gold waitlist button */
  onWaitlistClick: (tier: "silver" | "gold") => void
  /** CTA text for Bronze tier (default: "Get started") */
  bronzeCtaText?: string
  /** Whether this is on the onboarding page (uses different Bronze CTA behavior) */
  isOnboarding?: boolean
  /** Disable the Bronze CTA button (e.g., during checkout redirect) */
  bronzeDisabled?: boolean
}

export default function PricingCards({
  onBronzeClick,
  onWaitlistClick,
  bronzeCtaText,
  isOnboarding = false,
  bronzeDisabled = false,
}: PricingCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {tiers.map((tier) => (
        <div
          key={tier.name}
          className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6 md:p-8 flex flex-col h-full"
        >
          {/* Show "Recommended" badge on Bronze during onboarding, otherwise show tier's default badge */}
          {(isOnboarding && tier.tierKey === 'bronze') && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 border border-red-500/30 text-red-400">
                Recommended
              </span>
            </div>
          )}
          {(!isOnboarding || tier.tierKey !== 'bronze') && tier.badge && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/10 text-white/70">
                {tier.badge}
              </span>
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              {tier.tierKey === 'bronze' && (
                <TierBronzeIcon className="opacity-75" style={{ color: '#C88A5F' }} size={16} />
              )}
              {tier.tierKey === 'silver' && (
                <TierSilverIcon className="opacity-75" style={{ color: '#B8C0CC' }} size={16} />
              )}
              {tier.tierKey === 'gold' && (
                <TierGoldIcon className="opacity-75" style={{ color: '#D4B86A' }} size={16} />
              )}
              <h3 className="text-2xl font-semibold" style={{ color: '#F5F7FA' }}>
                {tier.name}
              </h3>
            </div>
            <p className="text-sm" style={{ color: '#A8AFB8' }}>
              {tier.description}
            </p>
          </div>

          <div className="mb-6 pb-6 border-b border-white/10">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold" style={{ color: '#F5F7FA' }}>
                {tier.price}
              </span>
              <span className="text-sm" style={{ color: '#7C828A' }}>
                / month
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-4 mb-6">
            <div>
              <p className="text-xs tracking-wider uppercase mb-3" style={{ color: '#7C828A' }}>
                Includes
              </p>
              {tier.tierKey === 'silver' || tier.tierKey === 'gold' ? (
                <p className="text-sm leading-relaxed" style={{ color: '#A8AFB8' }}>
                  {tier.features[0]}
                </p>
              ) : (
                <div>
                  <ul className="space-y-2">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[var(--neon-red)] mt-0.5 flex-shrink-0">✓</span>
                        <span className="text-sm leading-relaxed" style={{ color: '#A8AFB8' }}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {tier.limitations && tier.limitations.length > 0 && (
                    <div className="pt-4 border-t border-white/5">
                      <p className="text-xs tracking-wider uppercase mb-3" style={{ color: '#7C828A' }}>
                        Limitations
                      </p>
                      <ul className="space-y-2">
                        {tier.limitations.map((limitation, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-white/30 mt-0.5 flex-shrink-0">○</span>
                            <span className="text-sm leading-relaxed" style={{ color: '#7C828A' }}>
                              {limitation}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {tier.tierKey === 'silver' || tier.tierKey === 'gold' ? (
            <button
              onClick={() => onWaitlistClick(tier.tierKey)}
              className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              {tier.ctaText}
            </button>
          ) : isOnboarding && onBronzeClick ? (
            <button
              onClick={onBronzeClick}
              disabled={bronzeDisabled}
              className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {bronzeCtaText || tier.ctaText}
            </button>
          ) : (
            <Link
              to="/signup?plan=bronze"
              className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              {bronzeCtaText || tier.ctaText}
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
