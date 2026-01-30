# Phase 2: Backend PATCH Support - Summary

## Changes Made

### File Modified: `server/src/routes/leads.dev.ts`

**Added milestone field extraction and validation (after line 213):**
- Extracts 7 milestone fields from `req.body`
- Adds parsing helpers: `parseDateOrNull()` and `parseFeeOrNull()`
- Validates that `assignedAt` requires `buyerName`
- Handles undefined/null/value semantics correctly

**Updated dev store path (lines 349-370):**
- Conditionally updates milestone fields in `updatedLead` object
- Only updates if field is `!== undefined`

**Updated production DB path (lines 421-456):**
- Adds milestone fields to dynamic SQL update query
- Uses proper PostgreSQL casts: `::timestamptz` for dates, `::decimal(12,2)` for fee
- Only adds to query if field is `!== undefined`

## Exact Diff

```diff
--- a/server/src/routes/leads.dev.ts
+++ b/server/src/routes/leads.dev.ts
@@ -210,6 +210,88 @@ leadsDevRouter.patch("/:id", async (req, res) => {
   const orgId = (req as any).orgId || req.user.orgId || req.user.id;
   let { type, address, city, state, zip, temperature } = req.body;
 
+  // Extract milestone fields
+  const { 
+    underContractAt, 
+    assignedAt, 
+    escrowOpenedAt, 
+    closedAt, 
+    cancelledAt, 
+    buyerName, 
+    assignmentFee 
+  } = req.body;
+
   // Normalize all fields to strings
   type = String(type ?? "").trim();
   address = String(address ?? "").trim();
@@ -222,6 +304,60 @@ leadsDevRouter.patch("/:id", async (req, res) => {
     temperature = normalizedTemp;
   }
 
+  // Parse milestone fields (local helpers)
+  const parseDateOrNull = (value: any): string | null | undefined => {
+    if (value === undefined) return undefined; // Don't touch if undefined
+    if (value === null || value === "") return null;
+    const date = new Date(value);
+    if (isNaN(date.getTime())) {
+      throw new Error(`Invalid date: ${value}`);
+    }
+    return date.toISOString();
+  };
+
+  const parseFeeOrNull = (value: any): string | null | undefined => {
+    if (value === undefined) return undefined; // Don't touch if undefined
+    if (value === null || value === "") return null;
+    const num = typeof value === "string" ? parseFloat(value) : Number(value);
+    if (isNaN(num) || !isFinite(num) || num < 0) {
+      throw new Error(`Invalid assignmentFee: must be a non-negative number`);
+    }
+    return num.toFixed(2);
+  };
+
+  // Parse milestone fields (with error handling)
+  let parsedUnderContractAt: string | null | undefined;
+  let parsedAssignedAt: string | null | undefined;
+  let parsedEscrowOpenedAt: string | null | undefined;
+  let parsedClosedAt: string | null | undefined;
+  let parsedCancelledAt: string | null | undefined;
+  let parsedBuyerName: string | null | undefined;
+  let parsedAssignmentFee: string | null | undefined;
+
+  try {
+    parsedUnderContractAt = parseDateOrNull(underContractAt);
+    parsedAssignedAt = parseDateOrNull(assignedAt);
+    parsedEscrowOpenedAt = parseDateOrNull(escrowOpenedAt);
+    parsedClosedAt = parseDateOrNull(closedAt);
+    parsedCancelledAt = parseDateOrNull(cancelledAt);
+    parsedBuyerName = buyerName === undefined ? undefined : (buyerName === null || buyerName === "" ? null : String(buyerName).trim());
+    parsedAssignmentFee = parseFeeOrNull(assignmentFee);
+  } catch (err: any) {
+    return res.status(400).json({
+      error: "VALIDATION_ERROR",
+      message: err.message || "Invalid milestone field value"
+    });
+  }
+
+  // Validation: assignedAt requires buyerName
+  if (parsedAssignedAt !== undefined && parsedAssignedAt !== null) {
+    if (!parsedBuyerName || parsedBuyerName.trim().length === 0) {
+      return res.status(400).json({
+        error: "VALIDATION_ERROR",
+        message: "buyerName is required when assignedAt is set"
+      });
+    }
+  }
+
   if (isDevMode) {
     // ... existing code ...
     
     // Update milestone fields only if provided (undefined means don't touch)
+    if (parsedUnderContractAt !== undefined) {
+      updatedLead.underContractAt = parsedUnderContractAt;
+    }
+    if (parsedAssignedAt !== undefined) {
+      updatedLead.assignedAt = parsedAssignedAt;
+    }
+    if (parsedEscrowOpenedAt !== undefined) {
+      updatedLead.escrowOpenedAt = parsedEscrowOpenedAt;
+    }
+    if (parsedClosedAt !== undefined) {
+      updatedLead.closedAt = parsedClosedAt;
+    }
+    if (parsedCancelledAt !== undefined) {
+      updatedLead.cancelledAt = parsedCancelledAt;
+    }
+    if (parsedBuyerName !== undefined) {
+      updatedLead.buyerName = parsedBuyerName;
+    }
+    if (parsedAssignmentFee !== undefined) {
+      updatedLead.assignmentFee = parsedAssignmentFee;
+    }
     
     // ... existing code ...
   }
 
   // Production: update DB
   try {
     // ... existing code ...
     
+    // Milestone fields (only if provided)
+    if (parsedUnderContractAt !== undefined) {
+      updates.push(`"underContractAt" = $${paramIndex}::timestamptz`);
+      values.push(parsedUnderContractAt);
+      paramIndex++;
+    }
+    if (parsedAssignedAt !== undefined) {
+      updates.push(`"assignedAt" = $${paramIndex}::timestamptz`);
+      values.push(parsedAssignedAt);
+      paramIndex++;
+    }
+    if (parsedEscrowOpenedAt !== undefined) {
+      updates.push(`"escrowOpenedAt" = $${paramIndex}::timestamptz`);
+      values.push(parsedEscrowOpenedAt);
+      paramIndex++;
+    }
+    if (parsedClosedAt !== undefined) {
+      updates.push(`"closedAt" = $${paramIndex}::timestamptz`);
+      values.push(parsedClosedAt);
+      paramIndex++;
+    }
+    if (parsedCancelledAt !== undefined) {
+      updates.push(`"cancelledAt" = $${paramIndex}::timestamptz`);
+      values.push(parsedCancelledAt);
+      paramIndex++;
+    }
+    if (parsedBuyerName !== undefined) {
+      updates.push(`"buyerName" = $${paramIndex}`);
+      values.push(parsedBuyerName);
+    }
+    if (parsedAssignmentFee !== undefined) {
+      updates.push(`"assignmentFee" = $${paramIndex}::decimal(12,2)`);
+      values.push(parsedAssignmentFee);
+      paramIndex++;
+    }
     
     // ... existing code ...
   }
```

## Verification Commands

**Prerequisites:**
- Server running on `http://localhost:3010`
- Dev mode enabled (`DEV_AUTH_BYPASS=1`)
- At least one lead exists (get ID from `GET /api/leads`)
- Replace `LEAD_ID` with actual lead ID

**Test A: assignedAt set + buyerName missing → expect 400**
```bash
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"assignedAt": "2024-01-15T10:00:00Z"}'
```
**Expected:** HTTP 400 with `"buyerName is required when assignedAt is set"`

**Test B: assignedAt set + buyerName present → expect 200**
```bash
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"assignedAt": "2024-01-15T10:00:00Z", "buyerName": "John Doe"}'
```
**Expected:** HTTP 200 with updated lead in response

**Test C: clear assignedAt (null) → expect 200**
```bash
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"assignedAt": null, "buyerName": null}'
```
**Expected:** HTTP 200 with `assignedAt` and `buyerName` set to null

**Test D: assignmentFee set to 1000.5 → stored as "1000.50"**
```bash
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"assignmentFee": 1000.5}'
```
**Expected:** HTTP 200 with `assignmentFee` in response showing "1000.50" (or equivalent decimal format)

**Test E: assignmentFee cleared (null) → stored null**
```bash
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"assignmentFee": null}'
```
**Expected:** HTTP 200 with `assignmentFee` set to null

**Test F: Regression - existing lead edit still works**
```bash
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"address": "123 Test St", "city": "Austin", "state": "TX", "zip": "78701"}'
```
**Expected:** HTTP 200 with address fields updated (no milestone fields touched)

## Implementation Details

### Field Semantics
- **undefined**: Field not provided → don't update (preserve existing value)
- **null**: Field explicitly set to null → clear the value
- **value**: Field has a value → set to that value

### Validation Rules
1. `assignedAt` requires `buyerName` (non-empty string)
2. Date fields must be valid ISO strings or null
3. `assignmentFee` must be non-negative number or null
4. All fields are nullable (can be cleared)

### Dev/Prod Parity
- **Dev mode**: Updates in-memory `userLeads` array
- **Prod mode**: Updates PostgreSQL via parameterized SQL query
- Both paths use the same parsing and validation logic

## Notes

- No TypeScript type changes needed (fields handled as `any` in parsing)
- Decimal values stored as strings with 2 decimal places (e.g., "1000.50")
- Timestamps stored as ISO strings, cast to `timestamptz` in PostgreSQL
- All milestone fields are optional (undefined means don't touch)







