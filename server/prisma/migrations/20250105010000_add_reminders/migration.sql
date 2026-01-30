-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "remindAt" TIMESTAMPTZ NOT NULL,
    "reminderOffset" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_idempotencyKey_key" ON "Reminder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Reminder_orgId_userId_status_remindAt_idx" ON "Reminder"("orgId", "userId", "status", "remindAt");

-- CreateIndex
CREATE INDEX "Reminder_status_remindAt_idx" ON "Reminder"("status", "remindAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_orgId_userId_targetType_targetId_reminderOffset_ch_key" ON "Reminder"("orgId", "userId", "targetType", "targetId", "reminderOffset", "channel");










