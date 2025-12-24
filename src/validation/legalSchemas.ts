import { z } from "zod";

/**
 * Legal Stage enum
 */
export const LegalStageEnum = z.enum([
  "PRE_CONTRACT",
  "UNDER_CONTRACT",
  "ASSIGNMENT_IN_PROGRESS",
  "ASSIGNED",
  "TITLE_CLEARING",
  "CLEARED_TO_CLOSE",
  "CLOSED",
  "DEAD",
]);

/**
 * Stage transition schema
 */
export const advanceStageSchema = z.object({
  params: z.object({
    dealId: z.string().min(1),
  }),
  body: z.object({
    stage: LegalStageEnum,
  }),
});

/**
 * Contract metadata schema
 */
export const contractMetadataSchema = z.object({
  params: z.object({
    dealId: z.string().min(1),
  }),
  body: z.object({
    sellerName: z.string().optional(),
    buyerName: z.string().optional(),
    contractPrice: z.number().positive().nullable().optional(),
    contractDate: z.string().datetime().nullable().optional(),
    externalUrl: z.string().url().nullable().optional(),
  }),
});

/**
 * Assignment metadata schema
 */
export const assignmentMetadataSchema = z.object({
  params: z.object({
    dealId: z.string().min(1),
  }),
  body: z.object({
    endBuyerName: z.string().optional(),
    assignmentFee: z.number().positive().nullable().optional(),
    assignmentDate: z.string().datetime().nullable().optional(),
    externalUrl: z.string().url().nullable().optional(),
  }),
});

/**
 * Title metadata schema
 */
export const titleMetadataSchema = z.object({
  params: z.object({
    dealId: z.string().min(1),
  }),
  body: z.object({
    titleCompany: z.string().optional(),
    escrowOfficer: z.string().optional(),
    escrowNumber: z.string().optional(),
    expectedCloseDate: z.string().datetime().nullable().optional(),
    externalUrl: z.string().url().nullable().optional(),
  }),
});

/**
 * Get legal state schema
 */
export const getLegalStateSchema = z.object({
  params: z.object({
    dealId: z.string().min(1),
  }),
});

/**
 * Get legal events schema
 */
export const getLegalEventsSchema = z.object({
  params: z.object({
    dealId: z.string().min(1),
  }),
  query: z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

/**
 * Get blockers schema
 */
export const getBlockersSchema = z.object({
  params: z.object({
    dealId: z.string().min(1),
  }),
});



