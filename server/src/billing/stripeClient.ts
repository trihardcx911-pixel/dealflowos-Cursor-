import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("[BILLING] Missing STRIPE_SECRET_KEY");

  stripeInstance = new Stripe(key, {
    apiVersion: "2024-12-18.acacia" as any,
  });

  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return (
    !!process.env.STRIPE_SECRET_KEY &&
    !!process.env.STRIPE_DEFAULT_PRICE_ID &&
    !!process.env.STRIPE_DEFAULT_CUSTOMER_ID
  );
}

