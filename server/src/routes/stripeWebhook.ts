import express from "express";
import { getStripeClient, isStripeConfigured } from "../billing/stripeClient.js";

export const stripeWebhookRouter = express.Router();

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
          console.log("[STRIPE] checkout.session.completed", {
            customer: (event.data.object as any).customer,
            sessionId: (event.data.object as any).id,
          });
          break;

        case "invoice.payment_succeeded":
          console.log("[STRIPE] invoice.payment_succeeded", {
            invoice: (event.data.object as any).id,
            customer: (event.data.object as any).customer,
            amount: (event.data.object as any).amount_paid,
          });
          break;

        case "invoice.payment_failed":
          console.log("[STRIPE] invoice.payment_failed", {
            invoice: (event.data.object as any).id,
            customer: (event.data.object as any).customer,
            attemptCount: (event.data.object as any).attempt_count,
            nextPaymentAttempt: (event.data.object as any).next_payment_attempt,
          });
          break;

        case "customer.subscription.deleted":
          console.log("[STRIPE] customer.subscription.deleted", {
            subscription: (event.data.object as any).id,
            customer: (event.data.object as any).customer,
          });
          break;

        case "customer.subscription.updated":
          console.log("[STRIPE] customer.subscription.updated", {
            subscription: (event.data.object as any).id,
            customer: (event.data.object as any).customer,
            status: (event.data.object as any).status,
          });
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











