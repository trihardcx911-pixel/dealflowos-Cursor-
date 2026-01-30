-- Migration: Phase 6 Account Safety & Session Enforcement
-- Adds session versioning, lock states, and token revocation

-- Step 1: Add session and lock fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "session_version" INT NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabled_at" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lock_state" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lock_reason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lock_expires_at" TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "User_session_version_idx" ON "User"("session_version");
CREATE INDEX IF NOT EXISTS "User_lock_state_expires_idx" ON "User"("lock_state", "lock_expires_at") WHERE "lock_state" != 'none';

-- Step 2: Create revoked_tokens table for immediate token revocation
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT
);

-- Indexes for revocation lookups
CREATE INDEX IF NOT EXISTS "revoked_tokens_user_id_revoked_at_idx" ON revoked_tokens("user_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "revoked_tokens_expires_at_idx" ON revoked_tokens("expires_at");










