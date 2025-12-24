/**
 * KPI Delta Worker
 * Broadcasts real-time KPI updates to connected clients
 * Runs every 30 seconds
 */

import { broadcastToOrg } from "../realtime/gateway";
import { EVENTS, KpiDeltaEvent } from "../realtime/events";
import prisma from "../lib/prisma";

export async function kpiDeltaWorker(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const org of orgs) {
    try {
      const [leadsToday, dealsToday, eventsToday, revenueResult] = await Promise.all([
        // Leads created today
        prisma.lead.count({
          where: {
            orgId: org.id,
            createdAt: { gte: today },
          },
        }),

        // Deals closed today
        prisma.deal.count({
          where: {
            orgId: org.id,
            status: "closed",
            closeDate: { gte: today },
          },
        }),

        // Events logged today
        prisma.leadEvent.count({
          where: {
            lead: { orgId: org.id },
            createdAt: { gte: today },
          },
        }),

        // Revenue today
        prisma.deal.aggregate({
          where: {
            orgId: org.id,
            status: "closed",
            closeDate: { gte: today },
          },
          _sum: {
            profit: true,
          },
        }),
      ]);

      const delta: KpiDeltaEvent = {
        type: EVENTS.KPI_DELTA,
        orgId: org.id,
        leadsToday,
        dealsToday,
        eventsToday,
        revenueToday: Number(revenueResult._sum?.profit) || 0,
        timestamp: Date.now(),
      };

      // Broadcast to org's connected clients
      broadcastToOrg(org.id, delta);
    } catch (err) {
      console.error(`[kpiDeltaWorker] Error for org ${org.id}:`, err);
    }
  }
}

