import { Router } from "express";
import { Pool } from "pg";
// DEV MODE — all analytics use in-memory leads
import { leads } from "./leads.dev";

export function makeKpisRouter(pool: Pool) {
  console.log(">>> makeKpisRouter LOADED");
  const router = Router();

  // GET /kpis
  router.get("/", async (_req, res) => {
    console.log("[kpis] hit KPI route");
    try {
      // Get orgId from query or use default for dev
      const orgId = _req.query.orgId as string || 'default-org';
      
      console.log('[kpis] fetching KPIs for orgId:', orgId);

      // ============================================
      // DEV KPI METRICS — FULLY MATCH FRONTEND SHAPE
      // ============================================

      const totalLeads = leads.length;

      const activeLeads = leads.filter((l: any) => {
        const created = new Date(l.createdAt).getTime();
        return created >= Date.now() - 90 * 24 * 60 * 60 * 1000;
      }).length;

      const monthlyNewLeads = leads.filter((l: any) => {
        const created = new Date(l.createdAt).getTime();
        return created >= Date.now() - 30 * 24 * 60 * 60 * 1000;
      }).length;

      const dealsClosed = Math.floor(totalLeads * 0.05);
      const conversionRate = totalLeads ? Math.round((dealsClosed / totalLeads) * 100) : 0;

      const assignments = Math.floor(activeLeads * 0.1);
      const contractsInEscrow = Math.floor(activeLeads * 0.05);

      const contactRate = totalLeads ? Math.round((totalLeads * 0.3 / totalLeads) * 100) : 0;

      const monthlyProfit = monthlyNewLeads * 1500;

      // ============================================
      // LEADS OVER LAST 12 MONTHS
      // ============================================

      const monthlyCount: Record<string, number> = {};

      leads.forEach((l: any) => {
        const d = new Date(l.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyCount[key] = (monthlyCount[key] ?? 0) + 1;
      });

      const leadsOverTime = Object.entries(monthlyCount).map(([key, count]) => {
        const [year, month] = key.split("-");
        return {
          month: new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          }),
          leads: count,
        };
      });

      // ============================================
      // DONUT CHART — LEAD TYPES
      // ============================================

      const typeTotals: Record<string, number> = {};
      leads.forEach((l: any) => {
        const t = l.type || "other";
        typeTotals[t] = (typeTotals[t] ?? 0) + 1;
      });

      const leadTypes = Object.entries(typeTotals).map(([type, count]) => ({
        name: type.toUpperCase(),
        value: count,
      }));

      return res.json({
        totalLeads,
        activeLeads,
        conversionRate,
        assignments,
        contractsInEscrow,
        contactRate,
        monthlyNewLeads,
        monthlyProfit,
        charts: {
          leadsOverTime,
          leadTypes,
        }
      });
    } catch (err) {
      console.error("[kpis] error:", err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: 'failed_to_load_kpis', message });
    }
  });

  // GET /kpis/lead-sources - Get lead sources breakdown
  router.get("/lead-sources", async (req, res) => {
    console.log(">>> [ROUTE HIT] GET /api/kpis/lead-sources");
    console.log(">>> [QUERY PARAMS]", req.query);
    try {
      const orgId = req.query.orgId as string || 'default-org';
      console.log(">>> [ORG ID] Using orgId:", orgId);
      
      console.log(">>> [DEV] Computing lead sources from in-memory store…");

      const sourceTotals: Record<string, number> = {};
      
      for (const l of leads) {
        const s = l.source || "other";
        sourceTotals[s] = (sourceTotals[s] ?? 0) + 1;
      }

      const formatted = Object.entries(sourceTotals).map(([source, count]) => ({
        source,
        count
      }));

      console.log(">>> [DEV] Computed lead sources:", formatted);

      console.log(">>> [FORMATTED DATA] Sending response:", JSON.stringify(formatted, null, 2));
      res.json(formatted);
      console.log(">>> [RESPONSE SENT] Successfully sent lead sources data");
    } catch (err) {
      console.error(">>> [ERROR] lead-sources endpoint failed:", err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: 'failed_to_load_lead_sources', message });
      console.log(">>> [ERROR RESPONSE] Sent 500 error response");
    }
  });

  // Debug route to verify router is working
  router.get("/test", (_req, res) => {
    console.log(">>> HIT /api/kpis/test");
    res.json({ ok: true, message: "KPI router is working" });
  });

  return router;
}

