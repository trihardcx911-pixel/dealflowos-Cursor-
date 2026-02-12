/**
 * Stripe Customer Management
 * 
 * Ensures each user has an isolated Stripe customer for billing security.
 */

import { getStripeClient } from "./stripeClient.js";
import { pool } from "../db/pool.js";

/**
 * Get or create Stripe customer for a user
 * 
 * @param userId - User ID from req.user.id
 * @param userEmail - User email for Stripe customer creation
 * @returns Stripe customer ID
 * @throws Error if Stripe is not configured or customer creation fails
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  userEmail: string
): Promise<string> {
  try {
    // Check if user already has a Stripe customer ID
    const userResult = await pool.query(
      `SELECT "stripeCustomerId" FROM "User" WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      // User not found - this is a business logic error, not a DB connection error
      // Re-throw immediately so billing.ts can return proper JSON response
      const notFoundError: any = new Error("User not found");
      notFoundError.code = "USER_NOT_FOUND";
      throw notFoundError;
    }

    const existingCustomerId = userResult.rows[0].stripeCustomerId as string | null | undefined;

    const stripe = getStripeClient();

    // If user has a stored customer id, verify it exists in Stripe (handles test/live mismatch or deleted customer)
    if (existingCustomerId) {
      try {
        await stripe.customers.retrieve(existingCustomerId);
        return existingCustomerId;
      } catch (retrieveErr: any) {
        const isMissing =
          retrieveErr?.code === "resource_missing" ||
          (typeof retrieveErr?.message === "string" && retrieveErr.message.includes("No such customer"));
        if (isMissing) {
          if (process.env.NODE_ENV !== "production" || process.env.DEV_DIAGNOSTICS === "1") {
            console.log("[BILLING] Stale Stripe customer (missing in Stripe), creating new", {
              uid: userId,
              customerIdPrefix: existingCustomerId.substring(0, 12),
              stripeCode: retrieveErr?.code,
            });
          }
          // Fall through to create new customer and overwrite DB
        } else {
          throw retrieveErr;
        }
      }
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: {
        userId: userId,
      },
    });

    // Store Stripe customer ID in database
    await pool.query(
      `UPDATE "User" SET "stripeCustomerId" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [customer.id, userId]
    );

    console.log(`[BILLING] Created Stripe customer ${customer.id} for user ${userId}`);

    return customer.id;
  } catch (error: any) {
    // Preserve Stripe errors so billing can return proper response (do not mask as DB error)
    if (error?.type && String(error.type).startsWith("Stripe")) {
      throw error;
    }
    // Safe error logging (no secrets, no role names in message)
    if (process.env.NODE_ENV !== "production" || process.env.DEV_DIAGNOSTICS === "1") {
      console.error("[BILLING stripeCustomer] DB error:", {
        code: error?.code,
        severity: error?.severity,
        message: error?.message,
        routine: error?.routine,
        table: error?.table,
        column: error?.column,
        constraint: error?.constraint,
      });
    }
    // Preserve "User not found" errors as-is (business logic, not DB connection issue)
    if (error?.message === "User not found" || error?.code === "USER_NOT_FOUND") {
      throw error;
    }
    // For actual DB errors, re-throw with safe message, preserving error code
    const safeError: any = new Error("DB error in stripeCustomer lookup");
    if (error?.code) {
      safeError.code = error.code;
    }
    throw safeError;
  }
}

