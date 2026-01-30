-- Migration: Add missing User timestamp columns
-- Fixes schema drift: createdAt and updatedAt columns missing from User table (Postgres error 42703)
-- Date: 2026-01-11
-- Idempotent: Uses IF NOT EXISTS to allow safe re-runs
--
-- Migration Runner:
--   psql "postgresql://imceobitch@localhost:5432/dealflowos_dev" -f server/src/migrations/2026_01_11_add_user_timestamps.sql
--
-- Verification:
--   psql "postgresql://imceobitch@localhost:5432/dealflowos_dev" -P pager=off -c '\d+ "User"'
--   psql "postgresql://imceobitch@localhost:5432/dealflowos_dev" -P pager=off -c 'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '\''User'\'' AND column_name IN ('\''createdAt'\'', '\''updatedAt'\'');'

-- Add timestamp columns (matching Prisma schema: TIMESTAMP(3))
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows with timestamps if they are NULL (safe with COALESCE)
UPDATE "User" SET 
  "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "createdAt" IS NULL OR "updatedAt" IS NULL;








