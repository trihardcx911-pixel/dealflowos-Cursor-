-- CalendarEvent.userId type migration: Int -> String
-- This migration safely converts the userId column to match User.id (String/TEXT)

-- AlterTable
ALTER TABLE "CalendarEvent" ALTER COLUMN "userId" TYPE TEXT USING "userId"::text;










