/**
 * Daily KPI Snapshot Worker
 * Creates daily snapshots for historical dashboard charts
 */

import prisma from "../lib/prisma";
import { kpiService } from "../services/kpiService";

/**
 * Create daily KPI snapshots for all organizations
 */
export async function snapshotWorker(): Promise<void> {
  console.log("[snapshotWorker] Creating daily KPI snapshots...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all organizations
  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      // Check if snapshot already exists for today
      const existing = await prisma.kpiSnapshot.findFirst({
        where: {
          orgId: org.id,
          date: today,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Get current KPIs
      const kpis = await kpiService.getFullKpiDashboard(org.id);

      // Create snapshot
      await prisma.kpiSnapshot.create({
        data: {
          orgId: org.id,
          date: today,
          totalLeads: kpis.totalLeads,
          activeLeads: kpis.activeLeads,
          qualifiedLeads: kpis.qualifiedLeads,
          dealsCreated: kpis.dealCount,
          dealsClosed: kpis.closedDealCount,
          revenue: kpis.totalRevenue,
          profit: kpis.totalProfit,
          contactRate: kpis.contactRate,
          qualificationRate: kpis.qualificationRate,
          avgPipelineDays: kpis.avgPipelineTime,
        },
      });

      created++;
    } catch (err) {
      errors++;
      console.error(`[snapshotWorker] Error for org ${org.id}:`, err);
    }
  }

  console.log(`[snapshotWorker] Completed: ${created} created, ${skipped} skipped, ${errors} errors`);
}

/**
 * Get historical snapshots for charts
 */
export async function getSnapshotHistory(orgId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.kpiSnapshot.findMany({
    where: {
      orgId,
      date: { gte: startDate },
    },
    orderBy: { date: "asc" },
  });
}










