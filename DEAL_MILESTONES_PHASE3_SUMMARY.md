# Phase 3: KPI Computations - Summary

## Changes Made

### File Modified: `server/src/routes/kpis.ts`

**Added 2 new KPI variables (after line 38):**
- `assignmentsMTD = 0`
- `inEscrow = 0`

**Added DEV MODE computations (after line 113):**
- `assignmentsMTD`: Filters leads where `assignedAt` is within current UTC month
- `inEscrow`: Filters leads where `escrowOpenedAt` is set and `closedAt`/`cancelledAt` are null

**Added PROD MODE computations (after line 237):**
- `assignmentsMTD`: SQL query with UTC month boundaries using `DATE_TRUNC`
- `inEscrow`: SQL query with NULL checks

**Added to response payload (after line 327):**
- `assignmentsMTD` and `inEscrow` fields added to JSON response

## Exact Diff

```diff
--- a/server/src/routes/kpis.ts
+++ b/server/src/routes/kpis.ts
@@ -35,6 +35,8 @@ export function makeKpisRouter(pool?: any) {
       let qualifiedLeads = 0;
       let monthlyQualifiedLeads = 0;
       let monthlyNewLeads = 0;
+      let assignmentsMTD = 0;
+      let inEscrow = 0;
       // Previous period baselines (for semantic color tone computation)
       let prevActiveLeads: number | null = null;
       let prevConversionRate: number | null = null;
@@ -105,6 +107,20 @@ export function makeKpisRouter(pool?: any) {
                  createdTime < nextMonthStart.getTime();
         }).length;
 
+        // assignmentsMTD: count leads where assignedAt is within current month (UTC)
+        assignmentsMTD = leads.filter((l: any) => {
+          if (!l.assignedAt) return false;
+          const assignedTime = Date.parse(l.assignedAt);
+          return Number.isFinite(assignedTime) && 
+                 assignedTime >= monthStart.getTime() && 
+                 assignedTime < nextMonthStart.getTime();
+        }).length;
+
+        // inEscrow: count leads where escrowOpenedAt != null AND closedAt == null AND cancelledAt == null
+        inEscrow = leads.filter((l: any) => 
+          !!l.escrowOpenedAt && !l.closedAt && !l.cancelledAt
+        ).length;
+
         // Previous period baselines (UTC month boundaries)
         const prevYear = month === 0 ? year - 1 : year;
         const prevMonth = month === 0 ? 11 : month - 1;
@@ -237,6 +253,24 @@ export function makeKpisRouter(pool?: any) {
           );
           monthlyNewLeads = Number(monthlyNewLeadsResult.rows[0].monthlyNewLeads) || 0;
 
+          // assignmentsMTD: count leads where assignedAt is within current month (UTC)
+          const assignmentsMTDResult = await pool.query(
+            `SELECT COUNT(*) as "assignmentsMTD"
+             FROM "Lead"
+             WHERE "orgId" = $1
+               AND "assignedAt" IS NOT NULL
+               AND "assignedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
+               AND "assignedAt" < DATE_TRUNC('month', (NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month')`,
+            [orgId]
+          );
+          assignmentsMTD = Number(assignmentsMTDResult.rows[0].assignmentsMTD) || 0;
+
+          // inEscrow: count leads where escrowOpenedAt != null AND closedAt == null AND cancelledAt == null
+          const inEscrowResult = await pool.query(
+            `SELECT COUNT(*) as "inEscrow"
+             FROM "Lead"
+             WHERE "orgId" = $1
+               AND "escrowOpenedAt" IS NOT NULL
+               AND "closedAt" IS NULL
+               AND "cancelledAt" IS NULL`,
+            [orgId]
+          );
+          inEscrow = Number(inEscrowResult.rows[0].inEscrow) || 0;
+
           // conversionRate: (closedWonCount / totalLeads) * 100
           if (totalLeads > 0) {
             conversionRate = (closedWonCount / totalLeads) * 100;
@@ -324,6 +358,8 @@ export function makeKpisRouter(pool?: any) {
         monthlyProfit,
         qualifiedLeads,
         monthlyQualifiedLeads,
+        assignmentsMTD,
+        inEscrow,
         // Previous period baselines (for semantic color tone computation)
         prevActiveLeads,
         prevConversionRate,
```

## Phase 2 Hotfix Status

**No hotfix needed** - The `paramIndex++` for `buyerName` is already present at line 450 in `server/src/routes/leads.dev.ts`.

## Verification Commands

**Prerequisites:**
- Server running on `http://localhost:3010`
- Dev mode enabled (`DEV_AUTH_BYPASS=1`)
- At least one lead exists (get ID from `GET /api/leads`)
- Replace `LEAD_ID` with actual lead ID

**Test A: Set assignedAt and buyerName, verify assignmentsMTD increments**
```bash
# Step 1: Set assignedAt to current time
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"assignedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'", "buyerName": "Test Buyer"}'
```
**Expected:** HTTP 200

```bash
# Step 2: Check KPIs
curl -i http://localhost:3010/api/kpis \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev"
```
**Expected:** HTTP 200 with `assignmentsMTD` >= 1 (if assignedAt is in current month)

**Test B: Set escrowOpenedAt, verify inEscrow increments**
```bash
# Step 1: Set escrowOpenedAt
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"escrowOpenedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'
```
**Expected:** HTTP 200

```bash
# Step 2: Check KPIs
curl -i http://localhost:3010/api/kpis \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev"
```
**Expected:** HTTP 200 with `inEscrow` >= 1

**Test C: Set closedAt, verify inEscrow decrements**
```bash
# Step 1: Set closedAt (this should remove from inEscrow)
curl -i -X PATCH http://localhost:3010/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev" \
  -d '{"closedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'
```
**Expected:** HTTP 200

```bash
# Step 2: Check KPIs
curl -i http://localhost:3010/api/kpis \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev"
```
**Expected:** HTTP 200 with `inEscrow` decremented (lead no longer in escrow)

**Test D: Regression - existing KPIs still work**
```bash
curl -i http://localhost:3010/api/kpis \
  -H "x-dev-user-id: user_dev" \
  -H "x-dev-org-id: org_dev"
```
**Expected:** HTTP 200 with all existing KPI fields present:
- `totalLeads`
- `activeLeads`
- `conversionRate`
- `assignments`
- `contractsInEscrow`
- `contactRate`
- `monthlyNewLeads`
- `monthlyProfit`
- `qualifiedLeads`
- `monthlyQualifiedLeads`
- `assignmentsMTD` (new)
- `inEscrow` (new)
- `prevActiveLeads`
- `prevConversionRate`
- `prevMonthlyNewLeads`
- `prevMonthlyProfit`

## Implementation Details

### KPI Definitions

1. **assignmentsMTD** (Month-to-Date Assignments):
   - Count of leads where `assignedAt` is not null
   - AND `assignedAt` falls within the current UTC month
   - Uses same UTC month boundaries as `monthlyNewLeads` and `monthlyProfit`

2. **inEscrow** (Leads Currently in Escrow):
   - Count of leads where:
     - `escrowOpenedAt` is not null
     - AND `closedAt` is null
     - AND `cancelledAt` is null
   - This is a current-state metric (not time-based)

### Dev/Prod Parity

- **Dev mode**: Uses in-memory `leads` array with JavaScript filtering
- **Prod mode**: Uses PostgreSQL queries with proper UTC boundaries
- Both paths compute the same metrics with identical logic

### UTC Month Boundaries

- Reuses existing `monthStart` and `nextMonthStart` variables in dev mode
- Uses `DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')` pattern in prod mode
- Matches existing KPI computation patterns for consistency

## Notes

- No breaking changes: New fields are additive to existing response
- Existing KPI consumers will continue to work (new fields are optional)
- Timestamps handled as ISO strings (matches Phase 2 storage format)
- No state machine enforcement: KPIs only check field presence/nullability







