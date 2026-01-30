-- Migration: Phase X Auth Schema Alignment
-- Adds missing columns required by requireAuth middleware
-- Idempotent: Uses IF NOT EXISTS to allow safe re-runs

-- Step 1: Create revoked_tokens table if missing
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT
);

-- Indexes for revocation lookups
CREATE INDEX IF NOT EXISTS "revoked_tokens_user_id_revoked_at_idx" ON revoked_tokens(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS "revoked_tokens_expires_at_idx" ON revoked_tokens(expires_at);

-- Step 2: Create security_events table if missing
CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  user_id TEXT,
  ip TEXT,
  user_agent TEXT,
  path TEXT,
  method TEXT,
  status_code INT,
  reason TEXT,
  meta JSONB
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events(created_at);
CREATE INDEX IF NOT EXISTS security_events_user_id_created_at_idx ON security_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS security_events_event_type_created_at_idx ON security_events(event_type, created_at);

-- Step 3: Add missing User columns required by requireAuth
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS lock_state TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;

-- Step 4: Update existing rows to have default values (if columns were just added)
UPDATE "User" SET status = 'active' WHERE status IS NULL;
UPDATE "User" SET session_version = 1 WHERE session_version IS NULL;
UPDATE "User" SET lock_state = 'none' WHERE lock_state IS NULL;







