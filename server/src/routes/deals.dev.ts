import express from "express";
import {
  getOrgDeals,
  findDealByLeadId,
  upsertDealForLead,
  isDealStage,
  type Deal,
  type DealStage,
} from "../dev/dealsStore.js";
import { getOrgLeads } from "../dev/leadsStore.js";
import { pool } from "../db/pool.js";

export const dealsDevRouter = express.Router();

const isDevMode = process.env.NODE_ENV !== "production";

// ===========================================
// GET /api/deals
// ===========================================
dealsDevRouter.get("/", async (req, res) => {
  // BOLA prevention: Only return deals for authenticated user
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orgId = (req as any).orgId || req.user.orgId || req.user.id;

  if (isDevMode) {
    const deals = getOrgDeals(orgId);
    return res.json({ items: deals });
  }

  // Production: query DB
  try {
    const result = await pool.query(
      `SELECT * FROM "Deal" WHERE "orgId" = $1 ORDER BY "createdAt" DESC`,
      [orgId]
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error("[DEALS] DB query failed:", error);
    return res.status(500).json({ error: "Failed to load deals" });
  }
});

// ===========================================
// POST /api/deals/from-lead/:leadId
// ===========================================
dealsDevRouter.post("/from-lead/:leadId", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { leadId } = req.params;
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;

  if (isDevMode) {
    // Dev mode: validate lead exists in org
    const leads = getOrgLeads(orgId);
    const lead = leads.find((l: any) => l.id === leadId);

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Create or return existing deal
    const deal = upsertDealForLead(orgId, leadId);
    return res.json({ item: deal });
  }

  // Production: use DB
  try {
    // Validate lead exists in org
    const leadCheck = await pool.query(
      `SELECT 1 FROM "Lead" WHERE "orgId" = $1 AND "id" = $2 LIMIT 1`,
      [orgId, leadId]
    );

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Insert or return existing deal (idempotent)
    const result = await pool.query(
      `INSERT INTO "Deal" ("orgId", "leadId", stage, "stageUpdatedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, 'NEW', now(), now(), now())
       ON CONFLICT ("orgId", "leadId") 
       DO UPDATE SET "updatedAt" = now()
       RETURNING *`,
      [orgId, leadId]
    );

    return res.json({ item: result.rows[0] });
  } catch (error) {
    console.error("[DEALS] DB insert failed:", error);
    return res.status(500).json({ error: "Failed to create deal" });
  }
});

// ===========================================
// PATCH /api/deals/:id/stage
// ===========================================
dealsDevRouter.patch("/:id/stage", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;
  const { stage, assignmentFeeActual, assignmentFeeExpected } = req.body;

  // Validate stage
  if (!isDealStage(stage)) {
    return res.status(400).json({ error: "Invalid stage" });
  }

  if (isDevMode) {
    // Dev mode: use in-memory store
    const deals = getOrgDeals(orgId);
    const index = deals.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const deal = deals[index];
    const now = new Date().toISOString();

    // Update stage and timestamps
    deal.stage = stage as DealStage;
    deal.stageUpdatedAt = now;
    deal.updatedAt = now;

    // Set stage-specific timestamps ONLY when entering that stage the first time
    if (stage === "QUALIFIED" && !deal.qualifiedAt) {
      deal.qualifiedAt = now;
    }
    if (stage === "UNDER_CONTRACT" && !deal.contractAt) {
      deal.contractAt = now;
    }
    if (stage === "IN_ESCROW" && !deal.escrowAt) {
      deal.escrowAt = now;
    }
    if ((stage === "CLOSED_WON" || stage === "CLOSED_LOST") && !deal.closedAt) {
      deal.closedAt = now;
    }

    // Fee handling
    if (assignmentFeeExpected !== undefined) {
      const fee = Number(assignmentFeeExpected);
      deal.assignmentFeeExpected = Number.isFinite(fee) ? fee : null;
    }

    if (stage === "CLOSED_WON") {
      if (assignmentFeeActual !== undefined) {
        const fee = Number(assignmentFeeActual);
        deal.assignmentFeeActual = Number.isFinite(fee) && fee >= 0 ? fee : deal.assignmentFeeActual ?? null;
      }
    }

    return res.json({ item: deal });
  }

  // Production: update DB
  try {
    // First verify deal exists and belongs to org
    const dealCheck = await pool.query(
      `SELECT * FROM "Deal" WHERE "orgId" = $1 AND id = $2 LIMIT 1`,
      [orgId, id]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const existingDeal = dealCheck.rows[0];

    // Build update query with stage-specific timestamp logic (first-enter only)
    let updateFields = `stage = $1, "stageUpdatedAt" = now(), "updatedAt" = now()`;
    const values: any[] = [stage];
    let paramIndex = 2;

    // Set stage-specific timestamps ONLY if null (first-enter semantics using COALESCE)
    if (stage === "QUALIFIED") {
      updateFields += `, "qualifiedAt" = COALESCE("qualifiedAt", now())`;
    }
    if (stage === "UNDER_CONTRACT") {
      updateFields += `, "contractAt" = COALESCE("contractAt", now())`;
    }
    if (stage === "IN_ESCROW") {
      updateFields += `, "escrowAt" = COALESCE("escrowAt", now())`;
    }
    if (stage === "CLOSED_WON" || stage === "CLOSED_LOST") {
      updateFields += `, "closedAt" = COALESCE("closedAt", now())`;
    }

    // Fee handling: assignmentFeeExpected
    if (assignmentFeeExpected !== undefined) {
      const fee = Number(assignmentFeeExpected);
      updateFields += `, "assignmentFeeExpected" = $${paramIndex}`;
      values.push(Number.isFinite(fee) && fee >= 0 ? fee : null);
      paramIndex++;
    }

    // Fee handling: assignmentFeeActual (only if stage=CLOSED_WON and provided)
    if (stage === "CLOSED_WON" && assignmentFeeActual !== undefined) {
      const fee = Number(assignmentFeeActual);
      if (Number.isFinite(fee) && fee >= 0) {
        updateFields += `, "assignmentFeeActual" = $${paramIndex}`;
        values.push(fee);
        paramIndex++;
      }
      // If invalid, leave unchanged (don't add to update query)
    }

    // Add orgId and id for WHERE clause
    values.push(orgId, id);

    const result = await pool.query(
      `UPDATE "Deal" SET ${updateFields}
       WHERE "orgId" = $${paramIndex} AND id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    return res.json({ item: result.rows[0] });
  } catch (error) {
    console.error("[DEALS] DB update failed:", error);
    return res.status(500).json({ error: "Failed to update deal" });
  }
});

