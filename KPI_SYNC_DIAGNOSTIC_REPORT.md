# KPI Counts Out of Sync - Diagnostic Report

## Executive Summary

**Root Cause Category**: **B) Frontend cache/invalidation problem** (primary) + **A) Definition mismatch** (secondary)

The KPI values are out of sync due to:
1. **Query key mismatch**: Different components use different React Query keys (`["kpis"]` vs `["kpis-summary"]`), so invalidation doesn't reach all consumers
2. **Missing invalidation**: LeadsPage doesn't invalidate KPI queries when creating leads
3. **Definition mismatch**: "Active Leads" = all leads, but "Qualified Leads" = deals with stage >= QUALIFIED (not leads)

---

## 1) REPRO STEPS

### Steps to Reproduce:
1. Open `/leads` page
2. Create 3 new leads via the form
3. Confirm `/leads` list shows 3 leads (via `GET /api/leads`)
4. Open `/dashboard` and check KPI tile values:
   - "Active Leads" (from `useKpis()` hook)
   - "This Month" (from `useKpis()` hook)
5. Open `/kpis` page and check stat cards:
   - "TOTAL LEADS" (from `KpisPage` component)
   - "ACTIVE LEADS" (from `KpisPage` component)
   - "QUALIFIED LEADS" (from `KpisPage` component)

### Expected Behavior:
- All KPI displays should show updated counts immediately after lead creation

### Actual Behavior:
- Dashboard KPI card may update (if using `["kpis"]` query key)
- `/kpis` page stat cards do NOT update (uses `["kpis-summary"]` query key)
- "This Month" may not reflect new leads (depends on whether they're counted as "monthlyQualifiedLeads")

---

## 2) FILE MAP

### Frontend Files

#### A) Leads Page (`/leads`)
- **File**: `web/src/pages/LeadsPage.tsx`
- **Data Fetching**: 
  - Uses custom `refresh()` function (NOT React Query)
  - Calls `api.get('/leads')` directly
  - Stores results in local state: `const [items, setItems] = useState<Lead[]>([])`
- **Lead Creation**:
  - Function: `handleSourceSubmit()` (line 385)
  - Endpoint: `POST /api/leads` (line 394)
  - After creation: calls `refresh()` and invalidates `["lead-sources"]` only
  - **MISSING**: Does NOT invalidate `["kpis"]` or `["kpis-summary"]` queries

#### B) Dashboard KPI Card
- **File**: `web/src/features/dashboard/KpiOverview.tsx`
- **Hook**: `useKpis()` from `web/src/api/hooks.ts`
- **Query Key**: `["kpis"]` (line 129)
- **Endpoint**: `GET /kpis/full` (line 130)
- **Cache Settings**:
  - `refetchInterval: 30_000` (30 seconds)
  - `staleTime: 10_000` (10 seconds)
- **Displays**: 
  - `totalLeads` (line 80)
  - `activeLeads` (line 81, as subtitle)
  - `qualifiedLeads` (line 88)
  - `monthlyRevenue` (line 105, as "this month" subtitle)

#### C) KPIs Page (`/kpis`)
- **File**: `web/src/pages/KpisPage.tsx`
- **Query Key**: `["kpis-summary"]` (line 19) ⚠️ **DIFFERENT FROM DASHBOARD**
- **Endpoint**: `GET /api/kpis` (line 20)
- **Displays**:
  - `totalLeads` (line 52)
  - `activeLeads` (line 57)
  - `qualifiedLeads` (line 82)
  - `monthlyProfit` (line 87)

#### D) Dashboard KPI Card (Alternative)
- **File**: `web/src/components/KpiCard.tsx`
- **Query Key**: `["kpis-summary"]` (line 28) ⚠️ **SAME AS KPIS PAGE**
- **Endpoint**: `GET /api/kpis` (line 29)
- **Displays**:
  - `activeLeads` (line 45)
  - `monthlyQualifiedLeads` (line 46, as delta; line 56, as "This Month")

### Backend Files

#### E) Leads Endpoint
- **File**: `server/src/routes/leads.dev.ts`
- **GET /api/leads** (line 17):
  - Dev mode: Returns `getOrgLeads(orgId)` (in-memory store)
  - Production: `SELECT * FROM "Lead" WHERE "orgId" = $1 ORDER BY "createdAt" DESC`
  - **No filters** - returns ALL leads for org
- **POST /api/leads** (line 51):
  - Creates lead with default `temperature: 'cold'`
  - No status field set (leads don't have a status field)
  - Returns created lead

#### F) KPIs Endpoint
- **File**: `server/src/routes/kpis.ts`
- **GET /api/kpis** (line 9):
  - **totalLeads**: `COUNT(*) FROM "Lead" WHERE "orgId" = $1` (line 104)
  - **activeLeads**: Currently equals `totalLeads` (line 112) - no archived field
  - **qualifiedLeads**: `COUNT(*) FROM "Deal" WHERE stage IN ('QUALIFIED', 'UNDER_CONTRACT', 'IN_ESCROW', 'CLOSED_WON', 'CLOSED_LOST') AND "orgId" = $1` (line 118)
  - **monthlyQualifiedLeads**: `COUNT(*) FROM "Deal" WHERE "qualifiedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') AND "orgId" = $1` (line 128-130)
  - **monthlyProfit**: `SUM("assignmentFeeActual") FROM "Deal" WHERE stage = 'CLOSED_WON' AND "closedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') AND "orgId" = $1` (line 121-125)
  - **monthlyNewLeads**: Hardcoded to `0` with TODO comment (line 165)

### Route Registration
- **File**: `server/src/server.ts`
- **Line 234**: `app.use("/api/kpis", requireAuth, apiRateLimiter, makeKpisRouter(pool));`
- **Line 217**: `app.use("/api/leads", requireAuth, apiRateLimiter, leadsDevRouter);`

---

## 3) KPI DEFINITIONS TABLE

| KPI Name | Data Source | Query/Filter | Timestamp Field | Notes |
|----------|-------------|--------------|-----------------|-------|
| **TOTAL LEADS** | `Lead` table | `COUNT(*) WHERE "orgId" = $1` | N/A | All leads for org |
| **ACTIVE LEADS** | `Lead` table | Currently = `totalLeads` | N/A | No archived field yet, so equals total |
| **QUALIFIED LEADS** | `Deal` table | `COUNT(*) WHERE stage IN ('QUALIFIED', 'UNDER_CONTRACT', 'IN_ESCROW', 'CLOSED_WON', 'CLOSED_LOST') AND "orgId" = $1` | N/A | ⚠️ **NOT from Lead table** - counts deals, not leads |
| **MONTHLY QUALIFIED LEADS** | `Deal` table | `COUNT(*) WHERE "qualifiedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') AND "orgId" = $1` | `qualifiedAt` | ⚠️ **Deals qualified this month**, not leads created |
| **MONTHLY NEW LEADS** | N/A | Hardcoded to `0` | N/A | ⚠️ **TODO** - not implemented |
| **MONTHLY PROFIT** | `Deal` table | `SUM("assignmentFeeActual") WHERE stage = 'CLOSED_WON' AND "closedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') AND "orgId" = $1` | `closedAt` | Revenue from deals closed this month |

### Key Observations:
1. **"Active Leads"** = all leads (no filtering)
2. **"Qualified Leads"** = deals with stage >= QUALIFIED (NOT leads)
3. **"This Month"** (monthlyQualifiedLeads) = deals qualified this month (NOT leads created this month)
4. **"Monthly New Leads"** is not implemented (hardcoded to 0)

---

## 4) TIME SYSTEM / "THIS MONTH" BOUNDARIES

### Current Implementation:
- **Timezone**: UTC
- **Month Boundary Calculation**: `DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`
- **Field Used for Monthly KPIs**:
  - `monthlyQualifiedLeads`: Uses `qualifiedAt` from `Deal` table
  - `monthlyProfit`: Uses `closedAt` from `Deal` table
  - `monthlyNewLeads`: **NOT IMPLEMENTED** (hardcoded to 0)

### Statement:
**"This Month" = deals where `qualifiedAt` >= start of current month (UTC) and `qualifiedAt` < start of next month (UTC)**

### Issue:
- "This Month" shows deals qualified this month, NOT leads created this month
- New leads won't appear in "This Month" until they become deals and are marked as qualified
- There's no "monthlyNewLeads" metric implemented

### Recommendation:
- Use UTC storage + UTC month boundaries (current approach is correct)
- For "monthlyNewLeads", use `createdAt` from `Lead` table with same UTC month boundary
- Be explicit about which field defines "monthly leads gained" (should be `createdAt` from Lead table)

---

## 5) ROOT CAUSE ANALYSIS

### Primary Issue: **Frontend Cache/Invalidation Problem**

#### Problem 1: Query Key Mismatch
- **Dashboard KPI card** (`KpiOverview.tsx`) uses query key `["kpis"]`
- **KPIs page** (`KpisPage.tsx`) uses query key `["kpis-summary"]`
- **Dashboard KPI card** (`KpiCard.tsx`) uses query key `["kpis-summary"]`
- When `useCreateLead` mutation succeeds, it invalidates `["kpis"]` (line 286 in `hooks.ts`)
- **Result**: `/kpis` page and `KpiCard` component don't refetch because they use `["kpis-summary"]`

#### Problem 2: LeadsPage Doesn't Invalidate KPI Queries
- `LeadsPage.tsx` uses custom `refresh()` function (NOT React Query)
- When creating a lead (line 394), it:
  - Calls `refresh()` to reload leads list
  - Invalidates `["lead-sources"]` only (line 398)
  - **MISSING**: Does NOT invalidate `["kpis"]` or `["kpis-summary"]`

#### Problem 3: RealtimeProvider Only Invalidates `["kpis"]`
- `RealtimeProvider.tsx` listens for `LEAD_CREATED` events (line 74)
- Invalidates `["leads"]` queries (line 78)
- Invalidates `["kpis"]` queries (line 93) ⚠️ **But NOT `["kpis-summary"]`**

### Secondary Issue: **Definition Mismatch**

#### Problem 4: "Qualified Leads" Definition
- **Backend**: Counts deals with stage >= QUALIFIED (from `Deal` table)
- **User Expectation**: Likely expects leads that are qualified (from `Lead` table)
- **Result**: New leads won't show up in "Qualified Leads" until they become deals

#### Problem 5: "This Month" Definition
- **Backend**: Shows deals qualified this month (`monthlyQualifiedLeads`)
- **User Expectation**: Likely expects leads created this month
- **Result**: New leads don't appear in "This Month" until they become qualified deals

#### Problem 6: "Monthly New Leads" Not Implemented
- Hardcoded to `0` with TODO comment (line 165 in `kpis.ts`)
- No metric tracks leads created this month

---

## 6) MINIMAL FIX PLAN

### Fix 1: Unify Query Keys (HIGH PRIORITY)
**Location**: `web/src/pages/KpisPage.tsx`, `web/src/components/KpiCard.tsx`

**Change**:
- Change query key from `["kpis-summary"]` to `["kpis"]` in both files
- OR: Change `useKpis()` hook to use `["kpis-summary"]` instead
- **Recommendation**: Use `["kpis"]` everywhere for consistency

**Impact**: All KPI queries will be invalidated together

---

### Fix 2: Invalidate KPI Queries in LeadsPage (HIGH PRIORITY)
**Location**: `web/src/pages/LeadsPage.tsx`, function `handleSourceSubmit()` (line 385)

**Change**:
```typescript
// After line 397 (after await refresh())
queryClient.invalidateQueries({ queryKey: ["kpis"] });
queryClient.invalidateQueries({ queryKey: ["kpis-summary"] }); // If keeping both keys
```

**Impact**: KPI queries will refetch immediately after lead creation

---

### Fix 3: Invalidate Both Query Keys in RealtimeProvider (MEDIUM PRIORITY)
**Location**: `web/src/realtime/RealtimeProvider.tsx`, `EVENTS.LEAD_CREATED` handler (line 74)

**Change**:
```typescript
// After line 78 (after invalidating ["leads"])
queryClient.invalidateQueries({ queryKey: ["kpis"] });
queryClient.invalidateQueries({ queryKey: ["kpis-summary"] }); // If keeping both keys
```

**Impact**: Real-time updates will refresh all KPI displays

---

### Fix 4: Implement "Monthly New Leads" (MEDIUM PRIORITY)
**Location**: `server/src/routes/kpis.ts`, GET `/api/kpis` handler

**Change**:
- Replace hardcoded `monthlyNewLeads: 0` (line 165) with actual query:
```sql
COUNT(*) FROM "Lead" 
WHERE "orgId" = $1 
AND "createdAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
```

**Impact**: "This Month" will show leads created this month (if UI is updated to use this field)

---

### Fix 5: Clarify "Qualified Leads" Definition (LOW PRIORITY)
**Options**:
- **Option A**: Rename "Qualified Leads" to "Qualified Deals" in UI
- **Option B**: Change backend to count leads with a `qualified` status (requires schema change)
- **Option C**: Add both metrics: "Qualified Leads" (from Lead table) and "Qualified Deals" (from Deal table)

**Recommendation**: Option A (rename) is safest - no schema changes, just UI label update

---

### Fix 6: Update "This Month" to Show New Leads (LOW PRIORITY)
**Location**: `web/src/components/KpiCard.tsx`, `web/src/pages/KpisPage.tsx`

**Change**:
- Use `monthlyNewLeads` (after Fix 4) instead of `monthlyQualifiedLeads` for "This Month" display
- OR: Add separate "New Leads This Month" metric

**Impact**: "This Month" will reflect leads created, not deals qualified

---

## 7) PRIORITY ORDER

1. **Fix 1 + Fix 2** (HIGH): Unify query keys and invalidate in LeadsPage
   - **Effort**: Low (2-3 lines of code)
   - **Impact**: High (fixes immediate sync issue)

2. **Fix 3** (MEDIUM): Invalidate in RealtimeProvider
   - **Effort**: Low (1 line of code)
   - **Impact**: Medium (fixes real-time updates)

3. **Fix 4** (MEDIUM): Implement monthlyNewLeads
   - **Effort**: Medium (SQL query + backend change)
   - **Impact**: Medium (enables accurate "This Month" metric)

4. **Fix 5 + Fix 6** (LOW): Clarify definitions and update UI
   - **Effort**: Medium (UI changes + potential schema changes)
   - **Impact**: Low (improves clarity, doesn't fix sync bug)

---

## 8) TESTING CHECKLIST

After implementing fixes:

1. ✅ Create 3 leads on `/leads` page
2. ✅ Verify `/leads` list shows 3 leads
3. ✅ Verify `/dashboard` KPI card shows updated `totalLeads` and `activeLeads`
4. ✅ Verify `/kpis` page stat cards show updated `totalLeads` and `activeLeads`
5. ✅ Verify "This Month" updates if `monthlyNewLeads` is implemented
6. ✅ Verify real-time updates work (if WebSocket events fire)
7. ✅ Verify no console errors or React Query warnings

---

## END OF REPORT







