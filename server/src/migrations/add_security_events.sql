-- Migration: Add security_events table for authentication and authorization telemetry
-- Phase 4 Security Telemetry

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










