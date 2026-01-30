# Leads Overview + KPI Cards Unification Plan
## Single Source of Truth for Lead Counts

**Date:** 2025-01-XX  
**Status:** PLAN MODE (No Implementation)  
**Goal:** Make Leads Overview card and KPI tiles show consistent, always-refreshed lead counts by unifying identity, data source, and refresh mechanisms.

---

## A) Current State Map

### 1) Frontend Consumers

| Consumer | Component File | Query Key | Endpoint | Client | Org Resolution | Fields Used |
|----------|---------------|-----------|----------|--------|----------------|-------------|
| **KPI Tiles** | `web/src/components/KpiCard.tsx` | `["kpis-summary"]` | `GET /api/kpis` | `get` from `../api` (canonical) | JWT or dev bypass (consistent) | `activeLeads`, `monthlyNewLeads` |
| **Leads Overview** | `web/src/components/LeadsOverviewCard.tsx` | None (raw fetch) | `GET /api/leads/summary` | Raw `fetch()` (no headers) | Dev bypass only (default `org_dev`) | `total`, `active`, `newThisMonth` |

**Evidence:**
- `KpiCard.tsx` line 28-30: `useQuery(["kpis-summary"], () => get("/api/kpis"))`
- `LeadsOverviewCard.tsx` line 20: `fetch('/api/leads/summary')` with no headers
- `LeadsOverviewCard.tsx` line 15: Uses `useState` + `useEffect`, not React Query

### 2) Backend Providers

| Endpoint | Handler File | Store | Response Shape | Fields Computed |
|----------|-------------|--------|----------------|-----------------|
| **/api/kpis** | `server/src/routes/kpis.ts` | `getOrgLeads(orgId)` | `{ totalLeads, activeLeads, monthlyNewLeads, ... }` | `totalLeads`, `activeLeads`, `monthlyNewLeads` (UTC month) |
| **/api/leads/summary** | `server/src/routes/leads.dev.ts` | `getOrgLeads(orgId)` | `{ total, latest, items }` | `total` only (missing `active`, `newThisMonth`) |

**Evidence:**
- `kpis.ts` line 42: `const leads = getOrgLeads(orgId);`
- `kpis.ts` line 47: `totalLeads = leads.length;`
- `kpis.ts` line 48: `activeLeads = totalLeads;` (no archived field yet)
- `kpis.ts` line 102-107: `monthlyNewLeads` computed with UTC month boundaries
- `kpis.ts` line 184-194: Response includes `totalLeads`, `activeLeads`, `monthlyNewLeads`
- `leads.dev.ts` line 192: `const userLeads = getOrgLeads(orgId);`
- `leads.dev.ts` line 194-198: Returns `{ total: userLeads.length, latest, items }` only

### 3) Mutations and Refresh Strategy

| Mutation | Handler | Current Invalidation | Missing Invalidation |
|----------|---------|---------------------|---------------------|
| **Create Lead** | `handleSourceSubmit()` | `["lead-sources"]`, `["kpis-summary"]` + fetchQuery | None (complete) |
| **Update Lead** | `handleSaveLead()` | `["lead-sources"]` | `["kpis-summary"]` |
| **Delete Lead** | `handleDeleteLead()` | None | `["lead-sources"]`, `["kpis-summary"]` |
| **Import Leads** | `handleConfirmImport()` | `["lead-sources"]`, `["kpis-summary"]` + fetchQuery | None (complete) |

**Evidence:**
- `LeadsPage.tsx` line 398: Create invalidates `["lead-sources"]`
- `LeadsPage.tsx` line 400-406: Create invalidates + fetchQuery `["kpis-summary"]`
- `LeadsPage.tsx` line 437: Update invalidates `["lead-sources"]` only
- `LeadsPage.tsx` line 449: Delete calls `refresh()` only (no invalidation)
- `LeadsPage.tsx` line 607: Import invalidates `["lead-sources"]`
- `LeadsPage.tsx` line 609-617: Import invalidates + fetchQuery `["kpis-summary"]`

---

## B) Target Architecture — Single Source of Truth

### Selected Pattern: Pattern 1 (Preferred)

**Rationale:**
1. **Minimal changes:** `/api/kpis` already computes all fields Leads Overview needs:
   - `totalLeads` → maps to `total`
   - `activeLeads` → maps to `active`
   - `monthlyNewLeads` → maps to `newThisMonth`
2. **No backend changes:** Reuse existing endpoint, no risk of definition drift
3. **Single query cache:** Both cards share `["kpis-summary"]` queryKey → one network request, shared cache
4. **Consistency guaranteed:** Same computation, same store, same orgId → always consistent

**Alternative Patterns Rejected:**
- **Pattern 2:** Would require backend changes to add `active`/`newThisMonth` to `/api/leads/summary`, risk of definition drift, duplicate computation
- **Pattern 3:** Over-engineered for current needs, higher change surface

### KPI Definition Contract

**Source:** `server/src/routes/kpis.ts` (lines 28-107)

| Metric | Definition | Implementation |
|--------|------------|----------------|
| **totalLeads** | Count of all leads for org (excluding deleted/archived if exists) | `leads.length` (dev mode) or `COUNT(*) FROM "Lead" WHERE "orgId" = $1` (prod) |
| **activeLeads** | Currently equals totalLeads (no archived field yet). Future: filter by `archived = false` or `status != 'archived'` | `activeLeads = totalLeads` (line 48) |
| **monthlyNewLeads** | Count of leads with `createdAt` within UTC month boundaries `[monthStart, nextMonthStart)` | Lines 100-107: Filter by UTC month using `Date.parse(l.createdAt)` |

**UTC Month Boundaries:**
```typescript
const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth();
const monthStart = new Date(Date.UTC(year, month, 1));
const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));
// Filter: createdAt >= monthStart && createdAt < nextMonthStart
```

---

## C) Phased Implementation Plan

### Phase 0: Truth Gate (No Code)

**Goal:** Confirm current state before making changes.

**Manual Verification Steps:**

1. **Identity Mode Check:**
   - Open DevTools Console
   - Check: `localStorage.getItem("token")` (exists or null)
   - Check: `localStorage.getItem("DFOS_FORCE_DEV_IDENTITY")` (exists or null)

2. **Endpoint Response Verification:**
   - Network tab: `GET /api/kpis`
     - Status: 200
     - Response: `{ totalLeads: N, activeLeads: N, monthlyNewLeads: N, ... }`
     - Headers: Check identity headers (Authorization or x-dev-org-id)
   - Network tab: `GET /api/leads/summary`
     - Status: 200 or 401
     - Response: `{ total: N, latest: [...], items: [...] }` or `{ error: "Unauthorized" }`
     - Headers: Check if any identity headers present

3. **Current Dashboard State:**
   - KPI tiles show: Active Leads = X, New Leads (MTD) = Y
   - Leads Overview shows: Total Leads = Z (likely 0 or wrong)
   - Record exact values for comparison

**Deliverable:** Document current state (identity mode, endpoint responses, dashboard values)

---

### Phase 1: Client + Query Unification for LeadsOverviewCard (Frontend Only)

**Goal:** Migrate LeadsOverviewCard to use canonical client and React Query, reading from `/api/kpis` instead of `/api/leads/summary`.

**Files Modified:** 1 file
- `web/src/components/LeadsOverviewCard.tsx`

**Changes:**

**1. Replace raw fetch with React Query + canonical client:**
```typescript
// BEFORE (lines 1-35):
import { useEffect, useState } from 'react'
// ...
const [stats, setStats] = useState<LeadsStats>({ total: 0, active: 0, newThisMonth: 0 })
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch('/api/leads/summary')
    .then(res => res.json())
    .then(data => {
      setStats({
        total: data.total || 0,
        active: data.active || 0,
        newThisMonth: data.newThisMonth || 0
      })
      setLoading(false)
    })
    .catch(() => {
      // Fallback to dummy data if API fails
      setStats({ total: 147, active: 89, newThisMonth: 23 })
      setLoading(false)
    })
}, [])

// AFTER:
import { useQuery } from '@tanstack/react-query'
import { get } from '../api'

interface KpiPayload {
  totalLeads: number
  activeLeads: number
  monthlyNewLeads: number
  // ... other fields
}

export function LeadsOverviewCard() {
  const { data, isLoading, isError } = useQuery<KpiPayload>({
    queryKey: ["kpis-summary"],  // Same key as KpiCard
    queryFn: () => get<KpiPayload>("/api/kpis"),
  })
```

**2. Map KPI response to Leads Overview UI:**
```typescript
// Map backend fields to UI fields
const stats = {
  total: data?.totalLeads ?? 0,
  active: data?.activeLeads ?? 0,
  newThisMonth: data?.monthlyNewLeads ?? 0,
}

const loading = isLoading
const error = isError
```

**3. Remove dummy fallback, add error state:**
```typescript
// BEFORE: catch(() => { setStats({ total: 147, active: 89, newThisMonth: 23 }) })

// AFTER: Show error state in UI
{isError && (
  <div className="text-red-400 text-sm">Failed to load leads data</div>
)}
```

**4. Update type definition:**
```typescript
// Remove LeadsStats type (no longer needed)
// Use KpiPayload from query response
```

**Result:**
- ✅ Uses canonical client → same identity as KpiCard/LeadsPage
- ✅ Uses React Query → can be invalidated
- ✅ Shares queryKey with KpiCard → single network request, shared cache
- ✅ Reads from same endpoint as KPI tiles → guaranteed consistency
- ✅ No dummy fallback → real errors visible

**Rollback:** Revert `LeadsOverviewCard.tsx` to previous state

---

### Phase 2: Refresh/Invalidation Guarantees (Mutations)

**Goal:** Ensure all lead mutations invalidate `["kpis-summary"]` so both cards update immediately.

**Files Modified:** 1 file
- `web/src/pages/LeadsPage.tsx`

**Changes:**

**1. Add invalidation to `handleSaveLead()` (after line 437):**
```typescript
// CURRENT (line 437):
queryClient.invalidateQueries({ queryKey: ["lead-sources"] });

// ADD:
queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
```

**2. Add invalidation to `handleDeleteLead()` (after line 449):**
```typescript
// CURRENT (line 449):
await refresh();

// ADD:
queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
```

**3. Verify create and import already invalidate (no changes needed):**
- Create (line 400): Already invalidates `["kpis-summary"]` ✅
- Import (line 609): Already invalidates `["kpis-summary"]` ✅

**Result:**
- ✅ All mutations invalidate `["kpis-summary"]`
- ✅ Both KPI tiles and Leads Overview update immediately
- ✅ No refetch storms (invalidation triggers refetch only if query is active)

**Rollback:** Remove added invalidation lines

---

### Phase 3: Optional — Backend Cleanup (Not Required for Pattern 1)

**Status:** Not needed if Pattern 1 is chosen.

**Rationale:** `/api/leads/summary` endpoint can remain as-is (used by other consumers potentially) or be deprecated later. No changes required for this fix.

**If Pattern 2 was chosen (not recommended):**
- Would need to add `active` and `newThisMonth` computation to `/api/leads/summary`
- Would need to ensure definitions match `/api/kpis` exactly
- Higher risk of drift

---

## D) Second-Order Effects + Mitigations

### 1) Hidden Identity Split Reappears

**Risk:** If any component still uses `api/client` or raw `fetch()`, identity split can reappear.

**Mitigation:**
- ✅ Guardrail script already exists: `npm run check:api-client` (web/package.json)
- ✅ Documentation comment in `web/src/api.ts` warns against `api/client` usage
- ✅ Phase 1 migrates LeadsOverviewCard to canonical client
- **Action:** Run guardrail script after Phase 1 to confirm no regressions

---

### 2) Removing Dummy Fallback Reveals Auth/Identity Bugs

**Risk:** Current dummy fallback (`{ total: 147, active: 89, newThisMonth: 23 }`) masks real failures. Removing it may reveal existing bugs.

**Mitigation:**
- ✅ Phase 1 adds explicit error state instead of dummy data
- ✅ Error state shows "Failed to load leads data" message
- ✅ React Query error handling is robust (retry, error state)
- **Action:** Test error scenarios (stop backend, network failure) to ensure error state renders correctly

---

### 3) Double Fetching Counts on Dashboard

**Risk:** If both cards query different endpoints, dashboard makes 2 network requests.

**Mitigation:**
- ✅ Pattern 1 uses same queryKey `["kpis-summary"]` for both cards
- ✅ React Query deduplicates: if both components mount, only one network request
- ✅ Shared cache: both cards read from same cached data
- **Verification:** Network tab should show only ONE `GET /api/kpis` when dashboard loads

---

### 4) Stale Totals if Invalidation Misses Mutation Path

**Risk:** If a mutation handler doesn't invalidate `["kpis-summary"]`, cards show stale data.

**Mitigation:**
- ✅ Phase 2 enumerates all mutation handlers:
  - Create: ✅ Already invalidates
  - Update: ✅ Phase 2 adds invalidation
  - Delete: ✅ Phase 2 adds invalidation
  - Import: ✅ Already invalidates
- ✅ All mutations are in `LeadsPage.tsx` (single file) → easy to audit
- **Action:** After Phase 2, verify all mutation handlers invalidate `["kpis-summary"]`

---

### 5) Query Key Collision with Other Consumers

**Risk:** If other components use `["kpis-summary"]`, invalidating it may trigger unwanted refetches.

**Mitigation:**
- ✅ Current consumers of `["kpis-summary"]`:
  - `KpiCard.tsx` (dashboard)
  - `KpisPage.tsx` (likely, verify)
- ✅ Both are read-only displays → invalidating on mutations is correct behavior
- ✅ React Query only refetches if query is active (component mounted)
- **Action:** Verify `KpisPage.tsx` uses same queryKey (should be `["kpis-summary"]`)

---

### 6) Response Shape Changes Break Frontend

**Risk:** If backend `/api/kpis` response shape changes, both cards break.

**Mitigation:**
- ✅ TypeScript types: `KpiPayload` interface defines expected shape
- ✅ Optional chaining: `data?.totalLeads ?? 0` handles missing fields gracefully
- ✅ Backend changes are rare (kpis.ts is stable)
- **Action:** If backend changes, update `KpiPayload` interface and both components automatically get type errors

---

## E) Verification Matrix

### Test Case 1: Create Lead with Source

**Setup:**
- Clear all leads (or use fresh org)
- Ensure `DFOS_FORCE_DEV_IDENTITY` is unset (JWT mode)

**Steps:**
1. Navigate to `/dashboard`
2. Note initial values: KPI Active Leads = X, Leads Overview Total = Y
3. Create 1 lead with source "ppc" from `/leads` page
4. Return to `/dashboard` (no hard reload)

**Expected:**
- ✅ Network: POST /api/leads 200, GET /api/kpis 200 (triggered by invalidation)
- ✅ Server logs: `[LEADS_STORE] org=<X> afterCreate count=1`
- ✅ Server logs: `[KPI_STORE] org=<X> kpiCountSource=1`
- ✅ KPI tiles: Active Leads = X+1, New Leads (MTD) = 1
- ✅ Leads Overview: Total Leads = Y+1, Active = X+1, New This Month = 1
- ✅ Both cards show same values (total = active in dev mode)
- ✅ No duplicate GET /api/kpis requests (shared cache)

**Pass Criteria:** Both cards increment, values match, single network request

---

### Test Case 2: Update Lead Source

**Setup:**
- Test Case 1 completed (1 lead exists)

**Steps:**
1. Navigate to `/leads`
2. Edit the lead, change source from "ppc" to "referral"
3. Save
4. Navigate to `/dashboard`

**Expected:**
- ✅ Network: PATCH /api/leads/:id 200, GET /api/kpis 200 (triggered by invalidation)
- ✅ KPI tiles: Totals unchanged (source change doesn't affect counts)
- ✅ Leads Overview: Totals unchanged
- ✅ Pie chart: Updates to show "Referral" instead of "PPC" (separate query)

**Pass Criteria:** Totals remain consistent, pie chart updates

---

### Test Case 3: Delete Lead

**Setup:**
- Test Case 1 completed (1 lead exists)

**Steps:**
1. Navigate to `/leads`
2. Delete the lead
3. Navigate to `/dashboard`

**Expected:**
- ✅ Network: DELETE /api/leads/:id 200, GET /api/kpis 200 (triggered by invalidation)
- ✅ KPI tiles: Active Leads = X-1, New Leads (MTD) = 0
- ✅ Leads Overview: Total Leads = Y-1, Active = X-1, New This Month = 0
- ✅ Both cards decrement, values match

**Pass Criteria:** Both cards decrement, values match

---

### Test Case 4: Import Leads

**Setup:**
- CSV with 3 leads: 2 with "cold_call", 1 with "referral"

**Steps:**
1. Navigate to `/leads`
2. Import CSV
3. Commit import
4. Navigate to `/dashboard`

**Expected:**
- ✅ Network: POST /api/leads-import/commit 200, GET /api/kpis 200 (triggered by invalidation)
- ✅ KPI tiles: Active Leads = X+3, New Leads (MTD) = 3
- ✅ Leads Overview: Total Leads = Y+3, Active = X+3, New This Month = 3
- ✅ Both cards increment by 3, values match

**Pass Criteria:** Both cards increment by imported count, values match

---

### Test Case 5: Empty State (No Leads)

**Setup:**
- Clear all leads (or use fresh org)

**Steps:**
1. Navigate to `/dashboard`

**Expected:**
- ✅ Network: GET /api/kpis 200, response: `{ totalLeads: 0, activeLeads: 0, monthlyNewLeads: 0, ... }`
- ✅ KPI tiles: Active Leads = 0, New Leads (MTD) = 0
- ✅ Leads Overview: Total Leads = 0, Active = 0, New This Month = 0
- ✅ No console errors
- ✅ No dummy fallback data (147/89/23)

**Pass Criteria:** Both cards show 0, no errors, no dummy data

---

### Test Case 6: Identity Mode - JWT (Token Present, DFOS_FORCE_DEV_IDENTITY Off)

**Setup:**
```javascript
localStorage.removeItem("DFOS_FORCE_DEV_IDENTITY");
// Ensure token exists
location.reload();
```

**Steps:**
1. Create 1 lead from `/leads`
2. Navigate to `/dashboard`

**Expected:**
- ✅ Network: Both `/api/leads` and `/api/kpis` show `Authorization: Bearer <token>` header
- ✅ Network: NO `x-dev-org-id` header on either request
- ✅ Server logs: `[AUTH RESOLVE] mode=JWT` for both endpoints, same `org` value
- ✅ KPI tiles: Show correct counts
- ✅ Leads Overview: Show same counts as KPI tiles

**Pass Criteria:** Both endpoints use JWT auth, same orgId, counts match

---

### Test Case 7: Identity Mode - Forced Dev Identity (DFOS_FORCE_DEV_IDENTITY=1)

**Setup:**
```javascript
localStorage.setItem("DFOS_FORCE_DEV_IDENTITY","1");
localStorage.setItem("DFOS_DEV_ORG_ID","org_dev");
localStorage.setItem("DFOS_DEV_USER_ID","user_dev");
location.reload();
```

**Steps:**
1. Create 1 lead from `/leads`
2. Navigate to `/dashboard`

**Expected:**
- ✅ Network: Both `/api/leads` and `/api/kpis` show `x-dev-org-id: org_dev` header
- ✅ Network: NO `Authorization` header on either request
- ✅ Server logs: `[AUTH RESOLVE] mode=DEV_BYPASS` for both endpoints, `org=org_dev`
- ✅ KPI tiles: Show correct counts
- ✅ Leads Overview: Show same counts as KPI tiles

**Pass Criteria:** Both endpoints use dev bypass, same orgId, counts match

---

### Test Case 8: Network Failure / Backend Down

**Setup:**
- Stop backend server

**Steps:**
1. Navigate to `/dashboard`

**Expected:**
- ✅ Network: GET /api/kpis fails (network error or 500)
- ✅ KPI tiles: Show "—" or error state (isBusy = true)
- ✅ Leads Overview: Show error message "Failed to load leads data" (isError = true)
- ✅ NO dummy fallback data (147/89/23)
- ✅ No console errors (React Query handles gracefully)

**Pass Criteria:** Error states render, no dummy data, no crashes

---

### Test Case 9: Shared Cache Verification

**Setup:**
- Dashboard with both KpiCard and LeadsOverviewCard mounted

**Steps:**
1. Navigate to `/dashboard`
2. Open DevTools Network tab
3. Filter: `/api/kpis`

**Expected:**
- ✅ Exactly ONE `GET /api/kpis` request (not two)
- ✅ Both cards render with same data
- ✅ React Query deduplication working

**Pass Criteria:** Single network request, both cards show same values

---

## Rollback Plan

### Phase 1 Rollback
```bash
git checkout web/src/components/LeadsOverviewCard.tsx
```

### Phase 2 Rollback
```bash
git checkout web/src/pages/LeadsPage.tsx
```

### Full Rollback
```bash
git checkout web/src/components/LeadsOverviewCard.tsx web/src/pages/LeadsPage.tsx
```

**Verification After Rollback:**
- Leads Overview returns to broken state (shows 0 or wrong counts)
- KPI tiles continue working (unchanged)
- No new errors introduced

---

## Success Criteria

**Primary:**
- ✅ Leads Overview and KPI tiles show identical counts (total, active, new this month)
- ✅ Both cards update immediately after lead mutations (no hard reload)
- ✅ Both cards use same identity mechanism (same orgId resolution)
- ✅ Single network request when both cards are mounted (shared cache)

**Secondary:**
- ✅ No dummy fallback data (real errors visible)
- ✅ All mutation paths invalidate `["kpis-summary"]`
- ✅ No refetch storms (invalidation only, no manual refetch)
- ✅ Error states render correctly

**Tertiary:**
- ✅ Code uses canonical client consistently
- ✅ React Query cache shared between components
- ✅ Type safety maintained (TypeScript interfaces)

---

## Implementation Order

1. **Phase 0:** Run truth gate verification (manual)
2. **Phase 1:** Migrate LeadsOverviewCard to canonical client + React Query
3. **Phase 1 Verification:** Test dashboard shows consistent counts
4. **Phase 2:** Add invalidation to update/delete handlers
5. **Phase 2 Verification:** Test mutations trigger card updates
6. **Final Verification:** Run all 9 test cases

---

## Next Steps

1. **Review this plan** - Confirm Pattern 1 selection and phasing
2. **Approve Phase 0** - Run truth gate verification
3. **Approve Phase 1** - Begin client migration
4. **Test Phase 1** - Verify dashboard consistency
5. **Approve Phase 2** - Add mutation invalidations
6. **Test Phase 2** - Verify mutation refresh
7. **Final verification** - Run all test cases

---

**END OF PLAN**







