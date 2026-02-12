-- Migration: Add lead_type enum type for Lead.type column
-- Date: 2026-02-12
-- Idempotent: Uses IF NOT EXISTS to allow safe re-runs
--
-- Migration Runner:
--   psql "$DATABASE_URL" -f server/src/migrations/2026_02_12_add_lead_type_enum.sql
--
-- Verification:
--   psql "$DATABASE_URL" -P pager=off -c "SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='lead_type' ORDER BY e.enumsortorder;"

-- Create lead_type enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_type') THEN
    CREATE TYPE lead_type AS ENUM ('sfr', 'land', 'multi', 'other');
  END IF;
END $$;
