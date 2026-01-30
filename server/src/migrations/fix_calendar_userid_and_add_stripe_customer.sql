-- Migration: Fix CalendarEvent.userId type mismatch and add Stripe customer isolation
-- Phase 3 Security Hardening

-- Step 1: Add stripe_customer_id to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId") WHERE "stripeCustomerId" IS NOT NULL;

-- Step 2: Fix CalendarEvent.userId type mismatch
-- Strategy: Clear existing events (MVP/dev data) then change column type
-- Note: Old Int userId values (e.g., 1) cannot map to cuid strings deterministically
-- For MVP/dev, clearing is the honest approach. For production, you'd need a user mapping table.

-- Clear existing calendar events (MVP/dev data only - adjust for production)
DELETE FROM "CalendarEvent";

-- Drop the old integer column constraint/index
DROP INDEX IF EXISTS "CalendarEvent_userId_date_idx";
ALTER TABLE "CalendarEvent" DROP COLUMN IF EXISTS "userId";

-- Add new string userId column
ALTER TABLE "CalendarEvent" ADD COLUMN "userId" TEXT NOT NULL;

-- Recreate index with string userId
CREATE INDEX IF NOT EXISTS "CalendarEvent_userId_date_idx" ON "CalendarEvent"("userId", "date");

