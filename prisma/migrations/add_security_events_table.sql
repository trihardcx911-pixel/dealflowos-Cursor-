-- Migration: Add security_events table for authentication and authorization telemetry
-- Phase 4 Security Telemetry

CREATE TABLE IF NOT EXISTS "SecurityEvent" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type TEXT NOT NULL,
  user_id TEXT,
  firebase_uid TEXT,
  ip TEXT,
  user_agent TEXT,
  request_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: Prisma uses @default(uuid()) which generates UUID v4
-- PostgreSQL gen_random_uuid() also generates UUID v4, so they're compatible

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "SecurityEvent_event_type_idx" ON "SecurityEvent"("event_type");
CREATE INDEX IF NOT EXISTS "SecurityEvent_user_id_idx" ON "SecurityEvent"("user_id");
CREATE INDEX IF NOT EXISTS "SecurityEvent_created_at_idx" ON "SecurityEvent"("created_at");
CREATE INDEX IF NOT EXISTS "SecurityEvent_request_id_idx" ON "SecurityEvent"("request_id");

-- Composite index for user event queries
CREATE INDEX IF NOT EXISTS "SecurityEvent_user_id_created_at_idx" ON "SecurityEvent"("user_id", "created_at" DESC);

