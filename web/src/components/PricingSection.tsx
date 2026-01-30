import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TierBronzeIcon, TierSilverIcon, TierGoldIcon } from './TierIcons'

interface PricingTier {
  tierKey: "bronze" | "silver" | "gold"
  name: string
  price: string
  description: string
  features: string[]
  limitations?: string[]
  badge?: string
  ctaText: string
}

const tiers: PricingTier[] = [
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

export default function PricingSection() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistTier, setWaitlistTier] = useState<"silver" | "gold">("silver")
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [waitlistError, setWaitlistError] = useState<string | null>(null)
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistHoneypot, setWaitlistHoneypot] = useState("")

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const openWaitlist = (tier: "silver" | "gold") => {
    setWaitlistTier(tier)
    setWaitlistEmail("")
    setWaitlistError(null)
    setWaitlistSubmitted(false)
    setWaitlistSubmitting(false)
    setWaitlistHoneypot("")
    setWaitlistOpen(true)
  }

  const closeWaitlist = () => {
    setWaitlistOpen(false)
    setWaitlistEmail("")
    setWaitlistError(null)
    setWaitlistSubmitted(false)
    document.body.style.overflow = ""
  }

  // ESC key handler
  useEffect(() => {
    if (!waitlistOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeWaitlist()
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [waitlistOpen])

  // Body scroll lock
  useEffect(() => {
    if (waitlistOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [waitlistOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Submit locking: prevent double submit
    if (waitlistSubmitting) {
      return
    }
    
    // Honeypot check: if filled, pretend success without action
    if (waitlistHoneypot.trim() !== "") {
      setWaitlistError(null)
      setWaitlistSubmitted(true)
      setWaitlistSubmitting(false)
      return
    }
    
    // Email validation
    if (!waitlistEmail.trim()) {
      setWaitlistError("Email is required")
      return
    }
    if (!validateEmail(waitlistEmail)) {
      setWaitlistError("Please enter a valid email address")
      return
    }
    
    // Lock submit and process
    setWaitlistSubmitting(true)
    setWaitlistError(null)
    
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: waitlistEmail.trim(),
          tier: waitlistTier,
          source: "pricing",
          hp: waitlistHoneypot
        })
      })

      // Detect proxy failures: text/plain with 500 on /api/* routes
      const contentType = res.headers.get('content-type') || '';
      const isProxyFailure = res.status === 500 && contentType.includes('text/plain');
      
      if (isProxyFailure) {
        throw new Error('Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)')
      }

      if (res.ok) {
        setWaitlistSubmitted(true)
      } else {
        // Parse error response
        try {
          const errorData = await res.json()
          setWaitlistError(errorData.error || "Something went wrong. Please try again.")
        } catch {
          setWaitlistError("Something went wrong. Please try again.")
        }
      }
    } catch (error: any) {
      // Network error or fetch failure
      console.error("[WAITLIST] API call failed:", error)
      // Detect network/proxy errors
      const isNetworkError = 
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('Backend unreachable') ||
        error?.name === 'TypeError';
      
      const errorMessage = isNetworkError && !error?.message?.includes('Backend unreachable')
        ? 'Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)'
        : (error?.message?.includes('Backend unreachable') 
            ? error.message 
            : 'Failed to connect. Please check your connection and try again.');
      
      setWaitlistError(errorMessage)
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  return (
    <section id="pricing" className="py-32 px-6 sm:px-8 flex justify-center">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4" style={{ color: '#F5F7FA' }}>
            Simple pricing. Built for operators, not hype.
          </h2>
          <p className="text-[16px] leading-relaxed max-w-xl mx-auto" style={{ color: '#A8AFB8' }}>
            Choose a plan that fits how you actually work.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier, index) => (
            <div
              key={tier.name}
              className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6 md:p-8 flex flex-col h-full"
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/10 text-white/70">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Tier Name */}
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

              {/* Price */}
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

              {/* Features */}
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
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* CTA Button */}
              {tier.tierKey === 'silver' || tier.tierKey === 'gold' ? (
                <button
                  onClick={() => openWaitlist(tier.tierKey)}
                  className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  {tier.ctaText}
                </button>
              ) : (
                <Link
                  to={tier.tierKey === 'bronze' ? "/signup?plan=bronze" : "/signup"}
                  className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  {tier.ctaText}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="mt-20">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-wider" style={{ color: '#7C828A' }}>
                    Feature
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium uppercase tracking-wider" style={{ color: '#7C828A' }}>
                    Bronze
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium uppercase tracking-wider" style={{ color: '#7C828A' }}>
                    Silver
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium uppercase tracking-wider" style={{ color: '#7C828A' }}>
                    Gold
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Seller & property CRM
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Manual follow-ups
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Automated follow-ups
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#7C828A' }}>—</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Deal & pipeline tracking
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>Basic</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>Expanded</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>Team-level</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Contract & document storage
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#7C828A' }}>—</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Multi-user access
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#7C828A' }}>—</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#7C828A' }}>—</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Workflow customization
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#7C828A' }}>—</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>Limited</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>Full</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Team reporting
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#7C828A' }}>—</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#7C828A' }}>—</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>✓</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-xs" style={{ color: '#A8AFB8' }}>
                    Support level
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>Email</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>Priority email</td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: '#F5F7FA' }}>Dedicated</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Waitlist Modal Overlay - Always mounted, visibility toggled */}
      <div
        className={`fixed inset-0 z-[9999] transition-opacity duration-200 ${
          waitlistOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeWaitlist}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

        {/* Modal Card */}
        <div className="flex items-center justify-center min-h-screen p-6">
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_70px_rgba(255,0,60,0.18)] ring-1 ring-red-500/20 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold" style={{ color: '#F5F7FA' }}>
                    Join the waitlist
                  </h3>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      waitlistTier === 'silver'
                        ? 'bg-white/10 text-white/80 border border-white/20'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}
                  >
                    {waitlistTier === 'silver' ? 'Silver' : 'Gold'}
                  </span>
                </div>
                <p className="text-sm" style={{ color: '#A8AFB8' }}>
                  Get notified when {waitlistTier === 'silver' ? 'Silver' : 'Gold'} opens.
                </p>
              </div>
              <button
                onClick={closeWaitlist}
                className="ml-4 w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Body */}
            {waitlistSubmitted ? (
              <div className="text-center py-8">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <span className="text-2xl text-green-400">✓</span>
                  </div>
                </div>
                <h4 className="text-lg font-semibold mb-2" style={{ color: '#F5F7FA' }}>
                  You're on the waitlist.
                </h4>
                <p className="text-sm mb-6" style={{ color: '#A8AFB8' }}>
                  We'll email you when {waitlistTier === 'silver' ? 'Silver' : 'Gold'} opens.
                </p>
                <button
                  onClick={closeWaitlist}
                  className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <label htmlFor="waitlist-email" className="block text-sm font-medium mb-2" style={{ color: '#F5F7FA' }}>
                    Email
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    value={waitlistEmail}
                    onChange={(e) => {
                      setWaitlistEmail(e.target.value)
                      setWaitlistError(null)
                    }}
                    placeholder="you@domain.com"
                    disabled={waitlistSubmitting}
                    className="w-full h-12 px-4 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ color: '#F5F7FA' }}
                  />
                  {waitlistError && (
                    <p className="mt-2 text-sm" style={{ color: '#ff0a45' }}>
                      {waitlistError}
                    </p>
                  )}
                </div>

                {/* Honeypot field (hidden) */}
                <input
                  type="text"
                  name="company"
                  autoComplete="off"
                  tabIndex={-1}
                  value={waitlistHoneypot}
                  onChange={(e) => setWaitlistHoneypot(e.target.value)}
                  className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
                  aria-hidden="true"
                />

                {/* Footer */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeWaitlist}
                    disabled={waitlistSubmitting}
                    className="flex-1 h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={waitlistSubmitting}
                    className="flex-1 h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {waitlistSubmitting ? 'Joining...' : 'Join waitlist'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

