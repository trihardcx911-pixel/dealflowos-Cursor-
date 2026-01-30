-- Migration: Add Firebase authentication and user management fields to User table
-- This migration adds fields required for Firebase-based authentication and session management

-- Add Firebase UID (unique identifier from Firebase)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firebase_uid" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_firebase_uid_key" ON "User"("firebase_uid") WHERE "firebase_uid" IS NOT NULL;

-- Add user profile fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;

-- Add subscription/plan fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- Add trial management fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ;

-- Add onboarding flag
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboarding_complete" BOOLEAN NOT NULL DEFAULT false;

-- Add index on firebase_uid for fast lookups
CREATE INDEX IF NOT EXISTS "User_firebase_uid_idx" ON "User"("firebase_uid") WHERE "firebase_uid" IS NOT NULL;










