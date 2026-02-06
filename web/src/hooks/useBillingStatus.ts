import { useQuery } from '@tanstack/react-query'
import { get, ApiError, NetworkError } from '../api'

export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'none'

/** Normalized shape returned by the hook (consumers use data.status) */
export interface BillingStatusResponse {
  status: BillingStatus
  plan?: string | null
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
  trialEnd?: string | null
}

/** Raw shape from GET /billing/status (backend returns billingStatus, not status) */
interface BillingStatusApiResponse {
  billingStatus?: string
  plan?: string | null
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
  trialEnd?: string | null
}

function normalizeBillingResponse(raw?: BillingStatusApiResponse | null): BillingStatusResponse {
  if (!raw) return { status: 'none' }
  const status = (raw.billingStatus as BillingStatus) || 'none'
  return {
    status,
    plan: raw.plan ?? null,
    cancelAtPeriodEnd: raw.cancelAtPeriodEnd,
    currentPeriodEnd: raw.currentPeriodEnd ?? null,
    trialEnd: raw.trialEnd ?? null,
  }
}

/**
 * Check if a billing status is considered "subscribed" (has access to the app)
 */
export function isSubscribed(status: BillingStatus | undefined | null): boolean {
  if (!status) return false
  return status === 'active' || status === 'trialing'
}

/**
 * Hook to fetch the current user's billing status
 */
export function useBillingStatus() {
  return useQuery<BillingStatusResponse>({
    queryKey: ['billing', 'status'],
    queryFn: async () => {
      try {
        const response = await get<BillingStatusApiResponse>('/billing/status')
        return normalizeBillingResponse(response)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return { status: 'none' as BillingStatus }
        }
        if (error instanceof ApiError && error.status === 503) {
          // Backend auth subsystem unavailable (DB error) - treat as unauthenticated
          // Prevents 503 DB errors from breaking onboarding UI
          console.warn('[BILLING] Auth subsystem unavailable (503), treating as unauthenticated')
          return { status: 'none' as BillingStatus }
        }
        if (error instanceof NetworkError) {
          return { status: 'none' as BillingStatus }
        }
        throw error
      }
    },
    staleTime: 30_000, // 30 seconds
    retry: 1,
  })
}

/**
 * Synchronous check for billing status from a fetch response
 * Used in login flow where we need immediate redirect
 */
export async function checkBillingStatus(): Promise<BillingStatusResponse> {
  try {
    const response = await get<BillingStatusApiResponse>('/billing/status')
    return normalizeBillingResponse(response)
  } catch (error) {
    return { status: 'none' }
  }
}
