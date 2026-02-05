import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { post, ApiError, NetworkError } from '../../api'

interface CheckoutSession {
  url: string
  id: string
}

export default function BillingRedirectPage() {
  const [searchParams] = useSearchParams()
  const plan = searchParams.get('plan') || 'bronze'
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if user is logged in
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'))
  const backUrl = hasToken ? '/onboarding/plan' : '/'
  const backLabel = hasToken ? 'Back to plan selection' : 'Back to pricing'

  // Compute display states (single return, no fragments)
  const showLoginRequired = !hasToken
  const showLoading = hasToken && loading && !error
  const showError = hasToken && error

  useEffect(() => {
    // Don't attempt checkout if not logged in
    if (!hasToken) {
      setLoading(false)
      return
    }

    async function createCheckout() {
      try {
        setLoading(true)
        setError(null)

        const data = await post<CheckoutSession>('/billing/create-checkout-session', { plan })

        if (data.url) {
          // Redirect to Stripe Checkout
          window.location.assign(data.url)
        } else {
          setError('No checkout URL received')
          setLoading(false)
        }
      } catch (err) {
        console.error('[BILLING] Checkout creation failed:', err)

        let errorMessage = 'Failed to create checkout session'
        if (err instanceof NetworkError) {
          errorMessage = err.message
        } else if (err instanceof ApiError) {
          errorMessage = err.message || `HTTP ${err.status}`
        } else if (err instanceof Error) {
          errorMessage = err.message
        }

        setError(errorMessage)
        setLoading(false)
      }
    }

    createCheckout()
  }, [plan, hasToken])

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg-base, #0B0B10)' }}>
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8 text-center">
        {/* Login required state */}
        {showLoginRequired && (
          <div>
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-2xl text-white/60">🔐</span>
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
              Login required
            </h2>
            <p className="text-sm mb-6" style={{ color: '#A8AFB8' }}>
              Please log in to continue to checkout.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                to={`/login?redirect=/billing/redirect&plan=${plan}`}
                className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors flex items-center justify-center"
              >
                Log in to continue
              </Link>
              <Link
                to="/"
                className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium flex items-center justify-center"
              >
                Back to pricing
              </Link>
            </div>
          </div>
        )}

        {/* Loading state */}
        {showLoading && (
          <div>
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
              Redirecting to secure checkout…
            </h2>
            <p className="text-sm" style={{ color: '#A8AFB8' }}>
              Please wait while we prepare your checkout session.
            </p>
          </div>
        )}

        {/* Error state */}
        {showError && (
          <div>
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <span className="text-2xl text-red-400">✕</span>
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
              Checkout Error
            </h2>
            <p className="text-sm mb-6" style={{ color: '#A8AFB8' }}>
              {error}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(backUrl)}
                className="flex-1 h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium"
              >
                {backLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
