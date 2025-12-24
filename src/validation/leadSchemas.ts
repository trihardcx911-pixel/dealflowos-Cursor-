import { z } from "zod";

export const createLeadSchema = z.object({
  address: z.string().min(3),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),

  source: z.enum(["cold_call", "sms", "ppc", "driving_for_dollars", "referral", "other"]).default("other"),

  arv: z.number().nullable().optional(),
  estimatedRepairs: z.number().nullable().optional(),
  investorMultiplier: z.number().min(0).max(1).default(0.7),
  desiredAssignmentFee: z.number().default(10000),
  offerPrice: z.number().nullable().optional(),

  sellerName: z.string().optional(),
  sellerPhone: z.string().optional(),
  sellerEmail: z.string().optional(),

  propertyType: z.string().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().optional(),
  squareFeet: z.number().int().optional(),
  yearBuilt: z.number().int().optional(),
  lotSize: z.number().int().optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const updateStatusSchema = z.object({
  status: z.string().min(1),
});

export const qualifyLeadSchema = z.object({
  isQualified: z.boolean(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;





