-- AlterTable: Add Firebase auth and session management fields to User
-- Minimal fields required by sessionService.ts (lines 62, 80-94, 120-133)

-- Firebase auth fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firebase_uid" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;

-- Plan & status fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboarding_complete" BOOLEAN NOT NULL DEFAULT false;

-- Session management
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 1;

-- Lock state fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lock_state" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabled_at" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lock_reason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lock_expires_at" TIMESTAMPTZ;

-- Timestamps (may already exist from Prisma, safe to add IF NOT EXISTS)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: Unique indexes for auth fields
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_firebase_uid_key" ON "User"("firebase_uid");

-- CreateIndex: Lookup index for firebase_uid
CREATE INDEX IF NOT EXISTS "User_firebase_uid_idx" ON "User"("firebase_uid");

-- CreateTable: security_events (required by securityEvents.ts line 60)
CREATE TABLE IF NOT EXISTS "security_events" (
    "id" BIGSERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "user_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "path" TEXT,
    "method" TEXT,
    "status_code" INTEGER,
    "reason" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Indexes for security_events queries
CREATE INDEX IF NOT EXISTS "security_events_created_at_idx" ON "security_events"("created_at");
CREATE INDEX IF NOT EXISTS "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "security_events_event_type_created_at_idx" ON "security_events"("event_type", "created_at");
