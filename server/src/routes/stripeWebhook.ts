import express from "express";
import { getStripeClient, isStripeConfigured } from "../billing/stripeClient.js";
import { prisma } from "../db/prisma.js";
import {
  mapStripeStatusToBillingStatus,
  mapPriceIdToTier,
  findUserByStripeIdentifiers,
  isDuplicateWebhook,
} from "../billing/stripeEntitlements.js";
import { BillingStatus } from "@prisma/client";
import { invalidateUserAccessCache } from "../middleware/requireAuth.js";

export const stripeWebhookRouter = express.Router();

// DB column capabilities (based on existing User table schema)
const DB_CAPABILITIES = {
  HAS_stripeCustomerId: true,
  HAS_stripeSubscriptionId: true,
  HAS_stripePriceId: true,
  HAS_trialEnd: true,
  HAS_billingStatus: true,
  HAS_cancelAtPeriodEnd: true,
  HAS_currentPeriodEnd: true,
  HAS_currentPeriodStart: true,
  HAS_subscriptionCancelledAt: true,
  HAS_stripeEndedAt: true,
};

/**
 * Extract normalized subscription state from Stripe subscription object
 */
function extractSubscriptionState(sub: any): {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEndSec: number | null;
  currentPeriodStartSec: number | null;
  canceledAtSec: number | null;
  endedAtSec: number | null;
  trialEndSec: number | null;
} {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  
  return {
    stripeCustomerId: customerId || '',
    stripeSubscriptionId: sub.id || '',
    stripePriceId: sub.items?.data?.[0]?.price?.id || null,
    status: sub.status || '',
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    currentPeriodEndSec: sub.current_period_end || null,
    currentPeriodStartSec: sub.current_period_start || null,
    canceledAtSec: sub.canceled_at || null,
    endedAtSec: sub.ended_at || null,
    trialEndSec: sub.trial_end || null,
  };
}

/**
 * Persist subscription state to User row (only using existing DB columns)
 */
async function persistSubscriptionStateToUser(state: ReturnType<typeof extractSubscriptionState>): Promise<void> {
  if (!state.stripeCustomerId) {
    if (process.env.BILLING_DEBUG === '1') {
      console.log('[STRIPE WEBHOOK] persistSubscriptionState: Missing stripeCustomerId');
    }
    return;
  }

  // Build update object with only fields that have DB columns
  const updateData: Record<string, unknown> = {};

  if (DB_CAPABILITIES.HAS_stripeSubscriptionId && state.stripeSubscriptionId) {
    updateData.stripeSubscriptionId = state.stripeSubscriptionId;
  }

  if (DB_CAPABILITIES.HAS_stripePriceId && state.stripePriceId) {
    updateData.stripePriceId = state.stripePriceId;
  }

  if (DB_CAPABILITIES.HAS_trialEnd) {
    updateData.trialEnd = state.trialEndSec ? new Date(state.trialEndSec * 1000) : null;
  }

  if (DB_CAPABILITIES.HAS_billingStatus && state.status) {
    updateData.billingStatus = mapStripeStatusToBillingStatus(state.status);
  }

  if (DB_CAPABILITIES.HAS_cancelAtPeriodEnd) {
    updateData.cancelAtPeriodEnd = state.cancelAtPeriodEnd;
  }

  if (DB_CAPABILITIES.HAS_currentPeriodEnd) {
    updateData.currentPeriodEnd = state.currentPeriodEndSec ? new Date(state.currentPeriodEndSec * 1000) : null;
  }

  if (DB_CAPABILITIES.HAS_currentPeriodStart) {
    updateData.currentPeriodStart = state.currentPeriodStartSec ? new Date(state.currentPeriodStartSec * 1000) : null;
  }

  if (DB_CAPABILITIES.HAS_subscriptionCancelledAt && state.canceledAtSec) {
    updateData.subscriptionCancelledAt = new Date(state.canceledAtSec * 1000);
  }

  if (DB_CAPABILITIES.HAS_stripeEndedAt) {
    updateData.stripeEndedAt = state.endedAtSec ? new Date(state.endedAtSec * 1000) : null;
  }

  // Skip update if no fields to persist
  if (Object.keys(updateData).length === 0) {
    if (process.env.BILLING_DEBUG === '1') {
      console.log('[STRIPE WEBHOOK] persistSubscriptionState: No fields to persist');
    }
    return;
  }

  try {
    const result = await prisma.user.updateMany({
      where: { stripeCustomerId: state.stripeCustomerId },
      data: updateData,
    });

    if (process.env.BILLING_DEBUG === '1') {
      if (result.count === 0) {
        console.log(`[STRIPE WEBHOOK] persistSubscriptionState: No user found for stripeCustomerId ${state.stripeCustomerId}`);
      } else {
        console.log(`[STRIPE WEBHOOK] persistSubscriptionState: Updated ${result.count} user(s) for stripeCustomerId ${state.stripeCustomerId}`);
      }
    }
  } catch (error: any) {
    console.error('[STRIPE WEBHOOK] Error persisting subscription state:', error);
    throw error; // Re-throw to be caught by webhook handler
  }
}

/**
 * Helper: Persist trialEnd from Stripe subscription.trial_end
 * @param stripeCustomerId - Stripe customer ID to find user
 * @param trialEndSec - Unix timestamp in seconds (null if no trial)
 * @deprecated Use persistSubscriptionStateToUser instead
 */
async function persistTrialEndByStripeCustomerId(
  stripeCustomerId: string | null | undefined,
  trialEndSec: number | null | undefined
): Promise<void> {
  if (!stripeCustomerId) {
    return;
  }

  const trialEnd = trialEndSec ? new Date(trialEndSec * 1000) : null;

  try {
    const result = await prisma.user.updateMany({
      where: { stripeCustomerId },
      data: { trialEnd },
    });

    if (process.env.BILLING_DEBUG === '1') {
      if (result.count === 0) {
        console.log(`[STRIPE WEBHOOK] persistTrialEnd: No user found for customerId ${stripeCustomerId}`);
      } else {
        console.log(`[STRIPE WEBHOOK] persistTrialEnd: Updated ${result.count} user(s) for customerId ${stripeCustomerId}`);
      }
    }
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error persisting trialEnd:", error);
    // Don't throw - allow webhook to continue processing other fields
  }
}

/**
 * Handler: checkout.session.completed
 * User completes checkout → subscription created (trial or paid)
 */
async function handleCheckoutSessionCompleted(stripe: any, event: any) {
  try {
    const session = event.data.object;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const metadata = session.metadata || {};
    const metadataUserId = metadata.userId;

    // Find user
    const user = await findUserByStripeIdentifiers(subscriptionId, customerId, metadataUserId);
    if (!user) {
      console.warn("[STRIPE WEBHOOK] checkout.session.completed: User not found", { customerId, subscriptionId, metadataUserId });
      return;
    }

    // Idempotency check
    if (await isDuplicateWebhook(user.id, event.id)) {
      console.log("[STRIPE WEBHOOK] checkout.session.completed: Duplicate event", { userId: user.id, eventId: event.id });
      return;
    }

    // Retrieve subscription to get full details
    if (!subscriptionId) {
      console.warn("[STRIPE WEBHOOK] checkout.session.completed: No subscription ID in session");
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    const billingStatus = mapStripeStatusToBillingStatus(subscription.status);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    const currentPeriodEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000)
      : null;
    const trialEnd = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000)
      : null;

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customerId || undefined,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId || undefined,
        billingStatus,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        trialEnd,
        lastStripeEventId: event.id,
      },
    });

    // Invalidate auth cache so user gets immediate access
    invalidateUserAccessCache(user.id);

    console.log(`[STRIPE WEBHOOK] checkout.session.completed: Updated user ${user.id}`, {
      billingStatus,
      subscriptionId,
    });
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error in checkout.session.completed:", error);
    throw error; // Re-throw to be caught by outer try/catch
  }
}

/**
 * Handler: invoice.payment_succeeded
 * Payment successful (trial end or renewal)
 */
async function handleInvoicePaymentSucceeded(stripe: any, event: any) {
  try {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

    // Find user
    const user = await findUserByStripeIdentifiers(subscriptionId, customerId);
    if (!user) {
      console.warn("[STRIPE WEBHOOK] invoice.payment_succeeded: User not found", { customerId, subscriptionId });
      return;
    }

    // Idempotency check
    if (await isDuplicateWebhook(user.id, event.id)) {
      console.log("[STRIPE WEBHOOK] invoice.payment_succeeded: Duplicate event", { userId: user.id, eventId: event.id });
      return;
    }

    // Retrieve subscription to get current state
    if (!subscriptionId) {
      console.warn("[STRIPE WEBHOOK] invoice.payment_succeeded: No subscription ID in invoice");
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    const billingStatus = mapStripeStatusToBillingStatus(subscription.status);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    const currentPeriodEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000)
      : null;
    const trialEnd = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000)
      : null;

    // Update user (set to active, sync price/period)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        billingStatus,
        stripePriceId: priceId || undefined,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        trialEnd,
        lastStripeEventId: event.id,
      },
    });

    // Invalidate auth cache so billing status is immediately reflected
    invalidateUserAccessCache(user.id);

    console.log(`[STRIPE WEBHOOK] invoice.payment_succeeded: Updated user ${user.id}`, {
      billingStatus,
    });
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error in invoice.payment_succeeded:", error);
    throw error;
  }
}

/**
 * Handler: invoice.payment_failed
 * Payment failed (card declined, etc.)
 */
async function handleInvoicePaymentFailed(stripe: any, event: any) {
  try {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

    // Find user
    const user = await findUserByStripeIdentifiers(subscriptionId, customerId);
    if (!user) {
      console.warn("[STRIPE WEBHOOK] invoice.payment_failed: User not found", { customerId, subscriptionId });
      return;
    }

    // Idempotency check
    if (await isDuplicateWebhook(user.id, event.id)) {
      console.log("[STRIPE WEBHOOK] invoice.payment_failed: Duplicate event", { userId: user.id, eventId: event.id });
      return;
    }

    // Update user to past_due
    await prisma.user.update({
      where: { id: user.id },
      data: {
        billingStatus: BillingStatus.past_due,
        lastStripeEventId: event.id,
      },
    });

    // Invalidate auth cache so past_due status is immediately reflected
    invalidateUserAccessCache(user.id);

    console.log(`[STRIPE WEBHOOK] invoice.payment_failed: Updated user ${user.id} to past_due`);
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error in invoice.payment_failed:", error);
    throw error;
  }
}

/**
 * Handler: customer.subscription.updated
 * Subscription changed (status, price, cancel_at_period_end, etc.)
 */
async function handleSubscriptionUpdated(stripe: any, event: any) {
  try {
    const subscription = event.data.object as any;
    const subscriptionId = subscription.id;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

    // Find user for idempotency check
    const user = await findUserByStripeIdentifiers(subscriptionId, customerId);
    if (!user) {
      console.warn("[STRIPE WEBHOOK] customer.subscription.updated: User not found", { customerId, subscriptionId });
      // Still attempt persistence by customerId (BOLA-safe)
    } else {
      // Idempotency check
      if (await isDuplicateWebhook(user.id, event.id)) {
        console.log("[STRIPE WEBHOOK] customer.subscription.updated: Duplicate event", { userId: user.id, eventId: event.id });
        return;
      }
    }

    // Extract and persist subscription state
    const state = extractSubscriptionState(subscription);
    await persistSubscriptionStateToUser(state);

    // Also update lastStripeEventId if user was found
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastStripeEventId: event.id },
      });

      // Invalidate auth cache so subscription changes are immediately reflected
      invalidateUserAccessCache(user.id);
    }

    if (process.env.BILLING_DEBUG === '1') {
      console.log(`[STRIPE WEBHOOK] customer.subscription.updated: Persisted state for customerId ${state.stripeCustomerId}`, {
        status: state.status,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      });
    }
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error in customer.subscription.updated:", error);
    throw error;
  }
}

/**
 * Handler: customer.subscription.created
 * New subscription created (edge case when checkout.session.completed is missed)
 */
async function handleSubscriptionCreated(stripe: any, event: any) {
  try {
    const subscription = event.data.object as any;
    const subscriptionId = subscription.id;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

    // Find user for idempotency check
    const user = await findUserByStripeIdentifiers(subscriptionId, customerId);
    if (!user) {
      console.warn("[STRIPE WEBHOOK] customer.subscription.created: User not found", { customerId, subscriptionId });
      // Still attempt persistence by customerId (BOLA-safe)
    } else {
      // Idempotency check
      if (await isDuplicateWebhook(user.id, event.id)) {
        console.log("[STRIPE WEBHOOK] customer.subscription.created: Duplicate event", { userId: user.id, eventId: event.id });
        return;
      }
    }

    // Extract and persist subscription state
    const state = extractSubscriptionState(subscription);
    await persistSubscriptionStateToUser(state);

    // Also update lastStripeEventId if user was found
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastStripeEventId: event.id },
      });

      // Invalidate auth cache so new subscription is immediately reflected
      invalidateUserAccessCache(user.id);
    }

    if (process.env.BILLING_DEBUG === '1') {
      console.log(`[STRIPE WEBHOOK] customer.subscription.created: Persisted state for customerId ${state.stripeCustomerId}`, {
        status: state.status,
        subscriptionId: state.stripeSubscriptionId,
      });
    }
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error in customer.subscription.created:", error);
    throw error;
  }
}

/**
 * Handler: customer.subscription.deleted
 * Subscription canceled (user canceled or Stripe canceled after payment failure)
 */
async function handleSubscriptionDeleted(stripe: any, event: any) {
  try {
    const subscription = event.data.object as any;
    const subscriptionId = subscription.id;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

    // Find user for idempotency check
    const user = await findUserByStripeIdentifiers(subscriptionId, customerId);
    if (!user) {
      console.warn("[STRIPE WEBHOOK] customer.subscription.deleted: User not found", { customerId, subscriptionId });
      // Still attempt persistence by customerId (BOLA-safe)
    } else {
      // Idempotency check
      if (await isDuplicateWebhook(user.id, event.id)) {
        console.log("[STRIPE WEBHOOK] customer.subscription.deleted: Duplicate event", { userId: user.id, eventId: event.id });
        return;
      }
    }

    // Extract and persist subscription state (includes canceled status and timestamps)
    const state = extractSubscriptionState(subscription);
    await persistSubscriptionStateToUser(state);

    // Also explicitly set canceled status and clear cancelAtPeriodEnd if user was found
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          billingStatus: BillingStatus.canceled,
          cancelAtPeriodEnd: false,
          lastStripeEventId: event.id,
          // Keep stripeSubscriptionId (don't null it - audit trail)
        },
      });

      // Invalidate auth cache so canceled status is immediately reflected
      invalidateUserAccessCache(user.id);
    }

    if (process.env.BILLING_DEBUG === '1') {
      console.log(`[STRIPE WEBHOOK] customer.subscription.deleted: Persisted state for customerId ${state.stripeCustomerId}`, {
        status: state.status,
        canceledAt: state.canceledAtSec,
      });
    }
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error in customer.subscription.deleted:", error);
    throw error;
  }
}

// IMPORTANT: This route must use raw body parsing for signature verification
stripeWebhookRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!isStripeConfigured()) {
      return res.status(503).json({
        error: "Stripe integration is not configured",
      });
    }

    const stripe = getStripeClient();
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET is not set");
      return res.status(500).json({
        error: "Webhook secret not configured",
      });
    }

    if (!sig) {
      console.error("[STRIPE WEBHOOK] Missing stripe-signature header");
      return res.status(400).json({
        error: "Missing signature",
      });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error("[STRIPE WEBHOOK] Signature verification failed:", err.message);
      return res.status(400).json({
        error: "Invalid signature",
        message: err.message,
      });
    }

    // Handle different event types
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(stripe, event);
          break;

        case "customer.subscription.created":
          await handleSubscriptionCreated(stripe, event);
          break;

        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(stripe, event);
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(stripe, event);
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(stripe, event);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(stripe, event);
          break;

        default:
          console.log(`[STRIPE] Unhandled event type: ${event.type}`);
      }
    } catch (err: any) {
      console.error("[STRIPE WEBHOOK] Error handling event:", err);
      // Still return 200 to prevent Stripe from retrying
    }

    res.json({ received: true });
  }
);











