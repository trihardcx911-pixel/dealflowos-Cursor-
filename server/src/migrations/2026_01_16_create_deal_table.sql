-- Migration: Create Deal table for pipeline tracking
-- Date: 2026-01-16
-- Idempotent: Uses IF NOT EXISTS to allow safe re-runs
--
-- Migration Runner:
--   psql "$DATABASE_URL" -f server/src/migrations/2026_01_16_create_deal_table.sql
--
-- Verification:
--   psql "$DATABASE_URL" -P pager=off -c 'SELECT table_name FROM information_schema.tables WHERE table_schema = '\''public'\'' AND table_name = '\''Deal'\'';'

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create Deal table
CREATE TABLE IF NOT EXISTS "Deal" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'NEW',
  "stageUpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "qualifiedAt" TIMESTAMPTZ,
  "contractAt" TIMESTAMPTZ,
  "escrowAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  "assignmentFeeExpected" NUMERIC(12,2),
  "assignmentFeeActual" NUMERIC(12,2),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "unique_org_lead" UNIQUE ("orgId", "leadId")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_deal_orgId" ON "Deal"("orgId");
CREATE INDEX IF NOT EXISTS "idx_deal_stage" ON "Deal"(stage);
CREATE INDEX IF NOT EXISTS "idx_deal_closedAt" ON "Deal"("closedAt") WHERE "closedAt" IS NOT NULL;








