-- CreateTable
CREATE TABLE "public"."KpiSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "activeLeads" INTEGER NOT NULL DEFAULT 0,
    "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
    "newLeadsToday" INTEGER NOT NULL DEFAULT 0,
    "dealsCreated" INTEGER NOT NULL DEFAULT 0,
    "dealsClosed" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "contactRate" DECIMAL(5,2),
    "qualificationRate" DECIMAL(5,2),
    "closeRate" DECIMAL(5,2),
    "avgPipelineDays" DECIMAL(6,2),
    "avgDealCycleTime" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadEventArchive" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEventArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AutomationLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "metadata" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiSnapshot_date_idx" ON "public"."KpiSnapshot"("date");

-- CreateIndex
CREATE INDEX "KpiSnapshot_orgId_date_idx" ON "public"."KpiSnapshot"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "KpiSnapshot_orgId_date_key" ON "public"."KpiSnapshot"("orgId", "date");

-- CreateIndex
CREATE INDEX "LeadEventArchive_leadId_idx" ON "public"."LeadEventArchive"("leadId");

-- CreateIndex
CREATE INDEX "LeadEventArchive_createdAt_idx" ON "public"."LeadEventArchive"("createdAt");

-- CreateIndex
CREATE INDEX "AutomationLog_orgId_createdAt_idx" ON "public"."AutomationLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationLog_leadId_idx" ON "public"."AutomationLog"("leadId");

-- CreateIndex
CREATE INDEX "AutomationLog_ruleId_idx" ON "public"."AutomationLog"("ruleId");

-- AddForeignKey
ALTER TABLE "public"."KpiSnapshot" ADD CONSTRAINT "KpiSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationLog" ADD CONSTRAINT "AutomationLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationLog" ADD CONSTRAINT "AutomationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
