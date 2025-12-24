-- CreateEnum
CREATE TYPE "public"."DocumentCategory" AS ENUM ('CONTRACTS', 'COMPLIANCE', 'AGREEMENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DocumentType" AS ENUM ('PURCHASE_AGREEMENT', 'ASSIGNMENT_CONTRACT', 'OTHER');

-- CreateTable
CREATE TABLE "public"."LegalDocument" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "dealId" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" "public"."DocumentCategory" NOT NULL,
    "type" "public"."DocumentType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDocument_orgId_category_idx" ON "public"."LegalDocument"("orgId", "category");

-- AddForeignKey
ALTER TABLE "public"."LegalDocument" ADD CONSTRAINT "LegalDocument_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LegalDocument" ADD CONSTRAINT "LegalDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LegalDocument" ADD CONSTRAINT "LegalDocument_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LegalDocument" ADD CONSTRAINT "LegalDocument_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
