-- Migration: Add missing subscription state columns to User table
-- Date: 2026-01-17
-- Idempotent: Uses DO $$ guards to allow safe re-runs
--
-- Purpose: Add columns needed for complete Stripe subscription state persistence:
--          - currentPeriodStart: stores subscription.current_period_start
--          - stripeEndedAt: stores subscription.ended_at
--
-- Note: subscriptionCancelledAt already exists and is used for Stripe canceled_at,
--       so we do NOT add stripeCanceledAt to avoid duplication.
--
-- Migration Runner:
--   psql "$DATABASE_URL_PSQL" -f server/src/migrations/2026_01_17_add_subscription_state_columns.sql
--
-- Verification:
--   psql "$DATABASE_URL_PSQL" -P pager=off -c 'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '\''User'\'' AND column_name IN ('\''currentPeriodStart'\'', '\''stripeEndedAt'\'') ORDER BY column_name;'

-- Add currentPeriodStart column only if User table exists
DO $$
BEGIN
  -- Only proceed if User table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'User'
  ) THEN
    -- Add currentPeriodStart column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'User' 
      AND column_name = 'currentPeriodStart'
    ) THEN
      ALTER TABLE "User" ADD COLUMN "currentPeriodStart" TIMESTAMP WITHOUT TIME ZONE;
    END IF;
  END IF;
END $$;

-- Add stripeEndedAt column only if User table exists
DO $$
BEGIN
  -- Only proceed if User table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'User'
  ) THEN
    -- Add stripeEndedAt column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'User' 
      AND column_name = 'stripeEndedAt'
    ) THEN
      ALTER TABLE "User" ADD COLUMN "stripeEndedAt" TIMESTAMP WITHOUT TIME ZONE;
    END IF;
  END IF;
END $$;







