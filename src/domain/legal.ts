/**
 * Legal Domain Service
 * Contains business logic for legal workflow operations with transaction safety
 */

import prisma from "../lib/prisma";
import { DomainError } from "./leads";
import { LegalStage } from "@prisma/client";

export interface ContractMetadataInput {
  sellerName?: string;
  buyerName?: string;
  contractPrice?: number;
  contractDate?: Date;
  externalUrl?: string;
}

export interface AssignmentMetadataInput {
  endBuyerName?: string;
  assignmentFee?: number;
  assignmentDate?: Date;
  externalUrl?: string;
}

export interface TitleMetadataInput {
  titleCompany?: string;
  escrowOfficer?: string;
  escrowNumber?: string;
  expectedCloseDate?: Date;
  externalUrl?: string;
}

export interface JurisdictionProfile {
  requiredFields?: Record<string, string[]>;
  timingRules?: Record<string, any>;
  featureFlags?: Record<string, boolean>;
}

export class LegalDomain {
  /**
   * Get complete legal state for a deal
   */
  static async getLegalState(dealId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        contractMetadata: true,
        assignmentMetadata: true,
        titleMetadata: true,
        legalEvents: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!deal) {
      throw new DomainError("NOT_FOUND", "Deal not found");
    }

    return {
      dealId: deal.id,
      legalStage: deal.legalStage,
      contractMetadata: deal.contractMetadata,
      assignmentMetadata: deal.assignmentMetadata,
      titleMetadata: deal.titleMetadata,
      recentEvents: deal.legalEvents,
    };
  }

  /**
   * Validate stage transition against business rules
   */
  static validateStageTransition(
    deal: { legalStage: LegalStage; status: string },
    targetStage: LegalStage,
    jurisdiction?: JurisdictionProfile
  ): { valid: boolean; blockers: string[] } {
    const blockers: string[] = [];

    // Terminal states cannot be transitioned from
    if (deal.legalStage === "CLOSED" || deal.legalStage === "DEAD") {
      blockers.push(`Cannot transition from terminal state: ${deal.legalStage}`);
      return { valid: false, blockers };
    }

    // Cannot transition to same stage
    if (deal.legalStage === targetStage) {
      blockers.push(`Deal is already in stage: ${targetStage}`);
      return { valid: false, blockers };
    }

    // Validate deal status allows legal progression
    if (deal.status === "cancelled") {
      blockers.push("Cannot advance legal stage on cancelled deal");
      return { valid: false, blockers };
    }

    // Validate stage progression order (allow rollbacks but log them)
    const stageOrder: LegalStage[] = [
      "PRE_CONTRACT",
      "UNDER_CONTRACT",
      "ASSIGNMENT_IN_PROGRESS",
      "ASSIGNED",
      "TITLE_CLEARING",
      "CLEARED_TO_CLOSE",
      "CLOSED",
      "DEAD",
    ];

    const currentIndex = stageOrder.indexOf(deal.legalStage);
    const targetIndex = stageOrder.indexOf(targetStage);

    // Allow forward progression and rollbacks (rollbacks will be logged in event)
    if (currentIndex === -1 || targetIndex === -1) {
      blockers.push("Invalid legal stage");
      return { valid: false, blockers };
    }

    // Jurisdiction-specific validation (if provided)
    if (jurisdiction?.requiredFields) {
      const requiredForStage = jurisdiction.requiredFields[targetStage];
      if (requiredForStage && requiredForStage.length > 0) {
        // This is a placeholder - actual validation would check metadata
        // For now, we just note that jurisdiction rules exist
        // Full validation should be done by caller with actual metadata
      }
    }

    return { valid: blockers.length === 0, blockers };
  }

  /**
   * Advance legal stage with validation and event emission
   */
  static async advanceStage(
    dealId: string,
    targetStage: LegalStage,
    userId: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // Get deal within transaction
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: {
          contractMetadata: true,
          assignmentMetadata: true,
          titleMetadata: true,
        },
      });

      if (!deal) {
        throw new DomainError("NOT_FOUND", "Deal not found");
      }

      // Validate transition
      const validation = this.validateStageTransition(deal, targetStage);
      if (!validation.valid) {
        throw new DomainError(
          "INVALID_TRANSITION",
          `Cannot transition to ${targetStage}`,
          { blockers: validation.blockers }
        );
      }

      const previousStage = deal.legalStage;

      // Update deal legal stage (single source of truth)
      const updatedDeal = await tx.deal.update({
        where: { id: dealId },
        data: { legalStage: targetStage },
      });

      // Emit event for stage transition
      await tx.dealEvent.create({
        data: {
          dealId,
          eventType: "stage_transition",
          metadata: {
            previousStage,
            newStage: targetStage,
            userId,
            timestamp: new Date().toISOString(),
            isRollback: this.isRollback(previousStage, targetStage),
          },
        },
      });

      return updatedDeal;
    });

    return result;
  }

  /**
   * Upsert contract metadata (create or update)
   */
  static async upsertContractMetadata(
    dealId: string,
    data: ContractMetadataInput,
    userId: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // Verify deal exists
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) {
        throw new DomainError("NOT_FOUND", "Deal not found");
      }

      // Upsert contract metadata
      const metadata = await tx.contractMetadata.upsert({
        where: { dealId },
        create: {
          dealId,
          sellerName: data.sellerName,
          buyerName: data.buyerName,
          contractPrice: data.contractPrice,
          contractDate: data.contractDate,
          externalUrl: data.externalUrl,
        },
        update: {
          sellerName: data.sellerName,
          buyerName: data.buyerName,
          contractPrice: data.contractPrice,
          contractDate: data.contractDate,
          externalUrl: data.externalUrl,
        },
      });

      // Emit event for metadata update
      await tx.dealEvent.create({
        data: {
          dealId,
          eventType: "contract_metadata_updated",
          metadata: {
            userId,
            timestamp: new Date().toISOString(),
            changes: data,
          },
        },
      });

      return metadata;
    });

    return result;
  }

  /**
   * Upsert assignment metadata (create or update)
   */
  static async upsertAssignmentMetadata(
    dealId: string,
    data: AssignmentMetadataInput,
    userId: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // Verify deal exists
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) {
        throw new DomainError("NOT_FOUND", "Deal not found");
      }

      // Upsert assignment metadata
      const metadata = await tx.assignmentMetadata.upsert({
        where: { dealId },
        create: {
          dealId,
          endBuyerName: data.endBuyerName,
          assignmentFee: data.assignmentFee,
          assignmentDate: data.assignmentDate,
          externalUrl: data.externalUrl,
        },
        update: {
          endBuyerName: data.endBuyerName,
          assignmentFee: data.assignmentFee,
          assignmentDate: data.assignmentDate,
          externalUrl: data.externalUrl,
        },
      });

      // Emit event for metadata update
      await tx.dealEvent.create({
        data: {
          dealId,
          eventType: "assignment_metadata_updated",
          metadata: {
            userId,
            timestamp: new Date().toISOString(),
            changes: data,
          },
        },
      });

      return metadata;
    });

    return result;
  }

  /**
   * Upsert title metadata (create or update)
   */
  static async upsertTitleMetadata(
    dealId: string,
    data: TitleMetadataInput,
    userId: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // Verify deal exists
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) {
        throw new DomainError("NOT_FOUND", "Deal not found");
      }

      // Upsert title metadata
      const metadata = await tx.titleMetadata.upsert({
        where: { dealId },
        create: {
          dealId,
          titleCompany: data.titleCompany,
          escrowOfficer: data.escrowOfficer,
          escrowNumber: data.escrowNumber,
          expectedCloseDate: data.expectedCloseDate,
          externalUrl: data.externalUrl,
        },
        update: {
          titleCompany: data.titleCompany,
          escrowOfficer: data.escrowOfficer,
          escrowNumber: data.escrowNumber,
          expectedCloseDate: data.expectedCloseDate,
          externalUrl: data.externalUrl,
        },
      });

      // Emit event for metadata update
      await tx.dealEvent.create({
        data: {
          dealId,
          eventType: "title_metadata_updated",
          metadata: {
            userId,
            timestamp: new Date().toISOString(),
            changes: data,
          },
        },
      });

      return metadata;
    });

    return result;
  }

  /**
   * Emit a deal event (low-level event emission)
   */
  static async emitDealEvent(
    dealId: string,
    eventType: string,
    metadata?: any
  ) {
    // Verify deal exists
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      throw new DomainError("NOT_FOUND", "Deal not found");
    }

    return prisma.dealEvent.create({
      data: {
        dealId,
        eventType,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Helper: Check if transition is a rollback
   */
  private static isRollback(
    previousStage: LegalStage,
    targetStage: LegalStage
  ): boolean {
    const stageOrder: LegalStage[] = [
      "PRE_CONTRACT",
      "UNDER_CONTRACT",
      "ASSIGNMENT_IN_PROGRESS",
      "ASSIGNED",
      "TITLE_CLEARING",
      "CLEARED_TO_CLOSE",
      "CLOSED",
      "DEAD",
    ];

    const previousIndex = stageOrder.indexOf(previousStage);
    const targetIndex = stageOrder.indexOf(targetStage);

    return previousIndex > targetIndex;
  }
}



