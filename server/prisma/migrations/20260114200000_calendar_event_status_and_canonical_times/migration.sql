-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled';

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "missedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 480;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_userId_status_startAt_idx" ON "CalendarEvent"("userId", "status", "startAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_userId_status_endAt_idx" ON "CalendarEvent"("userId", "status", "endAt");








