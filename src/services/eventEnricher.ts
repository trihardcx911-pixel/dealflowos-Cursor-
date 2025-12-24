/**
 * Event Enrichment Service
 * Adds context to events at creation time
 */

import prisma from "../lib/prisma";

/**
 * Enriched event data
 */
export interface EnrichedEventData {
  leadId: string;
  eventType: string;
  metadata: Record<string, any>;
  
  // Enriched fields
  enrichedAt: Date;
  leadStatus: string;
  timeInCurrentStatus: number; // hours
  leadOwnerId?: string;
  dealStage?: string;
  dealId?: string;
  totalEventsOnLead: number;
  daysSinceLeadCreated: number;
}

export const eventEnricher = {
  /**
   * Enrich event with lead context
   */
  async enrichEvent(
    leadId: string,
    eventType: string,
    baseMetadata: Record<string, any> = {}
  ): Promise<EnrichedEventData> {
    // Fetch lead with related data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        _count: { select: { events: true } },
        deals: {
          where: { status: "in_progress" },
          take: 1,
        },
        pipelineHistory: {
          orderBy: { changedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    // Calculate time in current status
    let timeInCurrentStatus = 0;
    if (lead.pipelineHistory.length > 0) {
      const lastChange = lead.pipelineHistory[0].changedAt;
      timeInCurrentStatus = (Date.now() - new Date(lastChange).getTime()) / (1000 * 60 * 60);
    } else {
      // If no pipeline history, use created date
      timeInCurrentStatus = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60);
    }

    // Calculate days since lead created
    const daysSinceLeadCreated = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);

    // Get active deal if any
    const activeDeal = lead.deals[0];

    return {
      leadId,
      eventType,
      metadata: {
        ...baseMetadata,
        // Enrichment data embedded in metadata
        _enriched: {
          leadStatus: lead.status,
          timeInCurrentStatus: Math.round(timeInCurrentStatus * 10) / 10,
          leadOwnerId: lead.userId,
          dealStage: activeDeal?.status,
          dealId: activeDeal?.id,
          totalEventsOnLead: lead._count.events,
          daysSinceLeadCreated: Math.round(daysSinceLeadCreated * 10) / 10,
          enrichedAt: new Date().toISOString(),
        },
      },
      enrichedAt: new Date(),
      leadStatus: lead.status,
      timeInCurrentStatus: Math.round(timeInCurrentStatus * 10) / 10,
      leadOwnerId: lead.userId || undefined,
      dealStage: activeDeal?.status,
      dealId: activeDeal?.id,
      totalEventsOnLead: lead._count.events,
      daysSinceLeadCreated: Math.round(daysSinceLeadCreated * 10) / 10,
    };
  },

  /**
   * Create enriched event in database
   */
  async createEnrichedEvent(
    leadId: string,
    eventType: string,
    baseMetadata: Record<string, any> = {}
  ) {
    const enriched = await this.enrichEvent(leadId, eventType, baseMetadata);

    return prisma.leadEvent.create({
      data: {
        leadId,
        eventType,
        metadata: enriched.metadata,
      },
    });
  },

  /**
   * Batch enrich existing events (for migration)
   */
  async batchEnrichEvents(leadId: string): Promise<number> {
    // Get lead with pipeline history
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        pipelineHistory: { orderBy: { changedAt: "asc" } },
      },
    });

    if (!lead) return 0;

    // Get events that need enriching
    const events = await prisma.leadEvent.findMany({
      where: { leadId },
    });

    let enrichedCount = 0;
    const pipelineHistory = lead.pipelineHistory;

    for (const event of events) {
      // Find status at time of event
      const statusAtEventTime = pipelineHistory.find(
        (ph: { changedAt: Date; newStatus: string }) => new Date(ph.changedAt) <= new Date(event.createdAt)
      )?.newStatus || "new";

      // Enrich with historical context
      await prisma.leadEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...(event.metadata as object),
            _enriched: {
              leadStatus: statusAtEventTime,
              enrichedAt: new Date().toISOString(),
              retroactive: true,
            },
          },
        },
      });

      enrichedCount++;
    }

    return enrichedCount;
  },
};

