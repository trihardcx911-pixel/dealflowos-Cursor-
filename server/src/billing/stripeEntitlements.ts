/**
 * Stripe Entitlement Helpers
 * 
 * Utilities for mapping Stripe subscription data to User billing state.
 */

import { prisma } from "../db/prisma.js";
import { BillingStatus } from "@prisma/client";

/**
 * Map Stripe subscription.status to BillingStatus enum
 */
export function mapStripeStatusToBillingStatus(stripeStatus: string): BillingStatus {
  const statusMap: Record<string, BillingStatus> = {
    trialing: BillingStatus.trialing,
    active: BillingStatus.active,
    past_due: BillingStatus.past_due,
    canceled: BillingStatus.canceled,
    unpaid: BillingStatus.unpaid,
    incomplete: BillingStatus.incomplete,
    incomplete_expired: BillingStatus.incomplete_expired,
  };
  
  return statusMap[stripeStatus] || BillingStatus.unpaid; // Default to inactive-safe
}

/**
 * Map Stripe price ID to tier string (bronze/silver/gold)
 */
export function mapPriceIdToTier(priceId: string): "bronze" | "silver" | "gold" | null {
  const bronzePriceId = process.env.STRIPE_PRICE_BRONZE_MONTHLY;
  const silverPriceId = process.env.STRIPE_PRICE_SILVER_MONTHLY;
  const goldPriceId = process.env.STRIPE_PRICE_GOLD_MONTHLY;
  
  if (priceId === bronzePriceId) return "bronze";
  if (priceId === silverPriceId) return "silver";
  if (priceId === goldPriceId) return "gold";
  
  return null;
}

/**
 * Find user by Stripe identifiers (subscription ID, customer ID, or metadata userId)
 * Returns null if not found.
 */
export async function findUserByStripeIdentifiers(
  subscriptionId?: string | null,
  customerId?: string | null,
  metadataUserId?: string | null
): Promise<{ id: string } | null> {
  // Strategy 1: Find by subscription ID (most reliable)
  if (subscriptionId) {
    const user = await prisma.user.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      select: { id: true },
    });
    if (user) return user;
  }
  
  // Strategy 2: Find by customer ID
  if (customerId) {
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (user) return user;
  }
  
  // Strategy 3: Find by metadata userId (from checkout session)
  if (metadataUserId) {
    const user = await prisma.user.findUnique({
      where: { id: metadataUserId },
      select: { id: true },
    });
    if (user) return user;
  }
  
  return null;
}

/**
 * Check if webhook event is duplicate (idempotency)
 */
export async function isDuplicateWebhook(
  userId: string,
  eventId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastStripeEventId: true },
  });
  
  return user?.lastStripeEventId === eventId;
}








