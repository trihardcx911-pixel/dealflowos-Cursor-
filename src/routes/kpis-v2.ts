import express, { Request, Response, NextFunction } from "express";
import { kpiService } from "../services/kpiService";
import { pipelineService } from "../services/pipelineService";
import { analyticsService } from "../services/analyticsService";
import { asyncHandler } from "../middleware/errorNormalizer";
import prisma from "../lib/prisma";

const router = express.Router();

// GET /api/kpis - Get basic KPIs
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const kpis = await kpiService.getKpis(orgId);
  res.json(kpis);
}));

// GET /api/kpis/full - Get full KPI dashboard
router.get("/full", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const kpis = await kpiService.getFullKpiDashboard(orgId);
  res.json(kpis);
}));

// GET /api/kpis/snapshots - Get historical KPI snapshots for charts
router.get("/snapshots", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { range = "30" } = req.query;
  
  const days = parseInt(range as string, 10) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const snapshots = await prisma.kpiSnapshot.findMany({
    where: {
      orgId,
      date: { gte: startDate },
    },
    orderBy: { date: "asc" },
  });

  res.json({
    data: snapshots,
    range: days,
    startDate: startDate.toISOString(),
    endDate: new Date().toISOString(),
  });
}));

// GET /api/kpis/pipeline - Get pipeline stats
router.get("/pipeline", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const [stats, byStage, velocity, transitions] = await Promise.all([
    pipelineService.getPipelineStats(orgId),
    pipelineService.getLeadsByStage(orgId),
    pipelineService.getPipelineVelocity(orgId),
    pipelineService.getStageTransitions(orgId),
  ]);
  res.json({ stats, byStage, velocity, transitions });
}));

// GET /api/kpis/pipeline/summary - Get pipeline summary for dashboard
router.get("/pipeline/summary", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  
  const [byStage, velocity, health] = await Promise.all([
    pipelineService.getLeadsByStage(orgId),
    pipelineService.getPipelineVelocity(orgId),
    pipelineService.getHealthScore(orgId),
  ]);

  // Find bottleneck (stage with most leads that isn't closed/dead)
  const activeStages = byStage.filter((s: { stage: string; count: number }) => !["closed", "dead"].includes(s.stage));
  const bottleneck = activeStages.reduce((max: typeof activeStages[0] | null, s: typeof activeStages[0]) => 
    s.count > (max?.count || 0) ? s : max, null as typeof activeStages[0] | null
  );

  res.json({
    stages: byStage,
    velocity,
    health,
    bottleneck: bottleneck ? {
      stage: bottleneck.stage,
      count: bottleneck.count,
      recommendation: `${bottleneck.count} leads stuck in ${bottleneck.stage} - consider outreach`,
    } : null,
  });
}));

// GET /api/kpis/pipeline/activity - Get recent pipeline activity
router.get("/pipeline/activity", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { limit = "20" } = req.query;
  const activity = await pipelineService.getRecentPipelineActivity(orgId, parseInt(limit as string));
  res.json(activity);
}));

// GET /api/kpis/analytics - Get analytics
router.get("/analytics", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { days = "30" } = req.query;

  const [eventActivity, communications, dailyTrend, funnel] = await Promise.all([
    analyticsService.getEventActivityCounts(orgId, parseInt(days as string)),
    analyticsService.getCommunicationBreakdown(orgId, parseInt(days as string)),
    analyticsService.getDailyEventTrend(orgId, 14),
    analyticsService.getQualificationFunnel(orgId),
  ]);

  res.json({ eventActivity, communications, dailyTrend, funnel });
}));

// GET /api/kpis/revenue - Get revenue metrics
router.get("/revenue", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;

  const [monthly, weekly, avgSpread, cycleTime] = await Promise.all([
    kpiService.getMonthlyRevenue(orgId),
    kpiService.getWeeklyRevenue(orgId),
    kpiService.getAvgOfferToMoaSpread(orgId),
    kpiService.getLeadToContractCycleTime(orgId),
  ]);

  res.json({
    monthlyRevenue: monthly,
    weeklyRevenue: weekly,
    avgOfferToMoaSpread: avgSpread,
    leadToContractCycleTime: cycleTime,
  });
}));

export default router;
