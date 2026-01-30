-- Migration: Add User profile columns (display_name, photo_url, firebase_uid)
-- Date: 2026-01-20
-- Idempotent: Uses IF NOT EXISTS and DO $$ blocks to allow safe re-runs
--
-- Migration Runner:
--   psql "$DATABASE_URL" -f server/src/migrations/2026_01_20_add_user_profile_columns.sql
--
-- Verification:
--   psql "$DATABASE_URL" -P pager=off -c 'SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='\''public'\'' AND table_name='\''User'\'' AND column_name IN ('\''display_name'\'', '\''photo_url'\'', '\''firebase_uid'\'') ORDER BY column_name;'

-- Add display_name column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'User' 
      AND column_name = 'display_name'
  ) THEN
    ALTER TABLE "User" ADD COLUMN display_name TEXT;
  END IF;
END $$;

-- Add photo_url column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'User' 
      AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE "User" ADD COLUMN photo_url TEXT;
  END IF;
END $$;

-- Add firebase_uid column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'User' 
      AND column_name = 'firebase_uid'
  ) THEN
    ALTER TABLE "User" ADD COLUMN firebase_uid TEXT;
  END IF;
END $$;

-- Create partial unique index on firebase_uid if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'User' 
      AND indexname = 'User_firebase_uid_key'
  ) THEN
    CREATE UNIQUE INDEX "User_firebase_uid_key" 
    ON "User"(firebase_uid) 
    WHERE firebase_uid IS NOT NULL;
  END IF;
END $$;







