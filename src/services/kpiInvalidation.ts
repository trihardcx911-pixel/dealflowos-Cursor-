/**
 * KPI Cache Invalidation Service
 * Automatically invalidates KPI caches when data changes
 */

import { invalidateOrgCache, deleteCached, CacheKeys } from "../cache/kpiCache";

/**
 * Invalidation triggers - call these after data mutations
 */
export const kpiInvalidation = {
  /**
   * Call when a lead is created
   */
  async onLeadCreated(orgId: string): Promise<void> {
    await invalidateOrgCache(orgId);
  },

  /**
   * Call when a lead is updated
   */
  async onLeadUpdated(orgId: string): Promise<void> {
    await invalidateOrgCache(orgId);
  },

  /**
   * Call when lead status changes
   */
  async onStatusChanged(orgId: string): Promise<void> {
    await Promise.all([
      deleteCached(CacheKeys.kpi(orgId)),
      deleteCached(CacheKeys.kpiFull(orgId)),
      deleteCached(CacheKeys.pipeline(orgId)),
    ]);
  },

  /**
   * Call when a deal is created
   */
  async onDealCreated(orgId: string): Promise<void> {
    await invalidateOrgCache(orgId);
  },

  /**
   * Call when a deal is closed
   */
  async onDealClosed(orgId: string): Promise<void> {
    await Promise.all([
      deleteCached(CacheKeys.kpi(orgId)),
      deleteCached(CacheKeys.kpiFull(orgId)),
      deleteCached(CacheKeys.revenue(orgId)),
    ]);
  },

  /**
   * Call when a deal is cancelled
   */
  async onDealCancelled(orgId: string): Promise<void> {
    await invalidateOrgCache(orgId);
  },

  /**
   * Call when a lead event is logged
   */
  async onEventLogged(orgId: string): Promise<void> {
    // Events affect contact rate and activity metrics
    await deleteCached(CacheKeys.kpiFull(orgId));
  },

  /**
   * Call when lead is qualified/disqualified
   */
  async onQualificationChanged(orgId: string): Promise<void> {
    await Promise.all([
      deleteCached(CacheKeys.kpi(orgId)),
      deleteCached(CacheKeys.kpiFull(orgId)),
    ]);
  },

  /**
   * Invalidate all caches for an org
   */
  async invalidateAll(orgId: string): Promise<void> {
    await invalidateOrgCache(orgId);
  },
};

/**
 * Decorator to auto-invalidate KPIs after a function runs
 */
export function withKpiInvalidation<T>(
  orgIdGetter: (result: T) => string,
  invalidationFn: (orgId: string) => Promise<void>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      try {
        const orgId = orgIdGetter(result);
        if (orgId) {
          await invalidationFn(orgId);
        }
      } catch (err) {
        console.error("[kpiInvalidation] Failed to invalidate:", err);
      }

      return result;
    };

    return descriptor;
  };
}










