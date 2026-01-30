-- Migration: Add assignedToUserId column to Lead table
-- Date: 2026-01-16
-- Idempotent: Uses IF NOT EXISTS and DO $$ guards to allow safe re-runs
--
-- Migration Runner:
--   psql "$DATABASE_URL" -f server/src/migrations/2026_01_16_add_lead_assignedToUserId.sql
--
-- Verification:
--   psql "$DATABASE_URL" -P pager=off -c 'SELECT column_name FROM information_schema.columns WHERE table_name = '\''Lead'\'' AND column_name = '\''assignedToUserId'\'';'

-- Add assignedToUserId column only if Lead table exists
DO $$
BEGIN
  -- Only proceed if Lead table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'Lead'
  ) THEN
    -- Add assignedToUserId column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Lead' 
      AND column_name = 'assignedToUserId'
    ) THEN
      ALTER TABLE "Lead" ADD COLUMN "assignedToUserId" TEXT;
    END IF;

    -- Create partial index on assignedToUserId where not null (if index doesn't exist)
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'Lead' 
      AND indexname = 'idx_lead_assignedToUserId'
    ) THEN
      CREATE INDEX "idx_lead_assignedToUserId" ON "Lead"("assignedToUserId") WHERE "assignedToUserId" IS NOT NULL;
    END IF;
  END IF;
END $$;








