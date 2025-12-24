-- CreateEnum
CREATE TYPE "public"."LegalStage" AS ENUM ('PRE_CONTRACT', 'UNDER_CONTRACT', 'ASSIGNMENT_IN_PROGRESS', 'ASSIGNED', 'TITLE_CLEARING', 'CLEARED_TO_CLOSE', 'CLOSED', 'DEAD');

-- AlterTable
ALTER TABLE "public"."Deal" ADD COLUMN "legalStage" "public"."LegalStage" NOT NULL DEFAULT 'PRE_CONTRACT';

-- CreateTable
CREATE TABLE "public"."ContractMetadata" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "sellerName" TEXT,
    "buyerName" TEXT,
    "contractPrice" DECIMAL(12,2),
    "contractDate" TIMESTAMP(3),
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssignmentMetadata" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "endBuyerName" TEXT,
    "assignmentFee" DECIMAL(12,2),
    "assignmentDate" TIMESTAMP(3),
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TitleMetadata" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "titleCompany" TEXT,
    "escrowOfficer" TEXT,
    "escrowNumber" TEXT,
    "expectedCloseDate" TIMESTAMP(3),
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitleMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DealEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JurisdictionProfile" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "county" TEXT,
    "profileVersion" TEXT NOT NULL DEFAULT '1.0',
    "requiredFields" JSONB NOT NULL,
    "timingRules" JSONB,
    "featureFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JurisdictionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LegalAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ackType" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractMetadata_dealId_key" ON "public"."ContractMetadata"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentMetadata_dealId_key" ON "public"."AssignmentMetadata"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "TitleMetadata_dealId_key" ON "public"."TitleMetadata"("dealId");

-- CreateIndex
CREATE INDEX "DealEvent_dealId_eventType_idx" ON "public"."DealEvent"("dealId", "eventType");

-- CreateIndex
CREATE INDEX "DealEvent_dealId_createdAt_idx" ON "public"."DealEvent"("dealId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JurisdictionProfile_state_county_profileVersion_key" ON "public"."JurisdictionProfile"("state", "county", "profileVersion");

-- CreateIndex
CREATE INDEX "JurisdictionProfile_state_idx" ON "public"."JurisdictionProfile"("state");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcknowledgement_userId_orgId_ackType_key" ON "public"."LegalAcknowledgement"("userId", "orgId", "ackType");

-- AddForeignKey
ALTER TABLE "public"."ContractMetadata" ADD CONSTRAINT "ContractMetadata_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignmentMetadata" ADD CONSTRAINT "AssignmentMetadata_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TitleMetadata" ADD CONSTRAINT "TitleMetadata_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LegalAcknowledgement" ADD CONSTRAINT "LegalAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LegalAcknowledgement" ADD CONSTRAINT "LegalAcknowledgement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



