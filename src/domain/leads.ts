/**
 * Lead Domain Service
 * Contains business logic for lead operations
 * Reusable across API, CLI, workers, etc.
 */

import prisma from "../lib/prisma";
import { calculateMOA, calculateDealScore } from "../lib/formulas";
import { normalizeLeadInput } from "../lib/normalizeLeadInput";
import { kpiInvalidation } from "../services/kpiInvalidation";
import { runAutomation } from "../automation/engine";
import { createHash, randomUUID } from "node:crypto";

export interface LeadInput {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  source?: string;
  arv?: number | null;
  estimatedRepairs?: number | null;
  investorMultiplier?: number;
  desiredAssignmentFee?: number;
  offerPrice?: number | null;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  lotSize?: number;
}

export class LeadDomain {
  /**
   * Create a new lead with full normalization and underwriting
   */
  static async create(orgId: string, userId: string, input: LeadInput) {
    // Normalize input data
    const normalized = normalizeLeadInput(input);
    
    // Generate address hash for deduplication
    const canonical = `${normalized.address}, ${normalized.city}, ${normalized.state} ${normalized.zip}`.toUpperCase().trim();
    const addressHash = createHash("sha256").update(`${canonical}|${orgId}`).digest("hex");

    // Check for duplicates
    const existing = await prisma.lead.findFirst({
      where: { orgId, addressHash },
    });

    if (existing) {
      throw new DomainError("DUPLICATE_LEAD", "A lead with this address already exists", { existingId: existing.id });
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        orgId,
        userId,
        address: normalized.address,
        addressHash,
        city: normalized.city,
        state: normalized.state,
        zip: normalized.zip,
        source: normalized.source,
        arv: normalized.arv,
        estimatedRepairs: normalized.estimatedRepairs,
        investorMultiplier: normalized.investorMultiplier ?? 0.70,
        desiredAssignmentFee: normalized.desiredAssignmentFee ?? 10000,
        offerPrice: normalized.offerPrice,
        sellerName: normalized.sellerName,
        sellerPhone: normalized.sellerPhone,
        sellerEmail: normalized.sellerEmail,
        propertyType: normalized.propertyType,
        bedrooms: normalized.bedrooms,
        bathrooms: normalized.bathrooms,
        squareFeet: normalized.squareFeet,
        yearBuilt: normalized.yearBuilt,
        lotSize: normalized.lotSize,
      },
    });

    // Recalculate underwriting
    const updatedLead = await this.recalculateUnderwriting(lead.id);

    // Invalidate caches
    await kpiInvalidation.onLeadCreated(orgId);

    // Run automation
    await runAutomation("lead_created", { lead: updatedLead, orgId, userId });

    return updatedLead;
  }

  /**
   * Update lead with recalculation
   */
  static async update(leadId: string, input: Partial<LeadInput>) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new DomainError("NOT_FOUND", "Lead not found");
    }

    // Normalize any provided fields
    const normalized = normalizeLeadInput(input as LeadInput);

    // Update lead
    await prisma.lead.update({
      where: { id: leadId },
      data: normalized,
    });

    // Recalculate underwriting if financial fields changed
    const financialFields = ["arv", "estimatedRepairs", "investorMultiplier", "desiredAssignmentFee", "offerPrice"];
    const hasFinancialChange = financialFields.some(f => f in input);
    
    if (hasFinancialChange) {
      await this.recalculateUnderwriting(leadId);
    }

    // Invalidate caches
    await kpiInvalidation.onLeadUpdated(lead.orgId);

    // Run automation
    const updatedLead = await prisma.lead.findUnique({ where: { id: leadId } });
    await runAutomation("lead_updated", { lead: updatedLead, orgId: lead.orgId });

    return updatedLead;
  }

  /**
   * Qualify or disqualify a lead
   */
  static async qualify(leadId: string, isQualified: boolean) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new DomainError("NOT_FOUND", "Lead not found");
    }

    // Business rule: Can only qualify leads that are not dead
    if (lead.status === "dead") {
      throw new DomainError("INVALID_STATE", "Cannot qualify a dead lead");
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: { isQualified },
    });

    await kpiInvalidation.onQualificationChanged(lead.orgId);
    await runAutomation("qualification_changed", { lead: updated, orgId: lead.orgId });
    
    return updated;
  }

  /**
   * Update lead status with validation
   */
  static async updateStatus(leadId: string, newStatus: string) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new DomainError("NOT_FOUND", "Lead not found");
    }

    // Validate status transition
    const validTransitions = this.getValidStatusTransitions(lead.status);
    if (!validTransitions.includes(newStatus) && newStatus !== "dead") {
      throw new DomainError(
        "INVALID_TRANSITION",
        `Cannot transition from ${lead.status} to ${newStatus}`,
        { validTransitions }
      );
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: { status: newStatus },
    });

    await kpiInvalidation.onStatusChanged(lead.orgId);
    await runAutomation("status_change", { 
      lead: updated, 
      oldStatus: lead.status, 
      newStatus, 
      orgId: lead.orgId 
    });
    
    return updated;
  }

  /**
   * Check if lead is ready for contract
   */
  static isContractReady(lead: { isQualified: boolean; moa: any; offerPrice: any; status: string }): boolean {
    if (!lead.isQualified) return false;
    if (!lead.moa || !lead.offerPrice) return false;
    if (lead.status === "dead" || lead.status === "closed") return false;
    
    // Offer must be at or below MOA
    return Number(lead.offerPrice) <= Number(lead.moa);
  }

  /**
   * Get deal readiness analysis
   */
  static getDealReadiness(lead: { 
    isQualified: boolean; 
    moa: any; 
    offerPrice: any; 
    arv: any;
    estimatedRepairs: any;
    dealScore: any;
    status: string;
  }) {
    const issues: string[] = [];
    
    if (!lead.isQualified) issues.push("Lead not qualified");
    if (!lead.arv) issues.push("Missing ARV");
    if (!lead.estimatedRepairs) issues.push("Missing repair estimate");
    if (!lead.moa) issues.push("MOA not calculated");
    if (!lead.offerPrice) issues.push("No offer price set");
    if (lead.offerPrice && lead.moa && Number(lead.offerPrice) > Number(lead.moa)) {
      issues.push("Offer price exceeds MOA");
    }
    if (lead.status === "dead") issues.push("Lead is dead");

    return {
      ready: issues.length === 0,
      issues,
      dealScore: lead.dealScore ? Number(lead.dealScore) : null,
      spread: lead.moa && lead.offerPrice ? Number(lead.moa) - Number(lead.offerPrice) : null,
    };
  }

  /**
   * Recalculate MOA and deal score
   */
  static async recalculateUnderwriting(leadId: string) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return null;

    const moa = calculateMOA(
      lead.arv ? Number(lead.arv) : null,
      Number(lead.investorMultiplier),
      lead.estimatedRepairs ? Number(lead.estimatedRepairs) : null,
      Number(lead.desiredAssignmentFee)
    );

    const dealScore = calculateDealScore({
      arv: lead.arv ? Number(lead.arv) : null,
      estimatedRepairs: lead.estimatedRepairs ? Number(lead.estimatedRepairs) : null,
      moa,
      offerPrice: lead.offerPrice ? Number(lead.offerPrice) : null,
    });

    return prisma.lead.update({
      where: { id: leadId },
      data: { moa, dealScore },
    });
  }

  /**
   * Get valid status transitions
   */
  static getValidStatusTransitions(currentStatus: string): string[] {
    const transitions: Record<string, string[]> = {
      new: ["contacted", "qualified", "dead"],
      contacted: ["qualified", "dead"],
      qualified: ["offer_made", "dead"],
      offer_made: ["under_contract", "qualified", "dead"],
      under_contract: ["closed", "qualified", "dead"],
      closed: [], // Terminal state
      dead: ["new"], // Can resurrect
    };
    return transitions[currentStatus] || [];
  }
}

/**
 * Domain-specific error
 */
export class DomainError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "DomainError";
  }
}

