-- Migration: Add trialEnd column to User table for subscription trial tracking
-- Date: 2026-01-17
-- Idempotent: Uses DO $$ guards to allow safe re-runs
--
-- Purpose: Store Stripe subscription.trial_end timestamp so billing UI can display
--          trial end dates and webhook handlers can persist trial information.
--
-- Migration Runner:
--   psql "$DATABASE_URL" -f server/src/migrations/2026_01_17_add_user_trial_end.sql
--
-- Verification:
--   psql "$DATABASE_URL" -P pager=off -c 'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '\''User'\'' AND column_name = '\''trialEnd'\'';'

-- Add trialEnd column only if User table exists
DO $$
BEGIN
  -- Only proceed if User table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'User'
  ) THEN
    -- Add trialEnd column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'User' 
      AND column_name = 'trialEnd'
    ) THEN
      ALTER TABLE "User" ADD COLUMN "trialEnd" TIMESTAMPTZ;
    END IF;
  END IF;
END $$;







