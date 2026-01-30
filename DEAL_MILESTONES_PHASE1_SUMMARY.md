# Phase 1: Deal Milestones Schema Changes - Summary

## Changes Made

### File Modified: `server/prisma/schema.prisma`

**Added 7 nullable fields to `Lead` model (lines 44-51):**
```prisma
  // Deal Milestones (Silver tier)
  underContractAt  DateTime?
  assignedAt       DateTime?
  escrowOpenedAt   DateTime?
  closedAt         DateTime?
  cancelledAt      DateTime?
  buyerName        String?
  assignmentFee    Decimal?  @db.Decimal(12, 2)
```

**Added 2 optional indexes for KPI performance (after line 57):**
```prisma
  @@index([orgId, assignedAt])
  @@index([orgId, escrowOpenedAt])
```

## Exact Diff

```diff
--- a/server/prisma/schema.prisma
+++ b/server/prisma/schema.prisma
@@ -41,6 +41,15 @@ model Lead {
   createdAt    DateTime @default(now())
   updatedAt    DateTime @updatedAt
 
+  // Deal Milestones (Silver tier)
+  underContractAt  DateTime?
+  assignedAt       DateTime?
+  escrowOpenedAt   DateTime?
+  closedAt         DateTime?
+  cancelledAt      DateTime?
+  buyerName        String?
+  assignmentFee    Decimal?  @db.Decimal(12, 2)
+
   org          Organization @relation(fields: [orgId], references: [id])
   contacts     LeadContact[]
   documents    LegalDocument[]
 
   @@index([orgId, type, ruralFlag])
+  @@index([orgId, assignedAt])
+  @@index([orgId, escrowOpenedAt])
   @@unique([orgId, addressHash], name: "orgId_addressHash")
 }
```

## Next Steps (Run These Commands)

**From the `server/` directory:**

1. **Validate schema:**
   ```bash
   cd server
   npx prisma validate --schema prisma/schema.prisma
   ```

2. **Generate migration:**
   ```bash
   npx prisma migrate dev --name add_deal_milestones --schema prisma/schema.prisma
   ```

3. **Generate Prisma client:**
   ```bash
   npx prisma generate --schema prisma/schema.prisma
   ```

## Expected Migration SQL

The migration should create SQL similar to:

```sql
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "underContractAt" TIMESTAMP(3),
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "escrowOpenedAt" TIMESTAMP(3),
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "buyerName" TEXT,
ADD COLUMN "assignmentFee" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "Lead_orgId_assignedAt_idx" ON "Lead"("orgId", "assignedAt");

-- CreateIndex
CREATE INDEX "Lead_orgId_escrowOpenedAt_idx" ON "Lead"("orgId", "escrowOpenedAt");
```

## Verification Checklist

- [ ] Schema validates without errors
- [ ] Migration creates all 7 columns with correct types
- [ ] Migration creates 2 indexes
- [ ] Prisma client generates successfully
- [ ] No existing Lead rows are affected (all fields nullable)

## Migration File Location

After running `prisma migrate dev`, the migration will be created at:
```
server/prisma/migrations/YYYYMMDDHHMMSS_add_deal_milestones/migration.sql
```

## Notes

- All fields are nullable to avoid breaking existing rows
- Timestamps use `DateTime?` (Prisma maps to PostgreSQL `TIMESTAMP(3)`)
- `assignmentFee` uses `Decimal(12, 2)` matching existing codebase pattern
- Indexes added for KPI query performance on `assignedAt` and `escrowOpenedAt`







