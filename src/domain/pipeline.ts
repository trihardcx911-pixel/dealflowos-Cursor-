/**
 * Pipeline Domain Service
 * Contains business logic for pipeline and status management
 */

import prisma from "../lib/prisma";

/**
 * Pipeline stage configuration
 */
export const PIPELINE_STAGES = [
  { id: "new", label: "New", order: 0, color: "#6b7280" },
  { id: "contacted", label: "Contacted", order: 1, color: "#3b82f6" },
  { id: "qualified", label: "Qualified", order: 2, color: "#8b5cf6" },
  { id: "offer_made", label: "Offer Made", order: 3, color: "#f59e0b" },
  { id: "under_contract", label: "Under Contract", order: 4, color: "#10b981" },
  { id: "closed", label: "Closed", order: 5, color: "#22c55e" },
  { id: "dead", label: "Dead", order: 6, color: "#ef4444" },
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number]["id"];

export class PipelineDomain {
  /**
   * Get pipeline kanban view data
   */
  static async getKanbanView(orgId: string) {
    const leads = await prisma.lead.findMany({
      where: { orgId },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        status: true,
        isQualified: true,
        arv: true,
        moa: true,
        dealScore: true,
        sellerName: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group by status
    const columns = PIPELINE_STAGES.map(stage => ({
      ...stage,
      leads: leads.filter(l => l.status === stage.id),
      count: leads.filter(l => l.status === stage.id).length,
    }));

    return {
      columns,
      totalLeads: leads.length,
    };
  }

  /**
   * Get pipeline velocity metrics
   */
  static async getVelocityMetrics(orgId: string) {
    // Average time in each stage
    const stageMetrics = await prisma.$queryRaw<
      { status: string; avg_hours: number }[]
    >`
      WITH stage_times AS (
        SELECT 
          ph."newStatus" as status,
          EXTRACT(EPOCH FROM (
            COALESCE(
              LEAD(ph."changedAt") OVER (PARTITION BY ph."leadId" ORDER BY ph."changedAt"),
              NOW()
            ) - ph."changedAt"
          )) / 3600 as hours_in_stage
        FROM "PipelineHistory" ph
        JOIN "Lead" l ON ph."leadId" = l.id
        WHERE l."orgId" = ${orgId}
      )
      SELECT status, AVG(hours_in_stage) as avg_hours
      FROM stage_times
      GROUP BY status
    `;

    // Convert to stage data
    return PIPELINE_STAGES.map(stage => ({
      ...stage,
      avgHours: stageMetrics.find(m => m.status === stage.id)?.avg_hours ?? null,
    }));
  }

  /**
   * Get conversion rates between stages
   */
  static async getConversionRates(orgId: string) {
    const history = await prisma.pipelineHistory.findMany({
      where: { lead: { orgId } },
      select: { oldStatus: true, newStatus: true },
    });

    // Count transitions
    const transitions: Record<string, Record<string, number>> = {};
    
    history.forEach(h => {
      const from = h.oldStatus || "new";
      const to = h.newStatus;
      
      if (!transitions[from]) transitions[from] = {};
      transitions[from][to] = (transitions[from][to] || 0) + 1;
    });

    // Calculate conversion rates
    const rates: { from: string; to: string; count: number; rate: number }[] = [];
    
    Object.entries(transitions).forEach(([from, tos]) => {
      const totalFromStage = Object.values(tos).reduce((a, b) => a + b, 0);
      
      Object.entries(tos).forEach(([to, count]) => {
        rates.push({
          from,
          to,
          count,
          rate: Math.round((count / totalFromStage) * 100),
        });
      });
    });

    return rates.sort((a, b) => b.count - a.count);
  }

  /**
   * Get leads stuck in pipeline (no activity for N days)
   */
  static async getStuckLeads(orgId: string, stuckDays: number = 7) {
    const stuckDate = new Date();
    stuckDate.setDate(stuckDate.getDate() - stuckDays);

    return prisma.lead.findMany({
      where: {
        orgId,
        status: { notIn: ["closed", "dead"] },
        updatedAt: { lt: stuckDate },
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
    });
  }

  /**
   * Get pipeline health score
   */
  static async getHealthScore(orgId: string) {
    const [leads, stuckLeads, recentActivity] = await Promise.all([
      prisma.lead.count({ where: { orgId, status: { notIn: ["closed", "dead"] } } }),
      this.getStuckLeads(orgId, 7),
      prisma.leadEvent.count({
        where: {
          lead: { orgId },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const stuckRatio = leads > 0 ? stuckLeads.length / leads : 0;
    const activityScore = Math.min(100, (recentActivity / Math.max(1, leads)) * 20);
    const flowScore = Math.max(0, 100 - stuckRatio * 100);

    const healthScore = Math.round((activityScore + flowScore) / 2);

    return {
      score: healthScore,
      rating: healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Fair" : "Needs Attention",
      metrics: {
        activeLeads: leads,
        stuckLeads: stuckLeads.length,
        weeklyActivity: recentActivity,
        activityScore: Math.round(activityScore),
        flowScore: Math.round(flowScore),
      },
    };
  }
}










