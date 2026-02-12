import express from "express";
import crypto from "crypto";
// KPIs must be computed via /api/kpis only; leads.dev.ts must not depend on analytics modules
// (kpis.dev.ts has broken dependencies that prevent server boot)
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";
import { detectResourceProbing } from "../security/anomalyDetector.js";
import { getOrgLeads } from "../dev/leadsStore.js";
import { pool } from "../db/pool.js";

export const leadsDevRouter = express.Router();

const isDevMode = process.env.NODE_ENV !== "production";

// ===========================================
// GET /api/leads
// ===========================================
leadsDevRouter.get("/", async (req, res) => {
  // BOLA prevention: Only return leads for authenticated user
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;

  if (isDevMode) {
    const userLeads = getOrgLeads(orgId);
    // Ensure temperature is included (default to 'cold' if missing for backward compat)
    const leadsWithTemp = userLeads.map(lead => ({
      ...lead,
      temperature: lead.temperature || 'cold'
    }));
    return res.json({ items: leadsWithTemp });
  }

  // Production: query DB
  try {
    const result = await pool.query(
      `SELECT *, COALESCE(temperature, 'cold') AS temperature FROM "Lead" WHERE "orgId" = $1 ORDER BY "createdAt" DESC`,
      [orgId]
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error("[LEADS] DB query failed:", error);
    return res.status(500).json({ error: "Failed to load leads" });
  }
});

// ===========================================
// POST /api/leads
// ===========================================
leadsDevRouter.post("/", async (req, res) => {
  if (isDevMode) {
    console.log("[LEADS_DEV] POST /api/leads body:", req.body);
  }

  // Prevent hard crashes
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      error: "INVALID_BODY",
      message: "Request body must be JSON"
    });
  }

  let { type, address, city, state, zip, source, homeownerName, phoneNumber } = req.body;

  // Normalize all fields to strings
  type = String(type ?? "").trim();
  address = String(address ?? "").trim();
  city = String(city ?? "").trim();
  state = String(state ?? "").trim();
  zip = String(zip ?? "").trim();
  source = source ? String(source).trim() : null;

  // Normalize homeownerName: trim, empty -> null
  homeownerName = homeownerName ? String(homeownerName).trim() : null;
  if (homeownerName === "") homeownerName = null;

  // Normalize phoneNumber: digits only, null if < 7 digits
  if (phoneNumber) {
    const digits = String(phoneNumber).replace(/\D/g, "");
    phoneNumber = digits.length >= 7 ? digits : null;
  } else {
    phoneNumber = null;
  }

  // Required field
  if (!address) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Address is required"
    });
  }

  // Optional: Default type
  if (!type) type = "single_family";

  // Optional: Basic ZIP sanity check
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    if (isDevMode) {
      console.warn("[LEADS_DEV] Invalid ZIP format:", zip);
    }
  }

  // BOLA prevention: Ensure user is authenticated and use their ID
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.user.id;
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;
  const now = new Date().toISOString();

  if (isDevMode) {
    // Dev mode: use in-memory store
    const newLead = {
      id: crypto.randomUUID(), // safer than incremental IDs
      userId, // Store ownership
      orgId, // Store org ownership
      type,
      address,
      city,
      state,
      zip,
      source,
      homeownerName,
      phoneNumber,
      temperature: 'cold', // Default temperature
      createdAt: now,
      updatedAt: now,
    };

    const orgLeads = getOrgLeads(orgId);
    orgLeads.push(newLead);

    // DEV-only diagnostic log
    if (isDevMode) {
      console.log(`[LEADS_STORE] org=${orgId} afterCreate count=${orgLeads.length}`);
    }

    return res.json({
      item: newLead,
      items: orgLeads,
    });
  }

  // Production: insert into DB
  try {
    // Generate address hash for uniqueness check
    const addressHash = crypto.createHash('sha256').update(`${address}${city}${state}${zip}`.toLowerCase()).digest('hex');
    
    // Map type to enum value (handle "single_family" -> "sfr", default to 'sfr' if not valid)
    const typeLower = type.toLowerCase();
    const typeMap: Record<string, string> = {
      'single_family': 'sfr',
      'sfr': 'sfr',
      'land': 'land',
      'multi': 'multi',
      'other': 'other'
    };
    const dbType = typeMap[typeLower] || 'sfr';
    
    // Validate dbType is a valid enum value (safety check before SQL cast)
    const validTypes = ['sfr', 'land', 'multi', 'other'];
    if (!validTypes.includes(dbType)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: `Invalid lead type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    const result = await pool.query(
      `INSERT INTO "Lead" ("id", "orgId", type, address, city, state, zip, "addressHash", source, "homeownerName", "phoneNumber", temperature, "createdAt", "updatedAt")
       VALUES ($1, $2, $3::lead_type, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, 'cold'), $13, $14)
       RETURNING *`,
      [
        crypto.randomUUID(),
        orgId,
        dbType,
        address,
        city,
        state,
        zip,
        addressHash,
        source,
        homeownerName,
        phoneNumber,
        req.body.temperature || 'cold',
        now,
        now
      ]
    );

    return res.json({
      item: result.rows[0],
      items: [], // Don't return all items on POST to reduce payload
    });
  } catch (error: any) {
    console.error("[LEADS] DB insert failed:", error);
    // Handle unique constraint violation (duplicate address)
    if (error.code === '23505') {
      return res.status(409).json({ error: "Lead with this address already exists" });
    }
    return res.status(500).json({ error: "Failed to create lead" });
  }
});

// ===========================================
// GET /api/leads/summary
// ===========================================
leadsDevRouter.get("/summary", (req, res) => {
  // BOLA prevention: Only return leads for authenticated user
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orgId = (req as any).orgId || req.user.orgId || req.user.id;
  const userLeads = getOrgLeads(orgId);
  const latest = [...userLeads].slice(-5);
  res.json({
    total: userLeads.length,
    latest,
    items: userLeads,
  });
});

// ===========================================
// PATCH /api/leads/:id
// ===========================================
leadsDevRouter.patch("/:id", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const userId = req.user.id;
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;
  let { type, address, city, state, zip, temperature, homeownerName, phoneNumber } = req.body;

  // Normalize homeownerName if provided
  let normalizedHomeownerName: string | null | undefined = undefined;
  if (homeownerName !== undefined) {
    normalizedHomeownerName = homeownerName ? String(homeownerName).trim() : null;
    if (normalizedHomeownerName === "") normalizedHomeownerName = null;
  }

  // Normalize phoneNumber if provided: digits only, null if < 7 digits
  let normalizedPhoneNumber: string | null | undefined = undefined;
  if (phoneNumber !== undefined) {
    if (phoneNumber) {
      const digits = String(phoneNumber).replace(/\D/g, "");
      normalizedPhoneNumber = digits.length >= 7 ? digits : null;
    } else {
      normalizedPhoneNumber = null;
    }
  }

  // Extract milestone fields
  const { 
    underContractAt, 
    assignedAt, 
    escrowOpenedAt, 
    closedAt, 
    cancelledAt, 
    buyerName, 
    assignmentFee 
  } = req.body;

  // Normalize all fields to strings
  type = String(type ?? "").trim();
  address = String(address ?? "").trim();
  city = String(city ?? "").trim();
  state = String(state ?? "").trim().toUpperCase();
  zip = String(zip ?? "").trim();

  // Validate temperature if provided
  if (temperature !== undefined) {
    const normalizedTemp = String(temperature).toLowerCase();
    if (!['cold', 'warm', 'hot'].includes(normalizedTemp)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Temperature must be cold, warm, or hot"
      });
    }
    temperature = normalizedTemp;
  }

  // Parse milestone fields (local helpers)
  const parseDateOrNull = (value: any): string | null | undefined => {
    if (value === undefined) return undefined; // Don't touch if undefined
    if (value === null || value === "") return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${value}`);
    }
    return date.toISOString();
  };

  const parseFeeOrNull = (value: any): string | null | undefined => {
    if (value === undefined) return undefined; // Don't touch if undefined
    if (value === null || value === "") return null;
    const num = typeof value === "string" ? parseFloat(value) : Number(value);
    if (isNaN(num) || !isFinite(num) || num < 0) {
      throw new Error(`Invalid assignmentFee: must be a non-negative number`);
    }
    return num.toFixed(2);
  };

  // Parse milestone fields (with error handling)
  let parsedUnderContractAt: string | null | undefined;
  let parsedAssignedAt: string | null | undefined;
  let parsedEscrowOpenedAt: string | null | undefined;
  let parsedClosedAt: string | null | undefined;
  let parsedCancelledAt: string | null | undefined;
  let parsedBuyerName: string | null | undefined;
  let parsedAssignmentFee: string | null | undefined;

  try {
    parsedUnderContractAt = parseDateOrNull(underContractAt);
    parsedAssignedAt = parseDateOrNull(assignedAt);
    parsedEscrowOpenedAt = parseDateOrNull(escrowOpenedAt);
    parsedClosedAt = parseDateOrNull(closedAt);
    parsedCancelledAt = parseDateOrNull(cancelledAt);
    parsedBuyerName = buyerName === undefined ? undefined : (buyerName === null || buyerName === "" ? null : String(buyerName).trim());
    parsedAssignmentFee = parseFeeOrNull(assignmentFee);
  } catch (err: any) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: err.message || "Invalid milestone field value"
    });
  }

  // Validation: assignedAt requires buyerName
  if (parsedAssignedAt !== undefined && parsedAssignedAt !== null) {
    if (!parsedBuyerName || parsedBuyerName.trim().length === 0) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "buyerName is required when assignedAt is set"
      });
    }
  }

  if (isDevMode) {
    // Dev mode: use in-memory store
    const userLeads = getOrgLeads(orgId);
    const index = userLeads.findIndex((l) => l.id === id);
    
    if (index === -1) {
      // Return 403 instead of 404 to prevent information leakage
      // Log BOLA violation
      logSecurityEvent({
        event_type: "bola_forbidden",
        user_id: userId,
        ip: getClientIp(req),
        user_agent: getUserAgent(req),
        path: req.path,
        method: req.method,
        status_code: 403,
        reason: "ownership_mismatch",
        meta: {
          resource_type: "lead",
          resource_id: id,
        },
      }).catch(() => {}); // Ignore errors
      (req as any)._securityLogged = true; // Prevent double-logging

      // Anomaly detection (log-only, non-blocking)
      detectResourceProbing(userId).catch(() => {});

      return res.status(403).json({
        error: "Forbidden"
      });
    }

    // Update the lead
    const updatedAt = new Date().toISOString();
    const updatedLead = {
      ...userLeads[index],
      type,
      address,
      city,
      state,
      zip,
      updatedAt,
    };
    
    // Only update temperature if provided
    if (temperature !== undefined) {
      updatedLead.temperature = temperature;
    }

    // Update milestone fields only if provided (undefined means don't touch)
    if (parsedUnderContractAt !== undefined) {
      updatedLead.underContractAt = parsedUnderContractAt;
    }
    if (parsedAssignedAt !== undefined) {
      updatedLead.assignedAt = parsedAssignedAt;
    }
    if (parsedEscrowOpenedAt !== undefined) {
      updatedLead.escrowOpenedAt = parsedEscrowOpenedAt;
    }
    if (parsedClosedAt !== undefined) {
      updatedLead.closedAt = parsedClosedAt;
    }
    if (parsedCancelledAt !== undefined) {
      updatedLead.cancelledAt = parsedCancelledAt;
    }
    if (parsedBuyerName !== undefined) {
      updatedLead.buyerName = parsedBuyerName;
    }
    if (parsedAssignmentFee !== undefined) {
      updatedLead.assignmentFee = parsedAssignmentFee;
    }
    if (normalizedHomeownerName !== undefined) {
      updatedLead.homeownerName = normalizedHomeownerName;
    }
    if (normalizedPhoneNumber !== undefined) {
      updatedLead.phoneNumber = normalizedPhoneNumber;
    }

    userLeads[index] = updatedLead;

    return res.json({
      item: userLeads[index],
      items: userLeads,
    });
  }

  // Production: update DB
  try {
    // Map type to enum value if provided
    const dbType = type ? (['sfr', 'land', 'multi', 'other'].includes(type.toLowerCase()) ? type.toLowerCase() : null) : null;
    
    // Validate type if provided (return 400 before attempting SQL cast)
    if (type && !dbType) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: `Invalid lead type. Must be one of: sfr, land, multi, other`
      });
    }
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (type && dbType) {
      updates.push(`type = $${paramIndex}::lead_type`);
      values.push(dbType);
      paramIndex++;
    }
    if (address) {
      updates.push(`address = $${paramIndex}`);
      values.push(address);
      paramIndex++;
    }
    if (city) {
      updates.push(`city = $${paramIndex}`);
      values.push(city);
      paramIndex++;
    }
    if (state) {
      updates.push(`state = $${paramIndex}`);
      values.push(state);
      paramIndex++;
    }
    if (zip) {
      updates.push(`zip = $${paramIndex}`);
      values.push(zip);
      paramIndex++;
    }
    if (temperature !== undefined) {
      updates.push(`temperature = $${paramIndex}`);
      values.push(temperature);
      paramIndex++;
    }

    // Milestone fields (only if provided)
    if (parsedUnderContractAt !== undefined) {
      updates.push(`"underContractAt" = $${paramIndex}::timestamptz`);
      values.push(parsedUnderContractAt);
      paramIndex++;
    }
    if (parsedAssignedAt !== undefined) {
      updates.push(`"assignedAt" = $${paramIndex}::timestamptz`);
      values.push(parsedAssignedAt);
      paramIndex++;
    }
    if (parsedEscrowOpenedAt !== undefined) {
      updates.push(`"escrowOpenedAt" = $${paramIndex}::timestamptz`);
      values.push(parsedEscrowOpenedAt);
      paramIndex++;
    }
    if (parsedClosedAt !== undefined) {
      updates.push(`"closedAt" = $${paramIndex}::timestamptz`);
      values.push(parsedClosedAt);
      paramIndex++;
    }
    if (parsedCancelledAt !== undefined) {
      updates.push(`"cancelledAt" = $${paramIndex}::timestamptz`);
      values.push(parsedCancelledAt);
      paramIndex++;
    }
    if (parsedBuyerName !== undefined) {
      updates.push(`"buyerName" = $${paramIndex}`);
      values.push(parsedBuyerName);
      paramIndex++;
    }
    if (parsedAssignmentFee !== undefined) {
      updates.push(`"assignmentFee" = $${paramIndex}::decimal(12,2)`);
      values.push(parsedAssignmentFee);
      paramIndex++;
    }
    if (normalizedHomeownerName !== undefined) {
      updates.push(`"homeownerName" = $${paramIndex}`);
      values.push(normalizedHomeownerName);
      paramIndex++;
    }
    if (normalizedPhoneNumber !== undefined) {
      updates.push(`"phoneNumber" = $${paramIndex}`);
      values.push(normalizedPhoneNumber);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push(`"updatedAt" = $${paramIndex}`);
    values.push(new Date().toISOString());
    paramIndex++;

    // Add orgId and id for WHERE clause
    values.push(orgId, id);

    const result = await pool.query(
      `UPDATE "Lead" SET ${updates.join(", ")} 
       WHERE "orgId" = $${paramIndex} AND "id" = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }

    return res.json({
      item: result.rows[0],
      items: [],
    });
  } catch (error) {
    console.error("[LEADS] DB update failed:", error);
    return res.status(500).json({ error: "Failed to update lead" });
  }
});

// ===========================================
// PATCH /api/leads/:id/assign
// ===========================================
leadsDevRouter.patch("/:id/assign", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;
  const { assignedToUserId } = req.body;

  // Normalize assignedToUserId: null if null/empty, else trimmed string
  let normalizedAssignedTo: string | null = null;
  if (assignedToUserId != null && String(assignedToUserId).trim() !== "") {
    normalizedAssignedTo = String(assignedToUserId).trim();
  }

  if (isDevMode) {
    // Dev mode: use in-memory store
    const userLeads = getOrgLeads(orgId);
    const index = userLeads.findIndex((l) => l.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Update the lead
    const updatedAt = new Date().toISOString();
    userLeads[index] = {
      ...userLeads[index],
      assignedToUserId: normalizedAssignedTo,
      updatedAt,
    };

    return res.json({
      item: userLeads[index],
    });
  }

  // Production: update DB
  try {
    const result = await pool.query(
      `UPDATE "Lead" SET "assignedToUserId" = $1, "updatedAt" = $2
       WHERE "orgId" = $3 AND "id" = $4
       RETURNING *`,
      [normalizedAssignedTo, new Date().toISOString(), orgId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }

    return res.json({
      item: result.rows[0],
    });
  } catch (error) {
    console.error("[LEADS] DB update failed:", error);
    return res.status(500).json({ error: "Failed to update lead assignment" });
  }
});

// ===========================================
// DELETE /api/leads/:id
// ===========================================
leadsDevRouter.delete("/:id", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const userId = req.user.id;
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;

  if (isDevMode) {
    // Dev mode: use in-memory store
    const userLeads = getOrgLeads(orgId);
    const index = userLeads.findIndex((l) => l.id === id);
    
    if (index === -1) {
      // Return 403 instead of 404 to prevent information leakage
      return res.status(403).json({
        error: "Forbidden"
      });
    }

    userLeads.splice(index, 1);

    return res.json({
      success: true,
      items: userLeads,
    });
  }

  // Production: delete from DB
  try {
    const result = await pool.query(
      `DELETE FROM "Lead" WHERE "orgId" = $1 AND "id" = $2 RETURNING *`,
      [orgId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }

    return res.json({
      success: true,
      items: [],
    });
  } catch (error) {
    console.error("[LEADS] DB delete failed:", error);
    return res.status(500).json({ error: "Failed to delete lead" });
  }
});

// POST /api/leads/bulk-delete
// ===========================================
// Bulk delete leads by IDs (max 100 per request)
// Payload: { ids: string[] }
// Response: { success: true, deletedCount: number, items: Lead[] }
//
// Security:
// - Requires authentication
// - Only deletes leads belonging to user's org (BOLA protection)
// - Silently ignores IDs that don't exist or belong to other orgs
//
// Error handling:
// - 400: Invalid payload (not array, empty, or > 100 IDs)
// - 401: Unauthorized
// - 500: Database error
leadsDevRouter.post("/bulk-delete", express.json(), async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ids } = req.body;
  const userId = req.user.id;
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;

  // Payload validation
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "Invalid payload: ids must be an array" });
  }

  if (ids.length === 0) {
    return res.status(400).json({ error: "Empty ids array" });
  }

  if (ids.length > 100) {
    return res.status(400).json({ error: "Too many ids: maximum 100 per bulk delete" });
  }

  // Deduplicate and filter: only keep non-empty strings
  const uniqueIds = Array.from(new Set(ids.filter(id => typeof id === "string" && id.trim().length > 0)));

  if (uniqueIds.length === 0) {
    return res.status(400).json({ error: "No valid ids provided" });
  }

  if (isDevMode) {
    // Dev mode: use in-memory store
    const userLeads = getOrgLeads(orgId);
    let deletedCount = 0;

    // Delete only leads that exist and belong to org
    uniqueIds.forEach(id => {
      const index = userLeads.findIndex((l: any) => l.id === id);
      if (index !== -1) {
        userLeads.splice(index, 1);
        deletedCount++;
      }
      // Silently ignore not-found (already deleted or wrong org)
    });

    return res.json({
      success: true,
      deletedCount,
      items: userLeads,  // Return updated list (matches single delete pattern)
    });
  }

  // Production: delete from DB
  if (!pool) {
    return res.status(500).json({ error: "Database connection unavailable" });
  }

  try {
    // Delete leads that belong to org (BOLA protection)
    const deleteResult = await pool.query(
      `DELETE FROM "Lead"
       WHERE "orgId" = $1
         AND "id" = ANY($2::text[])
       RETURNING "id"`,
      [orgId, uniqueIds]
    );

    const deletedCount = deleteResult.rowCount || 0;

    // Fetch updated list (org-scoped, deterministic order)
    const leadsResult = await pool.query(
      `SELECT *, COALESCE(temperature, 'cold') AS temperature 
       FROM "Lead" 
       WHERE "orgId" = $1 
       ORDER BY "createdAt" DESC`,
      [orgId]
    );

    return res.json({
      success: true,
      deletedCount,
      items: leadsResult.rows,
    });
  } catch (dbError) {
    console.error("[LEADS] Bulk delete failed:", dbError);
    return res.status(500).json({ error: "Failed to delete leads" });
  }
});
