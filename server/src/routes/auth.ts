import express from "express";
import { establishSession } from "../auth/sessionService.js";
import { authRateLimiter } from "../middleware/rateLimit.js";
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";
import { detectImpossibleTravel, detectIdentityShift } from "../security/anomalyDetector.js";
import { pool } from "../db/pool.js";
import { invalidateUserAccessCache } from "../middleware/requireAuth.js";
import { signAppToken } from "../auth/jwtService.js";

export const authRouter = express.Router();

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
            `UPDATE "User" SET "billingStatus" = 'active', "cancelAtPeriodEnd" = false, "trialEnd" = $1, "currentPeriodEnd" = $2 WHERE id = 'user_dev'`,
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

  // Mock login - return static user with token
  console.log('[AUTH] Login successful, sending response');
  res.json({
    token: "mock-jwt-token-" + Date.now(),
    user: {
      email: email,
      id: "1"
    }
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
    // Extract Firebase ID token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await logSecurityEvent({
        event_type: "auth_session_error",
        ip,
        user_agent: userAgent,
        path,
        method,
        status_code: 401,
        reason: "missing_authorization_header",
      });
      (req as any)._securityLogged = true; // Prevent double-logging
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Use shared session service to establish session
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
      // Run asynchronously - don't await to avoid blocking request
      detectImpossibleTravel(session.user.id, ip, "unknown").catch(() => {});
      detectIdentityShift(session.user.id, ip, userAgent).catch(() => {});
    } else {
      // Log access denied
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

    // Return session response
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

    // Include app_session_token if available (only when access is allowed)
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

