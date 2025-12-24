import express from "express";

// We import the same in-memory leads list from leads.dev.ts.
// Cursor will adjust this import automatically when you run the patch.
// If not, we will fix the path afterwards.
import { leads } from "./leads.dev.js";

export const kpisDevRouter = express.Router();

// ------------------------------------
// Build Leads-Over-Time dataset
// ------------------------------------
function buildLeadTimeseries() {
  const grouped: Record<string, number> = {};

  for (const lead of leads) {
    const date = lead.createdAt?.slice(0, 10); // YYYY-MM-DD
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
export function calculateKpis() {
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
kpisDevRouter.get("/", (_req, res) => {
  const total = leads.length;
  const latest = [...leads]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, 5);
  const timeseries = buildLeadTimeseries();

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
kpisDevRouter.get("/summary", (_req, res) => {
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

