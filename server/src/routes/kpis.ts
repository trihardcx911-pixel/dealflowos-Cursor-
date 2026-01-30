import express from "express";
import { getOrgLeads } from "../dev/leadsStore.js";
import { getOrgDeals } from "../dev/dealsStore.js";

export function makeKpisRouter(pool?: any) {
  const router = express.Router();

  // --- GET /kpis ---
  router.get("/", async (req, res) => {
    // BOLA prevention: Ensure user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const orgId = (req as any).orgId || req.user.orgId || req.user.id;

      // KPI Definitions:
      // - totalLeads: count of all leads for org
      // - activeLeads: count of non-archived leads (if no archived field, equals totalLeads)
      // - assignments: count of leads with assignedToUserId != null
      // - conversionRate: (closedWonDeals / totalLeads) * 100
      // - contactRate: (contactedLeads / totalLeads) * 100 (requires contact tracking; returns 0 until implemented)
      // - contractsInEscrow: count of deals with stage = IN_ESCROW
      // - monthlyProfit: sum(assignmentFeeActual) for CLOSED_WON deals this month
      // - qualifiedLeads: count of deals with stage >= QUALIFIED

      const isDevMode = process.env.NODE_ENV !== "production";
      let totalLeads = 0;
      let activeLeads = 0;
      let assignments = 0;
      let conversionRate = 0;
      const contactRate = 0; // Still untracked
      let contractsInEscrow = 0;
      let monthlyProfit = 0;
      let qualifiedLeads = 0;
      let monthlyQualifiedLeads = 0;
      let monthlyNewLeads = 0;
      let assignmentsMTD = 0;
      let inEscrow = 0;
      // Previous period baselines (for semantic color tone computation)
      let prevActiveLeads: number | null = null;
      let prevConversionRate: number | null = null;
      let prevMonthlyNewLeads: number | null = null;
      let prevMonthlyProfit: number | null = null;

      if (isDevMode) {
        // Dev mode: use in-memory stores
        const leads = getOrgLeads(orgId);
        
        // DEV-only diagnostic log
        console.log(`[KPI_STORE] org=${orgId} kpiCountSource=${leads.length}`);
        
        totalLeads = leads.length;
        activeLeads = totalLeads; // No archived field yet
        assignments = leads.filter((l: any) => l.assignedToUserId != null).length;

        const deals = getOrgDeals(orgId);
        
        // qualifiedLeads: count deals where stage >= QUALIFIED
        qualifiedLeads = deals.filter((d) =>
          ["QUALIFIED", "UNDER_CONTRACT", "IN_ESCROW", "CLOSED_WON", "CLOSED_LOST"].includes(d.stage)
        ).length;

        // contractsInEscrow: count deals where stage === IN_ESCROW
        contractsInEscrow = deals.filter((d) => d.stage === "IN_ESCROW").length;

        // conversionRate: (closedWonCount / totalLeads) * 100
        const closedWonCount = deals.filter((d) => d.stage === "CLOSED_WON").length;
        if (totalLeads > 0) {
          conversionRate = (closedWonCount / totalLeads) * 100;
        }

        // monthlyProfit: sum(assignmentFeeActual) for CLOSED_WON deals this month (UTC)
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth();
        const monthStart = new Date(Date.UTC(year, month, 1));
        
        monthlyProfit = deals
          .filter((d) => {
            if (d.stage !== "CLOSED_WON" || !d.closedAt) {
              return false;
            }
            const closedDate = new Date(d.closedAt);
            return closedDate >= monthStart;
          })
          .reduce((sum, d) => {
            const fee = Number(d.assignmentFeeActual || 0);
            return sum + (Number.isFinite(fee) ? fee : 0);
          }, 0);
        
        // Round to avoid floating point precision issues
        monthlyProfit = Math.round(monthlyProfit);

        // monthlyQualifiedLeads: count deals that became qualified this month (UTC)
        monthlyQualifiedLeads = deals
          .filter((d) => {
            if (!d.qualifiedAt) {
              return false;
            }
            const qualifiedTime = Date.parse(d.qualifiedAt);
            return Number.isFinite(qualifiedTime) && qualifiedTime >= monthStart.getTime();
          })
          .length;

        // monthlyNewLeads: count leads created this month (UTC)
        const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));
        monthlyNewLeads = leads.filter((l: any) => {
          if (!l.createdAt) return false;
          const createdTime = Date.parse(l.createdAt);
          return Number.isFinite(createdTime) && 
                 createdTime >= monthStart.getTime() && 
                 createdTime < nextMonthStart.getTime();
        }).length;

        // assignmentsMTD: count leads where assignedAt is within current month (UTC)
        assignmentsMTD = leads.filter((l: any) => {
          if (!l.assignedAt) return false;
          const assignedTime = Date.parse(l.assignedAt);
          return Number.isFinite(assignedTime) && 
                 assignedTime >= monthStart.getTime() && 
                 assignedTime < nextMonthStart.getTime();
        }).length;

        // inEscrow: count leads where escrowOpenedAt != null AND closedAt == null AND cancelledAt == null
        inEscrow = leads.filter((l: any) => 
          !!l.escrowOpenedAt && !l.closedAt && !l.cancelledAt
        ).length;

        // Previous period baselines (UTC month boundaries)
        const prevYear = month === 0 ? year - 1 : year;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth, 1));

        // prevActiveLeads: count of leads created before current month start
        prevActiveLeads = leads.filter((l: any) => {
          if (!l.createdAt) return false;
          const createdTime = Date.parse(l.createdAt);
          return Number.isFinite(createdTime) && createdTime < monthStart.getTime();
        }).length;

        // prevMonthlyNewLeads: count of leads created in previous month
        prevMonthlyNewLeads = leads.filter((l: any) => {
          if (!l.createdAt) return false;
          const createdTime = Date.parse(l.createdAt);
          return Number.isFinite(createdTime) && 
                 createdTime >= prevMonthStart.getTime() && 
                 createdTime < monthStart.getTime();
        }).length;

        // prevMonthlyProfit: sum assignmentFeeActual for CLOSED_WON deals in previous month
        try {
          prevMonthlyProfit = deals
            .filter((d) => {
              if (d.stage !== "CLOSED_WON" || !d.closedAt) {
                return false;
              }
              const closedDate = new Date(d.closedAt);
              return closedDate >= prevMonthStart && closedDate < monthStart;
            })
            .reduce((sum, d) => {
              const fee = Number(d.assignmentFeeActual || 0);
              return sum + (Number.isFinite(fee) ? fee : 0);
            }, 0);
          prevMonthlyProfit = Math.round(prevMonthlyProfit);
        } catch (e) {
          // If deal data structure is unavailable, leave null
          prevMonthlyProfit = null;
        }

        // prevConversionRate: only compute if prevActiveLeads > 0 and deal data available
        if (prevActiveLeads > 0) {
          try {
            const prevClosedWonCount = deals.filter((d) => {
              if (d.stage !== "CLOSED_WON" || !d.closedAt) {
                return false;
              }
              const closedDate = new Date(d.closedAt);
              return closedDate < monthStart; // closed-won as of end of previous month
            }).length;
            prevConversionRate = (prevClosedWonCount / prevActiveLeads) * 100;
          } catch (e) {
            // If deal data structure is unavailable, leave null
            prevConversionRate = null;
          }
        } else {
          prevConversionRate = null;
        }
      } else {
        // Production: compute from DB
        if (!pool) {
          return res.status(500).json({ error: "Database connection unavailable" });
        }

        try {
          // Lead-based KPIs (single query)
          const leadsResult = await pool.query(
            `SELECT 
               COUNT(*) as "totalLeads",
               COUNT(CASE WHEN "assignedToUserId" IS NOT NULL THEN 1 END) as "assignments"
             FROM "Lead" 
             WHERE "orgId" = $1`,
            [orgId]
          );

          totalLeads = Number(leadsResult.rows[0].totalLeads);
          activeLeads = totalLeads; // No archived field yet
          assignments = Number(leadsResult.rows[0].assignments);

          // Deal-based KPIs (single query)
          const dealsResult = await pool.query(
            `SELECT 
               COUNT(CASE WHEN stage IN ('QUALIFIED', 'UNDER_CONTRACT', 'IN_ESCROW', 'CLOSED_WON', 'CLOSED_LOST') THEN 1 END) as "qualifiedLeads",
               COUNT(CASE WHEN stage = 'IN_ESCROW' THEN 1 END) as "contractsInEscrow",
               COUNT(CASE WHEN stage = 'CLOSED_WON' THEN 1 END) as "closedWonCount",
               COALESCE(SUM(CASE 
                 WHEN stage = 'CLOSED_WON' 
                 AND "closedAt" IS NOT NULL
                 AND "closedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
                 THEN "assignmentFeeActual" ELSE 0 END
               ), 0) as "monthlyProfit",
               COUNT(CASE 
                 WHEN "qualifiedAt" IS NOT NULL
                 AND "qualifiedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
                 THEN 1 END
               ) as "monthlyQualifiedLeads"
             FROM "Deal" 
             WHERE "orgId" = $1`,
            [orgId]
          );

          qualifiedLeads = Number(dealsResult.rows[0].qualifiedLeads);
          contractsInEscrow = Number(dealsResult.rows[0].contractsInEscrow);
          const closedWonCount = Number(dealsResult.rows[0].closedWonCount);
          
          // Parse monthlyProfit (may be string from DB)
          const profitValue = dealsResult.rows[0].monthlyProfit;
          monthlyProfit = Math.round(Number(profitValue) || 0);

          // Parse monthlyQualifiedLeads (may be string from DB)
          monthlyQualifiedLeads = Number(dealsResult.rows[0].monthlyQualifiedLeads) || 0;

          // monthlyNewLeads: count leads created this month (UTC)
          const monthlyNewLeadsResult = await pool.query(
            `SELECT COUNT(*) as "monthlyNewLeads"
             FROM "Lead"
             WHERE "orgId" = $1
               AND "createdAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
               AND "createdAt" < DATE_TRUNC('month', (NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month')`,
            [orgId]
          );
          monthlyNewLeads = Number(monthlyNewLeadsResult.rows[0].monthlyNewLeads) || 0;

          // assignmentsMTD: count leads where assignedAt is within current month (UTC)
          const assignmentsMTDResult = await pool.query(
            `SELECT COUNT(*) as "assignmentsMTD"
             FROM "Lead"
             WHERE "orgId" = $1
               AND "assignedAt" IS NOT NULL
               AND "assignedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
               AND "assignedAt" < DATE_TRUNC('month', (NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month')`,
            [orgId]
          );
          assignmentsMTD = Number(assignmentsMTDResult.rows[0].assignmentsMTD) || 0;

          // inEscrow: count leads where escrowOpenedAt != null AND closedAt == null AND cancelledAt == null
          const inEscrowResult = await pool.query(
            `SELECT COUNT(*) as "inEscrow"
             FROM "Lead"
             WHERE "orgId" = $1
               AND "escrowOpenedAt" IS NOT NULL
               AND "closedAt" IS NULL
               AND "cancelledAt" IS NULL`,
            [orgId]
          );
          inEscrow = Number(inEscrowResult.rows[0].inEscrow) || 0;

          // conversionRate: (closedWonCount / totalLeads) * 100
          if (totalLeads > 0) {
            conversionRate = (closedWonCount / totalLeads) * 100;
          }

          // Previous period baselines (UTC month boundaries)
          // Wrap in try/catch to ensure endpoint remains stable if baseline queries fail
          try {
            // prevActiveLeads: count of leads created before current month start
            const prevActiveLeadsResult = await pool.query(
              `SELECT COUNT(*) as "prevActiveLeads"
               FROM "Lead"
               WHERE "orgId" = $1
                 AND "createdAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`,
              [orgId]
            );
            prevActiveLeads = Number(prevActiveLeadsResult.rows[0].prevActiveLeads) || 0;

            // prevMonthlyNewLeads: count of leads created in previous month
            const prevMonthlyNewLeadsResult = await pool.query(
              `SELECT COUNT(*) as "prevMonthlyNewLeads"
               FROM "Lead"
               WHERE "orgId" = $1
                 AND "createdAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
                 AND "createdAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`,
              [orgId]
            );
            prevMonthlyNewLeads = Number(prevMonthlyNewLeadsResult.rows[0].prevMonthlyNewLeads) || 0;

            // prevMonthlyProfit: sum assignmentFeeActual for CLOSED_WON deals in previous month
            try {
              const prevMonthlyProfitResult = await pool.query(
                `SELECT COALESCE(SUM("assignmentFeeActual"), 0) as "prevMonthlyProfit"
                 FROM "Deal"
                 WHERE "orgId" = $1
                   AND stage = 'CLOSED_WON'
                   AND "closedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
                   AND "closedAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`,
                [orgId]
              );
              const profitValue = prevMonthlyProfitResult.rows[0].prevMonthlyProfit;
              prevMonthlyProfit = Math.round(Number(profitValue) || 0);
            } catch (e) {
              // If Deal table or assignmentFeeActual column doesn't exist, leave null
              prevMonthlyProfit = null;
            }

            // prevConversionRate: only compute if prevActiveLeads > 0
            if (prevActiveLeads > 0) {
              try {
                const prevClosedWonResult = await pool.query(
                  `SELECT COUNT(*) as "prevClosedWonCount"
                   FROM "Deal"
                   WHERE "orgId" = $1
                     AND stage = 'CLOSED_WON'
                     AND "closedAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`,
                  [orgId]
                );
                const prevClosedWonCount = Number(prevClosedWonResult.rows[0].prevClosedWonCount) || 0;
                prevConversionRate = (prevClosedWonCount / prevActiveLeads) * 100;
              } catch (e) {
                // If Deal table or closedAt/stage columns don't exist, leave null
                prevConversionRate = null;
              }
            } else {
              prevConversionRate = null;
            }
          } catch (baselineError) {
            // If baseline queries fail, log but don't crash the endpoint
            console.error("[KPI] Baseline query failed (non-fatal):", baselineError);
            // Leave all prev* fields as null (default values)
          }
        } catch (dbError) {
          console.error("[KPI] DB query failed:", dbError);
          return res.status(500).json({ error: "Failed to load KPIs" });
        }
      }

      res.json({
        totalLeads,
        activeLeads,
        conversionRate,
        assignments,
        contractsInEscrow,
        contactRate,
        monthlyNewLeads,
        monthlyProfit,
        qualifiedLeads,
        monthlyQualifiedLeads,
        assignmentsMTD,
        inEscrow,
        // Previous period baselines (for semantic color tone computation)
        prevActiveLeads,
        prevConversionRate,
        prevMonthlyNewLeads,
        prevMonthlyProfit,
      });
    } catch (error) {
      console.error("[KPI] Error in /kpis:", error);
      const isDevMode = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: "Failed to load KPIs",
        ...(isDevMode && { message: String(error) })
      });
    }
  });

  // --- GET /lead-sources ---
  // Aggregates leads by source for pie chart visualization
  router.get("/lead-sources", async (req, res) => {
    // BOLA prevention: Ensure user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const orgId = (req as any).orgId || req.user.orgId || req.user.id;

      // Determine mode: dev always uses in-memory store (matches /api/leads behavior)
      const isDevMode = process.env.NODE_ENV !== "production";
      const hasDatabase = Boolean(process.env.DATABASE_URL);
      const poolAvailable = Boolean(pool);

      // TEMP KPI DEBUG (REMOVE IN PHASE 3)
      const shouldDebug = isDevMode && process.env.KPI_DEBUG === "1";
      if (shouldDebug) {
        console.log("[KPI-DEBUG] /lead-sources: orgId=", orgId, "hasDatabase=", hasDatabase, "poolAvailable=", poolAvailable);
      }

      // In dev mode, always use in-memory store (same as /api/leads)
      if (isDevMode) {
        // TEMP KPI DEBUG (REMOVE IN PHASE 3)
        if (shouldDebug) {
          console.log("[KPI-DEBUG] Decision: using DEV_STORE because isDevMode=true");
          console.log("[KPI-DEBUG] Branch: DEV_STORE");
        }
        const leads = getOrgLeads(orgId);
        
        // TEMP KPI DEBUG (REMOVE IN PHASE 3)
        if (shouldDebug) {
          console.log("[KPI-DEBUG] leadsCount:", leads.length);
        }
        
        // Group by source, excluding null/undefined/empty
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

        // Sort deterministically: count descending, then source ascending (matches DB ORDER BY)
        result.sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

        // TEMP KPI DEBUG (REMOVE IN PHASE 3)
        if (shouldDebug) {
          console.log("[KPI-DEBUG] aggregatedResultCount:", result.length);
        }

        return res.json(result);
      } else if (hasDatabase && pool) {
        // Production mode: Query database
        // TEMP KPI DEBUG (REMOVE IN PHASE 3)
        if (shouldDebug) {
          console.log("[KPI-DEBUG] Decision: using DB because isDevMode=false and hasDatabase=true and poolAvailable=true");
          console.log("[KPI-DEBUG] Branch: DB");
          console.log("[KPI-DEBUG] Executing DB query for orgId:", orgId);
        }
        try {
          const result = await pool.query(
            `SELECT source, COUNT(*) as count
             FROM "Lead"
             WHERE "orgId" = $1
               AND source IS NOT NULL
               AND source != ''
             GROUP BY source
             ORDER BY count DESC`,
            [orgId]
          );

          const leadSources = result.rows.map((row: any) => ({
            source: row.source,
            count: parseInt(row.count, 10),
          }));

          // TEMP KPI DEBUG (REMOVE IN PHASE 3)
          if (shouldDebug) {
            console.log("[KPI-DEBUG] DB query success: returned", leadSources.length, "sources");
          }

          return res.json(leadSources);
        } catch (dbError) {
          // Database query failed - return 500 to avoid silent KPI outages
          console.error("[KPI] Database query failed for lead-sources:", dbError);
          // TEMP KPI DEBUG (REMOVE IN PHASE 3)
          if (shouldDebug) {
            console.log("[KPI-DEBUG] DB query error:", dbError instanceof Error ? dbError.name + ": " + dbError.message : String(dbError));
          }
          return res.status(500).json({ error: "Failed to query lead sources" });
        }
      } else {
        // Production mode but no DB configured - return empty array
        // TEMP KPI DEBUG (REMOVE IN PHASE 3)
        if (shouldDebug) {
          console.log("[KPI-DEBUG] Decision: no DB available, returning empty array");
        }
        return res.json([]);
      }
    } catch (error) {
      // Catch-all: return 500 to avoid silent KPI outages
      console.error("[KPI] Error in /lead-sources:", error);
      const isDevMode = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: "Failed to load lead sources",
        ...(isDevMode && { message: String(error) })
      });
    }
  });

  return router;
}

