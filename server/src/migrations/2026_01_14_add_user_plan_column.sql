-- Migration: Add missing plan column to User table
-- Fixes schema drift: plan column missing from User table (Postgres error 42703)
-- Date: 2026-01-14
-- Idempotent: Uses IF NOT EXISTS to allow safe re-runs
--
-- Migration Runner:
--   psql "postgresql://imceobitch@localhost:5432/dealflowos_dev" -f server/src/migrations/2026_01_14_add_user_plan_column.sql
--
-- Verification:
--   psql "postgresql://imceobitch@localhost:5432/dealflowos_dev" -P pager=off -c 'SELECT column_name FROM information_schema.columns WHERE table_name = '\''User'\'' AND column_name = '\''plan'\'';'

-- Add plan column (matching add_firebase_user_fields.sql migration)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'trial';

-- Update existing rows that might have NULL plan (shouldn't happen with NOT NULL, but safe)
UPDATE "User" SET plan = 'trial' WHERE plan IS NULL;








