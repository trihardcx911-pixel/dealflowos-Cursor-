-- Migration: Add urgency field to Task table
-- Date: 2026-01-14
-- Idempotent: Uses IF NOT EXISTS

-- Add urgency column with default 'medium'
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "urgency" TEXT NOT NULL DEFAULT 'medium';

-- Update existing rows to have 'medium' urgency (backward compatibility)
-- This is safe because we set NOT NULL DEFAULT above, but ensures consistency
UPDATE "Task" SET urgency = 'medium' WHERE urgency IS NULL;








