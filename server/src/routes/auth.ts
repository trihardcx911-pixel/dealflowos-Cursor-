import express from "express";
import { establishSession } from "../auth/sessionService.js";
import { createSessionCookie } from "../auth/firebaseAdmin.js";
import { authRateLimiter } from "../middleware/rateLimit.js";
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";
import { detectImpossibleTravel, detectIdentityShift } from "../security/anomalyDetector.js";
import { pool } from "../db/pool.js";
import { invalidateUserAccessCache } from "../middleware/requireAuth.js";
import { signAppToken } from "../auth/jwtService.js";

export const authRouter = express.Router();

const FIREBASE_ISS_PREFIX = "https://securetoken.google.com/";
let didWarnMissingFirebaseProjectId = false;

/** UX guard: token must look like a Firebase ID token (3 segments, iss, aud). Does NOT verify signature. */
function looksLikeFirebaseIdToken(token: string): { ok: boolean; reason?: string } {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { ok: false, reason: "Expected 3 JWT segments" };
  }
  let payload: any;
  try {
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64 + "===".slice(0, (4 - (payloadB64.length % 4)) % 4);
    payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return { ok: false, reason: "Invalid JWT payload encoding" };
  }
  if (!payload.iss || typeof payload.iss !== "string" || !payload.iss.startsWith(FIREBASE_ISS_PREFIX)) {
    return { ok: false, reason: "Not a Firebase ID token (iss)" };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (projectId && payload.aud !== projectId) {
    return { ok: false, reason: "aud does not match FIREBASE_PROJECT_ID" };
  }
  if (!projectId && !didWarnMissingFirebaseProjectId) {
    didWarnMissingFirebaseProjectId = true;
    console.warn("[AUTH] FIREBASE_PROJECT_ID not set; skipping aud check for Firebase token guard");
  }
  return { ok: true };
}

// DEV-only: seed user_dev billing once per boot when DEV_AUTH_BYPASS=1
let devBillingSeeded = false;

// --- POST /auth/login ---
authRouter.post("/login", async (req, res) => {
  // Dev-only short-circuit: bypass all auth logic
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEV AUTH] Bypassing auth for /login");
    
    const email = req.body.email || "dev@example.com";
    const userId = req.body.userId || "user_dev";
    
    // UPSERT dev user row to ensure it exists with correct email (development only)
    try {
      await pool.query(
        `INSERT INTO "User" (id, email, firebase_uid, plan, status, session_version)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE 
         SET email = EXCLUDED.email,
             plan = EXCLUDED.plan,
             status = EXCLUDED.status,
             session_version = EXCLUDED.session_version`,
        [userId, email, 'firebase_dev', 'gold', 'active', 1]
      );
      console.log('[DEV AUTH] Ensured user_dev exists in DB');
      // DEV-only: set user_dev to non-expiring billing when DEV_AUTH_BYPASS=1 (once per boot)
      if (process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "1" && userId === "user_dev" && !devBillingSeeded) {
        const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10);
        try {
          await pool.query(
            `UPDATE "User" SET "billingStatus" = 'active', "cancelAtPeriodEnd" = false, trial_ends_at = $1, "currentPeriodEnd" = $2 WHERE id = 'user_dev'`,
            [farFuture, farFuture]
          );
          console.log("[DEV BILLING] user_dev set to active (10y)");
          devBillingSeeded = true;
        } catch (seedErr: any) {
          console.warn("[DEV BILLING] failed to seed user_dev billing:", seedErr?.message ?? String(seedErr));
        }
      }
    } catch (error: any) {
      // Log but don't fail login (dev user might not be critical)
      console.warn('[DEV AUTH] Failed to upsert dev user:', error.message);
    }

    // Create dev user object matching SessionUser interface (org_dev must exist in Organization table)
    const devUser = {
      id: userId,
      firebase_uid: "firebase_dev",
      email: email,
      plan: "gold",
      session_version: 1,
      orgId: "org_dev",
    };
    
    // Generate real signed JWT token
    const appToken = signAppToken(devUser);
    
    return res.json({
      token: appToken,
      user: {
        email: devUser.email,
        id: devUser.id
      }
    });
  }

  console.log('[AUTH] POST /login reached');
  console.log('[AUTH] Request body:', req.body);
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ 
      error: "Email and password are required" 
    });
  }

  // Email/password login disabled in production to prevent invalid token format; use Firebase -> POST /api/auth/session
  return res.status(501).json({
    error: "Email/password login is disabled in production. Use POST /api/auth/session with a Firebase ID token.",
  });
});

// --- POST /auth/signup ---
authRouter.post("/signup", (req, res) => {
  // Dev-only short-circuit: bypass all auth logic
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEV AUTH] Bypassing auth for /signup");
    return res.status(201).json({
      success: true,
      message: "User created successfully"
    });
  }

  console.log('[AUTH] POST /signup reached');
  console.log('[AUTH] Request body:', req.body);
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ 
      error: "Email and password are required" 
    });
  }

  // Mock signup - return success
  res.status(201).json({
    success: true,
    message: "User created successfully"
  });
});

/**
 * POST /api/auth/session
 * 
 * Establishes an application session after Firebase authentication.
 * 
 * Request:
 *   Authorization: Bearer <firebase_id_token>
 * 
 * Response:
 *   {
 *     user: { id, email, plan, status, onboarding_complete },
 *     access: { allowed: boolean, reason?: string }
 *   }
 */
authRouter.post("/session", authRateLimiter, async (req, res) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const path = req.path;
  const method = req.method;

  // Log session attempt (before verifying Firebase token)
  logSecurityEvent({
    event_type: "auth_session_attempt",
    ip,
    user_agent: userAgent,
    path,
    method,
    status_code: null, // Will be set after processing
  }).catch(() => {}); // Ignore errors

  try {
    // Extract Firebase ID token from Authorization header or body
    let idToken: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      idToken = authHeader.substring(7).trim();
    } else if (req.body?.idToken && typeof req.body.idToken === "string") {
      idToken = req.body.idToken.trim();
    }

    if (!idToken || idToken.length === 0) {
      await logSecurityEvent({
        event_type: "auth_session_error",
        ip,
        user_agent: userAgent,
        path,
        method,
        status_code: 400,
        reason: "missing_firebase_token",
      });
      (req as any)._securityLogged = true;
      return res.status(400).json({ error: "Firebase ID token required" });
    }

    // UX guard: reject non-Firebase JWTs before calling establishSession
    const guard = looksLikeFirebaseIdToken(idToken);
    if (!guard.ok) {
      await logSecurityEvent({
        event_type: "auth_session_error",
        ip,
        user_agent: userAgent,
        path,
        method,
        status_code: 400,
        reason: "non_firebase_jwt_guard",
        meta: { hint: guard.reason },
      });
      (req as any)._securityLogged = true;
      return res.status(400).json({
        error: "Expected Firebase ID token (securetoken.google.com). Got a non-Firebase JWT.",
        hint: "Call user.getIdToken(true) and send that token.",
      });
    }

    // Use shared session service to establish session (cryptographic verification)
    const session = await establishSession(idToken);

    // Log based on outcome
    if (session.access.allowed) {
      // Log successful session establishment
      await logSecurityEvent({
        event_type: "auth_session_established",
        user_id: session.user.id,
        ip,
        user_agent: userAgent,
        path,
        method,
        status_code: 200,
        meta: {
          plan: session.user.plan,
          status: session.user.status,
        },
      });
      (req as any)._securityLogged = true; // Prevent double-logging

      // Anomaly detection (log-only, non-blocking)
      detectImpossibleTravel(session.user.id, ip, "unknown").catch(() => {});
      detectIdentityShift(session.user.id, ip, userAgent).catch(() => {});

      // Best-effort: set session cookie only when access is allowed (must not break login)
      const SESSION_COOKIE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
      try {
        const sessionCookieValue = await createSessionCookie(idToken, SESSION_COOKIE_MAX_AGE_MS);
        const isProd = process.env.NODE_ENV === "production";
        res.cookie("dfos_session", sessionCookieValue, {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "none" : "lax",
          path: "/",
          maxAge: SESSION_COOKIE_MAX_AGE_MS,
        });
      } catch (cookieErr: any) {
        console.error("[AUTH] Session cookie creation failed (login still succeeds):", cookieErr?.message || cookieErr);
        // Do not throw; return normal JSON response
      }
    } else {
      // Log access denied; do NOT set cookie
      await logSecurityEvent({
        event_type: "auth_session_denied",
        user_id: session.user.id,
        ip,
        user_agent: userAgent,
        path,
        method,
        status_code: 403,
        reason: session.access.reason || "unknown",
        meta: {
          plan: session.user.plan,
          status: session.user.status,
        },
      });
      (req as any)._securityLogged = true; // Prevent double-logging
    }

    // Return session response (backward compatible: app_session_token unchanged)
    const response: any = {
      user: {
        id: session.user.id,
        email: session.user.email,
        plan: session.user.plan,
        status: session.user.status,
        onboarding_complete: session.user.onboarding_complete,
      },
      access: session.access,
    };

    if (session.app_session_token) {
      response.app_session_token = session.app_session_token;
    }

    res.json(response);
  } catch (error: any) {
    console.error('[AUTH] Session endpoint error:', error);

    // Log unexpected exception
    await logSecurityEvent({
      event_type: "auth_session_error",
      ip,
      user_agent: userAgent,
      path,
      method,
      status_code: 500,
      reason: "unexpected_exception",
      meta: {
        error_type: error.constructor.name,
        error_message: error.message?.substring(0, 256) || "unknown",
      },
    });
    (req as any)._securityLogged = true; // Prevent double-logging

    // Handle specific error types
    if (error.message.includes('Firebase token verification failed')) {
      return res.status(401).json({ error: 'Invalid or expired Firebase token' });
    }

    if (error.message.includes('Email is required')) {
      return res.status(400).json({ error: error.message });
    }

    // Database errors
    if (error.code && error.code.startsWith('23')) {
      return res.status(500).json({ error: 'Database constraint violation' });
    }

    // Generic server error
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout-all
 * 
 * Self-service endpoint to logout from all devices by incrementing session_version.
 * Requires authentication.
 */
authRouter.post("/logout-all", async (req, res) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const path = req.path;
  const method = req.method;

  // Require authentication
  if (!(req as any).user?.id) {
    await logSecurityEvent({
      event_type: "access_denied",
      ip,
      user_agent: userAgent,
      path,
      method,
      status_code: 401,
      reason: "not_authenticated",
    });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = (req as any).user.id;

  try {
    // Increment session_version (invalidates all existing tokens)
    const result = await pool.query(
      `UPDATE "User" 
       SET session_version = session_version + 1,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING session_version`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Invalidate cache to ensure immediate enforcement
    invalidateUserAccessCache(userId);

    // Log user action
    await logSecurityEvent({
      event_type: "user_logout_all",
      user_id: userId,
      ip,
      user_agent: userAgent,
      path,
      method,
      status_code: 200,
      meta: {
        new_session_version: result.rows[0].session_version,
      },
    });

    res.json({ success: true, message: "Logged out from all devices" });
  } catch (error: any) {
    console.error('[AUTH] Logout-all error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

