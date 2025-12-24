-- AlterTable
ALTER TABLE "public"."Lead" ADD COLUMN     "arv" DECIMAL(12,2),
ADD COLUMN     "bathrooms" DECIMAL(3,1),
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "dealScore" DECIMAL(5,2),
ADD COLUMN     "desiredAssignmentFee" DECIMAL(12,2) NOT NULL DEFAULT 10000,
ADD COLUMN     "estimatedRepairs" DECIMAL(12,2),
ADD COLUMN     "investorMultiplier" DECIMAL(4,3) NOT NULL DEFAULT 0.70,
ADD COLUMN     "isQualified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lotSize" INTEGER,
ADD COLUMN     "moa" DECIMAL(12,2),
ADD COLUMN     "offerPrice" DECIMAL(12,2),
ADD COLUMN     "propertyType" TEXT,
ADD COLUMN     "sellerEmail" TEXT,
ADD COLUMN     "sellerName" TEXT,
ADD COLUMN     "sellerPhone" TEXT,
ADD COLUMN     "squareFeet" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "yearBuilt" INTEGER;

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserOrgMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "UserOrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Deal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealType" TEXT NOT NULL,
    "assignmentFee" DECIMAL(12,2),
    "profit" DECIMAL(12,2),
    "buyerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "closeDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PipelineHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSettings" (
    "userId" TEXT NOT NULL,
    "defaultMultiplier" DECIMAL(4,3) NOT NULL DEFAULT 0.70,
    "defaultAssignmentFee" DECIMAL(12,2) NOT NULL DEFAULT 10000,
    "defaultFollowupInterval" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserOrgMembership_userId_orgId_key" ON "public"."UserOrgMembership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_eventType_idx" ON "public"."LeadEvent"("leadId", "eventType");

-- CreateIndex
CREATE INDEX "Deal_userId_status_idx" ON "public"."Deal"("userId", "status");

-- CreateIndex
CREATE INDEX "Deal_orgId_closeDate_idx" ON "public"."Deal"("orgId", "closeDate");

-- CreateIndex
CREATE INDEX "PipelineHistory_leadId_changedAt_idx" ON "public"."PipelineHistory"("leadId", "changedAt");

-- CreateIndex
CREATE INDEX "Lead_orgId_status_idx" ON "public"."Lead"("orgId", "status");

-- AddForeignKey
ALTER TABLE "public"."UserOrgMembership" ADD CONSTRAINT "UserOrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserOrgMembership" ADD CONSTRAINT "UserOrgMembership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deal" ADD CONSTRAINT "Deal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PipelineHistory" ADD CONSTRAINT "PipelineHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
