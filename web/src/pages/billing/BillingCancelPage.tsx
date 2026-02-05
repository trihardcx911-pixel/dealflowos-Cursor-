import { useNavigate, useSearchParams } from 'react-router-dom'

export default function BillingCancelPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const plan = searchParams.get('plan') || 'bronze'

  // Check if user is logged in (has token) - if so, they're in onboarding flow
  const hasToken = typeof window !== 'undefined' && localStorage.getItem('token')
  const backUrl = hasToken ? '/onboarding/plan?canceled=true' : '/'
  const backLabel = hasToken ? 'Back to plan selection' : 'Back to pricing'

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg-base, #0B0B10)' }}>
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8 text-center">
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-2xl text-white/60">✕</span>
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
          Checkout canceled
        </h2>
        <p className="text-sm mb-6" style={{ color: '#A8AFB8' }}>
          Your checkout was canceled. No charges were made.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate(backUrl)}
            className="w-full h-12 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors"
          >
            {backLabel}
          </button>
          <button
            onClick={() => navigate(`/billing/redirect?plan=${plan}`)}
            className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}

