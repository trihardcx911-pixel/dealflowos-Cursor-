/**
 * User Profile API Routes
 * 
 * GET /api/user/me - Get current user profile
 * PATCH /api/user/me - Update current user profile
 * 
 * BOLA-safe: All operations use req.user.id (never accept userId from client)
 * Rate-limited: Mounted with apiRateLimiter in server.ts
 * Auth-required: Mounted with requireAuth in server.ts
 */

import { Router, Request, Response } from "express";
import { pool } from "../db/pool.js";

export const userRouter = Router();

/**
 * Schema map for User table identifiers (cached after first detection)
 */
type UserSchemaMap = {
  tableIdent: string;
  createdExpr: string;
  updatedExpr: string;
  updatedAtColumn: string | null;
  displayNameExpr: string;
  photoUrlExpr: string;
  displayNameColumn: string | null;
  photoUrlColumn: string | null;
};

let USER_SCHEMA_MAP: UserSchemaMap | null = null;

/**
 * Detect and cache User table schema (table name, column names)
 * Never throws - falls back to safe defaults if detection fails
 */
async function getUserSchemaMap(): Promise<UserSchemaMap> {
  // Return cached schema if available
  if (USER_SCHEMA_MAP) {
    return USER_SCHEMA_MAP;
  }

  // Regex for safe SQL identifiers (A-Z, a-z, 0-9, underscore, starting with letter/underscore)
  const identifierRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;

  try {
    // Step 1: Detect table name across schemas (prefer 'public')
    const tableResult = await pool.query(
      `SELECT table_schema, table_name 
       FROM information_schema.tables 
       WHERE table_name IN ('User', 'user')
       ORDER BY CASE WHEN table_schema = 'public' THEN 0 ELSE 1 END,
                table_name DESC
       LIMIT 1`
    );

    if (tableResult.rows.length === 0) {
      throw new Error("User table not found");
    }

    const tableSchema = tableResult.rows[0].table_schema;
    const tableName = tableResult.rows[0].table_name;
    
    // Validate identifiers
    if (!identifierRegex.test(tableSchema) || !identifierRegex.test(tableName)) {
      throw new Error(`Invalid table identifier: ${tableSchema}.${tableName}`);
    }

    const tableIdent = `"${tableSchema}"."${tableName}"`;

    // Step 2: Fetch ALL columns for this table to preserve exact casing
    const columnResult = await pool.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = $1 
         AND table_name = $2`,
      [tableSchema, tableName]
    );

    // Build lowercase -> original casing map
    const lowerToOriginal = new Map<string, string>();
    columnResult.rows.forEach((row) => {
      const colName = row.column_name;
      lowerToOriginal.set(colName.toLowerCase(), colName);
    });

    // Resolve column names preserving exact casing
    const resolveColumn = (candidates: string[]): string | null => {
      for (const candidate of candidates) {
        const original = lowerToOriginal.get(candidate.toLowerCase());
        if (original && identifierRegex.test(original)) {
          return original;
        }
      }
      return null;
    };

    // Timestamp columns
    const createdCol = resolveColumn(['createdAt', 'created_at', 'createdat']);
    const updatedCol = resolveColumn(['updatedAt', 'updated_at', 'updatedat']);

    // Profile columns
    const displayNameCol = resolveColumn(['display_name', 'displayName', 'name']);
    const photoUrlCol = resolveColumn(['photo_url', 'photoUrl', 'avatar_url']);

    // Build expressions (use NULL fallback if column missing)
    const createdExpr = createdCol ? `"${createdCol}"` : 'NULL::timestamp';
    const updatedExpr = updatedCol ? `"${updatedCol}"` : 'NULL::timestamp';
    const displayNameExpr = displayNameCol ? `"${displayNameCol}"` : 'NULL::text';
    const photoUrlExpr = photoUrlCol ? `"${photoUrlCol}"` : 'NULL::text';

    // Cache and return
    USER_SCHEMA_MAP = {
      tableIdent,
      createdExpr,
      updatedExpr,
      updatedAtColumn: updatedCol,
      displayNameExpr,
      photoUrlExpr,
      displayNameColumn: displayNameCol,
      photoUrlColumn: photoUrlCol,
    };

    return USER_SCHEMA_MAP;
  } catch (error: any) {
    // Log error only if diagnostics enabled
    if (process.env.DEV_DIAGNOSTICS === "1") {
      console.error("[USER API] getUserSchemaMap: detection failed, using fallback", {
        name: error?.name || null,
        message: error?.message || null,
        code: error?.code || null,
      });
    }

    // Safe fallback - never throw
    USER_SCHEMA_MAP = {
      tableIdent: '"public"."User"',
      createdExpr: '"createdAt"',
      updatedExpr: '"updatedAt"',
      updatedAtColumn: 'updatedAt',
      displayNameExpr: '"display_name"',
      photoUrlExpr: '"photo_url"',
      displayNameColumn: 'display_name',
      photoUrlColumn: 'photo_url',
    };

    return USER_SCHEMA_MAP;
  }
}

/**
 * Log database errors with safe, non-sensitive metadata
 */
function logDbError(context: string, err: any): void {
  console.error(`[USER API] ${context} - DB Error:`, {
    name: err?.name || null,
    message: err?.message || null,
    code: err?.code || null, // SQLSTATE (e.g., "42P01", "42703")
    detail: err?.detail || null,
    hint: err?.hint || null,
    where: err?.where || null,
    table: err?.table || null,
    column: err?.column || null,
    constraint: err?.constraint || null,
    schema: err?.schema || null,
  });
}

/**
 * Convert DB timestamp to ISO string safely
 */
function toIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/**
 * GET /api/user/me
 * Get current user profile
 * 
 * Response: { ok: true, user: { id, email, displayName, photoUrl, activeOrgId, createdAt, updatedAt } }
 */
userRouter.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        code: "UNAUTHENTICATED",
        error: "Unauthorized",
      });
    }

    // Get schema map (table name and timestamp column expressions)
    const schema = await getUserSchemaMap();

    // Optional debug logging
    if (process.env.DEV_DIAGNOSTICS === "1") {
      console.log("[USER API] schemaMap", {
        tableIdent: schema.tableIdent,
        createdExpr: schema.createdExpr,
        updatedExpr: schema.updatedExpr,
        updatedAtColumn: schema.updatedAtColumn,
        hasDisplayName: !!schema.displayNameColumn,
        hasPhotoUrl: !!schema.photoUrlColumn,
      });
    }

    // Query user profile (only profile fields, no billing/security fields)
    const result = await pool.query(
      `SELECT id, email, 
              ${schema.displayNameExpr} AS display_name,
              ${schema.photoUrlExpr} AS photo_url,
              ${schema.createdExpr} AS "createdAt",
              ${schema.updatedExpr} AS "updatedAt"
       FROM ${schema.tableIdent}
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    const userRow = result.rows[0];

    // Transform snake_case to camelCase
    const user = {
      id: userRow.id,
      email: userRow.email || null,
      displayName: userRow.display_name ?? null,
      photoUrl: userRow.photo_url ?? null,
      activeOrgId: req.user?.orgId || null,
      createdAt: toIso(userRow.createdAt),
      updatedAt: toIso(userRow.updatedAt),
    };

    return res.json({
      ok: true,
      user,
    });
  } catch (error: any) {
    logDbError("USER_ME_GET", error);
    return res.status(500).json({
      ok: false,
      code: "USER_PROFILE_FAILED",
      error: "Failed to fetch user profile",
    });
  }
});

/**
 * PATCH /api/user/me
 * Update current user profile
 * 
 * Request body: { displayName?: string | null, photoUrl?: string | null }
 * Response: { ok: true, user: { ... } } (same shape as GET)
 */
userRouter.patch("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        code: "UNAUTHENTICATED",
        error: "Unauthorized",
      });
    }

    // Check for forbidden fields
    const forbiddenFields = ["email", "phone", "password"];
    const providedForbiddenFields = forbiddenFields.filter((field) => req.body[field] !== undefined);
    
    if (providedForbiddenFields.length > 0) {
      const field = providedForbiddenFields[0];
      let code: string;
      let errorMessage: string;
      
      switch (field) {
        case "email":
          code = "EMAIL_CHANGE_UNSUPPORTED";
          errorMessage = "Email changes are not supported. Use Firebase Auth to change email.";
          break;
        case "phone":
          code = "PHONE_UNSUPPORTED";
          errorMessage = "Phone number is not supported yet.";
          break;
        case "password":
          code = "PASSWORD_UNSUPPORTED";
          errorMessage = "Password changes are not supported. Use Firebase Auth to change password.";
          break;
        default:
          code = "VALIDATION_ERROR";
          errorMessage = `Field '${field}' is not allowed.`;
      }
      
      return res.status(400).json({
        ok: false,
        code,
        error: errorMessage,
      });
    }

    // Validate request body is an object
    if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Request body must be an object",
      });
    }

    // Extract and validate allowed fields
    let displayName: string | null = null;
    let photoUrl: string | null = null;
    let hasUpdates = false;

    // Validate displayName
    if (req.body.displayName !== undefined) {
      if (req.body.displayName === null) {
        displayName = null;
        hasUpdates = true;
      } else if (typeof req.body.displayName === "string") {
        const trimmed = req.body.displayName.trim();
        if (trimmed === "") {
          displayName = null;
        } else {
          if (trimmed.length > 255) {
            return res.status(400).json({
              ok: false,
              code: "VALIDATION_ERROR",
              error: "displayName must be 255 characters or less",
            });
          }
          displayName = trimmed;
        }
        hasUpdates = true;
      } else {
        return res.status(400).json({
          ok: false,
          code: "VALIDATION_ERROR",
          error: "displayName must be a string or null",
        });
      }
    }

    // Validate photoUrl
    if (req.body.photoUrl !== undefined) {
      if (req.body.photoUrl === null) {
        photoUrl = null;
        hasUpdates = true;
      } else if (typeof req.body.photoUrl === "string") {
        const trimmed = req.body.photoUrl.trim();
        if (trimmed === "") {
          photoUrl = null;
        } else {
          if (trimmed.length > 2048) {
            return res.status(400).json({
              ok: false,
              code: "VALIDATION_ERROR",
              error: "photoUrl must be 2048 characters or less",
            });
          }
          photoUrl = trimmed;
        }
        hasUpdates = true;
      } else {
        return res.status(400).json({
          ok: false,
          code: "VALIDATION_ERROR",
          error: "photoUrl must be a string or null",
        });
      }
    }

    // Check if there are any valid fields to update
    if (!hasUpdates) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        error: "No valid fields to update",
      });
    }

    // Get schema map (table name and timestamp column expressions)
    const schema = await getUserSchemaMap();

    // Check column existence before attempting SET
    if (req.body.displayName !== undefined && !schema.displayNameColumn) {
      return res.status(500).json({
        ok: false,
        code: "USER_SCHEMA_MISMATCH",
        error: "Profile schema missing displayName column",
      });
    }

    if (req.body.photoUrl !== undefined && !schema.photoUrlColumn) {
      return res.status(500).json({
        ok: false,
        code: "USER_SCHEMA_MISMATCH",
        error: "Profile schema missing photoUrl column",
      });
    }

    // Build dynamic UPDATE query (only update fields that were provided)
    const updateParts: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (req.body.displayName !== undefined && schema.displayNameColumn) {
      updateParts.push(`"${schema.displayNameColumn}" = $${paramIndex}`);
      updateValues.push(displayName);
      paramIndex++;
    }

    if (req.body.photoUrl !== undefined && schema.photoUrlColumn) {
      updateParts.push(`"${schema.photoUrlColumn}" = $${paramIndex}`);
      updateValues.push(photoUrl);
      paramIndex++;
    }

    // Always update updatedAt (use schema column name if available)
    if (schema.updatedAtColumn) {
      updateParts.push(`"${schema.updatedAtColumn}" = NOW()`);
    }

    // Add userId for WHERE clause (use next param index)
    const whereParamIndex = paramIndex;
    updateValues.push(userId);

    const updateQuery = `
      UPDATE ${schema.tableIdent}
      SET ${updateParts.join(", ")}
      WHERE id = $${whereParamIndex}
      RETURNING id, email, 
                ${schema.displayNameExpr} AS display_name,
                ${schema.photoUrlExpr} AS photo_url,
                ${schema.createdExpr} AS "createdAt",
                ${schema.updatedExpr} AS "updatedAt"
    `;

    const result = await pool.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    const userRow = result.rows[0];

    // Transform snake_case to camelCase
    const user = {
      id: userRow.id,
      email: userRow.email || null,
      displayName: userRow.display_name ?? null,
      photoUrl: userRow.photo_url ?? null,
      activeOrgId: req.user?.orgId || null,
      createdAt: toIso(userRow.createdAt),
      updatedAt: toIso(userRow.updatedAt),
    };

    return res.json({
      ok: true,
      user,
    });
  } catch (error: any) {
    logDbError("USER_ME_PATCH", error);
    return res.status(500).json({
      ok: false,
      code: "USER_PROFILE_FAILED",
      error: "Failed to update user profile",
    });
  }
});

