import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useBillingStatus } from './hooks/useBillingStatus'
import { hasActiveSubscription, hasBillingIssue } from './lib/routeDecision'

type ProtectedRouteProps = {
  children?: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const { data: billingStatus, isLoading, isError } = useBillingStatus()

  // Determine current state
  const isAuthenticated = Boolean(token)
  const isSubscribed = hasActiveSubscription(billingStatus?.status)
  const showBillingWarning = hasBillingIssue(billingStatus?.status)
  const isCheckingStatus = isLoading && !isError

  // Compute what to render based on state (single return, no fragments)
  // On billing error: if cached data shows subscription → allow; else → onboarding
  const showLogin = !isAuthenticated
  const showLoading = isAuthenticated && isCheckingStatus
  const showOnboarding = isAuthenticated && !isCheckingStatus && !isSubscribed
  const showContent = isAuthenticated && !isCheckingStatus && isSubscribed

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
