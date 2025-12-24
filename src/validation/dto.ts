/**
 * DTO TypeScript Bindings
 * Type-safe interfaces inferred from Zod schemas
 */

import { z } from "zod";
import {
  createLeadFullSchema,
  updateLeadFullSchema,
  updateStatusFullSchema,
  qualifyLeadFullSchema,
  createDealFullSchema,
  closeDealFullSchema,
  createEventFullSchema,
  userSettingsFullSchema,
  LeadStatusEnum,
  EventTypeEnum,
  DealStatusEnum,
  UserRoleEnum,
} from "./schemas";
import {
  paginationSchema,
  leadQuerySchema,
  dealQuerySchema,
  leadEventQuerySchema,
  analyticsQuerySchema,
} from "./pagination";

// ============================================
// Lead DTOs
// ============================================

export type CreateLeadDto = z.infer<typeof createLeadFullSchema>["body"];
export type UpdateLeadDto = z.infer<typeof updateLeadFullSchema>["body"];
export type UpdateStatusDto = z.infer<typeof updateStatusFullSchema>["body"];
export type QualifyLeadDto = z.infer<typeof qualifyLeadFullSchema>["body"];
export type LeadQueryDto = z.infer<typeof leadQuerySchema>["query"];

// ============================================
// Deal DTOs
// ============================================

export type CreateDealDto = z.infer<typeof createDealFullSchema>["body"];
export type CloseDealDto = z.infer<typeof closeDealFullSchema>["body"];
export type DealQueryDto = z.infer<typeof dealQuerySchema>["query"];

// ============================================
// Event DTOs
// ============================================

export type CreateEventDto = z.infer<typeof createEventFullSchema>["body"];
export type EventQueryDto = z.infer<typeof leadEventQuerySchema>["query"];

// ============================================
// User Settings DTOs
// ============================================

export type UpdateUserSettingsDto = z.infer<typeof userSettingsFullSchema>["body"];

// ============================================
// Query DTOs
// ============================================

export type PaginationDto = z.infer<typeof paginationSchema>["query"];
export type AnalyticsQueryDto = z.infer<typeof analyticsQuerySchema>["query"];

// ============================================
// Enum Types
// ============================================

export type LeadStatus = z.infer<typeof LeadStatusEnum>;
export type EventType = z.infer<typeof EventTypeEnum>;
export type DealStatus = z.infer<typeof DealStatusEnum>;
export type UserRole = z.infer<typeof UserRoleEnum>;

// ============================================
// Response DTOs
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  code: string;
  details?: any;
  request_id?: string;
}

// ============================================
// Entity DTOs (Response shapes)
// ============================================

export interface LeadDto {
  id: string;
  orgId: string;
  userId?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: LeadStatus;
  isQualified: boolean;
  arv?: number;
  moa?: number;
  dealScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealDto {
  id: string;
  leadId: string;
  orgId: string;
  userId: string;
  dealType: string;
  status: DealStatus;
  assignmentFee?: number;
  profit?: number;
  buyerName?: string;
  closeDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadEventDto {
  id: string;
  leadId: string;
  eventType: EventType;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface UserSettingsDto {
  userId: string;
  defaultMultiplier: number;
  defaultAssignmentFee: number;
  defaultFollowupInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// KPI DTOs
// ============================================

export interface KpiDto {
  totalLeads: number;
  activeLeads: number;
  qualifiedLeads: number;
  totalProfit: number;
  totalRevenue: number;
  dealCount: number;
  closedDealCount: number;
  qualificationRate: number;
  dealCloseRatio: number;
}

export interface FullKpiDto extends KpiDto {
  contactRate: number;
  avgPipelineTime: number | null;
  monthlyRevenue: number;
  weeklyRevenue: number;
  dailyActivity: {
    events: number;
    leadsCreated: number;
  };
  avgOfferSpread: number | null;
  leadToContractCycleTime: number | null;
}

export interface KpiSnapshotDto {
  id: string;
  orgId: string;
  date: Date;
  totalLeads: number;
  activeLeads: number;
  qualifiedLeads: number;
  dealsCreated: number;
  dealsClosed: number;
  revenue: number;
  profit: number;
  contactRate?: number;
  qualificationRate?: number;
  avgPipelineDays?: number;
}










