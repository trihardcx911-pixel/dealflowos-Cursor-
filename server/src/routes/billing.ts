import express from "express";
import crypto from "crypto";
import { getStripeClient, isStripeConfigured } from "../billing/stripeClient.js";
import { getOrCreateStripeCustomer } from "../billing/stripeCustomer.js";
import { mapStripeStatusToBillingStatus } from "../billing/stripeEntitlements.js";
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";
import { detectResourceProbing } from "../security/anomalyDetector.js";
import { pool } from "../db/pool.js";

export const billingRouter = express.Router();

// Plan type and price ID mapping
type PlanType = "bronze" | "silver" | "gold";
const VALID_PLANS: PlanType[] = ["bronze", "silver", "gold"];

// Bronze tier gets 14-day free trial
const BRONZE_TRIAL_DAYS = 14;

/**
 * Get Stripe price ID for a specific plan with backward-compatible aliasing
 * Bronze: STRIPE_PRICE_BRONZE_MONTHLY -> STRIPE_PRICE_ID_CREATOR_MONTHLY -> STRIPE_DEFAULT_PRICE_ID
 * Silver: STRIPE_PRICE_SILVER_MONTHLY only
 * Gold: STRIPE_PRICE_GOLD_MONTHLY only
 */
function getPriceIdForPlan(plan: "bronze" | "silver" | "gold"): string | null {
  if (plan === "bronze") {
    // Bronze: try new name first, then fallback to legacy names
    const bronzePrice = process.env.STRIPE_PRICE_BRONZE_MONTHLY?.trim();
    if (bronzePrice) return bronzePrice;
    
    const creatorPrice = process.env.STRIPE_PRICE_ID_CREATOR_MONTHLY?.trim();
    if (creatorPrice) return creatorPrice;
    
    const defaultPrice = process.env.STRIPE_DEFAULT_PRICE_ID?.trim();
    if (defaultPrice) return defaultPrice;
    
    return null;
  } else if (plan === "silver") {
    return process.env.STRIPE_PRICE_SILVER_MONTHLY?.trim() || null;
  } else if (plan === "gold") {
    return process.env.STRIPE_PRICE_GOLD_MONTHLY?.trim() || null;
  }
  
  return null;
}

/**
 * Get frontend URL with trimming
 */
function getFrontendUrl(): string | null {
  return process.env.FRONTEND_URL?.trim() || null;
}

/**
 * Get list of missing required Stripe environment variables for a specific plan
 * Returns empty array if all required keys for the plan are present
 * Checks actual resolved values (with aliasing), but returns stable key names
 */
function getMissingStripeEnv(plan: string): string[] {
  const required: string[] = [];
  
  // Check secret key (with aliasing: STRIPE_SECRET_KEY or STRIPE_ACTIVE_KEY)
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_ACTIVE_KEY?.trim();
  if (!secretKey) {
    required.push("STRIPE_SECRET_KEY"); // Always return the primary name for stability
  }
  
  // Check price ID for the selected plan (with aliasing for bronze)
  const priceId = getPriceIdForPlan(plan as PlanType);
  if (!priceId) {
    if (plan === "bronze") {
      required.push("STRIPE_PRICE_BRONZE_MONTHLY"); // Always return the primary name
    } else if (plan === "silver") {
      required.push("STRIPE_PRICE_SILVER_MONTHLY");
    } else if (plan === "gold") {
      required.push("STRIPE_PRICE_GOLD_MONTHLY");
    }
  }
  
  // Check frontend URL
  const frontendUrl = getFrontendUrl();
  if (!frontendUrl) {
    required.push("FRONTEND_URL");
  }
  
  return required;
}

/**
 * Convert DB timestamp to ISO string safely
 */
function toIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    const date = new Date(v);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

/**
 * Map billingStatus enum to allowed status string union
 */
function mapBillingStatusToStatus(billingStatus: unknown): 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none' {
  if (!billingStatus) return 'none';
  const statusStr = String(billingStatus).toLowerCase();
  const allowed: Array<'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'> = ['active', 'trialing', 'past_due', 'canceled', 'incomplete'];
  if (allowed.includes(statusStr as any)) return statusStr as any;
  return 'none';
}

/**
 * Build DB update object from Stripe subscription (for cancel/resume endpoints)
 */
function buildUserBillingUpdateFromSubscription(sub: any): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  const priceId = sub.items?.data?.[0]?.price?.id || null;
  if (priceId) {
    updateData.stripePriceId = priceId;
  }

  updateData.cancelAtPeriodEnd = !!sub.cancel_at_period_end;

  if (sub.current_period_start) {
    updateData.currentPeriodStart = new Date(sub.current_period_start * 1000);
  }

  if (sub.current_period_end) {
    updateData.currentPeriodEnd = new Date(sub.current_period_end * 1000);
  }

  if (sub.trial_end) {
    updateData.trialEnd = new Date(sub.trial_end * 1000);
  }

  if (sub.ended_at) {
    updateData.stripeEndedAt = new Date(sub.ended_at * 1000);
  }

  if (sub.status) {
    const billingStatus = mapStripeStatusToBillingStatus(sub.status);
    updateData.billingStatus = billingStatus;
  }

  return updateData;
}

// GET /billing/summary
billingRouter.get("/summary", async (req, res) => {
  const uid = req.user?.id;

  if (!uid) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      error: "Unauthorized",
    });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "Stripe not configured",
    });
  }

  try {
    // Fetch user's billing state from DB (DB-first approach)
    const userResult = await pool.query(
      `SELECT "stripeCustomerId", "stripeSubscriptionId", "stripePriceId", "trialEnd",
              "billingStatus", "cancelAtPeriodEnd", "currentPeriodEnd"
       FROM "User" WHERE id = $1`,
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    const user = userResult.rows[0];

    // If no subscription, return "none" status
    if (!user.stripeSubscriptionId) {
      return res.json({
        ok: true,
        plan: {
          status: "none",
          priceId: user.stripePriceId || null,
          subscriptionId: null,
          customerId: user.stripeCustomerId || null,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          trialEnd: toIso(user.trialEnd),
        },
      });
    }

    // Use DB values if available (currentPeriodEnd is the key indicator of complete data)
    const statusFromDb = mapBillingStatusToStatus(user.billingStatus);
    const hasDbPeriodEnd = user.currentPeriodEnd !== null;

    // Fallback to Stripe ONLY if DB is missing currentPeriodEnd (indicates incomplete sync)
    if (!hasDbPeriodEnd) {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

      // Return from Stripe (read-only, no DB write in /summary)
      return res.json({
        ok: true,
        plan: {
          status: subscription.status || "none",
          priceId: user.stripePriceId || null,
          subscriptionId: user.stripeSubscriptionId,
          customerId: user.stripeCustomerId || null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          trialEnd: toIso(user.trialEnd) || (subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null),
        },
      });
    }

    // Return from DB (fast path, no Stripe call)
    return res.json({
      ok: true,
      plan: {
        status: statusFromDb,
        priceId: user.stripePriceId || null,
        subscriptionId: user.stripeSubscriptionId,
        customerId: user.stripeCustomerId || null,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd || false,
        currentPeriodEnd: toIso(user.currentPeriodEnd),
        trialEnd: toIso(user.trialEnd),
      },
    });
  } catch (error: any) {
    if (process.env.BILLING_DEBUG === "1") {
      console.error("[BILLING] Error fetching summary:", {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      });
    }
    res.status(500).json({
      ok: false,
      code: "BILLING_SUMMARY_FAILED",
      error: "Failed to fetch billing summary",
    });
  }
});

// GET /billing/status
billingRouter.get("/status", async (req, res) => {
  const uid = req.user?.id;
  
  // Safe diagnostic logging (no secrets)
  console.log("[BILLING] GET /status", { uidPresent: !!uid });

  if (!uid) {
    return res.status(401).json({ 
      code: "UNAUTHENTICATED",
      error: "Unauthorized" 
    });
  }

  try {
    const result = await pool.query(
      `SELECT "billingStatus", plan, "cancelAtPeriodEnd", "currentPeriodEnd"
       FROM "User" WHERE id = $1`,
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        code: "USER_NOT_FOUND",
        error: "User not found" 
      });
    }

    const user = result.rows[0];
    res.json({
      billingStatus: user.billingStatus,
      plan: user.plan,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      currentPeriodEnd: user.currentPeriodEnd ? user.currentPeriodEnd.toISOString() : null,
    });
  } catch (error: any) {
    // Safe error logging (no secrets)
    console.error("[BILLING] Error fetching status:", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    
    res.status(500).json({
      code: "BILLING_STATUS_FAILED",
      error: "Failed to fetch billing status",
    });
  }
});

// POST /billing/create-checkout-session
billingRouter.post("/create-checkout-session", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ code: "UNAUTHENTICATED", error: "Unauthorized" });
  }

  // Diagnostic logging (safe - no secrets)
  const uid = req.user.id;
  const email = req.user.email;
  const plan = (req.body as { plan?: string })?.plan;
  console.log("[BILLING] create-checkout-session request:", {
    uid: uid ? "present" : "missing",
    email: email ? "present" : "missing",
    plan: plan || "(missing)",
  });

  // Validate plan parameter
  if (!plan || !VALID_PLANS.includes(plan as PlanType)) {
    return res.status(400).json({
      code: "INVALID_PLAN",
      error: "Invalid plan",
      message: `Plan must be one of: ${VALID_PLANS.join(", ")}`,
      received: plan || "(missing)",
    });
  }

  const selectedPlan = plan as PlanType;

  // Check for required Stripe configuration for this specific plan
  const missing = getMissingStripeEnv(selectedPlan);
  if (missing.length > 0) {
    return res.status(503).json({
      code: "STRIPE_NOT_CONFIGURED",
      message: "Stripe not configured",
      missing,
    });
  }

  // Validate email is present (required for Stripe customer creation)
  if (!email) {
    return res.status(400).json({
      code: "USER_NOT_READY",
      error: "User email is required",
    });
  }

  // Declare variables outside try block for error handler access
  let priceId: string | null = null;
  let customerId: string | null = null;
  
  try {
    // DEV_AUTH_BYPASS: Ensure dev user exists in database before Stripe calls
    const isDevBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "1";
    if (isDevBypass) {
      try {
        const userCheck = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [uid]);
        if (userCheck.rows.length === 0) {
          // Upsert dev user with deterministic values
          // Only reference columns that exist after migration (email, firebase_uid, plan, status, timestamps)
          await pool.query(
            `INSERT INTO "User" (id, email, "firebase_uid", plan, status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET 
               email = COALESCE(EXCLUDED.email, "User".email),
               "updatedAt" = NOW()`,
            [uid, email, req.user.firebase_uid || "firebase_dev", selectedPlan, "active"]
          );
          console.log(`[BILLING] Upserted dev user: ${uid}`);
        }
      } catch (dbError: any) {
        console.error("[BILLING] Failed to upsert dev user:", {
          name: dbError?.name,
          message: dbError?.message,
          code: dbError?.code,
        });
        // Continue - if DB is unavailable, getOrCreateStripeCustomer will handle it
      }
    }

    const stripe = getStripeClient();
    priceId = getPriceIdForPlan(selectedPlan);

    if (!priceId) {
      console.error(`[BILLING] Missing price ID for plan: ${selectedPlan}`);
      return res.status(500).json({
        code: "PRICE_ID_MISSING",
        error: `Stripe price ID not configured for ${selectedPlan}`,
        hint: selectedPlan === "bronze" 
          ? "Set STRIPE_PRICE_BRONZE_MONTHLY (or STRIPE_PRICE_ID_CREATOR_MONTHLY / STRIPE_DEFAULT_PRICE_ID for backward compatibility)"
          : `Set STRIPE_PRICE_${selectedPlan.toUpperCase()}_MONTHLY environment variable`,
      });
    }

    // BOLA prevention: Get or create user-specific Stripe customer
    // Each user has an isolated Stripe customer - no shared customer IDs
    customerId = await getOrCreateStripeCustomer(uid, email);

    // Build checkout session options (single object so no undefined mutation; cast at call for Stripe SDK typing)
    const sessionOptions: Record<string, unknown> = {
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${getFrontendUrl() || "http://localhost:5173"}/billing/success`,
      cancel_url: `${getFrontendUrl() || "http://localhost:5173"}/billing/cancel?plan=${selectedPlan}`,
      metadata: {
        userId: req.user.id,
        orgId: (req as any).orgId || req.user.orgId || req.user.id,
        plan: selectedPlan,
      },
    };

    if (selectedPlan === "bronze") {
      (sessionOptions as any).subscription_data = {
        trial_period_days: BRONZE_TRIAL_DAYS,
        metadata: {
          userId: req.user.id,
          orgId: (req as any).orgId || req.user.orgId || req.user.id,
          plan: selectedPlan,
        },
      };
    }

    // DEV-only: Safe diagnostics before Stripe call
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      const frontendUrl = getFrontendUrl() || "http://localhost:5173";
      const successUrl = `${frontendUrl}/billing/success`;
      const cancelUrl = `${frontendUrl}/billing/cancel?plan=${selectedPlan}`;
      const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_ACTIVE_KEY?.trim();
      
      console.log("[BILLING] Pre-Stripe payload fingerprint:", {
        plan: selectedPlan,
        mode: "subscription",
        hasPriceId: !!priceId,
        priceIdPrefix: priceId ? priceId.substring(0, 8) : "(missing)",
        hasFrontendUrl: !!getFrontendUrl(),
        successUrlHostOnly: new URL(successUrl).hostname,
        cancelUrlHostOnly: new URL(cancelUrl).hostname,
        uidPresent: !!uid,
        emailPresent: !!email,
        hasStripeSecretKey: !!stripeKey,
        stripeKeyPrefix: stripeKey ? stripeKey.substring(0, 8) : "(missing)",
        customerIdPrefix: customerId ? customerId.substring(0, 8) : "(missing)",
      });
    }

    const session = await stripe.checkout.sessions.create(sessionOptions as any);

    console.log(`[BILLING] Checkout session created: plan=${selectedPlan}, trial=${selectedPlan === 'bronze' ? BRONZE_TRIAL_DAYS + 'd' : 'none'}`);

    res.json({
      url: session.url,
      id: session.id,
    });
  } catch (error: any) {
    const isDev = process.env.NODE_ENV !== "production";
    
    // Safe error logging (no secrets)
    const safeErrorLog: any = {
      name: error?.name,
      message: error?.message ? String(error.message).substring(0, 200) : undefined,
      code: error?.code,
      type: error?.type,
    };
    
    // DEV-only: Add safe Stripe error fields
    if (isDev && error?.type) {
      safeErrorLog.stripeType = error.type;
      safeErrorLog.stripeCode = error.code;
      safeErrorLog.stripeParam = error.param;
      safeErrorLog.statusCode = error.statusCode;
      safeErrorLog.requestId = error.requestId;
    }
    
    console.error("[BILLING] Error creating checkout session:", safeErrorLog);
    
    // Check for database role/auth errors
    const isRoleError = error?.message?.toLowerCase().includes('role') || 
                        error?.code === '28000' || // Invalid authorization specification
                        error?.code === '28P01' || // Invalid password
                        error?.code === '42501';   // Insufficient privilege
    
    if (isRoleError) {
      return res.status(500).json({
        code: "DB_ROLE_MISSING",
        error: "Database auth misconfigured (role/user). Check DATABASE_URL user exists in Postgres.",
      });
    }

    // Check for user not found error (from getOrCreateStripeCustomer)
    if (error?.message?.includes("User not found")) {
      return res.status(500).json({
        code: "USER_NOT_READY",
        error: "User record not found in database",
      });
    }
    
    // Check for Stripe-specific errors and provide helpful messages
    const stripeError = error?.type || error?.code;
    if (stripeError) {
      // Price/resource missing errors
      if (error?.code === 'resource_missing' || error?.param === 'line_items[0][price]') {
        const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_ACTIVE_KEY?.trim();
        const keyMode = stripeKey?.startsWith('sk_test_') ? 'test' : stripeKey?.startsWith('sk_live_') ? 'live' : 'unknown';
        
        return res.status(500).json({
          code: "CHECKOUT_SESSION_FAILED",
          error: "Invalid Stripe price ID. Ensure price ID exists in Stripe and matches key mode (test vs live).",
          ...(isDev && {
            debug: {
              stripeType: error.type,
              stripeCode: error.code,
              stripeParam: error.param,
              statusCode: error.statusCode,
              requestId: error.requestId,
              keyMode,
              priceIdPrefix: priceId ? priceId.substring(0, 12) : "(missing)",
              hint: keyMode === 'test' 
                ? "Ensure price ID is from Stripe test mode dashboard"
                : keyMode === 'live' 
                ? "Ensure price ID is from Stripe live mode dashboard"
                : "Check STRIPE_SECRET_KEY or STRIPE_ACTIVE_KEY format",
            }
          }),
        });
      }
      
      // Invalid URL errors
      if (error?.param?.includes('success_url') || error?.param?.includes('cancel_url')) {
        return res.status(500).json({
          code: "CHECKOUT_SESSION_FAILED",
          error: "Invalid success_url or cancel_url. Ensure FRONTEND_URL is absolute (includes http:// or https://).",
          ...(isDev && {
            debug: {
              stripeType: error.type,
              stripeCode: error.code,
              stripeParam: error.param,
              statusCode: error.statusCode,
              requestId: error.requestId,
            }
          }),
        });
      }
      
      // Customer errors
      if (error?.param === 'customer' || error?.code === 'resource_missing' && error?.message?.includes('customer')) {
        return res.status(500).json({
          code: "CHECKOUT_SESSION_FAILED",
          error: "Invalid Stripe customer. Customer may not exist or may be in a different Stripe mode.",
          ...(isDev && {
            debug: {
              stripeType: error.type,
              stripeCode: error.code,
              stripeParam: error.param,
              statusCode: error.statusCode,
              requestId: error.requestId,
            }
          }),
        });
      }
    }
    
    // Generic billing checkout error with DEV debug info
    return res.status(500).json({
      code: "CHECKOUT_SESSION_FAILED",
      error: "Failed to create checkout session",
      ...(isDev && {
        debug: {
          stripeType: error?.type,
          stripeCode: error?.code,
          stripeParam: error?.param,
          statusCode: error?.statusCode,
          requestId: error?.requestId,
        }
      }),
    });
  }
});

// POST /billing/cancel
billingRouter.post("/cancel", async (req, res) => {
  const uid = req.user?.id;

  if (!uid) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      error: "Unauthorized",
    });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "Stripe not configured",
    });
  }

  try {
    // Fetch user's Stripe subscription ID
    const userResult = await pool.query(
      `SELECT "stripeSubscriptionId" FROM "User" WHERE id = $1`,
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    const stripeSubscriptionId = userResult.rows[0].stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return res.status(409).json({
        ok: false,
        code: "NO_SUBSCRIPTION",
        error: "No active subscription found",
      });
    }

    // Update Stripe subscription to cancel at period end
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Immediately sync DB with Stripe response (optimistic update)
    const updateData = buildUserBillingUpdateFromSubscription(subscription);
    updateData.cancelAtPeriodEnd = true; // Force true for cancel action

    await pool.query(
      `UPDATE "User" SET 
        "cancelAtPeriodEnd" = $1,
        "currentPeriodStart" = $2,
        "currentPeriodEnd" = $3,
        "billingStatus" = $4::"BillingStatus",
        "stripePriceId" = $5,
        "trialEnd" = $6,
        "stripeEndedAt" = $7,
        "updatedAt" = NOW()
       WHERE id = $8`,
      [
        updateData.cancelAtPeriodEnd,
        updateData.currentPeriodStart || null,
        updateData.currentPeriodEnd || null,
        updateData.billingStatus || null,
        updateData.stripePriceId || null,
        updateData.trialEnd || null,
        updateData.stripeEndedAt || null,
        uid,
      ]
    );

    if (process.env.BILLING_DEBUG === "1") {
      console.log(`[BILLING] Cancel requested for user ${uid}, subscription ${stripeSubscriptionId}, cancelAtPeriodEnd=${updateData.cancelAtPeriodEnd}`);
    }

    return res.json({
      ok: true,
      subscriptionId: stripeSubscriptionId,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: updateData.currentPeriodEnd ? (updateData.currentPeriodEnd as Date).toISOString() : null,
      status: subscription.status,
    });
  } catch (error: any) {
    if (process.env.BILLING_DEBUG === "1") {
      console.error("[BILLING] Error canceling subscription:", {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      });
    }
    res.status(500).json({
      ok: false,
      code: "BILLING_CANCEL_FAILED",
      error: "Failed to cancel subscription",
    });
  }
});

// POST /billing/resume
billingRouter.post("/resume", async (req, res) => {
  const uid = req.user?.id;

  if (!uid) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      error: "Unauthorized",
    });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "Stripe not configured",
    });
  }

  try {
    // Fetch user's Stripe subscription ID
    const userResult = await pool.query(
      `SELECT "stripeSubscriptionId" FROM "User" WHERE id = $1`,
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    const stripeSubscriptionId = userResult.rows[0].stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return res.status(409).json({
        ok: false,
        code: "NO_SUBSCRIPTION",
        error: "No active subscription found",
      });
    }

    // Update Stripe subscription to resume (clear cancel_at_period_end)
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Immediately sync DB with Stripe response (optimistic update)
    const updateData = buildUserBillingUpdateFromSubscription(subscription);
    updateData.cancelAtPeriodEnd = false; // Force false for resume action

    await pool.query(
      `UPDATE "User" SET 
        "cancelAtPeriodEnd" = $1,
        "currentPeriodStart" = $2,
        "currentPeriodEnd" = $3,
        "billingStatus" = $4::"BillingStatus",
        "stripePriceId" = $5,
        "trialEnd" = $6,
        "stripeEndedAt" = $7,
        "updatedAt" = NOW()
       WHERE id = $8`,
      [
        updateData.cancelAtPeriodEnd,
        updateData.currentPeriodStart || null,
        updateData.currentPeriodEnd || null,
        updateData.billingStatus || null,
        updateData.stripePriceId || null,
        updateData.trialEnd || null,
        updateData.stripeEndedAt || null,
        uid,
      ]
    );

    if (process.env.BILLING_DEBUG === "1") {
      console.log(`[BILLING] Resume requested for user ${uid}, subscription ${stripeSubscriptionId}, cancelAtPeriodEnd=${updateData.cancelAtPeriodEnd}`);
    }

    return res.json({
      ok: true,
      subscriptionId: stripeSubscriptionId,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: updateData.currentPeriodEnd ? (updateData.currentPeriodEnd as Date).toISOString() : null,
      status: subscription.status,
    });
  } catch (error: any) {
    if (process.env.BILLING_DEBUG === "1") {
      console.error("[BILLING] Error resuming subscription:", {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      });
    }
    res.status(500).json({
      ok: false,
      code: "BILLING_RESUME_FAILED",
      error: "Failed to resume subscription",
    });
  }
});

// POST /billing/cancel-feedback
billingRouter.post("/cancel-feedback", async (req, res) => {
  const uid = req.user?.id;

  if (!uid) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      error: "Unauthorized",
    });
  }

  try {
    // Fetch user's Stripe IDs from DB (BOLA-safe: server derives, not client)
    const userResult = await pool.query(
      `SELECT "stripeSubscriptionId", "stripeCustomerId" FROM "User" WHERE id = $1`,
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    const user = userResult.rows[0];

    // Validate and sanitize reasonCodes
    const allowedCodes = [
      "too_expensive",
      "not_wholesaling_anymore",
      "missing_features",
      "hard_to_use",
      "bugs_or_performance",
      "found_alternative",
      "not_getting_value",
      "other",
    ];

    let reasonCodes: string[] = [];
    if (req.body.reasonCodes) {
      if (Array.isArray(req.body.reasonCodes)) {
        reasonCodes = req.body.reasonCodes
          .map((c: unknown) => String(c))
          .filter((c: string) => allowedCodes.includes(c))
          .slice(0, 10);
        // De-duplicate
        reasonCodes = Array.from(new Set(reasonCodes));
      } else if (typeof req.body.reasonCodes === 'string') {
        const singleCode = String(req.body.reasonCodes);
        if (allowedCodes.includes(singleCode)) {
          reasonCodes = [singleCode];
        }
      }
    }

    // Validate and sanitize otherText
    let otherText: string | null = null;
    if (req.body.otherText) {
      const rawText = String(req.body.otherText).trim();
      if (rawText.length > 0) {
        otherText = rawText.slice(0, 1000);
      }
    }

    // Insert feedback record (always insert, even if empty reasons and null otherText)
    const feedbackId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "SubscriptionCancellationFeedback" 
       (id, "userId", "stripeSubscriptionId", "stripeCustomerId", "reasonCodes", "otherText", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        feedbackId,
        uid,
        user.stripeSubscriptionId || null,
        user.stripeCustomerId || null,
        reasonCodes,
        otherText,
      ]
    );

    if (process.env.BILLING_DEBUG === "1") {
      console.log(`[BILLING] Cancel feedback recorded for user ${uid}, reasonCodes=${reasonCodes.length}, hasOtherText=${!!otherText}`);
    }

    return res.json({ ok: true });
  } catch (error: any) {
    if (process.env.BILLING_DEBUG === "1") {
      console.error("[BILLING] Error recording cancel feedback:", {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      });
    }
    res.status(500).json({
      ok: false,
      code: "BILLING_FEEDBACK_FAILED",
      error: "Failed to record feedback",
    });
  }
});

// POST /billing/portal
billingRouter.post("/portal", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    
    // BOLA prevention: Get or create user-specific Stripe customer
    // Each user has an isolated Stripe customer - no shared customer IDs
    const customerId = await getOrCreateStripeCustomer(req.user.id, req.user.email);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings/billing-history`,
    });

    res.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error("[BILLING] Error creating portal session:", error);
    res.status(500).json({
      error: "Failed to create portal session",
      message: error.message,
    });
  }
});

// GET /billing/invoices
billingRouter.get("/invoices", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    
    // BOLA prevention: Get or create user-specific Stripe customer
    // Each user has an isolated Stripe customer - no shared customer IDs
    const customerId = await getOrCreateStripeCustomer(req.user.id, req.user.email);

    // Fetch invoices - only for this user's Stripe customer
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 20,
    });

    // Fetch charges - only for this user's Stripe customer
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 20,
    });

    // Map invoices to simplified format
    const invoiceItems = invoices.data.map((inv: any) => {
      const amount = inv.amount_paid > 0 ? inv.amount_paid : inv.amount_due;
      const status = inv.status || "open";
      
      // Determine type based on status
      let type: "charge" | "invoice" | "refund" | "failed" = "invoice";
      if (status === "paid") {
        type = "charge";
      } else if (status === "uncollectible" || status === "void") {
        type = "failed";
      }
      
      return {
        id: inv.id,
        type,
        date: new Date(inv.created * 1000).toISOString(),
        amount: amount / 100, // Convert from cents to dollars
        currency: inv.currency || "usd",
        status: status,
        description: inv.description || inv.lines.data[0]?.description || "Invoice",
        invoiceNumber: inv.number || undefined,
        receiptNumber: inv.receipt_number || undefined,
        chargeId: inv.charge as string | undefined,
        refundReason: undefined,
        hostedInvoiceUrl: inv.hosted_invoice_url || undefined,
        invoicePdf: inv.invoice_pdf || undefined,
      };
    });

    // Fetch refunds for this customer's charges
    const refunds = await stripe.refunds.list({
      limit: 20,
    });

    // Map charges to simplified format
    // Only include charges that aren't already represented by invoices
    const invoiceChargeIds = new Set(invoiceItems.map((inv: any) => inv.chargeId).filter(Boolean));
    
    // Get charge IDs that have refunds
    const refundChargeIds = new Set(
      refunds.data
        .map((ref: any) => {
          const chargeId = typeof ref.charge === 'string' ? ref.charge : ref.charge?.id;
          return chargeId;
        })
        .filter(Boolean) as string[]
    );
    
    const chargeItems = charges.data
      .filter((ch: any) => ch.status === "succeeded" && !invoiceChargeIds.has(ch.id) && !refundChargeIds.has(ch.id))
      .map((ch: any) => {
        return {
          id: ch.id,
          type: "charge" as const,
          date: new Date(ch.created * 1000).toISOString(),
          amount: ch.amount / 100,
          currency: ch.currency || "usd",
          status: "paid",
          description: ch.description || "Payment",
          invoiceNumber: undefined,
          receiptNumber: ch.receipt_number || undefined,
          chargeId: ch.id,
          refundReason: undefined,
          hostedInvoiceUrl: undefined,
          invoicePdf: undefined,
        };
      });

    // Map refunds to simplified format
    // Only include refunds for charges that belong to this user's Stripe customer
    const refundItems = refunds.data
      .filter((ref: any) => {
        const chargeId = typeof ref.charge === 'string' ? ref.charge : ref.charge?.id;
        if (!chargeId) return false;
        // Verify charge belongs to this customer
        const charge = charges.data.find((ch: any) => ch.id === chargeId);
        return charge && (charge.customer === customerId || (typeof charge.customer === 'object' && charge.customer?.id === customerId));
      })
      .map((ref: any) => {
        const chargeId = typeof ref.charge === 'string' ? ref.charge : ref.charge?.id;
        return {
          id: ref.id,
          type: "refund" as const,
          date: new Date(ref.created * 1000).toISOString(),
          amount: ref.amount / 100,
          currency: ref.currency || "usd",
          status: "refunded",
          description: ref.description || ref.reason || "Refund",
          invoiceNumber: undefined,
          receiptNumber: undefined,
          chargeId: chargeId || undefined,
          refundReason: ref.reason || "Customer request",
          hostedInvoiceUrl: undefined,
          invoicePdf: undefined,
        };
      });

    // Combine and sort by date (newest first)
    const allItems = [...invoiceItems, ...chargeItems, ...refundItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.json({
      items: allItems,
    });
  } catch (error: any) {
    console.error("[BILLING] Error fetching invoices:", error);
    res.status(500).json({
      error: "Failed to fetch invoices",
      message: error.message,
    });
  }
});

// POST /billing/retry/:invoiceId
billingRouter.post("/retry/:invoiceId", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    const { invoiceId } = req.params;

    // Fetch invoice to check status
    const invoice = await stripe.invoices.retrieve(invoiceId);

    // BOLA prevention: Verify invoice belongs to user's Stripe customer
    const customerId = await getOrCreateStripeCustomer(req.user.id, req.user.email);
    const invoiceCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    
    if (invoiceCustomerId !== customerId) {
      // Log BOLA violation
      logSecurityEvent({
        event_type: "bola_forbidden",
        user_id: req.user.id,
        ip: getClientIp(req),
        user_agent: getUserAgent(req),
        path: req.path,
        method: req.method,
        status_code: 403,
        reason: "ownership_mismatch",
        meta: {
          resource_type: "invoice",
          resource_id: invoiceId,
        },
      }).catch(() => {}); // Ignore errors
      (req as any)._securityLogged = true; // Prevent double-logging

      // Anomaly detection (log-only, non-blocking)
      detectResourceProbing(req.user.id).catch(() => {});

      return res.status(403).json({ error: "Forbidden" });
    }

    if (invoice.status !== "open" && invoice.status !== "uncollectible") {
      return res.status(400).json({
        error: "Invoice cannot be retried",
        message: `Invoice status is ${invoice.status}. Only 'open' or 'uncollectible' invoices can be retried.`,
      });
    }

    // Attempt to pay the invoice
    const paidInvoice = await stripe.invoices.pay(invoiceId);

    console.log("[BILLING] Invoice retry successful:", {
      invoiceId,
      status: paidInvoice.status,
    });

    res.json({
      success: true,
      invoiceId: paidInvoice.id,
      status: paidInvoice.status,
    });
  } catch (error: any) {
    console.error("[BILLING] Error retrying invoice:", error);
    res.status(500).json({
      error: "Failed to retry invoice",
      message: error.message,
    });
  }
});

// GET /billing/invoice/:id/pdf
billingRouter.get("/invoice/:id/pdf", async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    const { id } = req.params;

    const invoice = await stripe.invoices.retrieve(id);

    // BOLA prevention: Verify invoice belongs to user's Stripe customer
    const customerId = await getOrCreateStripeCustomer(req.user.id, req.user.email);
    const invoiceCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    
    if (invoiceCustomerId !== customerId) {
      // Log BOLA violation
      logSecurityEvent({
        event_type: "bola_forbidden",
        user_id: req.user.id,
        ip: getClientIp(req),
        user_agent: getUserAgent(req),
        path: req.path,
        method: req.method,
        status_code: 403,
        reason: "ownership_mismatch",
        meta: {
          resource_type: "invoice",
          resource_id: id,
        },
      }).catch(() => {}); // Ignore errors
      return res.status(403).json({ error: "Forbidden" });
    }

    const pdfUrl = invoice.invoice_pdf || invoice.hosted_invoice_url;

    if (!pdfUrl) {
      return res.status(404).json({
        error: "PDF not available",
      });
    }

    res.json({
      url: pdfUrl,
    });
  } catch (error: any) {
    console.error("[BILLING] Error fetching invoice PDF:", error);
    res.status(500).json({
      error: "Failed to fetch invoice PDF",
      message: error.message,
    });
  }
});

