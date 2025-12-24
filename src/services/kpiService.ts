// src/services/kpiService.ts

import prisma from "../lib/prisma";
import { withCache, CacheKeys } from "../cache/kpiCache";

export const kpiService = {
  async getKpis(orgId: string) {
    const cacheKey = CacheKeys.kpi(orgId);

    return withCache(cacheKey, async () => {
      const totalLeads = await prisma.lead.count({ where: { orgId } });

      const activeLeads = await prisma.lead.count({
        where: { orgId, status: { notIn: ["closed", "dead"] } },
      });

      const qualifiedLeads = await prisma.lead.count({
        where: { orgId, isQualified: true },
      });

      const deals = await prisma.deal.findMany({ where: { orgId } });
      const closedDeals = deals.filter(d => d.status === "closed");

      const totalProfit = deals.reduce((acc, d) => acc + (Number(d.profit) || 0), 0);
      const totalRevenue = closedDeals.reduce((acc, d) => acc + (Number(d.assignmentFee) || 0), 0);

      // Qualification rate
      const qualificationRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;

      // Deal close ratio
      const dealCloseRatio = deals.length > 0 ? (closedDeals.length / deals.length) * 100 : 0;

      return {
        totalLeads,
        activeLeads,
        qualifiedLeads,
        totalProfit,
        totalRevenue,
        dealCount: deals.length,
        closedDealCount: closedDeals.length,
        qualificationRate: Math.round(qualificationRate * 10) / 10,
        dealCloseRatio: Math.round(dealCloseRatio * 10) / 10,
      };
    }, 60);
  },

  async getContactRate(orgId: string) {
    const leads = await prisma.lead.count({ where: { orgId } });

    const contacted = await prisma.leadEvent.groupBy({
      by: ["leadId"],
      where: { 
        lead: { orgId }, 
        eventType: { in: ["contacted", "call", "sms", "email"] } 
      },
    });

    if (leads === 0) return 0;
    return Math.round((contacted.length / leads) * 100 * 10) / 10;
  },

  async getAvgPipelineTime(orgId: string): Promise<number | null> {
    const result = await prisma.$queryRaw<{ avg_days: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (ph."changedAt" - l."createdAt")) / 86400) as avg_days
      FROM "PipelineHistory" ph
      JOIN "Lead" l ON ph."leadId" = l.id
      WHERE l."orgId" = ${orgId}
    `;
    return result[0]?.avg_days ?? null;
  },

  async getMonthlyRevenue(orgId: string): Promise<number> {
    const cacheKey = CacheKeys.revenue(orgId);

    return withCache(cacheKey, async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const deals = await prisma.deal.findMany({
        where: {
          orgId,
          status: "closed",
          closeDate: { gte: startOfMonth },
        },
      });

      return deals.reduce((acc, d) => acc + (Number(d.assignmentFee) || 0), 0);
    }, 300); // Cache for 5 minutes
  },

  async getWeeklyRevenue(orgId: string): Promise<number> {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const deals = await prisma.deal.findMany({
      where: {
        orgId,
        status: "closed",
        closeDate: { gte: startOfWeek },
      },
    });

    return deals.reduce((acc, d) => acc + (Number(d.assignmentFee) || 0), 0);
  },

  async getDailyActivity(orgId: string): Promise<{ events: number; leadsCreated: number }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const events = await prisma.leadEvent.count({
      where: {
        lead: { orgId },
        createdAt: { gte: startOfDay },
      },
    });

    const leadsCreated = await prisma.lead.count({
      where: {
        orgId,
        createdAt: { gte: startOfDay },
      },
    });

    return { events, leadsCreated };
  },

  async getAvgOfferToMoaSpread(orgId: string): Promise<number | null> {
    const leads = await prisma.lead.findMany({
      where: {
        orgId,
        moa: { not: null },
        offerPrice: { not: null },
      },
      select: { moa: true, offerPrice: true },
    });

    if (leads.length === 0) return null;

    const totalSpread = leads.reduce((acc, l) => {
      const spread = Number(l.moa) - Number(l.offerPrice);
      return acc + spread;
    }, 0);

    return Math.round((totalSpread / leads.length) * 100) / 100;
  },

  async getLeadToContractCycleTime(orgId: string): Promise<number | null> {
    const result = await prisma.$queryRaw<{ avg_days: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (d."createdAt" - l."createdAt")) / 86400) as avg_days
      FROM "Deal" d
      JOIN "Lead" l ON d."leadId" = l.id
      WHERE d."orgId" = ${orgId}
    `;
    return result[0]?.avg_days ? Math.round(result[0].avg_days * 10) / 10 : null;
  },

  async getFullKpiDashboard(orgId: string) {
    const cacheKey = CacheKeys.kpiFull(orgId);

    return withCache(cacheKey, async () => {
      const [
        basicKpis,
        contactRate,
        avgPipelineTime,
        monthlyRevenue,
        weeklyRevenue,
        dailyActivity,
        avgOfferSpread,
        cycleTime,
      ] = await Promise.all([
        this.getKpis(orgId),
        this.getContactRate(orgId),
        this.getAvgPipelineTime(orgId),
        this.getMonthlyRevenue(orgId),
        this.getWeeklyRevenue(orgId),
        this.getDailyActivity(orgId),
        this.getAvgOfferToMoaSpread(orgId),
        this.getLeadToContractCycleTime(orgId),
      ]);

      return {
        ...basicKpis,
        contactRate,
        avgPipelineTime: avgPipelineTime ? Math.round(avgPipelineTime * 10) / 10 : null,
        monthlyRevenue,
        weeklyRevenue,
        dailyActivity,
        avgOfferSpread,
        leadToContractCycleTime: cycleTime,
      };
    }, 60);
  },
};
