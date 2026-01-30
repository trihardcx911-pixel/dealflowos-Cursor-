/**
 * Waitlist API Routes
 * 
 * Public endpoint for waitlist signups (Silver/Gold tiers).
 */

import { Router, Request, Response } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valid tier values
const VALID_TIERS = ["silver", "gold"] as const;
type WaitlistTier = typeof VALID_TIERS[number];

/**
 * POST /api/waitlist
 * Public endpoint to submit waitlist signup.
 * 
 * Body: { email: string, tier: "silver" | "gold", source?: string, hp?: string }
 * - hp: honeypot field (if non-empty, respond success but don't store)
 * 
 * Response: { success: true } (always 200 on valid requests)
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Parse JSON body safely
    const emailRaw = String(req.body?.email ?? "");
    const tierRaw = String(req.body?.tier ?? "");
    const sourceRaw = req.body?.source ? String(req.body.source) : null;
    const hp = String(req.body?.hp ?? "");

    // Honeypot check: if filled, respond success but don't store
    if (hp.trim().length > 0) {
      return res.status(200).json({ success: true });
    }

    // DB readiness check
    const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
    if (!hasDb) {
      return res.status(503).json({ 
        error: "Waitlist storage is not configured yet. Set DATABASE_URL and run prisma migrate." 
      });
    }

    // Normalize email
    const email = emailRaw.trim().toLowerCase();

    // Validate email
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // Validate tier
    if (!VALID_TIERS.includes(tierRaw as WaitlistTier)) {
      return res.status(400).json({ error: "Tier must be 'silver' or 'gold'" });
    }
    const tier = tierRaw as WaitlistTier;

    // Normalize source (cap length for safety)
    const source = sourceRaw ? sourceRaw.slice(0, 32) : null;

    // Insert (dedupe by email + tier unique constraint)
    // Try create first; if duplicate, return success without error
    try {
      await prisma.waitlistEntry.create({
        data: {
          email,
          tier,
          source,
          ipHash: null, // Phase B: leave null
        },
      });

      // Log in dev mode only
      if (process.env.NODE_ENV !== "production") {
        console.log(`[WAITLIST] + ${tier} ${email}`);
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      // Handle unique constraint violation (P2002 = duplicate entry)
      if (error.code === "P2002") {
        // Duplicate entry - still return success (don't reveal duplicates)
        return res.status(200).json({ success: true });
      }
      
      // Handle DB-not-ready errors
      const isDbNotReady = 
        error.code === "P2021" || // Table does not exist
        error.code === "P1001" || // Can't reach database server
        error.code === "P1002" || // Connection timeout
        (error.message && typeof error.message === "string" && error.message.toLowerCase().includes("does not exist"));
      
      if (isDbNotReady) {
        return res.status(503).json({ 
          error: "Waitlist storage is not ready yet. Run: npx prisma migrate dev --name add_waitlist_entry && npx prisma generate" 
        });
      }
      
      throw error;
    }
  } catch (error: any) {
    // Log the real error server-side for debugging
    console.error("[WAITLIST] Error processing signup:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

