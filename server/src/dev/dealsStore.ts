// Shared in-memory deals store for dev mode
// Structure: { [orgId: string]: Deal[] }
// One deal per lead (enforced by leadId uniqueness within org)

import crypto from "crypto";

export type DealStage =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "UNDER_CONTRACT"
  | "IN_ESCROW"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export const DEAL_STAGES: DealStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "UNDER_CONTRACT",
  "IN_ESCROW",
  "CLOSED_WON",
  "CLOSED_LOST",
];

export function isDealStage(x: unknown): x is DealStage {
  return typeof x === "string" && DEAL_STAGES.includes(x as DealStage);
}

export type Deal = {
  id: string;
  orgId: string;
  leadId: string;
  stage: DealStage;
  stageUpdatedAt: string;
  qualifiedAt?: string | null;
  contractAt?: string | null;
  escrowAt?: string | null;
  closedAt?: string | null;
  assignmentFeeExpected?: number | null;
  assignmentFeeActual?: number | null;
  createdAt: string;
  updatedAt: string;
};

export const dealsByOrg: Record<string, Deal[]> = {};

export function getOrgDeals(orgId: string): Deal[] {
  if (!dealsByOrg[orgId]) {
    dealsByOrg[orgId] = [];
  }
  return dealsByOrg[orgId];
}

export function findDealByLeadId(orgId: string, leadId: string): Deal | null {
  const deals = getOrgDeals(orgId);
  return deals.find((d) => d.leadId === leadId) || null;
}

export function upsertDealForLead(orgId: string, leadId: string): Deal {
  const deals = getOrgDeals(orgId);
  const existing = deals.find((d) => d.leadId === leadId);
  
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const newDeal: Deal = {
    id: crypto.randomUUID(),
    orgId,
    leadId,
    stage: "NEW",
    stageUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  deals.push(newDeal);
  return newDeal;
}







