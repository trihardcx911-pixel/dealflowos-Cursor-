-- Migration: Add temperature column to Lead table
-- Date: 2026-01-21
-- Idempotent: Uses IF NOT EXISTS and DO $$ guards to allow safe re-runs
--
-- Migration Runner:
--   psql "$DATABASE_URL" -f server/src/migrations/2026_01_21_add_lead_temperature.sql
--
-- Verification:
--   psql "$DATABASE_URL" -P pager=off -c 'SELECT column_name FROM information_schema.columns WHERE table_name = '\''Lead'\'' AND column_name = '\''temperature'\'';'

-- Add temperature column only if Lead table exists
DO $$
BEGIN
  -- Only proceed if Lead table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'Lead'
  ) THEN
    -- Add temperature column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Lead' 
      AND column_name = 'temperature'
    ) THEN
      ALTER TABLE "Lead" ADD COLUMN temperature TEXT NOT NULL DEFAULT 'cold';
    END IF;

    -- Add CHECK constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'lead_temperature_check'
    ) THEN
      ALTER TABLE "Lead" ADD CONSTRAINT lead_temperature_check 
        CHECK (temperature IN ('cold', 'warm', 'hot'));
    END IF;
  END IF;
END $$;







