/**
 * Admin Security Routes
 * 
 * Administrative endpoints for user account safety and session management.
 * Requires both JWT authentication (via requireAuth) and ADMIN_API_KEY.
 */

import express from "express";
import { pool } from "../db/pool.js";
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";
import { invalidateUserAccessCache } from "../middleware/requireAuth.js";

export const adminSecurityRouter = express.Router();

/**
 * Admin authentication guard
 * 
 * Requires:
 * 1. JWT authentication (req.user must exist from requireAuth)
 * 2. ADMIN_API_KEY header
 * 3. Admin identity check (email domain or user allowlist)
 */
function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const adminKey = req.headers["x-admin-key"] as string;
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    console.error("[ADMIN] ADMIN_API_KEY not configured");
    return res.status(500).json({ error: "Admin functionality not configured" });
  }

  if (!adminKey || adminKey !== expectedKey) {
    logSecurityEvent({
      event_type: "access_denied",
      user_id: (req as any).user?.id || null,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 403,
      reason: "invalid_admin_key",
    }).catch(() => {});
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!(req as any).user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Admin identity check: email domain (simplest approach)
  const adminEmailDomain = process.env.ADMIN_EMAIL_DOMAIN;
  const userEmail = (req as any).user?.email;
  const attemptedAction = `${req.method} ${req.path}`;

  let isAdmin = false;
  if (adminEmailDomain && userEmail) {
    isAdmin = userEmail.endsWith(`@${adminEmailDomain}`);
  }

  // Fallback: user allowlist (if ADMIN_USER_IDS env var is set)
  if (!isAdmin) {
    const adminUserIds = process.env.ADMIN_USER_IDS;
    if (adminUserIds) {
      const allowedIds = new Set(adminUserIds.split(',').map((id: string) => id.trim()));
      isAdmin = allowedIds.has((req as any).user.id);
    }
  }

  if (!isAdmin) {
    logSecurityEvent({
      event_type: "admin_unauthorized_attempt",
      user_id: (req as any).user.id,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 403,
      reason: "unauthorized_admin_access",
      meta: {
        caller_user_id: (req as any).user.id,
        attempted_action: attemptedAction,
      },
    }).catch(() => {});
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

// Apply admin auth guard to all routes
adminSecurityRouter.use(requireAdminAuth);

/**
 * POST /api/admin/security/disable-user
 * 
 * Disables a user account and forces logout via session_version bump.
 */
adminSecurityRouter.post("/disable-user", async (req, res) => {
  try {
    const { userId, reason } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    // Disable user and increment session_version (forces logout)
    const result = await pool.query(
      `UPDATE "User" 
       SET status = 'disabled', 
           disabled_at = NOW(),
           session_version = session_version + 1,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, status, session_version`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Invalidate cache to ensure immediate enforcement
    invalidateUserAccessCache(userId);

    // Log admin action
    await logSecurityEvent({
      event_type: "admin_user_disabled",
      user_id: (req as any).user.id,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 200,
      meta: {
        target_user_id: userId,
        reason: reason || null,
      },
    });

    res.json({ success: true, user: result.rows[0] });
  } catch (error: any) {
    console.error("[ADMIN] Error disabling user:", error);
    res.status(500).json({ error: "Failed to disable user" });
  }
});

/**
 * POST /api/admin/security/enable-user
 * 
 * Re-enables a user account.
 */
adminSecurityRouter.post("/enable-user", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    // Enable user
    const result = await pool.query(
      `UPDATE "User" 
       SET status = 'active', 
           disabled_at = NULL,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, status`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Invalidate cache to ensure immediate enforcement
    invalidateUserAccessCache(userId);

    // Log admin action
    await logSecurityEvent({
      event_type: "admin_user_enabled",
      user_id: (req as any).user.id,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 200,
      meta: {
        target_user_id: userId,
      },
    });

    res.json({ success: true, user: result.rows[0] });
  } catch (error: any) {
    console.error("[ADMIN] Error enabling user:", error);
    res.status(500).json({ error: "Failed to enable user" });
  }
});

/**
 * POST /api/admin/security/lock-user
 * 
 * Locks a user account (soft or hard).
 */
adminSecurityRouter.post("/lock-user", async (req, res) => {
  try {
    const { userId, state, minutes, reason } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!state || !['soft', 'hard'].includes(state)) {
      return res.status(400).json({ error: "state must be 'soft' or 'hard'" });
    }

    let lockExpiresAt: Date | null = null;
    if (state === 'soft') {
      const lockMinutes = minutes || 60; // Default 60 minutes
      lockExpiresAt = new Date(Date.now() + lockMinutes * 60 * 1000);
    }

    // Lock user
    const result = await pool.query(
      `UPDATE "User" 
       SET lock_state = $1,
           lock_reason = $2,
           lock_expires_at = $3,
           "updatedAt" = NOW()
       WHERE id = $4
       RETURNING id, lock_state, lock_expires_at`,
      [state, reason || null, lockExpiresAt, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Invalidate cache to ensure immediate enforcement
    invalidateUserAccessCache(userId);

    // Log admin action
    await logSecurityEvent({
      event_type: "admin_user_locked",
      user_id: (req as any).user.id,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 200,
      meta: {
        target_user_id: userId,
        lock_state: state,
        lock_expires_at: lockExpiresAt?.toISOString() || null,
        reason: reason || null,
      },
    });

    res.json({ success: true, user: result.rows[0] });
  } catch (error: any) {
    console.error("[ADMIN] Error locking user:", error);
    res.status(500).json({ error: "Failed to lock user" });
  }
});

/**
 * POST /api/admin/security/unlock-user
 * 
 * Unlocks a user account.
 */
adminSecurityRouter.post("/unlock-user", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    // Unlock user
    const result = await pool.query(
      `UPDATE "User" 
       SET lock_state = 'none',
           lock_reason = NULL,
           lock_expires_at = NULL,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, lock_state`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Invalidate cache to ensure immediate enforcement
    invalidateUserAccessCache(userId);

    // Log admin action
    await logSecurityEvent({
      event_type: "admin_user_unlocked",
      user_id: (req as any).user.id,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 200,
      meta: {
        target_user_id: userId,
      },
    });

    res.json({ success: true, user: result.rows[0] });
  } catch (error: any) {
    console.error("[ADMIN] Error unlocking user:", error);
    res.status(500).json({ error: "Failed to unlock user" });
  }
});

/**
 * POST /api/admin/security/revoke-token
 * 
 * Revokes a specific token by jti.
 */
adminSecurityRouter.post("/revoke-token", async (req, res) => {
  try {
    const { userId, jti, exp, reason } = req.body;

    if (!userId || !jti || !exp) {
      return res.status(400).json({ error: "userId, jti, and exp are required" });
    }

    // Convert exp (Unix timestamp) to Date
    const expiresAt = new Date(exp * 1000);

    // Insert into revoked_tokens
    await pool.query(
      `INSERT INTO revoked_tokens (jti, user_id, expires_at, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, userId, expiresAt, reason || null]
    );

    // Log admin action
    await logSecurityEvent({
      event_type: "admin_token_revoked",
      user_id: (req as any).user.id,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 200,
      meta: {
        target_user_id: userId,
        jti: jti,
        reason: reason || null,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("[ADMIN] Error revoking token:", error);
    res.status(500).json({ error: "Failed to revoke token" });
  }
});

/**
 * POST /api/admin/security/logout-user
 * 
 * Forces logout by incrementing session_version (invalidates all tokens).
 */
adminSecurityRouter.post("/logout-user", async (req, res) => {
  try {
    const { userId, reason } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    // Increment session_version (forces logout of all sessions)
    const result = await pool.query(
      `UPDATE "User" 
       SET session_version = session_version + 1,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, session_version`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Invalidate cache to ensure immediate enforcement
    invalidateUserAccessCache(userId);

    // Log admin action
    await logSecurityEvent({
      event_type: "admin_forced_logout",
      user_id: (req as any).user.id,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 200,
      meta: {
        target_user_id: userId,
        reason: reason || null,
        new_session_version: result.rows[0].session_version,
      },
    });

    res.json({ success: true, user: result.rows[0] });
  } catch (error: any) {
    console.error("[ADMIN] Error forcing logout:", error);
    res.status(500).json({ error: "Failed to force logout" });
  }
});

/**
 * POST /api/admin/security/cleanup-revoked-tokens
 * 
 * Manually clean up expired revoked tokens.
 * No automation - must be called explicitly.
 */
adminSecurityRouter.post("/cleanup-revoked-tokens", async (req, res) => {
  try {
    // Delete expired revoked tokens
    const result = await pool.query(
      `DELETE FROM revoked_tokens WHERE expires_at < NOW() RETURNING jti`
    );

    const deletedCount = result.rows.length;

    // Log admin action
    await logSecurityEvent({
      event_type: "admin_revoked_tokens_cleanup",
      user_id: (req as any).user.id,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 200,
      meta: {
        deleted_count: deletedCount,
      },
    });

    res.json({ success: true, deleted_count: deletedCount });
  } catch (error: any) {
    console.error("[ADMIN] Error cleaning up revoked tokens:", error);
    res.status(500).json({ error: "Failed to cleanup revoked tokens" });
  }
});

