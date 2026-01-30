import express from "express";
import { getOrgLeads } from "../dev/leadsStore.js";

export const kpisDevRouter = express.Router();

// ------------------------------------
// Build Leads-Over-Time dataset
// ------------------------------------
function buildLeadTimeseries(orgId: string) {
  const leads = getOrgLeads(orgId);
  const grouped: Record<string, number> = {};

  for (const lead of leads) {
    const date = (lead as any).createdAt?.slice(0, 10); // YYYY-MM-DD
    if (!date) continue;
    grouped[date] = (grouped[date] || 0) + 1;
  }

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Simple KPI calculator for DEV MODE
 */
export function calculateKpis(orgId: string) {
  const leads = getOrgLeads(orgId);
  const totalLeads = leads.length;

  // Example metrics (you can expand later)
  return {
    totalLeads,
    newThisWeek: totalLeads, // placeholder — dev mode only
    latest5: leads.slice(-5).reverse(),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * GET /api/kpis — returns KPI summary
 */
kpisDevRouter.get("/", (req, res) => {
  const orgId = (req as any).orgId || req.user?.orgId || req.user?.id || "org_dev";
  const leads = getOrgLeads(orgId);
  const total = leads.length;
  const latest = [...leads]
    .sort((a: any, b: any) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, 5);
  const timeseries = buildLeadTimeseries(orgId);

  res.json({
    total,
    latest,
    timeseries,
    lastUpdated: new Date().toISOString(),
  });
});

/**
 * GET /api/kpis/summary — returns KPI summary tiles data
 */
kpisDevRouter.get("/summary", (req, res) => {
  const orgId = (req as any).orgId || req.user?.orgId || req.user?.id || "org_dev";
  const leads = getOrgLeads(orgId);
  const totalLeads = leads.length;
  const activeLeads = leads.length; // In dev mode, all leads are considered active
  const conversionRate = 5; // Placeholder
  const assignments = Math.floor(totalLeads * 0.1); // 10% of total leads
  const contractsInEscrow = Math.floor(totalLeads * 0.05); // 5% of total leads
  const contactRate = 30; // Placeholder
  const qualifiedLeads = Math.floor(totalLeads * 0.7); // 70% of total leads
  const monthlyProfit = totalLeads * 1500; // $1500 per lead estimate

  res.json({
    totalLeads,
    activeLeads,
    conversionRate,
    assignments,
    contractsInEscrow,
    contactRate,
    qualifiedLeads,
    monthlyProfit,
  });
});

/**
 * GET /api/kpis/lead-sources — returns lead count grouped by source
 */
kpisDevRouter.get("/lead-sources", (req, res) => {
  const orgId = (req as any).orgId || req.user?.orgId || req.user?.id || "org_dev";
  const leads = getOrgLeads(orgId);

  // Group by source, excluding null/undefined
  const sourceMap: Record<string, number> = {};
  
  for (const lead of leads) {
    const source = (lead as any).source;
    if (source && typeof source === "string" && source.trim()) {
      const key = source.trim();
      sourceMap[key] = (sourceMap[key] || 0) + 1;
    }
  }

  // Convert to array format expected by frontend
  const result = Object.entries(sourceMap).map(([source, count]) => ({
    source,
    count,
  }));

  res.json(result);
});