-- Migration: Create SubscriptionCancellationFeedback table for cancellation feedback storage
-- Date: 2026-01-17
-- Idempotent: Uses DO $$ guards to allow safe re-runs
--
-- Purpose: Store cancellation feedback (reason codes + optional text) for analysis
--
-- Migration Runner:
--   psql "$DATABASE_URL_PSQL" -f server/src/migrations/2026_01_17_create_subscription_cancellation_feedback.sql
--
-- Verification:
--   psql "$DATABASE_URL_PSQL" -P pager=off -c 'SELECT table_name FROM information_schema.tables WHERE table_name='\''SubscriptionCancellationFeedback'\'';'

-- Create SubscriptionCancellationFeedback table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'SubscriptionCancellationFeedback'
  ) THEN
    CREATE TABLE "SubscriptionCancellationFeedback" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "stripeSubscriptionId" TEXT,
      "stripeCustomerId" TEXT,
      "reasonCodes" TEXT[] NOT NULL DEFAULT '{}',
      "otherText" TEXT,
      "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    );
  END IF;
END $$;

-- Create index on (userId, createdAt DESC) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'SubscriptionCancellationFeedback' 
    AND indexname = 'idx_subscription_cancellation_feedback_user_created'
  ) THEN
    CREATE INDEX "idx_subscription_cancellation_feedback_user_created" 
    ON "SubscriptionCancellationFeedback"("userId", "createdAt" DESC);
  END IF;
END $$;

-- Create index on stripeSubscriptionId if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'SubscriptionCancellationFeedback' 
    AND indexname = 'idx_subscription_cancellation_feedback_subscription_id'
  ) THEN
    CREATE INDEX "idx_subscription_cancellation_feedback_subscription_id" 
    ON "SubscriptionCancellationFeedback"("stripeSubscriptionId") 
    WHERE "stripeSubscriptionId" IS NOT NULL;
  END IF;
END $$;







