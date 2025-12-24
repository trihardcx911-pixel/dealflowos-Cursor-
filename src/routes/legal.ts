import express, { Request, Response } from "express";
import prisma from "../lib/prisma";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorNormalizer";
import { LegalDomain } from "../domain/legal";
import { DomainError } from "../domain/leads";
import {
  advanceStageSchema,
  contractMetadataSchema,
  assignmentMetadataSchema,
  titleMetadataSchema,
  getLegalStateSchema,
  getLegalEventsSchema,
  getBlockersSchema,
} from "../validation/legalSchemas";
import {
  getJurisdictionProfile,
  validateRequiredFields,
  getWarnings,
} from "../services/jurisdictionService";

const router = express.Router();

/**
 * Middleware to verify deal exists and belongs to org
 */
async function verifyDealAccess(
  dealId: string,
  orgId: string
): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { lead: true },
  });

  if (!deal) {
    throw new DomainError("NOT_FOUND", "Deal not found");
  }

  if (deal.orgId !== orgId) {
    throw new DomainError("FORBIDDEN", "Deal does not belong to this organization");
  }
}

// GET /api/deals/:dealId/legal - Get legal state
router.get(
  "/",
  validate(getLegalStateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = req.auth!;
    const { dealId } = req.validated!.params;

    await verifyDealAccess(dealId, orgId);

    const legalState = await LegalDomain.getLegalState(dealId);

    res.json(legalState);
  })
);

// PATCH /api/deals/:dealId/legal/stage - Advance legal stage
router.patch(
  "/stage",
  validate(advanceStageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId, userId } = req.auth!;
    const { dealId } = req.validated!.params;
    const { stage } = req.validated!.body;

    await verifyDealAccess(dealId, orgId);

    // Get deal for jurisdiction lookup
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        lead: true,
        contractMetadata: true,
        assignmentMetadata: true,
        titleMetadata: true,
      },
    });

    if (!deal) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND" });
    }

    // Get jurisdiction profile if lead has location
    let jurisdiction = null;
    if (deal.lead.state) {
      jurisdiction = await getJurisdictionProfile(
        deal.lead.state,
        undefined // county not available in lead model
      );
    }

    // Validate transition
    const baseValidation = LegalDomain.validateStageTransition(deal, stage, jurisdiction);
    
    // Validate required fields if jurisdiction exists
    const metadata = {
      contract: deal.contractMetadata,
      assignment: deal.assignmentMetadata,
      title: deal.titleMetadata,
    };
    
    const jurisdictionValidation = validateRequiredFields(stage, metadata, jurisdiction);
    const warnings = getWarnings(stage, metadata, jurisdiction);

    // Merge validation results
    const finalValidation = {
      valid: baseValidation.valid && jurisdictionValidation.valid,
      blockers: [...baseValidation.blockers, ...jurisdictionValidation.blockers],
      warnings: [...jurisdictionValidation.warnings, ...warnings],
    };

    if (!finalValidation.valid) {
      return res.status(400).json({
        error: "Cannot advance stage",
        code: "INVALID_TRANSITION",
        blockers: finalValidation.blockers,
        warnings: finalValidation.warnings,
      });
    }

    // Advance stage
    const updatedDeal = await LegalDomain.advanceStage(dealId, stage, userId);

    res.json({
      dealId: updatedDeal.id,
      legalStage: updatedDeal.legalStage,
      warnings: finalValidation.warnings,
    });
  })
);

// PUT /api/deals/:dealId/legal/contract - Update contract metadata
router.put(
  "/contract",
  validate(contractMetadataSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId, userId } = req.auth!;
    const { dealId } = req.validated!.params;
    const body = req.validated!.body;

    await verifyDealAccess(dealId, orgId);

    const metadata = await LegalDomain.upsertContractMetadata(
      dealId,
      {
        sellerName: body.sellerName,
        buyerName: body.buyerName,
        contractPrice: body.contractPrice ?? undefined,
        contractDate: body.contractDate ? new Date(body.contractDate) : undefined,
        externalUrl: body.externalUrl ?? undefined,
      },
      userId
    );

    res.json(metadata);
  })
);

// PUT /api/deals/:dealId/legal/assignment - Update assignment metadata
router.put(
  "/assignment",
  validate(assignmentMetadataSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId, userId } = req.auth!;
    const { dealId } = req.validated!.params;
    const body = req.validated!.body;

    await verifyDealAccess(dealId, orgId);

    const metadata = await LegalDomain.upsertAssignmentMetadata(
      dealId,
      {
        endBuyerName: body.endBuyerName,
        assignmentFee: body.assignmentFee ?? undefined,
        assignmentDate: body.assignmentDate ? new Date(body.assignmentDate) : undefined,
        externalUrl: body.externalUrl ?? undefined,
      },
      userId
    );

    res.json(metadata);
  })
);

// PUT /api/deals/:dealId/legal/title - Update title metadata
router.put(
  "/title",
  validate(titleMetadataSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId, userId } = req.auth!;
    const { dealId } = req.validated!.params;
    const body = req.validated!.body;

    await verifyDealAccess(dealId, orgId);

    const metadata = await LegalDomain.upsertTitleMetadata(
      dealId,
      {
        titleCompany: body.titleCompany,
        escrowOfficer: body.escrowOfficer,
        escrowNumber: body.escrowNumber,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
        externalUrl: body.externalUrl ?? undefined,
      },
      userId
    );

    res.json(metadata);
  })
);

// GET /api/deals/:dealId/legal/events - Get legal events
router.get(
  "/events",
  validate(getLegalEventsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = req.auth!;
    const { dealId } = req.validated!.params;
    const limit = req.validated!.query?.limit || 50;

    await verifyDealAccess(dealId, orgId);

    const events = await prisma.dealEvent.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json({ events });
  })
);

// GET /api/deals/:dealId/legal/blockers - Get blockers for current stage
router.get(
  "/blockers",
  validate(getBlockersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = req.auth!;
    const { dealId } = req.validated!.params;

    await verifyDealAccess(dealId, orgId);

    // Get deal with metadata
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        lead: true,
        contractMetadata: true,
        assignmentMetadata: true,
        titleMetadata: true,
      },
    });

    if (!deal) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND" });
    }

    // Get jurisdiction profile
    let jurisdiction = null;
    if (deal.lead.state) {
      jurisdiction = await getJurisdictionProfile(deal.lead.state, undefined);
    }

    // Get validation results
    const metadata = {
      contract: deal.contractMetadata,
      assignment: deal.assignmentMetadata,
      title: deal.titleMetadata,
    };

    const validation = validateRequiredFields(deal.legalStage, metadata, jurisdiction);
    const warnings = getWarnings(deal.legalStage, metadata, jurisdiction);

    res.json({
      blockers: validation.blockers,
      warnings: [...validation.warnings, ...warnings],
      currentStage: deal.legalStage,
    });
  })
);

// GET /api/deals/:dealId/legal/issues - Get open issues (read-only)
router.get(
  "/issues",
  validate(getLegalStateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = req.auth!;
    const { dealId } = req.validated!.params;

    await verifyDealAccess(dealId, orgId);

    const conditions = await prisma.legalCondition.findMany({
      where: { dealId },
      orderBy: [
        { status: "asc" }, // OPEN first, then RESOLVED
        { discoveredAt: "desc" },
      ],
    });

    const openIssues = conditions.filter((c) => c.status === "OPEN");
    const resolvedIssues = conditions.filter((c) => c.status === "RESOLVED");

    res.json({
      openIssues,
      resolvedIssues,
    });
  })
);

export default router;

