import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface BillingStatus {
  billingStatus: string | null
  plan: string | null
  cancelAtPeriodEnd: boolean | null
  currentPeriodEnd: string | null
}

const ALLOWED_STATUSES = ['active', 'trialing', 'past_due']
const DENIED_STATUSES = ['canceled', 'unpaid', 'incomplete', 'incomplete_expired']

export default function BillingSuccessPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)

  const POLL_INTERVAL = 1500
  const MAX_POLLS = Math.floor(25000 / POLL_INTERVAL) // ~16 polls for 25 seconds

  useEffect(() => {
    let pollTimer: number | null = null
    let timeoutTimer: number | null = null
    let currentPollCount = 0

    async function pollStatus() {
      try {
        const res = await fetch('/api/billing/status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-dev-user-id': 'user_dev',
            'x-dev-user-email': 'dev@example.com',
            'x-dev-org-id': 'org_dev',
          },
        })

        // Detect proxy failures: text/plain with 500 on /api/* routes
        const contentType = res.headers.get('content-type') || '';
        const isProxyFailure = res.status === 500 && contentType.includes('text/plain');
        
        if (isProxyFailure) {
          throw new Error('Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)')
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json() as BillingStatus
        setStatus(data)
        currentPollCount++

        if (data.billingStatus && ALLOWED_STATUSES.includes(data.billingStatus)) {
          // Success: navigate to dashboard
          navigate('/dashboard', { replace: true })
          return
        }

        if (data.billingStatus && DENIED_STATUSES.includes(data.billingStatus)) {
          // Denied status: stop polling, show error
          setError('Subscription not active')
          return
        }

        // Continue polling if status is not yet set or is null
        if (currentPollCount < MAX_POLLS) {
          pollTimer = window.setTimeout(() => {
            pollStatus()
          }, POLL_INTERVAL)
        } else {
          // Timeout reached
          setTimedOut(true)
        }
      } catch (err: any) {
        console.error('[BILLING] Status poll failed:', err)
        // Detect network/proxy errors - don't continue polling on these
        const isNetworkError = 
          err?.message?.includes('Failed to fetch') ||
          err?.message?.includes('ECONNREFUSED') ||
          err?.message?.includes('Backend unreachable') ||
          err?.name === 'TypeError';
        
        if (isNetworkError) {
          setError(err?.message?.includes('Backend unreachable') 
            ? err.message 
            : 'Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)')
          return
        }
        
        // Continue polling on other errors (might be temporary)
        if (currentPollCount < MAX_POLLS) {
          pollTimer = window.setTimeout(() => {
            pollStatus()
          }, POLL_INTERVAL)
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
  }, [navigate])

  const handleManageBilling = async () => {
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-user-id': 'user_dev',
          'x-dev-user-email': 'dev@example.com',
          'x-dev-org-id': 'org_dev',
        },
        body: JSON.stringify({}),
      })

      // Detect proxy failures: text/plain with 500 on /api/* routes
      const contentType = res.headers.get('content-type') || '';
      const isProxyFailure = res.status === 500 && contentType.includes('text/plain');
      
      if (isProxyFailure) {
        throw new Error('Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)')
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to create portal session' }))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data = await res.json() as { url: string }
      if (data.url) {
        window.location.assign(data.url)
      } else {
        setError('No portal URL received')
      }
    } catch (err: any) {
      console.error('[BILLING] Portal creation failed:', err)
      // Detect network/proxy errors
      const isNetworkError = 
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('ECONNREFUSED') ||
        err?.message?.includes('Backend unreachable') ||
        err?.name === 'TypeError';
      
      const errorMessage = isNetworkError && !err?.message?.includes('Backend unreachable')
        ? 'Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)'
        : 'Failed to open billing portal';
      
      setError(errorMessage)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg-base, #0B0B10)' }}>
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8 text-center">
        {!error && !timedOut && (
          <div>
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
              Finalizing your subscription…
            </h2>
            <p className="text-sm" style={{ color: '#A8AFB8' }}>
              Please wait while we sync your billing status.
            </p>
          </div>
        )}
        {(error || timedOut) && (
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
                : 'Your subscription could not be activated. Please manage your billing to resolve this.'}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleManageBilling}
                className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors"
              >
                Manage billing
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium"
              >
                Back to pricing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

