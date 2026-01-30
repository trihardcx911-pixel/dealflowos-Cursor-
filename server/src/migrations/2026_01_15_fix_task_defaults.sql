-- Migration: Add missing defaults to Task table to match Prisma schema expectations
-- Fixes: POST /api/tasks 500 error due to NOT NULL constraint violations
-- Date: 2026-01-15
-- Idempotent: Uses ALTER COLUMN SET DEFAULT (safe to re-run)
--
-- Migration Runner:
--   psql "postgresql://imceobitch@localhost:5432/dealflowos_dev" -f server/src/migrations/2026_01_15_fix_task_defaults.sql
--
-- Verification:
--   psql "postgresql://imceobitch@localhost:5432/dealflowos_dev" -P pager=off -c '\d+ "Task"'

-- Ensure status default
ALTER TABLE "Task"
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- Ensure createdAt default
ALTER TABLE "Task"
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Ensure updatedAt default
ALTER TABLE "Task"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Backfill any existing NULLs defensively (should be none, but safe)
UPDATE "Task" SET "status" = 'pending' WHERE "status" IS NULL;
UPDATE "Task" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "Task" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- Note: id cannot have a DB default (Prisma generates cuid() client-side)
-- Code will explicitly provide id in taskStore.createTask()








