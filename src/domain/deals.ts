/**
 * Deal Domain Service
 * Contains business logic for deal operations with transaction safety
 */

import prisma from "../lib/prisma";
import { kpiInvalidation } from "../services/kpiInvalidation";
import { runAutomation } from "../automation/engine";
import { DomainError } from "./leads";

export interface CreateDealInput {
  leadId: string;
  buyerName?: string;
  assignmentFee?: number;
  dealType?: string;
}

export interface CloseDealInput {
  profit?: number;
  closeDate?: Date;
}

export class DealDomain {
  /**
   * Create deal from lead with transaction safety
   */
  static async create(orgId: string, userId: string, input: CreateDealInput) {
    const { leadId, buyerName, assignmentFee, dealType = "assignment" } = input;

    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get lead within transaction
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      
      if (!lead) {
        throw new DomainError("NOT_FOUND", "Lead not found");
      }

      if (lead.orgId !== orgId) {
        throw new DomainError("FORBIDDEN", "Lead does not belong to this organization");
      }

      // Business rules
      if (lead.status === "dead") {
        throw new DomainError("INVALID_STATE", "Cannot create deal from dead lead");
      }

      if (lead.status === "closed") {
        throw new DomainError("INVALID_STATE", "Lead already has a closed deal");
      }

      // Check for existing active deal
      const existingDeal = await tx.deal.findFirst({
        where: { leadId, status: { in: ["in_progress"] } },
      });

      if (existingDeal) {
        throw new DomainError("DUPLICATE_DEAL", "Lead already has an active deal", { existingDealId: existingDeal.id });
      }

      // Calculate profit
      const finalAssignmentFee = assignmentFee ?? Number(lead.desiredAssignmentFee) ?? 0;
      const profit = finalAssignmentFee;

      // Create deal
      const deal = await tx.deal.create({
        data: {
          leadId,
          orgId,
          userId,
          dealType,
          assignmentFee: finalAssignmentFee,
          profit,
          buyerName,
          status: "in_progress",
        },
      });

      // Update lead status atomically
      await tx.lead.update({
        where: { id: leadId },
        data: { status: "under_contract" },
      });

      // Log event
      await tx.leadEvent.create({
        data: {
          leadId,
          eventType: "deal_created",
          metadata: { dealId: deal.id, dealType, assignmentFee: finalAssignmentFee, userId },
        },
      });

      return deal;
    });

    // Invalidate caches after successful transaction
    await kpiInvalidation.onDealCreated(orgId);

    // Get lead for automation
    const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
    await runAutomation("deal_created", { deal: result, lead, orgId });

    return result;
  }

  /**
   * Close deal with transaction safety
   */
  static async close(dealId: string, input: CloseDealInput = {}) {
    const { profit, closeDate = new Date() } = input;

    const result = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: { lead: true },
      });

      if (!deal) {
        throw new DomainError("NOT_FOUND", "Deal not found");
      }

      if (deal.status === "closed") {
        throw new DomainError("INVALID_STATE", "Deal is already closed");
      }

      if (deal.status === "cancelled") {
        throw new DomainError("INVALID_STATE", "Cannot close a cancelled deal");
      }

      // Update deal
      const updatedDeal = await tx.deal.update({
        where: { id: dealId },
        data: {
          status: "closed",
          closeDate,
          profit: profit ?? deal.profit,
        },
      });

      // Update lead status
      await tx.lead.update({
        where: { id: deal.leadId },
        data: { status: "closed" },
      });

      // Log event
      await tx.leadEvent.create({
        data: {
          leadId: deal.leadId,
          eventType: "deal_closed",
          metadata: { 
            dealId: deal.id, 
            profit: profit ?? deal.profit,
            closeDate: closeDate.toISOString(),
          },
        },
      });

      return updatedDeal;
    });

    await kpiInvalidation.onDealClosed(result.orgId);

    // Get lead for automation
    const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
    await runAutomation("deal_closed", { deal: result, lead, orgId: result.orgId });

    return result;
  }

  /**
   * Cancel deal with transaction safety
   */
  static async cancel(dealId: string, reason?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: { lead: true },
      });

      if (!deal) {
        throw new DomainError("NOT_FOUND", "Deal not found");
      }

      if (deal.status === "closed") {
        throw new DomainError("INVALID_STATE", "Cannot cancel a closed deal");
      }

      if (deal.status === "cancelled") {
        throw new DomainError("INVALID_STATE", "Deal is already cancelled");
      }

      // Update deal
      const updatedDeal = await tx.deal.update({
        where: { id: dealId },
        data: { status: "cancelled" },
      });

      // Revert lead status to qualified (or last valid state)
      await tx.lead.update({
        where: { id: deal.leadId },
        data: { status: "qualified" },
      });

      // Log event
      await tx.leadEvent.create({
        data: {
          leadId: deal.leadId,
          eventType: "deal_cancelled",
          metadata: { dealId: deal.id, reason },
        },
      });

      return updatedDeal;
    });

    await kpiInvalidation.onDealCancelled(result.orgId);
    return result;
  }

  /**
   * Get deal metrics for an organization
   */
  static async getMetrics(orgId: string) {
    const deals = await prisma.deal.findMany({ where: { orgId } });
    
    const closed = deals.filter(d => d.status === "closed");
    const inProgress = deals.filter(d => d.status === "in_progress");
    const cancelled = deals.filter(d => d.status === "cancelled");

    return {
      total: deals.length,
      closed: closed.length,
      inProgress: inProgress.length,
      cancelled: cancelled.length,
      totalProfit: closed.reduce((sum, d) => sum + (Number(d.profit) || 0), 0),
      totalRevenue: closed.reduce((sum, d) => sum + (Number(d.assignmentFee) || 0), 0),
      avgProfit: closed.length > 0 
        ? closed.reduce((sum, d) => sum + (Number(d.profit) || 0), 0) / closed.length 
        : 0,
      closeRate: deals.length > 0 ? (closed.length / deals.length) * 100 : 0,
    };
  }
}

