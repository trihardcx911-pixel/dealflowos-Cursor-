-- CreateTable
CREATE TABLE IF NOT EXISTS "ProcessedStripeEvent" (
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("event_id")
);
