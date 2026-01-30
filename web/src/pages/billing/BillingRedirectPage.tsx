import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function BillingRedirectPage() {
  const [searchParams] = useSearchParams()
  const plan = searchParams.get('plan') || 'bronze'
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function createCheckout() {
      try {
        setLoading(true)
        setError(null)
        
        const res = await fetch('/api/billing/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-dev-user-id': 'user_dev',
            'x-dev-user-email': 'dev@example.com',
            'x-dev-org-id': 'org_dev',
          },
          body: JSON.stringify({ plan }),
        })

        // Detect proxy failures: text/plain with 500 on /api/* routes
        const contentType = res.headers.get('content-type') || '';
        const isProxyFailure = res.status === 500 && contentType.includes('text/plain');
        
        if (isProxyFailure) {
          throw new Error('Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)')
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Failed to create checkout session' }))
          throw new Error(errorData.error || `HTTP ${res.status}`)
        }

        const data = await res.json() as { url: string; id: string }

        if (data.url) {
          // Redirect to Stripe Checkout
          window.location.assign(data.url)
        } else {
          setError('No checkout URL received')
          setLoading(false)
        }
      } catch (err: any) {
        console.error('[BILLING] Checkout creation failed:', err)
        // Detect network/proxy errors
        const isNetworkError = 
          err?.message?.includes('Failed to fetch') ||
          err?.message?.includes('ECONNREFUSED') ||
          err?.message?.includes('Backend unreachable') ||
          err?.name === 'TypeError';
        
        const errorMessage = isNetworkError && !err?.message?.includes('Backend unreachable')
          ? 'Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)'
          : (err?.message || 'Failed to create checkout session');
        
        setError(errorMessage)
        setLoading(false)
      }
    }

    createCheckout()
  }, [plan])

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg-base, #0B0B10)' }}>
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8 text-center">
        {loading && !error && (
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
        {error && (
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
                onClick={() => navigate('/')}
                className="flex-1 h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium"
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

