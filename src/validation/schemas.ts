import { z } from "zod";

/**
 * Lead status enum
 */
export const LeadStatusEnum = z.enum([
  "new",
  "contacted",
  "qualified",
  "offer_made",
  "under_contract",
  "closed",
  "dead",
]);

/**
 * Event type enum
 */
export const EventTypeEnum = z.enum([
  "created",
  "updated",
  "deleted",
  "contacted",
  "call",
  "sms",
  "email",
  "note",
  "status_changed",
  "qualified",
  "disqualified",
  "deal_created",
  "deal_closed",
  "deal_cancelled",
]);

/**
 * Deal status enum
 */
export const DealStatusEnum = z.enum([
  "in_progress",
  "closed",
  "cancelled",
]);

/**
 * User role enum
 */
export const UserRoleEnum = z.enum([
  "owner",
  "admin",
  "user",
  "readonly",
]);

/**
 * Create lead full schema with all validation
 */
export const createLeadFullSchema = z.object({
  body: z.object({
    address: z.string().min(3, "Address must be at least 3 characters"),
    city: z.string().optional(),
    state: z.string().max(2).optional(),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format").optional(),

    source: z.enum(["cold_call", "sms", "ppc", "driving_for_dollars", "referral", "other"]).default("other"),

    arv: z.number().positive().nullable().optional(),
    estimatedRepairs: z.number().min(0).nullable().optional(),
    investorMultiplier: z.number().min(0).max(1).default(0.7),
    desiredAssignmentFee: z.number().min(0).default(10000),
    offerPrice: z.number().positive().nullable().optional(),

    sellerName: z.string().optional(),
    sellerPhone: z.string().regex(/^[\d\s\-\(\)\.+]+$/, "Invalid phone format").optional(),
    sellerEmail: z.string().email("Invalid email format").optional(),

    propertyType: z.string().optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().min(0).optional(),
    squareFeet: z.number().int().positive().optional(),
    yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
    lotSize: z.number().int().positive().optional(),
  }),
});

/**
 * Update lead schema
 */
export const updateLeadFullSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: createLeadFullSchema.shape.body.partial(),
});

/**
 * Update status schema
 */
export const updateStatusFullSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: LeadStatusEnum,
  }),
});

/**
 * Qualify lead schema
 */
export const qualifyLeadFullSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    isQualified: z.boolean(),
  }),
});

/**
 * Create deal schema
 */
export const createDealFullSchema = z.object({
  body: z.object({
    leadId: z.string().min(1),
    buyerName: z.string().optional(),
    assignmentFee: z.number().min(0).optional(),
    dealType: z.enum(["assignment", "wholesale", "novation"]).default("assignment"),
  }),
});

/**
 * Close deal schema
 */
export const closeDealFullSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    profit: z.number().optional(),
    closeDate: z.string().datetime().optional(),
  }),
});

/**
 * Create event schema
 */
export const createEventFullSchema = z.object({
  params: z.object({
    leadId: z.string().min(1),
  }),
  body: z.object({
    eventType: EventTypeEnum,
    metadata: z.record(z.any()).optional(),
  }),
});

/**
 * User settings schema
 */
export const userSettingsFullSchema = z.object({
  body: z.object({
    defaultMultiplier: z.number().min(0).max(1).optional(),
    defaultAssignmentFee: z.number().min(0).optional(),
    defaultFollowupInterval: z.number().int().min(1).optional(),
  }),
});





