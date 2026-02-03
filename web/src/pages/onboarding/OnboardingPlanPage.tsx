import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import PricingCards from '../../components/PricingCards'
import { useBillingStatus } from '../../hooks/useBillingStatus'
import { hasActiveSubscription, DEFAULT_APP_ROUTE } from '../../lib/routeDecision'

export default function OnboardingPlanPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const checkoutCanceled = searchParams.get('canceled') === 'true'

  // Check auth and billing status
  const hasToken = typeof window !== 'undefined' && localStorage.getItem('token')
  const { data: billingStatus, isLoading: billingLoading, isError: billingError, refetch } = useBillingStatus()
  const isSubscribed = hasActiveSubscription(billingStatus?.status)

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

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (waitlistSubmitting) return

    // Honeypot check
    if (waitlistHoneypot.trim() !== "") {
      setWaitlistError(null)
      setWaitlistSubmitted(true)
      setWaitlistSubmitting(false)
      return
    }

    if (!waitlistEmail.trim()) {
      setWaitlistError("Email is required")
      return
    }
    if (!validateEmail(waitlistEmail)) {
      setWaitlistError("Please enter a valid email address")
      return
    }

    setWaitlistSubmitting(true)
    setWaitlistError(null)

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: waitlistEmail.trim(),
          tier: waitlistTier,
          source: "onboarding",
          hp: waitlistHoneypot
        })
      })

      const contentType = res.headers.get('content-type') || '';
      const isProxyFailure = res.status === 500 && contentType.includes('text/plain');

      if (isProxyFailure) {
        throw new Error('Backend unreachable')
      }

      if (res.ok) {
        setWaitlistSubmitted(true)
      } else {
        try {
          const errorData = await res.json()
          setWaitlistError(errorData.error || "Something went wrong. Please try again.")
        } catch {
          setWaitlistError("Something went wrong. Please try again.")
        }
      }
    } catch (error: any) {
      console.error("[WAITLIST] API call failed:", error)
      setWaitlistError('Failed to connect. Please try again.')
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  const handleBronzeClick = () => {
    navigate('/billing/redirect?plan=bronze')
  }

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['billing', 'status'] })
    refetch()
  }

  // Compute display states (single return, no fragments)
  const showLoading = hasToken && billingLoading && !billingError
  const showBillingError = hasToken && billingError && !billingLoading
  const showAlreadySubscribed = hasToken && !billingLoading && !billingError && isSubscribed
  const showUnauthenticated = !hasToken
  const showPlanSelection = hasToken && !billingLoading && !billingError && !isSubscribed

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--bg-base, #0B0B10)' }}
    >
      {/* Subtle animated grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex-1 py-16 px-6 sm:px-8 flex flex-col items-center">
        {/* Loading state */}
        {showLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin mb-4" />
              <p className="text-sm text-white/60">Checking subscription status...</p>
            </div>
          </div>
        )}

        {/* Billing status error state */}
        {showBillingError && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <span className="text-2xl text-amber-400">⚠</span>
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
                Can't check subscription status
              </h2>
              <p className="text-sm mb-6" style={{ color: '#A8AFB8' }}>
                We couldn't verify your subscription status. This may be a temporary issue.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRetry}
                  className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors"
                >
                  Retry
                </button>
                <Link
                  to="/"
                  className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium flex items-center justify-center"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Already subscribed state */}
        {showAlreadySubscribed && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <span className="text-2xl text-green-400">✓</span>
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
                You're already subscribed
              </h2>
              <p className="text-sm mb-6" style={{ color: '#A8AFB8' }}>
                Your account is active. You have full access to DealflowOS.
              </p>
              <button
                onClick={() => navigate(DEFAULT_APP_ROUTE)}
                className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors"
              >
                Go to app
              </button>
            </div>
          </div>
        )}

        {/* Unauthenticated state */}
        {showUnauthenticated && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-2xl text-white/60">👤</span>
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
                Sign in to choose a plan
              </h2>
              <p className="text-sm mb-6" style={{ color: '#A8AFB8' }}>
                Create an account or sign in to select your plan and get started.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  to="/signup"
                  className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors flex items-center justify-center"
                >
                  Create account
                </Link>
                <Link
                  to="/login"
                  className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium flex items-center justify-center"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Plan selection state */}
        {showPlanSelection && (
          <div className="w-full flex flex-col items-center">
            {/* Checkout canceled banner */}
            {checkoutCanceled && (
              <div className="w-full max-w-6xl mb-6">
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-center gap-3">
                  <span className="text-amber-400">⚠</span>
                  <p className="text-sm text-amber-200">
                    Checkout was canceled. No charges were made. Choose a plan to continue.
                  </p>
                </div>
              </div>
            )}

            {/* Step indicator */}
            <div className="mb-8 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                  <span className="text-sm font-semibold text-red-400">1</span>
                </div>
                <span className="text-sm font-medium text-white/80">Choose plan</span>
              </div>
              <div className="w-8 h-px bg-white/20" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-white/40">2</span>
                </div>
                <span className="text-sm font-medium text-white/40">Complete payment</span>
              </div>
            </div>

            {/* Header */}
            <div className="text-center mb-12 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
                  Step 1 of 2
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold mb-4" style={{ color: '#F5F7FA' }}>
                Choose your plan to continue
              </h1>
              <p className="text-[16px] leading-relaxed" style={{ color: '#A8AFB8' }}>
                You'll confirm payment on Stripe, then you're in.
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="w-full max-w-6xl">
              <PricingCards
                isOnboarding={true}
                onBronzeClick={handleBronzeClick}
                onWaitlistClick={openWaitlist}
                bronzeCtaText="Continue to checkout"
              />
            </div>

            {/* Comparison Table */}
            <div className="w-full max-w-6xl mt-20">
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
        )}
      </div>

      {/* Waitlist Modal Overlay */}
      <div
        className={`fixed inset-0 z-[9999] transition-opacity duration-200 ${
          waitlistOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeWaitlist}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        <div className="flex items-center justify-center min-h-screen p-6">
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_70px_rgba(255,0,60,0.18)] ring-1 ring-red-500/20 p-6"
            onClick={(e) => e.stopPropagation()}
          >
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
              <form onSubmit={handleWaitlistSubmit}>
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
    </div>
  )
}
