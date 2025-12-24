-- CreateEnum
CREATE TYPE "public"."LeadType" AS ENUM ('sfr', 'land', 'multi', 'other');

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Demo Org',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "marketProfile" TEXT NOT NULL DEFAULT 'metro_sfr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lead" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "public"."LeadType" NOT NULL DEFAULT 'sfr',
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "addressHash" TEXT NOT NULL,
    "notes" TEXT,
    "ruralFlag" BOOLEAN NOT NULL DEFAULT false,
    "populationOk" BOOLEAN NOT NULL DEFAULT true,
    "landSignals" JSONB,
    "legalFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadContact" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "dncStatus" TEXT,
    "dncCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CalendarEvent" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "urgency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_orgId_type_ruralFlag_idx" ON "public"."Lead"("orgId", "type", "ruralFlag");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_orgId_addressHash_key" ON "public"."Lead"("orgId", "addressHash");

-- CreateIndex
CREATE INDEX "LeadContact_leadId_type_idx" ON "public"."LeadContact"("leadId", "type");

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_date_idx" ON "public"."CalendarEvent"("userId", "date");

-- CreateIndex
CREATE INDEX "CalendarEvent_date_idx" ON "public"."CalendarEvent"("date");

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadContact" ADD CONSTRAINT "LeadContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
