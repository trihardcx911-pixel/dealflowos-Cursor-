/**
 * Require Authentication Middleware
 * 
 * Enforces application access by verifying JWT app session tokens and checking access permissions.
 * Attaches user information to the request object for use in route handlers.
 */

import { Request, Response, NextFunction } from "express";
import { verifyAppToken, JWT_SECRET, AppTokenPayload } from "../auth/jwtService.js";
import { verifySessionCookie } from "../auth/firebaseAdmin.js";
import { pool } from "../db/pool.js";
import { SessionUser } from "../auth/sessionService.js";
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";
import { detectTokenAbuse } from "../security/anomalyDetector.js";
import jwt from "jsonwebtoken";

// In-memory cache for user access state (reduces DB reads)
interface UserAccessCache {
  status: string;
  plan: string;
  trial_ends_at: Date | null;
  session_version: number;
  lock_state: string;
  lock_expires_at: Date | null;
  billingStatus: string | null;
  cancelAtPeriodEnd: boolean | null;
  currentPeriodEnd: Date | null;
  cachedAt: number;
}

const userAccessCache = new Map<string, UserAccessCache>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

// DEV-only diagnostics helper (runtime check)
const DIAG = () => process.env.DEV_DIAGNOSTICS === "1";
const IS_DEV = () => process.env.NODE_ENV !== "production";

/**
 * Parse value to Date safely (ISO string or Date; null/undefined safe).
 */
function toDateSafe(val: Date | string | null | undefined): Date | null {
  if (val == null) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

// In-memory flags to cache "table missing" state (avoid repeated queries/logs)
let REVOKED_TOKENS_MISSING = false;
let SECURITY_EVENTS_MISSING = false;

/**
 * Extract Postgres error code from error object (checks multiple nested paths)
 */
function pgCode(err: any): string | null {
  return err?.code || err?.cause?.code || err?.original?.code || null;
}

/**
 * Extract relation/table name from error (if available)
 */
function pgRelation(err: any): string | null {
  // Prefer explicit fields, fallback to parsing message
  return err?.table || err?.relation || err?.schemaTable || null;
}

/**
 * Check if error is Postgres "undefined table" (code 42P01)
 */
function isUndefinedTable(err: any): boolean {
  const c = pgCode(err);
  if (c === "42P01") return true;
  const msg = String(err?.message || "");
  return msg.includes("does not exist") && msg.includes("relation");
}

/**
 * Check if error is specifically for a missing table by name
 */
function isMissingTable(err: any, tableName: string): boolean {
  if (!isUndefinedTable(err)) return false;
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes(`relation "${tableName}" does not exist`) || 
         msg.includes(`relation '${tableName}' does not exist`) ||
         msg.includes(`relation ${tableName} does not exist`);
}

/**
 * Invalidate user access cache (exported for admin routes)
 * 
 * Called after admin actions that mutate user state to ensure immediate enforcement.
 */
export function invalidateUserAccessCache(userId: string): void {
  userAccessCache.delete(userId);
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/**
 * Enforce Stripe billing access rules
 * 
 * Returns { ok: true } if access allowed, or { ok: false, status, body } if denied.
 * Time-based: denies if trialEnd or currentPeriodEnd has passed even when billingStatus is trialing/active.
 */
function enforceBillingAccess(userAccess: UserAccessCache): { ok: boolean; status?: number; body?: any } {
  const now = new Date();
  const billingStatus = userAccess.billingStatus;
  const trialEndDate = toDateSafe(userAccess.trial_ends_at);
  const periodEndDate = toDateSafe(userAccess.currentPeriodEnd);

  // Time-based: trialing but trial end has passed => deny
  if (billingStatus === 'trialing' && trialEndDate && now > trialEndDate) {
    if (DIAG()) {
      console.log('[BILLING DIAG] entitlement expired (trial)', {
        billingStatus,
        trialEnd: trialEndDate.toISOString(),
        currentPeriodEnd: periodEndDate ? periodEndDate.toISOString() : null,
        nowIso: now.toISOString(),
        trialExpired: true,
        periodExpired: periodEndDate ? now > periodEndDate : false,
      });
    }
    return {
      ok: false,
      status: 402,
      body: { error: 'Subscription required', code: 'BILLING_REQUIRED' },
    };
  }

  // Time-based: active/trialing/past_due but current period has ended => deny
  if (
    (billingStatus === 'active' || billingStatus === 'trialing' || billingStatus === 'past_due') &&
    periodEndDate &&
    now > periodEndDate
  ) {
    if (DIAG()) {
      console.log('[BILLING DIAG] entitlement expired (period)', {
        billingStatus,
        trialEnd: trialEndDate ? trialEndDate.toISOString() : null,
        currentPeriodEnd: periodEndDate.toISOString(),
        nowIso: now.toISOString(),
        trialExpired: trialEndDate ? now > trialEndDate : false,
        periodExpired: true,
      });
    }
    return {
      ok: false,
      status: 402,
      body: { error: 'Subscription required', code: 'BILLING_REQUIRED' },
    };
  }

  // Dev-only diagnostic when entitlement not expired
  if (DIAG() && (billingStatus === 'active' || billingStatus === 'trialing' || billingStatus === 'past_due')) {
    console.log('[BILLING DIAG] entitlement check', {
      billingStatus,
      trialEnd: trialEndDate ? trialEndDate.toISOString() : null,
      currentPeriodEnd: periodEndDate ? periodEndDate.toISOString() : null,
      nowIso: now.toISOString(),
      trialExpired: trialEndDate ? now > trialEndDate : false,
      periodExpired: periodEndDate ? now > periodEndDate : false,
    });
  }

  // Safety check: if cancelAtPeriodEnd is true and currentPeriodEnd has passed (+ 5 min buffer)
  if (userAccess.cancelAtPeriodEnd === true && periodEndDate) {
    const periodEndWithBuffer = new Date(periodEndDate.getTime() + 5 * 60 * 1000); // +5 minutes
    if (now > periodEndWithBuffer) {
      return {
        ok: false,
        status: 402,
        body: {
          error: 'Subscription required',
          code: 'BILLING_REQUIRED',
        },
      };
    }
  }

  // ALLOW: active, trialing, past_due (grace period) — time checks above already handled expired
  if (billingStatus === 'active' || billingStatus === 'trialing' || billingStatus === 'past_due') {
    return { ok: true };
  }

  // DENY: canceled, unpaid, incomplete_expired, incomplete
  if (billingStatus === 'canceled' || 
      billingStatus === 'unpaid' || 
      billingStatus === 'incomplete_expired' || 
      billingStatus === 'incomplete') {
    return {
      ok: false,
      status: 402,
      body: {
        error: 'Subscription required',
        code: 'BILLING_REQUIRED',
      },
    };
  }

  // Unknown status: deny (fail closed)
  return {
    ok: false,
    status: 402,
    body: {
      error: 'Subscription required',
      code: 'BILLING_REQUIRED',
    },
  };
}

/**
 * Middleware that requires authentication and valid access permissions
 * 
 * Behavior:
 * 1. Extracts JWT app session token from Authorization header
 * 2. Verifies JWT signature and expiry
 * 3. Fetches current user access state from DB (with cache)
 * 4. Enforces access permissions (trial expiry, account status, plan)
 * 5. Attaches user to request object
 * 6. Allows request to continue if access is granted
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Step tracking for diagnostics
  let step = "enter";
  
  // Entry diagnostics - always print when enabled (proves flag is read)
  if (DIAG()) {
    console.log("[AUTH DIAG] enter", {
      path: req.originalUrl,
      method: req.method,
    });
  }

  // ============================================================
  // CHECK FOR REAL AUTH FIRST (Authorization header takes precedence)
  // ============================================================
  const authHeader = req.headers.authorization;
  const hasBearer = authHeader?.startsWith("Bearer ") && authHeader.slice(7).trim().length > 0;
  
  // Compute client IP early (needed for dev bypass localhost check)
  const ip = getClientIp(req);
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('127.0.0.1:') || ip.startsWith('::1:');
  const devBypass = process.env.NODE_ENV === "development" 
    && process.env.DEV_AUTH_BYPASS === "1" 
    && isLocalhost;

  // Branch diagnostics - pinpoint which path is taken
  step = "bearer_check";
  if (DIAG()) {
    console.log("[AUTH DIAG] branch", {
      hasBearer: !!hasBearer,
      devBypassEnabled: devBypass,
    });
  }

  // Cookie-first: if dfos_session present, verify and apply same gates as JWT path (then fall through on failure)
  const sessionCookie = req.cookies?.dfos_session;
  if (sessionCookie) {
    try {
      const decodedClaims = await verifySessionCookie(sessionCookie, true);
      const firebaseUid = decodedClaims.uid;
      const userResult = await pool.query(
        `SELECT id, email, firebase_uid, status, plan, trial_ends_at, session_version, lock_state, lock_expires_at, "billingStatus", "cancelAtPeriodEnd", "currentPeriodEnd"
         FROM "User" WHERE firebase_uid = $1`,
        [firebaseUid]
      );
      if (userResult.rows.length === 0) {
        const isProd = process.env.NODE_ENV === "production";
        res.clearCookie("dfos_session", { path: "/", sameSite: isProd ? "none" : "lax", secure: isProd });
        // Fall through to Authorization / dev bypass
      } else {
        const user = userResult.rows[0];
        const userAccess: UserAccessCache = {
          status: user.status,
          plan: user.plan,
          trial_ends_at: user.trial_ends_at,
          session_version: user.session_version ?? 1,
          lock_state: user.lock_state ?? "none",
          lock_expires_at: user.lock_expires_at,
          billingStatus: user.billingStatus,
          cancelAtPeriodEnd: user.cancelAtPeriodEnd,
          currentPeriodEnd: user.currentPeriodEnd,
          cachedAt: Date.now(),
        };

        const nowDate = new Date();
        if (userAccess.lock_state === "hard") {
          const isProd = process.env.NODE_ENV === "production";
          res.clearCookie("dfos_session", { path: "/", sameSite: isProd ? "none" : "lax", secure: isProd });
          return res.status(403).json({ error: "Account restricted" });
        }
        if (userAccess.lock_state === "soft" && userAccess.lock_expires_at && nowDate < new Date(userAccess.lock_expires_at)) {
          const isProd = process.env.NODE_ENV === "production";
          res.clearCookie("dfos_session", { path: "/", sameSite: isProd ? "none" : "lax", secure: isProd });
          return res.status(403).json({ error: "Account restricted" });
        }

        const devBillingBypass = process.env.NODE_ENV !== "production" && process.env.DEV_BILLING_BYPASS === "1";
        if (!devBillingBypass && userAccess.billingStatus != null) {
          const billingCheck = enforceBillingAccess(userAccess);
          if (!billingCheck.ok) {
            return res.status(billingCheck.status ?? 402).json(billingCheck.body ?? { error: "Subscription required", code: "BILLING_REQUIRED" });
          }
        }

        let allowed = false;
        if (userAccess.status !== "active") {
          allowed = false;
        } else if (userAccess.plan === "trial") {
          allowed = !userAccess.trial_ends_at || new Date() < new Date(userAccess.trial_ends_at);
        } else if (["bronze", "silver", "gold"].includes(userAccess.plan)) {
          allowed = true;
        }
        if (!allowed) {
          const isProd = process.env.NODE_ENV === "production";
          res.clearCookie("dfos_session", { path: "/", sameSite: isProd ? "none" : "lax", secure: isProd });
          return res.status(403).json({ error: "Access denied" });
        }

        const resolvedOrgId = user.id; // MVP: 1:1
        req.user = {
          id: user.id,
          firebase_uid: user.firebase_uid,
          email: user.email,
          plan: user.plan,
          status: user.status,
          onboarding_complete: false,
        };
        req.user.orgId = resolvedOrgId;
        (req as { orgId?: string }).orgId = resolvedOrgId;
        res.locals.orgId = resolvedOrgId;
        (req.user as any).billingStatus = userAccess.billingStatus;
        (req.user as any).cancelAtPeriodEnd = userAccess.cancelAtPeriodEnd;
        (req.user as any).currentPeriodEnd = userAccess.currentPeriodEnd;
        (req.user as any).isPastDue = userAccess.billingStatus === "past_due";
        res.locals.user = req.user;
        if (DIAG()) {
          console.log("[AUTH RESOLVE] mode=SESSION_COOKIE", { userId: user.id, orgId: resolvedOrgId });
        }
        return next();
      }
    } catch (err: any) {
      // DIAGNOSTIC: Log session cookie verification/DB errors
      console.error("[AUTH] Session cookie verification/DB failed:", {
        error: err?.message?.substring(0, 200),
        code: err?.code,
        pgCode: pgCode(err),
        isFirebaseError: err?.errorInfo?.code || err?.code?.startsWith?.('auth/'),
        isDbError: err?.code && !err?.code?.startsWith?.('auth/'),
        path: req.path,
      });
      const isProd = process.env.NODE_ENV === "production";
      res.clearCookie("dfos_session", { path: "/", sameSite: isProd ? "none" : "lax", secure: isProd });
      // Fall through to Authorization header / dev bypass
    }
  }

  // If Authorization header is present, use real auth (skip dev bypass)
  if (hasBearer && authHeader) {
    const userAgent = getUserAgent(req);
    const path = req.path;
    const method = req.method;

    try {
      // Step 1: Extract JWT token from Authorization header (already validated by hasBearer check)
      const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix

      // Check token format and decode payload for diagnostics (before verify)
      const tokenParts = token.split('.');
      const tokenLooksJwt = tokenParts.length === 3;
      
      // Decode payload WITHOUT verification for diagnostics (safe - no secrets)
      let decodedPayload: any = null;
      if (DIAG()) {
        try {
          decodedPayload = jwt.decode(token);
        } catch {
          // Ignore decode errors
        }
        if (decodedPayload) {
          console.log("[AUTH DIAG] Token payload (decoded, not verified):", {
            iss: decodedPayload.iss || null,
            sub: decodedPayload.sub || null,
            userId: decodedPayload.userId || null,
            orgId: decodedPayload.orgId ?? null,
          });
        }
      }

      // Step 2: Verify JWT token
      step = "jwt_verify";
      let decodedToken: AppTokenPayload;
      try {
        decodedToken = verifyAppToken(token);
      } catch (error: any) {
        // If token is not JWT format, return immediately with helpful message
        if (!tokenLooksJwt) {
          if (DIAG()) {
            console.warn("[AUTH DIAG] 401", {
              step,
              errorName: error.name || "unknown",
              errorMessage: error.message || "unknown",
              tokenLooksJwt: false,
            });
          }
          return res.status(401).json({ 
            error: 'Invalid token format. Clear localStorage token and log in again.' 
          });
        }
        
        // DEV-ONLY diagnostics (gated by DEV_DIAGNOSTICS=1)
        if (DIAG()) {
          // Import JWT secret meta helper
          const { getJwtSecretMeta } = await import("../auth/jwtService.js");
          const secretMeta = getJwtSecretMeta();
          
          console.warn("[AUTH DIAG] 401", {
            step,
            errorName: error.name || "unknown",
            errorMessage: error.message || "unknown",
            tokenLooksJwt,
            jwtSecretLength: secretMeta.jwtSecretLength,
          });
        }
        
        // Token is not a valid DealflowOS JWT
        // Log JWT invalid - do not log token content
        logSecurityEvent({
          event_type: "jwt_invalid",
          ip,
          user_agent: userAgent,
          path,
          method,
          status_code: 401,
          reason: error.message?.substring(0, 256) || "invalid_token",
        }).catch(() => {}); // Ignore errors
        (req as any)._securityLogged = true; // Prevent double-logging

        // Try to extract user ID from token for anomaly detection (best-effort)
        // If token is malformed, userId will be null and detection will skip
        let userIdForDetection: string | null = null;
        try {
          // Attempt to decode token without verification to get userId
          // This is safe because we're only using it for logging, not authorization
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            userIdForDetection = payload.userId || payload.sub || null;
          }
        } catch {
          // Ignore - token is too malformed to extract userId
        }

        // Anomaly detection (log-only, non-blocking)
        step = "anomaly_checks";
        // Skip if table is known to be missing (dev only)
        if (userIdForDetection && !SECURITY_EVENTS_MISSING) {
          detectTokenAbuse(userIdForDetection, ip).catch((err: any) => {
            // In dev only: cache "table missing" state and log
            if (IS_DEV() && isMissingTable(err, "security_events")) {
              SECURITY_EVENTS_MISSING = true;
              if (DIAG()) {
                console.warn("[AUTH DIAG] security_events missing; disabling anomaly checks in dev");
              }
            }
            // Otherwise silently ignore (existing behavior - non-blocking)
          });
        }

        // Return more specific error message
        const errorMsg = error.message || "";
        const errorResponse: any = { error: "Authentication verification failed" };
        if (errorMsg.includes("expired") || errorMsg.includes("Token has expired")) {
          errorResponse.error = "Token has expired";
        }
        if (DIAG()) {
          errorResponse.step = 'jwt_verify';
          errorResponse.reason = errorMsg.slice(0, 120);
        }
        return res.status(401).json(errorResponse);
      }

      const userId = decodedToken.userId;
      const tokenJti = decodedToken.jti;
      const tokenSessionVersion = decodedToken.sv || 1; // Fallback for old tokens

      // Step 2a: Check token revocation (denylist)
      step = "revocation_check";
      // Skip revocation check if table is known to be missing (cached across all envs)
      if (REVOKED_TOKENS_MISSING) {
        // Skip query entirely - table is missing (fail-open)
      } else {
        try {
          const revokedCheck = await pool.query(
            `SELECT jti FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW()`,
            [tokenJti]
          );

          if (revokedCheck.rows.length > 0) {
            // Token is revoked
            logSecurityEvent({
              event_type: "session_revoked",
              user_id: userId,
              ip,
              user_agent: userAgent,
              path,
              method,
              status_code: 401,
              reason: "token_revoked",
              meta: { jti: tokenJti },
            }).catch(() => {});
            (req as any)._securityLogged = true;
            return res.status(401).json({ error: 'Session token has been revoked' });
          }
        } catch (error: any) {
          // Fail-open for missing revocation table (optional security feature)
          // MVP: revocation is opt-in; missing table should not block auth/payments
          if (isMissingTable(error, "revoked_tokens")) {
            // Cache the "table missing" state to avoid repeated queries
            REVOKED_TOKENS_MISSING = true;
            console.warn("[AUTH] revoked_tokens table missing; treating token as not revoked (fail-open)", {
              path: req.path,
              userId: userId?.substring(0, 8) + '...',
              pgCode: pgCode(error),
            });
            // Treat as "not revoked" and continue auth
          } else {
            // Other DB errors (connection failures, schema errors, etc.): return 503
            // DIAGNOSTIC: Log DB error details to help identify root cause
            console.error('[AUTH] Revocation check DB error:', {
              code: error?.code,
              message: error?.message?.substring(0, 200),
              pgCode: pgCode(error),
              isUndefinedTable: pgCode(error) === "42P01",
              isUndefinedColumn: pgCode(error) === "42703",
              path: req.path,
              userId: userId?.substring(0, 8) + '...',
            });

            const errorResponse: any = {
              error: 'Auth subsystem unavailable',
              code: 'AUTH_DB_UNAVAILABLE',
              step: 'revocation_check'
            };
            if (DIAG()) {
              errorResponse.reason = String(error?.message || "").slice(0, 120);
            }

            logSecurityEvent({
              event_type: "auth_db_error",
              user_id: userId,
              ip,
              user_agent: userAgent,
              path,
              method,
              status_code: 503,
              reason: "revocation_check_failed",
              meta: { error: error.message?.substring(0, 256) || "unknown" },
            }).catch(() => {});
            (req as any)._securityLogged = true;
            return res.status(503).json(errorResponse);
          }
        }
      }

      // Step 3: Fetch user access state from DB (with cache)
      step = "user_access_check";
      let userAccess: UserAccessCache | null = userAccessCache.get(userId) || null;
      const now = Date.now();

      // Check cache validity
      if (!userAccess || now - userAccess.cachedAt > CACHE_TTL_MS) {
        // Cache miss or expired, fetch from DB (include session_version and lock fields)
        let userResult;
        try {
          userResult = await pool.query(
            `SELECT status, plan, trial_ends_at, session_version, lock_state, lock_expires_at,
                    "billingStatus", "cancelAtPeriodEnd", "currentPeriodEnd"
             FROM "User" WHERE id = $1`,
            [userId]
          );
        } catch (error: any) {
          // DB error - return appropriate status code (not 401)
          const pgErrCode = pgCode(error);
          const isSchemaError = pgErrCode === "42P01" || pgErrCode === "42703";

          // DIAGNOSTIC: Log DB error details to help identify root cause
          console.error('[AUTH] User access check DB error:', {
            code: error?.code,
            message: error?.message?.substring(0, 200),
            pgCode: pgErrCode,
            isUndefinedTable: pgErrCode === "42P01",
            isUndefinedColumn: pgErrCode === "42703",
            isSchemaError,
            path: req.path,
            userId: userId?.substring(0, 8) + '...',
            query: 'SELECT status, plan, trial_ends_at, ... FROM "User" WHERE id = $1',
          });

          const errorResponse: any = isSchemaError
            ? { error: 'Database schema error', code: 'SCHEMA_MISMATCH', step: 'user_access_check' }
            : { error: 'Auth subsystem unavailable', code: 'AUTH_DB_UNAVAILABLE', step: 'user_access_check' };

          if (DIAG()) {
            errorResponse.reason = String(error?.message || "").slice(0, 120);
          }

          const statusCode = isSchemaError ? 500 : 503;
          
          logSecurityEvent({
            event_type: "auth_db_error",
            user_id: userId,
            ip,
            user_agent: userAgent,
            path,
            method,
            status_code: statusCode,
            reason: "user_lookup_failed",
            meta: { error: error.message?.substring(0, 256) || "unknown" },
          }).catch(() => {});
          (req as any)._securityLogged = true;
          return res.status(statusCode).json(errorResponse);
        }

        if (userResult.rows.length === 0) {
          logSecurityEvent({
            event_type: "access_denied",
            user_id: decodedToken.userId,
            ip,
            user_agent: userAgent,
            path,
            method,
            status_code: 401,
            reason: "user_not_found",
          }).catch(() => {}); // Ignore errors
          (req as any)._securityLogged = true; // Prevent double-logging
          return res.status(401).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        userAccess = {
          status: user.status,
          plan: user.plan,
          trial_ends_at: user.trial_ends_at,
          session_version: user.session_version || 1,
          lock_state: user.lock_state || 'none',
          lock_expires_at: user.lock_expires_at,
          billingStatus: user.billingStatus,
          cancelAtPeriodEnd: user.cancelAtPeriodEnd,
          currentPeriodEnd: user.currentPeriodEnd,
          cachedAt: now,
        };

        // Update cache
        userAccessCache.set(userId, userAccess);
      }

      // Step 2b: Verify session version matches (forced logout check)
      if (tokenSessionVersion !== userAccess.session_version) {
        logSecurityEvent({
          event_type: "session_version_mismatch",
          user_id: userId,
          ip,
          user_agent: userAgent,
          path,
          method,
          status_code: 401,
          reason: "session_invalidated",
          meta: {
            token_sv: tokenSessionVersion,
            current_sv: userAccess.session_version,
          },
        }).catch(() => {});
        (req as any)._securityLogged = true;
        return res.status(401).json({ error: 'Session has been invalidated. Please log in again.' });
      }

      // Step 3: Check lock state (soft/hard locks)
      const nowDate = new Date();
      if (userAccess.lock_state === 'hard') {
        // Hard lock: indefinite restriction
        logSecurityEvent({
          event_type: "account_hard_locked",
          user_id: userId,
          ip,
          user_agent: userAgent,
          path,
          method,
          status_code: 403,
          reason: "account_hard_locked",
        }).catch(() => {});
        (req as any)._securityLogged = true;
        return res.status(403).json({ error: 'Account restricted' });
      } else if (userAccess.lock_state === 'soft') {
        // Soft lock: check if expired
        if (userAccess.lock_expires_at) {
          const lockExpiry = new Date(userAccess.lock_expires_at);
          if (nowDate < lockExpiry) {
            // Still locked
            logSecurityEvent({
              event_type: "account_soft_locked",
              user_id: userId,
              ip,
              user_agent: userAgent,
              path,
              method,
              status_code: 403,
              reason: "account_soft_locked",
              meta: {
                lock_expires_at: userAccess.lock_expires_at.toISOString(),
              },
            }).catch(() => {});
            (req as any)._securityLogged = true;
            return res.status(403).json({ error: 'Account restricted' });
          } else {
            // Soft lock expired - auto-clear (best-effort)
            pool.query(
              `UPDATE "User" SET lock_state = 'none', lock_reason = NULL, lock_expires_at = NULL WHERE id = $1`,
              [userId]
            ).catch(() => {}); // Ignore errors
            // Clear cache
            userAccessCache.delete(userId);
            // Proceed with normal access check
          }
        } else {
          // Soft lock with no expiry - treat as hard lock
          logSecurityEvent({
            event_type: "account_soft_locked",
            user_id: userId,
            ip,
            user_agent: userAgent,
            path,
            method,
            status_code: 403,
            reason: "account_soft_locked",
          }).catch(() => {});
          (req as any)._securityLogged = true;
          return res.status(403).json({ error: 'Account restricted' });
        }
      }

      // Step 4: Enforce Stripe billing access (if billingStatus is present)
      // Check DEV_BILLING_BYPASS BEFORE enforceBillingAccess so we never return 402 in dev when bypass is on
      const devBillingBypass = process.env.NODE_ENV !== "production" && process.env.DEV_BILLING_BYPASS === "1";
      if (devBillingBypass) {
        if (process.env.NODE_ENV !== "production" && process.env.DEV_DIAGNOSTICS === "1") {
          console.log("[BILLING] DEV_BILLING_BYPASS active - skipping billing gate");
        }
        // skip billing enforcement entirely; continue to Step 4b
      } else if (userAccess.billingStatus !== null && userAccess.billingStatus !== undefined) {
        const billingCheck = enforceBillingAccess(userAccess);
        if (!billingCheck.ok) {
          logSecurityEvent({
            event_type: "access_denied",
            user_id: decodedToken.userId,
            ip,
            user_agent: userAgent,
            path,
            method,
            status_code: billingCheck.status || 402,
            reason: "billing_required",
            meta: {
              billingStatus: userAccess.billingStatus,
              cancelAtPeriodEnd: userAccess.cancelAtPeriodEnd,
              currentPeriodEnd: userAccess.currentPeriodEnd?.toISOString(),
            },
          }).catch(() => {});
          (req as any)._securityLogged = true;
          return res.status(billingCheck.status || 402).json(billingCheck.body || {
            error: 'Subscription required',
            code: 'BILLING_REQUIRED',
          });
        }
        // Billing check passed, continue to legacy checks (for account status, etc.)
      }

      // Step 4b: Enforce legacy access permissions (fallback for users without billingStatus)
      let allowed = false;
      let reason: string | null = null;

      if (userAccess.status !== 'active') {
        allowed = false;
        reason = 'account_disabled';
      } else if (userAccess.plan === 'trial') {
        // Check if trial has expired
        if (userAccess.trial_ends_at) {
          const trialEndDate = new Date(userAccess.trial_ends_at);
          allowed = new Date() < trialEndDate;
          if (!allowed) {
            reason = 'trial_expired';
          }
        } else {
          // No trial end date set, allow access
          allowed = true;
        }
      } else if (['bronze', 'silver', 'gold'].includes(userAccess.plan)) {
        allowed = true;
      } else {
        allowed = false;
        reason = 'invalid_plan';
      }

      if (!allowed) {
        // Log access denied (valid JWT but plan/trial/status denies)
        logSecurityEvent({
          event_type: "access_denied",
          user_id: decodedToken.userId,
          ip,
          user_agent: userAgent,
          path,
          method,
          status_code: 403,
          reason: reason || 'unknown',
          meta: {
            plan: userAccess.plan,
            status: userAccess.status,
          },
        }).catch(() => {}); // Ignore errors
        (req as any)._securityLogged = true; // Prevent double-logging
        return res.status(403).json({
          error: 'Access denied',
          reason: reason || 'unknown',
        });
      }

      // Step 5: Attach user to request
      req.user = {
        id: decodedToken.userId,
        firebase_uid: decodedToken.firebaseUid,
        email: decodedToken.email,
        plan: decodedToken.plan,
        status: userAccess.status,
        onboarding_complete: false, // Not stored in JWT, can be fetched if needed
      };

      // Resolve orgId from JWT; in production require it, in dev allow fallback to org_dev
      const resolvedOrgId = decodedToken.orgId
        ?? (process.env.NODE_ENV !== "production" || process.env.DEV_AUTH_BYPASS === "1" ? "org_dev" : null);
      if (resolvedOrgId == null) {
        return res.status(401).json({
          error: "Org scope required",
          hint: "Token missing orgId. Ensure session establishes org membership.",
        });
      }
      req.user.orgId = resolvedOrgId;
      (req as { orgId?: string }).orgId = resolvedOrgId;
      res.locals.orgId = resolvedOrgId;

      // DEV-only identity resolution log
      if (IS_DEV()) {
        console.log(`[AUTH RESOLVE] mode=JWT path=${req.path} user=${req.user.id} org=${resolvedOrgId}`);
      }
      
      // Attach billing fields to req.user for downstream UI
      (req.user as any).billingStatus = userAccess.billingStatus;
      (req.user as any).cancelAtPeriodEnd = userAccess.cancelAtPeriodEnd;
      (req.user as any).currentPeriodEnd = userAccess.currentPeriodEnd;
      (req.user as any).isPastDue = userAccess.billingStatus === 'past_due';
      
      res.locals.user = req.user;

      // Step 6: Allow request to continue
      step = "success";
      if (DIAG()) {
        console.log("[AUTH DIAG] ok", {
          path: req.originalUrl,
          method: req.method,
          userId: req.user?.id,
        });
      }
      next();
      return;
    } catch (error: any) {
      console.error('[AUTH] Middleware error:', error.message);

      // Database errors
      if (error.code && error.code.startsWith('23')) {
        return res.status(500).json({ error: 'Database constraint violation' });
      }

      // Generic server error
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ============================================================
  // DEV-ONLY AUTH BYPASS (only if no Authorization header present)
  // ============================================================
  // Note: devBypass was already computed above, reuse it
  if (devBypass) {
    // Extract dev headers if provided, or use defaults
    const devOrgId = req.headers["x-dev-org-id"] as string;
    const devUserId = req.headers["x-dev-user-id"] as string;
    const devUserEmail = req.headers["x-dev-user-email"] as string;

    const orgId = devOrgId || "org_dev";
    const userId = devUserId || "user_dev";
    const email = devUserEmail || "dev@example.com";

    // Populate user in all common locations
    req.user = {
      id: userId,
      orgId: orgId,
      firebase_uid: "firebase_dev",
      email: email,
      plan: "gold",
      status: "active",
      onboarding_complete: false,
    };
    (req.user as any).session_version = 1;
    (req as { orgId?: string }).orgId = orgId;
    res.locals.orgId = orgId;
    res.locals.user = req.user;

    // DEV-only identity resolution log
    if (IS_DEV()) {
      console.log(`[AUTH RESOLVE] mode=DEV_BYPASS path=${req.path} user=${userId} org=${orgId}`);
    }

    if (DIAG()) {
      console.log(`[DEV AUTH BYPASS FIRED] url=${req.originalUrl} method=${req.method} orgId=${orgId} userId=${userId}`);
    }

    return next();
  }

  // ============================================================
  // NO AUTH PROVIDED (neither real token nor dev bypass)
  // ============================================================
  // Note: ip was already computed above for dev bypass check
  const userAgent = getUserAgent(req);
  const path = req.path;
  const method = req.method;

  // Log JWT missing
  logSecurityEvent({
    event_type: "jwt_missing",
    ip,
    user_agent: userAgent,
    path,
    method,
    status_code: 401,
    reason: "missing_authorization_header",
  }).catch(() => {}); // Ignore errors
  (req as any)._securityLogged = true; // Prevent double-logging
  return res.status(401).json({ error: 'Missing or invalid Authorization header' });
}

