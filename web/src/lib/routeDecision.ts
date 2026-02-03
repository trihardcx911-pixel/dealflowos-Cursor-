import type { BillingStatus } from '../hooks/useBillingStatus'

/**
 * Centralized route decision helper for onboarding flow.
 * Pure function that determines the next route based on auth/billing state.
 *
 * State Machine:
 * - unauthenticated → /login
 * - authenticated + checkout-intent (plan param) → /billing/redirect?plan=xxx
 * - authenticated + subscribed → /leads (or from path if safe)
 * - authenticated + unsubscribed → /onboarding/plan
 */

export interface RouteDecisionInput {
  isAuthenticated: boolean
  billingStatus: BillingStatus | null | undefined
  planIntent?: string | null       // plan param from signup flow
  fromPath?: string | null         // where user was trying to go
  currentPath?: string             // current location
}

export interface RouteDecisionResult {
  route: string
  reason: 'unauthenticated' | 'checkout-intent' | 'subscribed' | 'unsubscribed'
}

// Routes that are safe to redirect to after login
const SAFE_REDIRECT_PATHS = [
  '/leads',
  '/dashboard',
  '/calendar',
  '/tasks',
  '/settings',
  '/kpis',
  '/resources',
  '/deals',
]

/**
 * Check if a path is safe to redirect to (protected app routes)
 */
function isSafeRedirectPath(path: string | null | undefined): boolean {
  if (!path) return false
  return SAFE_REDIRECT_PATHS.some(safe => path.startsWith(safe))
}

/**
 * Check if billing status means user has active subscription.
 * Includes 'past_due' because user should retain access while payment is being resolved.
 */
export function hasActiveSubscription(status: BillingStatus | null | undefined): boolean {
  if (!status) return false
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

/**
 * Check if billing status indicates a payment issue that needs attention.
 * Used to show warning banners while still allowing app access.
 */
export function hasBillingIssue(status: BillingStatus | null | undefined): boolean {
  if (!status) return false
  return status === 'past_due'
}

/**
 * Determine the next route based on auth and billing state.
 * Used by LoginPage, ProtectedRoute, and BillingSuccessPage.
 */
export function getNextRoute(input: RouteDecisionInput): RouteDecisionResult {
  const { isAuthenticated, billingStatus, planIntent, fromPath, currentPath } = input

  // Not authenticated -> login
  if (!isAuthenticated) {
    return { route: '/login', reason: 'unauthenticated' }
  }

  // Has plan intent (from signup flow) -> go directly to checkout
  if (planIntent) {
    return { route: `/billing/redirect?plan=${planIntent}`, reason: 'checkout-intent' }
  }

  // Subscribed -> go to app (respecting fromPath if safe)
  if (hasActiveSubscription(billingStatus)) {
    const destination = isSafeRedirectPath(fromPath) ? fromPath! : '/leads'
    return { route: destination, reason: 'subscribed' }
  }

  // Not subscribed -> onboarding (but avoid loop if already there)
  if (currentPath === '/onboarding/plan') {
    // Already on onboarding, don't redirect
    return { route: '/onboarding/plan', reason: 'unsubscribed' }
  }

  return { route: '/onboarding/plan', reason: 'unsubscribed' }
}

/**
 * Default app route for post-checkout success.
 * This is the canonical post-auth landing route - all success paths converge here.
 */
export const DEFAULT_APP_ROUTE = '/leads'
