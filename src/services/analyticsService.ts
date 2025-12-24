// src/services/analyticsService.ts

import prisma from "../lib/prisma";

export const analyticsService = {
  async getContactRate(orgId: string) {
    const leads = await prisma.lead.count({ where: { orgId } });

    const contacted = await prisma.leadEvent.groupBy({
      by: ["leadId"],
      _count: true,
      where: { lead: { orgId }, eventType: "contacted" },
    });

    if (leads === 0) return 0;
    return (contacted.length / leads) * 100;
  },

  async getEventActivityCounts(orgId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await prisma.leadEvent.groupBy({
      by: ["eventType"],
      where: {
        lead: { orgId },
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    return events.map(e => ({
      eventType: e.eventType,
      count: e._count,
    }));
  },

  async getCommunicationBreakdown(orgId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const communicationTypes = ["call", "sms", "email", "contacted"];

    const events = await prisma.leadEvent.groupBy({
      by: ["eventType"],
      where: {
        lead: { orgId },
        eventType: { in: communicationTypes },
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    return {
      calls: events.find(e => e.eventType === "call")?._count || 0,
      sms: events.find(e => e.eventType === "sms")?._count || 0,
      emails: events.find(e => e.eventType === "email")?._count || 0,
      contacted: events.find(e => e.eventType === "contacted")?._count || 0,
      total: events.reduce((acc, e) => acc + e._count, 0),
    };
  },

  async getLeadSourceAnalysis(orgId: string) {
    // Future-proofed for when lead source tracking is added
    // For now, return placeholder structure
    const leads = await prisma.lead.findMany({
      where: { orgId },
      select: { id: true, createdAt: true },
    });

    return {
      totalLeads: leads.length,
      sources: [
        { source: "direct", count: leads.length, percentage: 100 },
      ],
      // Will be expanded when source field is added to Lead model
    };
  },

  async getDailyEventTrend(orgId: string, days: number = 14) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await prisma.leadEvent.findMany({
      where: {
        lead: { orgId },
        createdAt: { gte: startDate },
      },
      select: { createdAt: true, eventType: true },
    });

    // Group by date
    const dailyCounts: Record<string, number> = {};
    events.forEach(e => {
      const dateKey = e.createdAt.toISOString().split("T")[0];
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    });

    // Fill in missing dates with 0
    const result: { date: string; count: number }[] = [];
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      result.push({ date: dateKey, count: dailyCounts[dateKey] || 0 });
    }

    return result;
  },

  async getQualificationFunnel(orgId: string) {
    const totalLeads = await prisma.lead.count({ where: { orgId } });
    const contacted = await prisma.leadEvent.groupBy({
      by: ["leadId"],
      where: { lead: { orgId }, eventType: { in: ["contacted", "call", "sms", "email"] } },
    });
    const qualified = await prisma.lead.count({ where: { orgId, isQualified: true } });
    const deals = await prisma.deal.count({ where: { orgId } });
    const closedDeals = await prisma.deal.count({ where: { orgId, status: "closed" } });

    return {
      stages: [
        { stage: "Total Leads", count: totalLeads },
        { stage: "Contacted", count: contacted.length },
        { stage: "Qualified", count: qualified },
        { stage: "Deals Created", count: deals },
        { stage: "Deals Closed", count: closedDeals },
      ],
      conversionRates: {
        contactRate: totalLeads > 0 ? Math.round((contacted.length / totalLeads) * 100) : 0,
        qualificationRate: contacted.length > 0 ? Math.round((qualified / contacted.length) * 100) : 0,
        dealRate: qualified > 0 ? Math.round((deals / qualified) * 100) : 0,
        closeRate: deals > 0 ? Math.round((closedDeals / deals) * 100) : 0,
      },
    };
  },
};
