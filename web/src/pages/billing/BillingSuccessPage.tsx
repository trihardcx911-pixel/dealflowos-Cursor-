import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { get, post, ApiError, NetworkError } from '../../api'
import { DEFAULT_APP_ROUTE } from '../../lib/routeDecision'

interface BillingStatusResponse {
  billingStatus: string | null
  plan: string | null
  cancelAtPeriodEnd: boolean | null
  currentPeriodEnd: string | null
}

interface PortalResponse {
  url: string
}

const ALLOWED_STATUSES = ['active', 'trialing', 'past_due']
const DENIED_STATUSES = ['canceled', 'unpaid', 'incomplete', 'incomplete_expired']

export default function BillingSuccessPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const pollCountRef = useRef(0)

  // Check if user is logged in
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'))
  const backUrl = hasToken ? '/onboarding/plan' : '/'
  const backLabel = hasToken ? 'Back to plan selection' : 'Back to pricing'

  const POLL_INTERVAL = 1500
  const MAX_POLLS = Math.floor(25000 / POLL_INTERVAL) // ~16 polls for 25 seconds

  // Compute display states (single return, no fragments)
  const showLoginRequired = !hasToken
  const showLoading = hasToken && !error && !timedOut
  const showError = hasToken && (error || timedOut)

  useEffect(() => {
    // Don't poll if not logged in
    if (!hasToken) {
      return
    }

    let pollTimer: number | null = null
    let timeoutTimer: number | null = null

    async function pollStatus() {
      try {
        const data = await get<BillingStatusResponse>('/billing/status')
        pollCountRef.current++

        if (data.billingStatus && ALLOWED_STATUSES.includes(data.billingStatus)) {
          // Success: navigate to app
          navigate(DEFAULT_APP_ROUTE, { replace: true })
          return
        }

        if (data.billingStatus && DENIED_STATUSES.includes(data.billingStatus)) {
          // Denied status: stop polling, show error
          setError('Subscription not active')
          return
        }

        // Continue polling if status is not yet set or is null
        if (pollCountRef.current < MAX_POLLS) {
          pollTimer = window.setTimeout(pollStatus, POLL_INTERVAL)
        } else {
          setTimedOut(true)
        }
      } catch (err) {
        console.error('[BILLING] Status poll failed:', err)

        // Network errors - stop polling
        if (err instanceof NetworkError) {
          setError(err.message)
          return
        }

        // API errors - might be temporary, continue polling
        if (pollCountRef.current < MAX_POLLS) {
          pollTimer = window.setTimeout(pollStatus, POLL_INTERVAL)
        } else {
          setError('Failed to verify subscription status')
        }
      }
    }

    // Start polling immediately
    pollStatus()

    // Set overall timeout
    timeoutTimer = window.setTimeout(() => {
      setTimedOut(true)
    }, 25000)

    return () => {
      if (pollTimer) window.clearTimeout(pollTimer)
      if (timeoutTimer) window.clearTimeout(timeoutTimer)
    }
  }, [navigate, hasToken])

  const handleManageBilling = async () => {
    try {
      const data = await post<PortalResponse>('/billing/portal', {})
      if (data.url) {
        window.location.assign(data.url)
      } else {
        setError('No portal URL received')
      }
    } catch (err) {
      console.error('[BILLING] Portal creation failed:', err)
      const errorMessage = err instanceof NetworkError
        ? err.message
        : 'Failed to open billing portal'
      setError(errorMessage)
    }
  }

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
              Please log in to verify your subscription status.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                to="/login"
                className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors flex items-center justify-center"
              >
                Log in
              </Link>
              <Link
                to="/"
                className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium flex items-center justify-center"
              >
                Back to home
              </Link>
            </div>
          </div>
        )}

        {/* Loading/polling state */}
        {showLoading && (
          <div>
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
              Verifying your subscription…
            </h2>
            <p className="text-sm" style={{ color: '#A8AFB8' }}>
              Please wait while we sync your billing status.
            </p>
          </div>
        )}

        {/* Error/timeout state */}
        {showError && (
          <div>
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <span className="text-2xl text-red-400">⚠</span>
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
              {timedOut ? 'Still syncing' : 'Subscription not active'}
            </h2>
            <p className="text-sm mb-6" style={{ color: '#A8AFB8' }}>
              {timedOut
                ? 'Your subscription is being processed. Try refreshing this page in a moment.'
                : (error || 'Your subscription could not be activated. Please manage your billing to resolve this.')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleManageBilling}
                className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors"
              >
                Manage billing
              </button>
              <button
                onClick={() => navigate(backUrl)}
                className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium"
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
