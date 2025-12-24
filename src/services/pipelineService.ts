// src/services/pipelineService.ts

import prisma from "../lib/prisma";

export const pipelineService = {
  async getPipelineStats(orgId: string) {
    const stages = await prisma.pipelineHistory.groupBy({
      by: ["newStatus"],
      where: { lead: { orgId } },
      _count: true,
    });

    return stages.map((s) => ({
      stage: s.newStatus,
      count: s._count,
    }));
  },

  async getLeadsByStage(orgId: string) {
    const stages = await prisma.lead.groupBy({
      by: ["status"],
      where: { orgId },
      _count: true,
    });

    return stages.map((s) => ({
      stage: s.status,
      count: s._count,
    }));
  },

  async getPipelineVelocity(orgId: string) {
    // Average time between status changes
    const result = await prisma.$queryRaw<{ avg_hours: number | null }[]>`
      SELECT AVG(
        EXTRACT(EPOCH FROM (
          ph2."changedAt" - ph1."changedAt"
        )) / 3600
      ) as avg_hours
      FROM "PipelineHistory" ph1
      JOIN "PipelineHistory" ph2 ON ph1."leadId" = ph2."leadId" 
        AND ph2."changedAt" > ph1."changedAt"
      JOIN "Lead" l ON ph1."leadId" = l.id
      WHERE l."orgId" = ${orgId}
    `;
    
    return result[0]?.avg_hours ? Math.round(result[0].avg_hours * 10) / 10 : null;
  },

  async getStageTransitions(orgId: string) {
    const transitions = await prisma.pipelineHistory.findMany({
      where: { lead: { orgId } },
      select: {
        oldStatus: true,
        newStatus: true,
      },
    });

    // Count transitions between stages
    const transitionCounts: Record<string, number> = {};
    transitions.forEach(t => {
      const key = `${t.oldStatus || "new"} → ${t.newStatus}`;
      transitionCounts[key] = (transitionCounts[key] || 0) + 1;
    });

    return Object.entries(transitionCounts).map(([transition, count]) => ({
      transition,
      count,
    }));
  },

  async getRecentPipelineActivity(orgId: string, limit: number = 20) {
    return prisma.pipelineHistory.findMany({
      where: { lead: { orgId } },
      orderBy: { changedAt: "desc" },
      take: limit,
      include: {
        lead: {
          select: { id: true, address: true, city: true, state: true },
        },
      },
    });
  },

  /**
   * Get pipeline health score based on activity and flow
   */
  async getHealthScore(orgId: string): Promise<{
    score: number;
    rating: string;
    metrics: {
      activeLeads: number;
      stuckLeads: number;
      weeklyActivity: number;
    };
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [activeLeads, stuckLeads, weeklyActivity] = await Promise.all([
      // Active leads (not closed or dead)
      prisma.lead.count({
        where: { orgId, status: { notIn: ["closed", "dead"] } },
      }),
      // Stuck leads (no activity in 14+ days)
      prisma.lead.count({
        where: {
          orgId,
          status: { notIn: ["closed", "dead"] },
          updatedAt: { lt: fourteenDaysAgo },
        },
      }),
      // Events in last 7 days
      prisma.leadEvent.count({
        where: { lead: { orgId }, createdAt: { gte: sevenDaysAgo } },
      }),
    ]);

    // Calculate score
    let score = 50; // Base score

    // Active leads bonus
    if (activeLeads >= 10) score += 15;
    else if (activeLeads >= 5) score += 10;
    else if (activeLeads >= 1) score += 5;

    // Stuck leads penalty
    const stuckRatio = activeLeads > 0 ? stuckLeads / activeLeads : 0;
    if (stuckRatio < 0.1) score += 15;
    else if (stuckRatio < 0.25) score += 5;
    else if (stuckRatio > 0.5) score -= 15;
    else score -= 5;

    // Activity bonus
    if (weeklyActivity >= 20) score += 20;
    else if (weeklyActivity >= 10) score += 10;
    else if (weeklyActivity >= 5) score += 5;
    else if (weeklyActivity === 0) score -= 10;

    // Clamp score
    score = Math.min(100, Math.max(0, score));

    // Determine rating
    let rating: string;
    if (score >= 80) rating = "Excellent";
    else if (score >= 60) rating = "Good";
    else if (score >= 40) rating = "Fair";
    else rating = "Needs Attention";

    return {
      score,
      rating,
      metrics: {
        activeLeads,
        stuckLeads,
        weeklyActivity,
      },
    };
  },
};
