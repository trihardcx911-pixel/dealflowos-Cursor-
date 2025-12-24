/**
 * Activity Feed Service
 * Aggregates events for UI activity feeds
 */

import prisma from "../lib/prisma";
import { withCache, CacheKeys } from "../cache/kpiCache";

export interface ActivityItem {
  id: string;
  type: string;
  leadId: string;
  leadAddress?: string;
  description: string;
  metadata: any;
  createdAt: Date;
}

export const activityFeedService = {
  /**
   * Get activity feed for organization
   */
  async getFeed(orgId: string, limit: number = 50): Promise<ActivityItem[]> {
    const events = await prisma.leadEvent.findMany({
      where: { lead: { orgId } },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        lead: {
          select: { id: true, address: true, city: true, state: true },
        },
      },
    });

    return events.map((e) => ({
      id: e.id,
      type: e.eventType,
      leadId: e.leadId,
      leadAddress: e.lead ? `${e.lead.address}, ${e.lead.city}, ${e.lead.state}` : undefined,
      description: this.formatEventDescription(e.eventType, e.metadata as any),
      metadata: e.metadata,
      createdAt: e.createdAt,
    }));
  },

  /**
   * Get activity feed for a specific lead
   */
  async getLeadFeed(leadId: string, limit: number = 50): Promise<ActivityItem[]> {
    const events = await prisma.leadEvent.findMany({
      where: { leadId },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return events.map((e) => ({
      id: e.id,
      type: e.eventType,
      leadId: e.leadId,
      description: this.formatEventDescription(e.eventType, e.metadata as any),
      metadata: e.metadata,
      createdAt: e.createdAt,
    }));
  },

  /**
   * Get activity grouped by day
   */
  async getDailyActivity(orgId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await prisma.leadEvent.findMany({
      where: {
        lead: { orgId },
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { address: true } },
      },
    });

    // Group by date
    const grouped: Record<string, ActivityItem[]> = {};
    
    events.forEach((e) => {
      const dateKey = e.createdAt.toISOString().split("T")[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      
      grouped[dateKey].push({
        id: e.id,
        type: e.eventType,
        leadId: e.leadId,
        leadAddress: e.lead?.address,
        description: this.formatEventDescription(e.eventType, e.metadata as any),
        metadata: e.metadata,
        createdAt: e.createdAt,
      });
    });

    return Object.entries(grouped).map(([date, items]) => ({
      date,
      count: items.length,
      items,
    }));
  },

  /**
   * Get activity summary stats
   */
  async getActivitySummary(orgId: string, days: number = 30) {
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

    const total = events.reduce((sum, e) => sum + e._count, 0);

    return {
      total,
      period: `${days} days`,
      breakdown: events.map((e) => ({
        type: e.eventType,
        count: e._count,
        percentage: Math.round((e._count / total) * 100),
      })),
    };
  },

  /**
   * Format event description for display
   */
  formatEventDescription(eventType: string, metadata: any): string {
    const descriptions: Record<string, (m: any) => string> = {
      created: () => "Lead created",
      updated: (m) => `Lead updated (${m?.fields?.join(", ") || "fields changed"})`,
      deleted: () => "Lead deleted",
      contacted: () => "Lead contacted",
      call: (m) => `Phone call (${m?.outcome || "completed"})`,
      sms: (m) => `SMS ${m?.direction || "sent"}`,
      email: (m) => `Email ${m?.direction || "sent"}`,
      note: () => "Note added",
      status_changed: (m) => `Status: ${m?.oldStatus || "new"} → ${m?.newStatus}`,
      qualified: () => "Lead qualified",
      disqualified: () => "Lead disqualified",
      deal_created: (m) => `Deal created ($${m?.assignmentFee || 0})`,
      deal_closed: (m) => `Deal closed ($${m?.profit || 0} profit)`,
      deal_cancelled: (m) => `Deal cancelled${m?.reason ? `: ${m.reason}` : ""}`,
    };

    const formatter = descriptions[eventType];
    return formatter ? formatter(metadata) : `Event: ${eventType}`;
  },
};










