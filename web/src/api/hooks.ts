/**
 * React Query Hooks for API Data Fetching
 * Strongly-typed hooks with automatic refetching
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./client";
import { get } from "../api";

// ============================================
// Type Definitions
// ============================================

export interface KpiData {
  totalLeads: number;
  activeLeads: number;
  qualifiedLeads: number;
  totalProfit: number;
  totalRevenue: number;
  dealCount: number;
  closedDealCount: number;
  qualificationRate: number;
  dealCloseRatio: number;
  contactRate?: number;
  avgPipelineTime?: number | null;
  monthlyRevenue?: number;
  weeklyRevenue?: number;
  dailyActivity?: { events: number; leadsCreated: number };
  avgOfferSpread?: number | null;
  leadToContractCycleTime?: number | null;
}

export interface KpiSnapshot {
  id: string;
  orgId: string;
  date: string;
  totalLeads: number;
  activeLeads: number;
  qualifiedLeads: number;
  dealsCreated: number;
  dealsClosed: number;
  revenue: number;
  profit: number;
  contactRate?: number;
  qualificationRate?: number;
}

export interface PipelineSummary {
  stages: Array<{ stage: string; count: number }>;
  velocity: number | null;
  health: {
    score: number;
    rating: string;
    metrics: {
      activeLeads: number;
      stuckLeads: number;
      weeklyActivity: number;
    };
  };
  bottleneck: {
    stage: string;
    count: number;
    recommendation: string;
  } | null;
}

export interface LeadScore {
  totalScore: number;
  engagementScore: number;
  urgencyScore: number;
  dealScore: number;
  statusScore: number;
  breakdown: Record<string, number>;
  recommendations: string[];
}

export interface SystemMetrics {
  system: {
    cpuLoad: number[];
    memoryUsagePercent: number;
    freeMemory: number;
  };
  process: {
    heapUsedMB: number;
    uptimeHours: number;
  };
  queue: {
    eventsPending: number;
    isProcessing: boolean;
  };
  timestamp: string;
}

export interface WorkerStatus {
  name: string;
  pattern: string;
  isRunning: boolean;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  errorCount: number;
  lastError?: string;
}

export interface DashboardDigest {
  summary: {
    totalLeads: number;
    activeLeads: number;
    dealsClosed: number;
    monthlyRevenue: number;
    projectedRevenue: number;
  };
  hotLeads: any[];
  needsFollowUp: any[];
  upcomingDeals: any[];
  recentActivity: any[];
  health: {
    score: number;
    rating: string;
  };
}

// ============================================
// KPI Hooks
// ============================================

export interface KpiSummary {
  totalLeads: number;
  activeLeads: number;
  conversionRate: number;
  assignments: number;
  contractsInEscrow: number;
  contactRate: number;
  monthlyNewLeads: number;
  monthlyProfit: number;
  qualifiedLeads: number;
  monthlyQualifiedLeads: number;
  assignmentsMTD: number;
  inEscrow: number;
  // Previous period baselines (for semantic color tone computation)
  prevActiveLeads: number | null;
  prevConversionRate: number | null;
  prevMonthlyNewLeads: number | null;
  prevMonthlyProfit: number | null;
}

/**
 * Canonical hook for KPI summary data
 * Used by KpiCard and LeadsOverviewCard to ensure consistent data source
 */
export function useKpisSummary() {
  return useQuery<KpiSummary>({
    queryKey: ["kpis-summary"],
    queryFn: async () => {
      const data = await get<any>("/api/kpis");
      // Normalize new fields with safe defaults
      return {
        ...data,
        assignmentsMTD: Number(data.assignmentsMTD) || 0,
        inEscrow: Number(data.inEscrow) || 0,
      } as KpiSummary;
    },
  });
}

export const useKpis = () =>
  useQuery({
    queryKey: ["kpis"],
    queryFn: () => api.get<KpiData>("/kpis/full"),
    refetchInterval: 30_000, // Refresh every 30s
    staleTime: 10_000,
  });

export const useKpiTimeline = (days: number = 30) =>
  useQuery({
    queryKey: ["kpiTimeline", days],
    queryFn: () =>
      api.get<{ data: KpiSnapshot[]; range: number }>("/kpis/snapshots", { range: days }),
    staleTime: 60_000,
  });

export const usePipelineSummary = () =>
  useQuery({
    queryKey: ["pipelineSummary"],
    queryFn: () => api.get<PipelineSummary>("/kpis/pipeline/summary"),
    refetchInterval: 30_000,
  });

// ============================================
// Lead Hooks
// ============================================

export const useLeads = (params?: { status?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: ["leads", params],
    queryFn: () => api.get<{ data: any[]; meta: any }>("/leads", params),
  });

export const useLead = (leadId: string) =>
  useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => api.get<any>(`/leads/${leadId}`),
    enabled: !!leadId,
  });

export const useLeadScore = (leadId: string) =>
  useQuery({
    queryKey: ["leadScore", leadId],
    queryFn: () => api.get<LeadScore>(`/leads/${leadId}/score`),
    enabled: !!leadId,
    refetchInterval: 15_000,
  });

export const useLeadInsights = (leadId: string) =>
  useQuery({
    queryKey: ["leadInsights", leadId],
    queryFn: () => api.get<any>(`/leads/${leadId}/insights`),
    enabled: !!leadId,
  });

export const useLeadEvents = (leadId: string, limit: number = 50) =>
  useQuery({
    queryKey: ["leadEvents", leadId, limit],
    queryFn: () => api.get<{ data: any[]; total: number }>(`/leads/${leadId}/events`, { limit }),
    enabled: !!leadId,
    refetchInterval: 5_000,
  });

// ============================================
// Deal Hooks
// ============================================

export const useDeals = (params?: { status?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: ["deals", params],
    queryFn: () => api.get<{ data: any[]; meta: any }>("/deals", params),
  });

export const useDealMetrics = () =>
  useQuery({
    queryKey: ["dealMetrics"],
    queryFn: () => api.get<any>("/deals/metrics"),
  });

// ============================================
// System Hooks
// ============================================

export const useSystemMetrics = () =>
  useQuery({
    queryKey: ["systemMetrics"],
    queryFn: () => api.get<SystemMetrics>("/system/metrics"),
    refetchInterval: 10_000,
  });

export const useSystemHealth = () =>
  useQuery({
    queryKey: ["systemHealth"],
    queryFn: () => api.get<any>("/system/health"),
    refetchInterval: 30_000,
  });

export const useWorkerStatus = () =>
  useQuery({
    queryKey: ["workerStatus"],
    queryFn: () =>
      api.get<{ workers: WorkerStatus[]; summary: any }>("/system/workers/status"),
    refetchInterval: 10_000,
  });

export const useSystemStats = () =>
  useQuery({
    queryKey: ["systemStats"],
    queryFn: () => api.get<any>("/system/stats"),
    refetchInterval: 60_000,
  });

// ============================================
// Dashboard Hooks
// ============================================

export const useDashboardDigest = () =>
  useQuery({
    queryKey: ["dashboardDigest"],
    queryFn: () => api.get<DashboardDigest>("/dashboard/digest"),
    refetchInterval: 60_000,
  });

export const useQuickStats = () =>
  useQuery({
    queryKey: ["quickStats"],
    queryFn: () => api.get<any>("/dashboard/quick-stats"),
    refetchInterval: 30_000,
  });

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<any>("/dashboard/notifications"),
    refetchInterval: 60_000,
  });

// ============================================
// Activity Hooks
// ============================================

export const useActivityFeed = (limit: number = 50) =>
  useQuery({
    queryKey: ["activityFeed", limit],
    queryFn: () => api.get<{ data: any[] }>("/activity", { limit }),
    refetchInterval: 10_000,
  });

// ============================================
// Mutations
// ============================================

export const useCreateLead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => api.post("/leads", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
};

export const useUpdateLeadStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: string }) =>
      api.patch(`/leads/${leadId}/status`, { status }),
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["pipelineSummary"] });
    },
  });
};

export const useCreateDeal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => api.post("/deals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
};

export const useCloseDeal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ dealId, data }: { dealId: string; data: any }) =>
      api.patch(`/deals/${dealId}/close`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
};

export const useTriggerWorker = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (workerName: string) =>
      api.post(`/system/workers/${workerName}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workerStatus"] });
    },
  });
};




