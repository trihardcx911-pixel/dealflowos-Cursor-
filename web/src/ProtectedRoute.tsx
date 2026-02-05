import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useBillingStatus } from './hooks/useBillingStatus'
import { hasActiveSubscription, hasBillingIssue } from './lib/routeDecision'
import { useQueryClient } from '@tanstack/react-query'

type ProtectedRouteProps = {
  children?: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const queryClient = useQueryClient()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const { data: billingStatus, isLoading, isError, refetch } = useBillingStatus()

  // Determine current state
  const isAuthenticated = Boolean(token)
  const isSubscribed = hasActiveSubscription(billingStatus?.status)
  const showBillingWarning = hasBillingIssue(billingStatus?.status)
  const isCheckingStatus = isLoading && !isError

  // Compute what to render based on state (single return, no fragments)
  const showLogin = !isAuthenticated
  const showLoading = isAuthenticated && isCheckingStatus
  const showVerifyError = isAuthenticated && isError && !isLoading
  const showOnboarding = isAuthenticated && !isCheckingStatus && !isError && !isSubscribed
  const showContent = isAuthenticated && !isCheckingStatus && !isError && isSubscribed

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['billing', 'status'] })
    refetch()
  }

  return (
    <div className="contents">
      {showLogin && (
        <Navigate to="/login" state={{ from: location.pathname }} replace />
      )}

      {showLoading && (
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-base, #0B0B10)' }}
        >
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin mb-4" />
            <p className="text-sm text-white/60">Verifying access...</p>
          </div>
        </div>
      )}

      {showVerifyError && (
        <div
          className="min-h-screen flex items-center justify-center px-6"
          style={{ backgroundColor: 'var(--bg-base, #0B0B10)' }}
        >
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <span className="text-2xl text-amber-400">⚠</span>
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
              Can't verify subscription
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
                to="/settings/billing"
                className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors font-medium flex items-center justify-center"
              >
                Manage billing
              </Link>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && (
        <Navigate to="/onboarding/plan" replace />
      )}

      {showContent && (
        <div className="contents">
          {/* Past due billing warning banner */}
          {showBillingWarning && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-amber-400">⚠</span>
                  <p className="text-sm text-amber-200">
                    Payment issue — please update your billing information to avoid service interruption.
                  </p>
                </div>
                <Link
                  to="/settings/billing"
                  className="shrink-0 px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors"
                >
                  Update billing
                </Link>
              </div>
            </div>
          )}
          {children ? children : <Outlet />}
        </div>
      )}
    </div>
  )
}
