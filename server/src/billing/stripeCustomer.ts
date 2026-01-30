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

    const existingCustomerId = userResult.rows[0].stripeCustomerId;

    // If user already has a Stripe customer, return it
    if (existingCustomerId) {
      return existingCustomerId;
    }

    // Create new Stripe customer
    const stripe = getStripeClient();
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
      throw error; // Re-throw unchanged so billing.ts can handle it
    }
    
    // For actual DB errors, re-throw with safe message (no role names or secrets), preserving error code
    const safeError: any = new Error("DB error in stripeCustomer lookup");
    if (error?.code) {
      safeError.code = error.code; // Preserve PostgreSQL error code for proper handling upstream
    }
    throw safeError;
  }
}

