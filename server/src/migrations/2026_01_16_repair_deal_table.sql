-- Migration: Repair existing Deal table schema to match expected columns
-- Date: 2026-01-16
-- Purpose: This migration repairs legacy Deal schemas so later migrations don't fail.
--          It is idempotent and does not drop data or columns.
-- Idempotent: Uses IF NOT EXISTS and DO $$ guards to allow safe re-runs
--
-- Migration Runner:
--   psql "$DATABASE_URL" -f server/src/migrations/2026_01_16_repair_deal_table.sql
--
-- Verification:
--   psql "$DATABASE_URL" -P pager=off -c '\d "Deal"'

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create Deal table if it doesn't exist (with full correct schema)
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

-- If Deal table already exists, add missing columns safely
DO $$
BEGIN
  -- Only proceed if Deal table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'Deal'
  ) THEN
    
    -- Add id column if missing (as UUID with default)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'id'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN id UUID DEFAULT gen_random_uuid();
      -- Note: Cannot add PRIMARY KEY constraint if table already has a PK
      -- This will be handled by app logic or a separate migration if needed
    END IF;

    -- Add orgId column if missing (as nullable to avoid constraint issues with existing rows)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'orgId'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "orgId" TEXT;
    END IF;

    -- Add leadId column if missing (as nullable to avoid constraint issues with existing rows)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'leadId'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "leadId" TEXT;
    END IF;

    -- Add stage column if missing (with default)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'stage'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN stage TEXT DEFAULT 'NEW';
    END IF;

    -- Add stageUpdatedAt column if missing (with default)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'stageUpdatedAt'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "stageUpdatedAt" TIMESTAMPTZ DEFAULT now();
    END IF;

    -- Add qualifiedAt column if missing (nullable)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'qualifiedAt'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "qualifiedAt" TIMESTAMPTZ;
    END IF;

    -- Add contractAt column if missing (nullable)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'contractAt'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "contractAt" TIMESTAMPTZ;
    END IF;

    -- Add escrowAt column if missing (nullable)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'escrowAt'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "escrowAt" TIMESTAMPTZ;
    END IF;

    -- Add closedAt column if missing (nullable)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'closedAt'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "closedAt" TIMESTAMPTZ;
    END IF;

    -- Add assignmentFeeExpected column if missing (nullable)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'assignmentFeeExpected'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "assignmentFeeExpected" NUMERIC(12,2);
    END IF;

    -- Add assignmentFeeActual column if missing (nullable)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'assignmentFeeActual'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "assignmentFeeActual" NUMERIC(12,2);
    END IF;

    -- Add createdAt column if missing (with default)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'createdAt'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "createdAt" TIMESTAMPTZ DEFAULT now();
    END IF;

    -- Add updatedAt column if missing (with default)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'updatedAt'
    ) THEN
      ALTER TABLE "Deal" ADD COLUMN "updatedAt" TIMESTAMPTZ DEFAULT now();
    END IF;

    -- Add unique constraint (orgId, leadId) if both columns exist and constraint doesn't exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'orgId'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'leadId'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND constraint_name = 'unique_org_lead'
    ) THEN
      ALTER TABLE "Deal" ADD CONSTRAINT "unique_org_lead" UNIQUE ("orgId", "leadId");
    END IF;

  END IF;
END $$;

-- Create indexes safely (only if columns exist)
DO $$
BEGIN
  -- Only proceed if Deal table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'Deal'
  ) THEN

    -- Create orgId index if column exists and index doesn't exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'orgId'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'Deal' 
      AND indexname = 'idx_deal_orgId'
    ) THEN
      CREATE INDEX "idx_deal_orgId" ON "Deal"("orgId");
    END IF;

    -- Create stage index if column exists and index doesn't exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'stage'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'Deal' 
      AND indexname = 'idx_deal_stage'
    ) THEN
      CREATE INDEX "idx_deal_stage" ON "Deal"(stage);
    END IF;

    -- Create closedAt partial index if column exists and index doesn't exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Deal' 
      AND column_name = 'closedAt'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'Deal' 
      AND indexname = 'idx_deal_closedAt'
    ) THEN
      CREATE INDEX "idx_deal_closedAt" ON "Deal"("closedAt") WHERE "closedAt" IS NOT NULL;
    END IF;

  END IF;
END $$;


