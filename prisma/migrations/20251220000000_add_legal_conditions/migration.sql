-- CreateEnum
CREATE TYPE "public"."LegalConditionCategory" AS ENUM ('TITLE', 'PROBATE', 'LIEN', 'HOA', 'JUDGMENT', 'HEIRSHIP', 'MUNICIPAL', 'CONTRACTUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LegalConditionSeverity" AS ENUM ('INFORMATIONAL', 'RISKY', 'BLOCKING');

-- CreateEnum
CREATE TYPE "public"."LegalConditionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."LegalConditionSource" AS ENUM ('TITLE_COMPANY', 'ATTORNEY', 'WHOLESALER', 'BUYER', 'SELLER', 'OTHER');

-- CreateTable
CREATE TABLE "public"."LegalCondition" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "category" "public"."LegalConditionCategory" NOT NULL,
    "severity" "public"."LegalConditionSeverity" NOT NULL,
    "status" "public"."LegalConditionStatus" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "source" "public"."LegalConditionSource",
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalCondition_dealId_status_idx" ON "public"."LegalCondition"("dealId", "status");

-- CreateIndex
CREATE INDEX "LegalCondition_dealId_severity_idx" ON "public"."LegalCondition"("dealId", "severity");

-- AddForeignKey
ALTER TABLE "public"."LegalCondition" ADD CONSTRAINT "LegalCondition_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;



