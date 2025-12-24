/**
 * Dashboard Routes
 * Aggregated data for frontend dashboard views
 */

import express, { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorNormalizer";
import prisma from "../lib/prisma";
import { kpiService } from "../services/kpiService";
import { leadScoreService } from "../services/leadScoreService";
import { pipelineService } from "../services/pipelineService";

const router = express.Router();

// GET /api/dashboard/digest - Daily digest for dashboard
router.get("/digest", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;

  const [
    kpis,
    topLeads,
    needsAttention,
    upcomingDeals,
    recentActivity,
    pipelineHealth,
  ] = await Promise.all([
    kpiService.getKpis(orgId),
    leadScoreService.getTopLeads(orgId, 5),
    leadScoreService.getLeadsNeedingAttention(orgId, 5),
    getUpcomingDeals(orgId),
    getRecentActivity(orgId),
    pipelineService.getHealthScore(orgId),
  ]);

  // Calculate projections
  const avgDealValue = kpis.closedDealCount > 0 
    ? kpis.totalProfit / kpis.closedDealCount 
    : 10000;
  const projectedMonthlyRevenue = kpis.activeLeads * (kpis.qualificationRate / 100) * avgDealValue * 0.3;

  res.json({
    summary: {
      totalLeads: kpis.totalLeads,
      activeLeads: kpis.activeLeads,
      dealsClosed: kpis.closedDealCount,
      monthlyRevenue: kpis.totalProfit,
      projectedRevenue: Math.round(projectedMonthlyRevenue),
    },
    hotLeads: topLeads,
    needsFollowUp: needsAttention,
    upcomingDeals,
    recentActivity,
    health: pipelineHealth,
    generatedAt: new Date().toISOString(),
  });
}));

// GET /api/dashboard/quick-stats - Quick stats for header
router.get("/quick-stats", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayLeads, todayEvents, todayDeals, activeDeals] = await Promise.all([
    prisma.lead.count({ where: { orgId, createdAt: { gte: today } } }),
    prisma.leadEvent.count({ where: { lead: { orgId }, createdAt: { gte: today } } }),
    prisma.deal.count({ where: { orgId, createdAt: { gte: today } } }),
    prisma.deal.count({ where: { orgId, status: "in_progress" } }),
  ]);

  res.json({
    todayLeads,
    todayEvents,
    todayDeals,
    activeDeals,
    timestamp: new Date().toISOString(),
  });
}));

// GET /api/dashboard/notifications - Pending notifications/alerts
router.get("/notifications", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - 7);

  const [staleLeads, highValuePending, automationLogs] = await Promise.all([
    prisma.lead.count({
      where: { orgId, status: { notIn: ["closed", "dead"] }, updatedAt: { lt: staleDate } },
    }),
    prisma.lead.count({
      where: { orgId, status: { notIn: ["closed", "dead"] }, arv: { gte: 300000 } },
    }),
    prisma.automationLog.findMany({
      where: { orgId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }).catch(() => []), // Table might not exist yet
  ]);

  const notifications = [];

  if (staleLeads > 0) {
    notifications.push({
      type: "warning",
      title: "Stale Leads",
      message: `${staleLeads} leads haven't been touched in 7+ days`,
      action: "View stale leads",
      count: staleLeads,
    });
  }

  if (highValuePending > 0) {
    notifications.push({
      type: "info",
      title: "High-Value Opportunities",
      message: `${highValuePending} high-value leads need attention`,
      action: "View high-value leads",
      count: highValuePending,
    });
  }

  res.json({ notifications, automationLogs });
}));

// Helper: Get upcoming deals (closing soon)
async function getUpcomingDeals(orgId: string) {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  return prisma.deal.findMany({
    where: {
      orgId,
      status: "in_progress",
    },
    include: {
      lead: { select: { address: true, city: true, state: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
}

// Helper: Get recent activity
async function getRecentActivity(orgId: string) {
  return prisma.leadEvent.findMany({
    where: { lead: { orgId } },
    include: {
      lead: { select: { id: true, address: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export default router;










