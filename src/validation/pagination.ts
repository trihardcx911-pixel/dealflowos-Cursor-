import { z } from "zod";

/**
 * Shared pagination schema for all list endpoints
 */
export const paginationSchema = z.object({
  query: z.object({
    page: z.string().optional().default("1"),
    limit: z.string().optional().default("50"),
    sortBy: z.string().optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

/**
 * Lead-specific query schema with pagination
 */
export const leadQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().default("1"),
    limit: z.string().optional().default("50"),
    status: z.string().optional(),
    isQualified: z.enum(["true", "false"]).optional(),
    type: z.enum(["sfr", "land", "multi", "other"]).optional(),
    search: z.string().optional(),
  }),
});

/**
 * Deal query schema with pagination
 */
export const dealQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().default("1"),
    limit: z.string().optional().default("50"),
    status: z.enum(["in_progress", "closed", "cancelled"]).optional(),
  }),
});

/**
 * Lead event query schema
 */
export const leadEventQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().default("1"),
    limit: z.string().optional().default("50"),
    eventType: z.string().optional(),
  }),
  params: z.object({
    leadId: z.string().min(1),
  }),
});

/**
 * KPI analytics query schema
 */
export const analyticsQuerySchema = z.object({
  query: z.object({
    days: z.string().optional().default("30"),
  }),
});

/**
 * Helper to parse pagination from validated query
 */
export function parsePagination(query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "50", 10)));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Standard pagination response meta
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function createPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}










