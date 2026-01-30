-- Migration: Add missing User columns for billing functionality
-- Fixes schema drift: email column missing from User table (Postgres error 42703)
-- Date: 2026-01-11
-- Idempotent: Uses IF NOT EXISTS to allow safe re-runs

-- Core billing columns (required for checkout session creation)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- Billing status columns (used by requireAuth middleware and stripeWebhook)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "billingStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMPTZ;

-- Stripe subscription tracking columns (used by stripeWebhook)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastStripeEventId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionCancelledAt" TIMESTAMPTZ;

-- Create unique indexes on Stripe IDs (partial indexes for nullable columns)
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" 
  ON "User"("stripeCustomerId") 
  WHERE "stripeCustomerId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeSubscriptionId_key"
  ON "User"("stripeSubscriptionId")
  WHERE "stripeSubscriptionId" IS NOT NULL;








