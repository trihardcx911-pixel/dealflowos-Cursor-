import Stripe from "stripe";

let stripeInstance: any = null;

/**
 * Get Stripe secret key with backward-compatible aliasing
 * Returns STRIPE_SECRET_KEY if present, otherwise STRIPE_ACTIVE_KEY
 */
function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (key) return key;
  
  const altKey = process.env.STRIPE_ACTIVE_KEY?.trim();
  if (altKey) return altKey;
  
  return null;
}

export function getStripeClient(): any {
  if (stripeInstance) return stripeInstance;
  const key = getStripeSecretKey();
  if (!key) throw new Error("[BILLING] Missing STRIPE_SECRET_KEY or STRIPE_ACTIVE_KEY");

  // DEV-only: Safe diagnostic for Stripe key formatting
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const keyPrefix = key.slice(0, 8);
    const keyLen = key.length;
    const hasWhitespace = /\s/.test(key);
    
    console.log("[STRIPE ENV]", {
      keyPrefix,
      keyLen,
      hasWhitespace,
    });
    
    if (hasWhitespace) {
      throw new Error("STRIPE_SECRET_KEY contains whitespace (likely malformed .env)");
    }
  }

  stripeInstance = new Stripe(key, {
    apiVersion: "2024-12-18.acacia" as any,
  });

  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  // Minimum requirement: secret key only (with backward-compatible aliasing)
  // Tier price IDs and FRONTEND_URL are checked in billing routes
  return getStripeSecretKey() !== null;
}

