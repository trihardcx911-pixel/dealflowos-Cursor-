# Lead Sources Pie Chart Fix Plan
## Regression Fix: Identity Scope Mismatch + Data Flow Hardening

**Date:** 2025-01-XX  
**Status:** PLAN MODE (No Implementation)  
**Goal:** Restore pie chart rendering and ensure end-to-end correctness for lead sources across all creation/update/import flows.

---

## Executive Summary

**Root Cause:** Identity scope mismatch between `/api/leads` and `/api/kpis/lead-sources` endpoints due to `KpiChart.tsx` using the legacy `api/client` instead of the canonical client (`web/src/api.ts`).

**Impact:** Pie chart shows empty state even when leads with sources exist, because:
- Leads are stored in org scope resolved from JWT token
- Pie chart reads from org scope `"org_dev"` (hardcoded dev bypass)
- Different org scopes → empty aggregation → empty chart

**Fix Strategy:** Migrate `KpiChart.tsx` to canonical client + ensure proper cache invalidation + add defensive data handling.

---

## Phase 0: Current Contract Analysis

### 1) Pie Chart Surface Location

**Component:** `web/src/features/dashboard/KpiChart.tsx`  
**Parent Pages:**
- `web/src/pages/KpisPage.tsx` (line 98: `<KpiChart />`)
- Not used on `/dashboard` page (dashboard uses `KpiCard.tsx` which shows KPI tiles, not charts)

**Chart Component:** `web/src/features/dashboard/NeonPieChart.tsx`  
**Chart Library:** Recharts (`PieChart`, `Pie`, `Cell`, `Tooltip`, `ResponsiveContainer`)

### 2) Data Hook and Query Key

**Query Definition (KpiChart.tsx, lines 144-150):**
```typescript
const leadSourcesQuery = useQuery<unknown>({
  queryKey: ["lead-sources"],
  queryFn: () => api.get<unknown>("/kpis/lead-sources"),
  retry: 1,
  staleTime: 30000,
  refetchOnMount: "always",
});
```

**Issues Identified:**
- Uses `api` from `"../../api/client"` (line 8) - **LEGACY CLIENT**
- Endpoint: `"/kpis/lead-sources"` (resolved to `/api/kpis/lead-sources` by `api/client`)
- Type: `unknown` (no type safety)

### 3) Expected vs Actual Response Shape

**Expected Shape (from normalization):**
```typescript
// leadSources.ts expects:
Array<{source: string, count: number}>

// Example:
[
  {"source": "cold_call", "count": 5},
  {"source": "referral", "count": 3}
]
```

**Actual Backend Response (kpis.ts, lines 254-257):**
```typescript
const result = Object.entries(sourceMap).map(([source, count]) => ({
  source,
  count,
}));
return res.json(result);
```

**Shape Match:** ✅ **CORRECT** - Backend returns exactly what frontend expects.

**Transformation Chain:**
1. API response: `Array<{source: string, count: number}>`
2. `normalizeLeadSources()` → `LeadSourceKpiRow[]` (validates, filters, normalizes)
3. `toPieData()` → `Array<{name: string, value: number}>` (maps to display names, applies topN)
4. `NeonPieChart` → Renders with Recharts

**Conclusion:** Response shape is correct. The issue is **NOT** a shape mismatch.

---

## Phase 1: Lead Source Persistence Audit

### 1) Field Naming Consistency

**UI Field Name:** `source`  
**API Payload (LeadsPage.tsx, line 395):**
```typescript
await post("/leads", finalPayload);
// finalPayload includes: { ..., source: string }
```

**Backend Storage (leads.dev.ts, lines 64, 72, 112):**
```typescript
let { type, address, city, state, zip, source } = req.body;
source = source ? String(source).trim() : null;
// Stored as:
source,  // in newLead object
```

**Backend Aggregation (kpis.ts, line 246):**
```typescript
const source = (lead as any).source;
if (source && typeof source === "string" && source.trim()) {
  const key = source.trim();
  sourceMap[key] = (sourceMap[key] || 0) + 1;
}
```

**Field Name:** `source` (consistent across all layers) ✅

### 2) Lead Creation Flow

**POST /api/leads (LeadsPage.tsx):**
- Uses canonical client: `post("/leads", finalPayload)` from `../api`
- Payload includes `source` field
- After success: `queryClient.invalidateQueries({ queryKey: ["lead-sources"] })` (line 398)
- ✅ Invalidation present

### 3) Lead Update Flow

**PATCH /api/leads/:id (LeadsPage.tsx, line 433):**
```typescript
await patch(`/leads/${updated.id}`, updated);
// updated object may include source field
await refresh();
// ❌ MISSING: No invalidateQueries for ["lead-sources"]
```

**Issue:** Lead source updates do NOT invalidate `["lead-sources"]` query.

### 4) Import Flow

**POST /api/leads-import/commit (LeadsPage.tsx, line 588):**
```typescript
const response = await post<{...}>('/leads-import/commit', { leads: previewRows });
// After success:
await refresh();
queryClient.invalidateQueries({ queryKey: ["lead-sources"] }); // line 606
```
- ✅ Invalidation present

**Conclusion:** Field naming is consistent. Missing invalidation on lead updates.

---

## Phase 2: Aggregation Logic Analysis

### 1) Backend Handler Location

**File:** `server/src/routes/kpis.ts`  
**Route:** `router.get("/lead-sources", ...)` (line 208)  
**Org Resolution:** `const orgId = (req as any).orgId || req.user.orgId || req.user.id;` (line 215)

### 2) Store Used in Dev Mode

**Dev Mode (kpis.ts, lines 229-267):**
```typescript
if (isDevMode) {
  const leads = getOrgLeads(orgId);  // ✅ Same singleton as /api/leads
  // Group by source
  const sourceMap: Record<string, number> = {};
  for (const lead of leads) {
    const source = (lead as any).source;
    if (source && typeof source === "string" && source.trim()) {
      const key = source.trim();
      sourceMap[key] = (sourceMap[key] || 0) + 1;
    }
  }
  // Convert to array
  const result = Object.entries(sourceMap).map(([source, count]) => ({
    source,
    count,
  }));
  return res.json(result);
}
```

**Store:** ✅ Uses `getOrgLeads(orgId)` - same singleton as `/api/leads`

### 3) Aggregation Rules

**Grouping:** Object map (`Record<string, number>`) → converted to array  
**Missing Sources:** Filtered out (only non-empty strings counted)  
**Count Type:** Number (incremented as integer)  
**Sorting:** Descending by count, then ascending by source name (line 260)

**Response Shape:** `Array<{source: string, count: number}>` ✅

**Conclusion:** Aggregation logic is correct. The issue is **orgId mismatch**, not aggregation.

---

## Phase 3: Break Point Identification

### Primary Root Cause: Identity Scope Mismatch

**Evidence:**
1. **KpiChart.tsx line 8:** `import { api } from "../../api/client"` (legacy client)
2. **KpiChart.tsx line 146:** `queryFn: () => api.get<unknown>("/kpis/lead-sources")`
3. **api/client.ts behavior:**
   - Always sends `x-dev-org-id: "org_dev"` (lines 18-20)
   - Never sends `Authorization` header
   - Forces dev bypass path in backend
4. **Backend requireAuth.ts line 196:** If no `Authorization` header, uses dev bypass → `orgId = "org_dev"`
5. **LeadsPage.tsx:** Uses canonical client (`web/src/api.ts`) which:
   - In JWT mode: Sends `Authorization` header → resolves orgId from token
   - In forced dev mode: Sends dev headers → resolves `orgId = "org_dev"`

**Impact:**
- **JWT Mode (default):** `/api/leads` stores in `orgId_from_token`, `/api/kpis/lead-sources` reads from `"org_dev"` → empty array
- **Forced Dev Mode:** Both use `"org_dev"` → works, but only if user sets `DFOS_FORCE_DEV_IDENTITY=1`

**Network Evidence:**
- `/api/leads` requests: Include `Authorization: Bearer <token>` (if token exists)
- `/api/kpis/lead-sources` requests: Include `x-dev-org-id: org_dev`, NO `Authorization`
- Server logs: `[AUTH RESOLVE] mode=JWT` for `/api/leads`, `mode=DEV_BYPASS` for `/api/kpis/lead-sources`

### Secondary Contributors

**#2: Missing Cache Invalidation on Lead Updates**

**Evidence:**
- `handleSaveLead()` (LeadsPage.tsx, line 432) updates lead but does NOT invalidate `["lead-sources"]`
- If user changes a lead's source, pie chart won't update until manual refresh

**Impact:** Stale data after source updates (not the primary cause of empty chart, but a correctness issue)

**#3: No Defensive Empty State Handling**

**Evidence:**
- `normalizeLeadSources()` returns `[]` for invalid input (line 67)
- `toPieData()` handles empty array gracefully (returns `[]`)
- `NeonPieChart` shows empty state if `pieData.length === 0` (line 349)
- ✅ Empty state handling is correct

**Impact:** None - empty state is handled properly

**#4: Container Sizing (Unlikely)**

**Evidence:**
- Container has fixed height: `h-[300px]` (line 340, 344, 350)
- `ResponsiveContainer` from Recharts handles width automatically
- ✅ Container sizing is correct

**Impact:** None - container has proper dimensions

---

## Phase 4: Phased Fix Plan

### Layer 1: Backend Contract Stabilization

**Goal:** Ensure `/api/kpis/lead-sources` returns stable, consistent shape and uses same org scope as `/api/leads`.

**Changes:**
1. **No backend changes needed** - backend already:
   - Returns correct shape: `Array<{source: string, count: number}>`
   - Uses same store: `getOrgLeads(orgId)`
   - Uses same org resolution: `(req as any).orgId || req.user.orgId || req.user.id`

**Verification:**
- Confirm backend logs show same `orgId` for `/api/leads` and `/api/kpis/lead-sources` after fix

**Files:** None (backend is correct)

---

### Layer 2: Frontend Client Migration

**Goal:** Migrate `KpiChart.tsx` to canonical client so it uses same identity mechanism as `LeadsPage.tsx`.

**Changes:**

**File:** `web/src/features/dashboard/KpiChart.tsx`

**Change 1: Update imports (line 8)**
```typescript
// BEFORE:
import { api } from "../../api/client";

// AFTER:
import { get } from "../../api";
```

**Change 2: Update KPI data query (line 140)**
```typescript
// BEFORE:
queryFn: () => api.get<KpiDevData>("/kpis"),

// AFTER:
queryFn: () => get<KpiDevData>("/kpis"),
```

**Change 3: Update lead sources query (line 146)**
```typescript
// BEFORE:
queryFn: () => api.get<unknown>("/kpis/lead-sources"),

// AFTER:
queryFn: () => get<unknown>("/kpis/lead-sources"),
```

**Result:** Both queries now use canonical client → same identity mechanism → same orgId resolution

**Files Modified:** 1 file (`web/src/features/dashboard/KpiChart.tsx`)

**Rollback:** Revert import and queryFn changes

---

### Layer 3: Cache Invalidation Hardening

**Goal:** Ensure lead source updates trigger pie chart refresh.

**Changes:**

**File:** `web/src/pages/LeadsPage.tsx`

**Change: Add invalidation in `handleSaveLead()` (after line 436)**
```typescript
// AFTER:
await refresh();

// ADD:
queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
```

**Verification:**
- Update a lead's source → pie chart updates immediately
- No duplicate fetches (invalidation triggers refetch, not manual fetch)

**Files Modified:** 1 file (`web/src/pages/LeadsPage.tsx`)

**Rollback:** Remove the invalidation line

---

### Layer 4: Chart Robustness (Already Correct)

**Goal:** Ensure chart handles edge cases gracefully.

**Current State:**
- ✅ Empty state: Shows "No lead sources yet" message (line 349-360)
- ✅ Loading state: Shows skeleton (line 339-342)
- ✅ Error state: Shows error message (line 343-348)
- ✅ Container sizing: Fixed height `h-[300px]`
- ✅ Data validation: `normalizeLeadSources()` filters invalid data
- ✅ Zero values: Filtered out before rendering (NeonPieChart line 31)

**Changes:** None needed - robustness is already implemented

**Files Modified:** 0 files

---

## Second-Order Effects & Mitigations

### 1) Changing API Client Identity Behavior

**Risk:** Migrating `KpiChart.tsx` to canonical client changes its identity behavior:
- **Before:** Always dev bypass (`orgId = "org_dev"`)
- **After:** Respects `DFOS_FORCE_DEV_IDENTITY` flag (JWT mode by default)

**Mitigation:**
- ✅ This is the intended behavior - both endpoints should use same identity
- ✅ User can still force dev mode with `DFOS_FORCE_DEV_IDENTITY=1`
- ✅ Production behavior unchanged (canonical client sends token in prod)

**Verification:** Test both identity modes after fix

---

### 2) Increased Network Chatter from Invalidation

**Risk:** Adding invalidation to `handleSaveLead()` may cause extra refetches.

**Mitigation:**
- ✅ Invalidation only triggers refetch if query is active (mounted component)
- ✅ `staleTime: 30000` in query config prevents excessive refetches
- ✅ Only invalidate on successful mutation (inside try block, after `await patch()`)

**Verification:** Monitor Network tab - should see exactly one `GET /api/kpis/lead-sources` after lead update

---

### 3) Unknown Sources Handling

**Risk:** Backend filters out null/empty sources. If all leads have empty sources, pie chart shows empty state.

**Mitigation:**
- ✅ This is correct behavior - empty state message explains: "Create a lead and select a source"
- ✅ No data loss - leads without sources are still stored, just not counted in aggregation

**Documentation:** Current empty state message is clear (line 351-359)

---

### 4) Vite Proxy Caching/ETags

**Risk:** Dev server may cache `/api/kpis/lead-sources` responses, causing stale data.

**Mitigation:**
- ✅ `refetchOnMount: "always"` in query config (line 149) ensures fresh data on mount
- ✅ Invalidation triggers refetch regardless of cache
- ✅ Backend should set `Cache-Control: no-cache` in dev mode (optional, not critical)

**Verification:** Check Network tab - should see 200 responses, not 304 (if ETags present)

---

### 5) Breaking Other Consumers

**Risk:** Changing `KpiChart.tsx` client might affect other components.

**Mitigation:**
- ✅ `KpiChart.tsx` is the only consumer of `["lead-sources"]` query (verified via grep)
- ✅ No other components import `KpiChart` except `KpisPage.tsx`
- ✅ Response shape unchanged - only identity mechanism changes

**Verification:** Run `rg -n "lead-sources" web/src` - should only show `KpiChart.tsx` and `LeadsPage.tsx` (invalidation)

---

## Verification Matrix

### Test Case 1: Create Lead with Source "ppc"

**Setup:**
- Clear all leads (or use fresh org)
- Ensure `DFOS_FORCE_DEV_IDENTITY` is unset (JWT mode)

**Steps:**
1. Navigate to `/leads`
2. Create lead with source "ppc"
3. Navigate to `/kpis`

**Expected:**
- ✅ Network: POST /api/leads 200, GET /api/kpis/lead-sources 200
- ✅ Server logs: `[AUTH RESOLVE] mode=JWT` for both endpoints, same `org` value
- ✅ Server logs: `[LEADS_STORE] org=<X> afterCreate count=1`
- ✅ Pie chart: Shows slice for "PPC" with value 1
- ✅ No console errors

**Pass Criteria:** Pie chart displays "PPC" slice

---

### Test Case 2: Create Lead with Source "sms" → Pie Updates

**Setup:**
- Test Case 1 completed (1 lead with "ppc" source)

**Steps:**
1. Stay on `/kpis` page (pie chart visible)
2. Open `/leads` in new tab
3. Create lead with source "sms"
4. Return to `/kpis` tab

**Expected:**
- ✅ Network: POST /api/leads 200, GET /api/kpis/lead-sources 200 (triggered by invalidation)
- ✅ Pie chart: Shows both "PPC" (1) and "SMS" (1) slices
- ✅ No hard reload required
- ✅ Chart updates within ~1 second

**Pass Criteria:** Pie chart updates without reload

---

### Test Case 3: Update Lead Source from "ppc" → "referral"

**Setup:**
- Test Case 1 completed (1 lead with "ppc" source)

**Steps:**
1. Navigate to `/leads`
2. Edit the lead, change source from "ppc" to "referral"
3. Save
4. Navigate to `/kpis`

**Expected:**
- ✅ Network: PATCH /api/leads/:id 200, GET /api/kpis/lead-sources 200 (triggered by invalidation)
- ✅ Pie chart: Shows "Referral" (1) slice, NO "PPC" slice
- ✅ Counts rebalance correctly (old source decremented, new source incremented)

**Pass Criteria:** Pie chart reflects source change immediately

---

### Test Case 4: Import Leads with Sources

**Setup:**
- CSV with 3 leads: 2 with "cold_call", 1 with "referral"

**Steps:**
1. Navigate to `/leads`
2. Import CSV
3. Commit import
4. Navigate to `/kpis`

**Expected:**
- ✅ Network: POST /api/leads-import/commit 200, GET /api/kpis/lead-sources 200
- ✅ Pie chart: Shows "Cold Call" (2) and "Referral" (1) slices
- ✅ Total matches imported count

**Pass Criteria:** Imported leads appear in pie chart

---

### Test Case 5: Empty State (No Leads)

**Setup:**
- Clear all leads (or use fresh org)

**Steps:**
1. Navigate to `/kpis`

**Expected:**
- ✅ Network: GET /api/kpis/lead-sources 200, response: `[]`
- ✅ Pie chart: Shows "No lead sources yet" message (not broken chart)
- ✅ No console errors
- ✅ No Recharts warnings

**Pass Criteria:** Empty state renders correctly, no errors

---

### Test Case 6: Identity Mode - FORCE_DEV_IDENTITY ON

**Setup:**
```javascript
localStorage.setItem("DFOS_FORCE_DEV_IDENTITY","1");
localStorage.setItem("DFOS_DEV_ORG_ID","org_dev");
localStorage.setItem("DFOS_DEV_USER_ID","user_dev");
location.reload();
```

**Steps:**
1. Create 1 lead with source "ppc"
2. Navigate to `/kpis`

**Expected:**
- ✅ Network: Both `/api/leads` and `/api/kpis/lead-sources` show `x-dev-org-id: org_dev` header
- ✅ Network: NO `Authorization` header on either request
- ✅ Server logs: `[AUTH RESOLVE] mode=DEV_BYPASS` for both, `org=org_dev`
- ✅ Pie chart: Shows "PPC" slice

**Pass Criteria:** Both endpoints use dev bypass, same orgId, pie chart works

---

### Test Case 7: Identity Mode - FORCE_DEV_IDENTITY OFF (JWT)

**Setup:**
```javascript
localStorage.removeItem("DFOS_FORCE_DEV_IDENTITY");
location.reload();
// Ensure token exists in localStorage
```

**Steps:**
1. Create 1 lead with source "ppc"
2. Navigate to `/kpis`

**Expected:**
- ✅ Network: Both `/api/leads` and `/api/kpis/lead-sources` show `Authorization: Bearer <token>` header
- ✅ Network: NO `x-dev-org-id` header on either request
- ✅ Server logs: `[AUTH RESOLVE] mode=JWT` for both, same `org` value (from token)
- ✅ Pie chart: Shows "PPC" slice

**Pass Criteria:** Both endpoints use JWT auth, same orgId, pie chart works

---

## Rollback Plan

### If Fix Causes Issues

**Layer 2 Rollback (Client Migration):**
```bash
# Revert KpiChart.tsx changes
git checkout web/src/features/dashboard/KpiChart.tsx
```

**Layer 3 Rollback (Cache Invalidation):**
```bash
# Revert LeadsPage.tsx changes
git checkout web/src/pages/LeadsPage.tsx
```

**Full Rollback:**
```bash
git checkout web/src/features/dashboard/KpiChart.tsx web/src/pages/LeadsPage.tsx
```

**Verification After Rollback:**
- Pie chart returns to current broken state (empty)
- No new errors introduced
- Other functionality unchanged

---

## Implementation Order

1. **Layer 2 (Client Migration)** - Fixes primary root cause
   - Migrate `KpiChart.tsx` to canonical client
   - Test: Pie chart should work in both identity modes

2. **Layer 3 (Cache Invalidation)** - Fixes secondary issue
   - Add invalidation to `handleSaveLead()`
   - Test: Source updates trigger chart refresh

3. **Verification** - Run all test cases
   - Confirm pie chart works in all scenarios
   - Confirm no regressions

4. **Documentation** - Update if needed
   - No documentation changes required (code is self-documenting)

---

## Success Criteria

**Primary:**
- ✅ Pie chart displays lead sources immediately after creation
- ✅ Pie chart updates when lead source changes
- ✅ Pie chart works in both JWT and dev bypass identity modes
- ✅ `/api/leads` and `/api/kpis/lead-sources` resolve to same orgId

**Secondary:**
- ✅ No console errors or warnings
- ✅ No duplicate network requests
- ✅ Empty state renders correctly
- ✅ Import flow updates pie chart

**Tertiary:**
- ✅ Code uses canonical client consistently
- ✅ Cache invalidation triggers on all source mutations
- ✅ No breaking changes to other components

---

## Next Steps

1. **Review this plan** - Confirm approach and phasing
2. **Approve Layer 2** - Begin client migration
3. **Test Layer 2** - Verify pie chart works
4. **Approve Layer 3** - Add cache invalidation
5. **Test Layer 3** - Verify updates trigger refresh
6. **Final verification** - Run all test cases
7. **Documentation** - Update if needed

---

**END OF PLAN**







