/**
 * KPI Recomputation Worker
 * Precomputes expensive KPI queries on a schedule
 */

import prisma from "../lib/prisma";
import { kpiService } from "../services/kpiService";
import { setCached, CacheKeys } from "../cache/kpiCache";

/**
 * Recompute KPIs for all active organizations
 */
export async function recalcKpiWorker(): Promise<void> {
  console.log("[kpiWorker] Starting KPI recomputation...");

  // Get all organizations with recent activity
  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });

  let processed = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      // Compute full KPIs
      const kpis = await kpiService.getFullKpiDashboard(org.id);
      
      // Cache results
      await setCached(CacheKeys.kpiFull(org.id), kpis, 300); // 5 min cache
      await setCached(CacheKeys.kpi(org.id), {
        totalLeads: kpis.totalLeads,
        activeLeads: kpis.activeLeads,
        qualifiedLeads: kpis.qualifiedLeads,
        totalProfit: kpis.totalProfit,
        dealCount: kpis.dealCount,
      }, 300);

      processed++;
    } catch (err) {
      errors++;
      console.error(`[kpiWorker] Error for org ${org.id}:`, err);
    }
  }

  console.log(`[kpiWorker] Completed: ${processed} orgs processed, ${errors} errors`);
}










