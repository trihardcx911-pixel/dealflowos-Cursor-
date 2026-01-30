# API Identity Unification Plan
## Fix: Leads and KPIs Share Same Org Scope

**Date:** 2025-01-XX  
**Status:** PLAN MODE (No Implementation)  
**Goal:** Permanently fix data flow so lead creation/listing and KPI aggregation always use the same org/user scope.

---

## A) Recommended Option: Option A (Enhanced `web/src/api.ts`)

### Rationale

**Option A: Make `web/src/api.ts` canonical + add dev header injection**

**Why Option A:**
1. **Minimal migration risk**: `web/src/api.ts` is already used by critical KPI paths (`KpiCard.tsx`, `KpisPage.tsx`, `LeadsPage.tsx` fetchQuery). Making it canonical requires fewer call-site changes.
2. **Better token handling**: `api.ts` already has token management (`getToken()`, `setToken()`), which is needed for production auth.
3. **Backward compatible**: Can add dev headers without breaking existing token-based flows.
4. **Single source of truth**: One `request()` function handles all identity logic.

**Why NOT Option B (Deprecate `api.ts`):**
- Would require migrating 15+ files (auth pages, billing, calendar, settings)
- `api.ts` has better error handling (`ApiError`, `NetworkError` classes)
- Token management is already implemented

**Why NOT Option C (Merge both):**
- More complex refactor, higher risk
- `api/client.ts` has different URL building logic (`buildUrl` with params)
- Would require reconciling two different error handling approaches

### Implementation Strategy

Enhance `web/src/api.ts` `request()` function to:
1. **In dev mode**: Always inject `x-dev-org-id` and `x-dev-user-id` headers
2. **In dev mode with token**: Still send dev headers, but backend will use JWT path (we'll handle this via backend modification OR conditional token sending)
3. **In prod mode**: Only send `Authorization` header (existing behavior)

**Key Decision**: In dev mode, if dev headers are present, we should NOT send `Authorization` header to ensure backend uses dev bypass path. This guarantees consistent `orgId = "org_dev"` resolution.

---

## B) 3-Phase Implementation Plan

### Phase 1: Identity Unification (Headers/Auth Semantics)

**Goal**: Make `web/src/api.ts` inject dev headers in dev mode, ensuring all API calls use the same org scope.

**Changes:**
1. Modify `web/src/api.ts` `request()` function:
   - Add `getDevHeaders()` function that returns dev headers only in dev mode (`import.meta.env.DEV`)
   - In dev mode: inject dev headers, conditionally skip `Authorization` header if dev headers are present
   - In prod mode: existing behavior (token only)

2. **Header injection logic:**
   ```typescript
   function getDevHeaders(): Record<string, string> {
     if (import.meta.env.DEV) {
       return {
         "x-dev-org-id": "org_dev",
         "x-dev-user-id": "user_dev",
         "x-dev-user-email": "dev@example.com",
       };
     }
     return {};
   }
   ```

3. **Token handling in dev mode:**
   - **Decision**: In dev mode, if dev headers are present, do NOT send `Authorization` header
   - **Rationale**: Backend skips dev bypass if `Authorization` exists (line 196 in `requireAuth.ts`). By not sending token in dev, we force dev bypass path, ensuring consistent `orgId = "org_dev"`.

4. **Modified `request()` signature:**
   ```typescript
   async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
     const token = getToken();
     const isDev = import.meta.env.DEV;
     const devHeaders = getDevHeaders();
     const hasDevHeaders = Object.keys(devHeaders).length > 0;
     
     const headers: HeadersInit = {
       'content-type': 'application/json',
       ...devHeaders, // Always inject in dev
       // Only send token if NOT in dev mode OR if dev headers are missing
       ...(token && (!isDev || !hasDevHeaders) ? { authorization: `Bearer ${token}` } : {}),
       ...(init.headers ?? {}),
     };
     // ... rest of function
   }
   ```

**Files Modified:**
- `web/src/api.ts` (only file changed in Phase 1)

**Rollback Plan:**
- Git revert the single file change
- No database or backend changes

**Verification:**
- DevTools Network tab: All `/api/*` requests show `x-dev-org-id: org_dev` header in dev mode
- DevTools Network tab: No `Authorization` header in dev mode (if token exists in localStorage, clear it or verify it's not sent)
- Server logs: All requests log `[DEV AUTH BYPASS FIRED]` with `orgId=org_dev`

---

### Phase 2: Call-Site Consolidation (Remove Dual Clients)

**Goal**: Migrate all `api/client.ts` usage to `api.ts` where possible, or ensure both use the same identity logic.

**Strategy**: Since `api/client.ts` is used by React Query hooks (`web/src/api/hooks.ts`), we have two options:
- **Option 2A**: Migrate `hooks.ts` to use `api.ts` functions (recommended)
- **Option 2B**: Make `api/client.ts` use the same dev header logic as `api.ts` (alternative)

**Recommended: Option 2A** - Migrate hooks to use `api.ts`:

1. **Update `web/src/api/hooks.ts`:**
   - Change `import { api } from "./client"` to `import { get, post, patch } from "./index"` (or `from "../api"`)
   - Replace `api.get()` → `get()`, `api.post()` → `post()`, `api.patch()` → `patch()`

2. **Update files using `api` from `client.ts`:**
   - `web/src/pages/LeadsPage.tsx`: Change `api.get/post/patch/delete` to `get/post/patch/del` from `../api`
   - `web/src/features/dashboard/KpiChart.tsx`: Change `api.get` to `get` from `../../api`
   - Legal components: Migrate to `api.ts` functions
   - `web/src/components/NeedsAttentionCard.tsx`: Migrate `apiFetch` usage
   - `web/src/hooks/useReminders.ts`: Migrate `apiFetch` usage
   - `web/src/pages/TasksPage.tsx`: Migrate `apiFetch` usage
   - `web/src/components/TodoCard.tsx`: Migrate `apiFetch` usage

3. **Handle `apiFetch` direct usage:**
   - `apiFetch` is a lower-level function. Either:
     - Export it from `api.ts` and make it use the same identity logic, OR
     - Replace `apiFetch` calls with `get/post/patch/del` functions

**Files Modified:**
- `web/src/api/hooks.ts`
- `web/src/pages/LeadsPage.tsx`
- `web/src/features/dashboard/KpiChart.tsx`
- `web/src/components/legal/*.tsx` (6 files)
- `web/src/components/NeedsAttentionCard.tsx`
- `web/src/hooks/useReminders.ts`
- `web/src/pages/TasksPage.tsx`
- `web/src/components/TodoCard.tsx`
- `web/src/components/attention/DealNeedsAttention.tsx`

**Rollback Plan:**
- Git revert all Phase 2 changes
- Phase 1 remains intact (dev headers still work)

**Verification:**
- All API calls in Network tab show `x-dev-org-id` header
- No imports of `api/client` remain (except possibly in `api/index.ts` re-exports)
- Run: `rg -n "from.*api/client" web/src` should return minimal results

---

### Phase 3: Guardrails/Regression Protection

**Goal**: Prevent future drift and ensure identity consistency.

**Changes:**

1. **ESLint rule (or script) to detect dual client usage:**
   - Create `.eslintrc` rule or `scripts/check-api-imports.js`:
     ```javascript
     // Disallow imports from api/client in non-api files
     // Only allow: import { get, post, ... } from '../api'
     ```

2. **Runtime assertion in dev mode:**
   - Add to `web/src/api.ts`:
     ```typescript
     if (import.meta.env.DEV) {
       // Log warning if token exists but dev headers are being used
       const token = getToken();
       if (token) {
         console.warn('[API] Dev mode: Token exists but dev headers will be used. Token will be ignored.');
       }
     }
     ```

3. **Backend logging enhancement:**
   - Add to `server/src/middleware/requireAuth.ts` (optional, for debugging):
     ```typescript
     if (DIAG()) {
       console.log('[AUTH] Headers:', {
         hasAuth: !!req.headers.authorization,
         hasDevOrgId: !!req.headers['x-dev-org-id'],
         orgId: (req as any).orgId,
       });
     }
     ```

4. **Documentation:**
   - Add comment in `web/src/api.ts`:
     ```typescript
     /**
      * Canonical API client for all frontend requests.
      * 
      * In dev mode: Always sends x-dev-org-id/x-dev-user-id headers.
      * In prod mode: Sends Authorization header if token exists.
      * 
      * DO NOT import from '../api/client' - use this module instead.
      */
     ```

**Files Modified:**
- `web/src/api.ts` (add assertion + docs)
- `.eslintrc.js` or `scripts/check-api-imports.js` (new file)
- `server/src/middleware/requireAuth.ts` (optional logging)

**Rollback Plan:**
- Remove ESLint rule/script
- Remove runtime assertion
- Keep documentation

**Verification:**
- Run lint/script: No violations
- Dev console: Warning appears if token exists in dev mode
- Server logs: Show consistent orgId for all requests

---

## C) Migration Inventory Table

### Files Using `web/src/api.ts` (get/post/patch/del)

| File | Current Usage | Migration Needed? | Notes |
|------|---------------|-------------------|-------|
| `web/src/pages/KpisPage.tsx` | `get("/api/kpis")` | ✅ Phase 1 fixes this | Already uses correct client |
| `web/src/components/KpiCard.tsx` | `get("/api/kpis")` | ✅ Phase 1 fixes this | Already uses correct client |
| `web/src/pages/LeadsPage.tsx` | `get("/api/kpis")` in fetchQuery | ✅ Phase 1 fixes this | Already uses correct client |
| `web/src/pages/SettingsPage.tsx` | `get, patch` | ✅ Phase 1 fixes this | Already uses correct client |
| `web/src/pages/CalendarPage.tsx` | `get, post, patch, del` | ✅ Phase 1 fixes this | Already uses correct client |
| `web/src/pages/BillingPage.tsx` | `get, post` | ✅ Phase 1 fixes this | Already uses correct client |
| `web/src/pages/BillingHistoryPage.tsx` | `get, post` | ✅ Phase 1 fixes this | Already uses correct client |
| `web/src/pages/auth/LoginPage.tsx` | `post, setToken, ApiError, NetworkError` | ✅ Phase 1 fixes this | Auth pages need token, but Phase 1 handles this |
| `web/src/pages/auth/SignupPage.tsx` | `post` | ✅ Phase 1 fixes this | Auth pages need token |

**Total: 9 files** - All benefit from Phase 1 (dev header injection)

---

### Files Using `web/src/api/client.ts` (api, apiFetch)

| File | Current Usage | Migration Needed? | Phase | Notes |
|------|---------------|-------------------|-------|-------|
| `web/src/api/hooks.ts` | `api.get/post/patch` (30+ usages) | ✅ Yes | Phase 2 | React Query hooks - migrate to `get/post/patch` |
| `web/src/pages/LeadsPage.tsx` | `api.get/post/patch/delete` (6 usages) | ✅ Yes | Phase 2 | Main leads CRUD - migrate to `get/post/patch/del` |
| `web/src/features/dashboard/KpiChart.tsx` | `api.get` (2 usages) | ✅ Yes | Phase 2 | KPI chart data - migrate to `get` |
| `web/src/components/legal/TitleMetadataPanel.tsx` | `api.get` | ✅ Yes | Phase 2 | Legal component |
| `web/src/components/legal/OpenIssuesPanel.tsx` | `api.get` | ✅ Yes | Phase 2 | Legal component |
| `web/src/components/legal/NeedsAttentionSignals.tsx` | `api.get` | ✅ Yes | Phase 2 | Legal component |
| `web/src/components/legal/LegalHub.tsx` | `api.get, api.patch` | ✅ Yes | Phase 2 | Legal component |
| `web/src/components/legal/LegalEventsTimeline.tsx` | `api.get` | ✅ Yes | Phase 2 | Legal component |
| `web/src/components/legal/ContractMetadataPanel.tsx` | `api` import (verify usage) | ✅ Yes | Phase 2 | Legal component |
| `web/src/components/legal/AssignmentMetadataPanel.tsx` | `api` import (verify usage) | ✅ Yes | Phase 2 | Legal component |
| `web/src/components/attention/DealNeedsAttention.tsx` | `api.get` (3 usages) | ✅ Yes | Phase 2 | Needs attention component |
| `web/src/components/NeedsAttentionCard.tsx` | `apiFetch` | ✅ Yes | Phase 2 | Migrate to `get/post` or export `apiFetch` from `api.ts` |
| `web/src/hooks/useReminders.ts` | `apiFetch` | ✅ Yes | Phase 2 | Migrate to `get/post` |
| `web/src/pages/TasksPage.tsx` | `apiFetch` | ✅ Yes | Phase 2 | Migrate to `get/post` |
| `web/src/components/TodoCard.tsx` | `apiFetch` | ✅ Yes | Phase 2 | Migrate to `get/post` |

**Total: 15 files** - All migrate in Phase 2

---

### Special Cases

| File | Issue | Solution |
|------|-------|----------|
| `web/src/api/index.ts` | Re-exports from `client.ts` and `hooks.ts` | Update to re-export from `api.ts` instead (or remove if not needed) |
| `web/src/api/client.ts` | Still used by hooks and components | After Phase 2, can deprecate or keep for backward compatibility |

---

## D) Second-Order Issues + Mitigations

### 1. Avoid Leaking Dev Headers into Prod Builds

**Issue**: Dev headers (`x-dev-org-id`) must never be sent in production.

**Mitigation:**
- Use `import.meta.env.DEV` (Vite-specific, stripped in prod builds)
- Add runtime check: `if (import.meta.env.DEV) { ... }`
- Verify: Build prod bundle and check Network tab - no `x-dev-org-id` headers

**Verification:**
```bash
npm run build
# Serve prod build and check Network tab
```

---

### 2. Avoid Conflicting Auth (Token + Dev Headers)

**Issue**: If both token and dev headers are sent, backend uses JWT path (skips dev bypass), potentially resolving different `orgId`.

**Mitigation:**
- **Phase 1 solution**: In dev mode, if dev headers are present, do NOT send `Authorization` header
- This forces backend to use dev bypass path, ensuring `orgId = "org_dev"`

**Alternative (if token must be sent):**
- Modify backend `requireAuth.ts` to check dev headers even in JWT path (out of scope for this plan)

**Verification:**
- DevTools: In dev mode, requests should NOT have `Authorization` header
- Server logs: Should show `[DEV AUTH BYPASS FIRED]` not JWT auth

---

### 3. Avoid Double Caching (ETag + React Query)

**Issue**: Browser may cache API responses via ETag, conflicting with React Query cache.

**Mitigation:**
- Add `Cache-Control: no-cache` header to API responses in dev mode (backend change, optional)
- React Query already handles caching - ensure API responses don't have aggressive cache headers

**Recommendation:**
- Backend should set: `Cache-Control: no-cache, no-store, must-revalidate` for `/api/*` routes in dev mode
- This is a backend change, not frontend - document but don't implement in this plan

---

### 4. Ensure KpisPage Doesn't Mask Failures (0 vs Error)

**Issue**: If API returns `{ totalLeads: 0 }`, UI shows 0, which could mask a real error.

**Mitigation:**
- Already handled in Phase D: `KpisPage.tsx` uses optional chaining (`data?.totalLeads ?? 0`)
- Ensure error state is displayed: `{error && <div>Failed to load</div>}`
- Verify: Check `KpisPage.tsx` has error handling (already present)

**Verification:**
- Simulate API error (stop backend server)
- Verify UI shows error message, not 0 values

---

### 5. Ensure Tests/Verification Cover Token Present vs Absent

**Issue**: Need to test both scenarios to ensure identity works correctly.

**Mitigation:**
- **Test Case 1**: Token present in localStorage, dev mode
  - Expected: Dev headers sent, token NOT sent, dev bypass used, `orgId = "org_dev"`
- **Test Case 2**: Token absent, dev mode
  - Expected: Dev headers sent, dev bypass used, `orgId = "org_dev"`
- **Test Case 3**: Token present, prod mode
  - Expected: Token sent, no dev headers, JWT auth used
- **Test Case 4**: Token absent, prod mode
  - Expected: No auth, 401 error (or handled by app)

**Verification Script**: See Section E

---

## E) Verification Scripts and Pass Criteria

### Test Matrix

| Test Case | Token | Mode | Expected Headers | Expected Backend Path | Expected orgId |
|-----------|-------|------|------------------|----------------------|----------------|
| 1 | Present | Dev | `x-dev-org-id`, `x-dev-user-id` (NO `Authorization`) | Dev bypass | `"org_dev"` |
| 2 | Absent | Dev | `x-dev-org-id`, `x-dev-user-id` (NO `Authorization`) | Dev bypass | `"org_dev"` |
| 3 | Present | Prod | `Authorization: Bearer <token>` (NO dev headers) | JWT auth | From token |
| 4 | Absent | Prod | None (or handled by app) | 401 or handled | N/A |

---

### Verification Script 1: Dev Mode (Token Present)

**Setup:**
```bash
# 1. Start dev server
cd web && npm run dev

# 2. Open browser, navigate to app
# 3. Set token in localStorage (if not already set)
localStorage.setItem('token', 'test-token-123')
```

**Steps:**
1. Open DevTools → Network tab
2. Filter: `/api/kpis` and `/api/leads`
3. Create a lead on `/leads` page
4. Navigate to `/kpis` page

**Assertions:**
- ✅ All `/api/*` requests show `x-dev-org-id: org_dev` header
- ✅ All `/api/*` requests do NOT show `Authorization` header (even if token exists)
- ✅ Server logs show `[DEV AUTH BYPASS FIRED]` for all requests
- ✅ `/api/kpis` returns `totalLeads > 0` (matches leads count)
- ✅ KPI numbers update immediately after lead creation (no hard reload)

**Pass Criteria:**
- All assertions pass
- No console errors
- KPIs match lead counts

---

### Verification Script 2: Dev Mode (Token Absent)

**Setup:**
```bash
# 1. Start dev server
cd web && npm run dev

# 2. Clear token
localStorage.removeItem('token')
```

**Steps:**
1. Open DevTools → Network tab
2. Filter: `/api/kpis` and `/api/leads`
3. Create a lead on `/leads` page
4. Navigate to `/kpis` page

**Assertions:**
- ✅ All `/api/*` requests show `x-dev-org-id: org_dev` header
- ✅ All `/api/*` requests do NOT show `Authorization` header
- ✅ Server logs show `[DEV AUTH BYPASS FIRED]` for all requests
- ✅ `/api/kpis` returns `totalLeads > 0` (matches leads count)

**Pass Criteria:**
- All assertions pass
- No 401 errors
- KPIs match lead counts

---

### Verification Script 3: Prod Build (Token Present)

**Setup:**
```bash
# 1. Build prod bundle
cd web && npm run build

# 2. Serve prod build (or deploy)
# 3. Set token in localStorage
localStorage.setItem('token', 'valid-jwt-token')
```

**Steps:**
1. Open DevTools → Network tab
2. Filter: `/api/kpis` and `/api/leads`
3. Make API requests

**Assertions:**
- ✅ All `/api/*` requests show `Authorization: Bearer <token>` header
- ✅ All `/api/*` requests do NOT show `x-dev-org-id` header
- ✅ Server uses JWT auth path (not dev bypass)
- ✅ API returns data (if token is valid)

**Pass Criteria:**
- All assertions pass
- No dev headers in prod
- JWT auth works correctly

---

### Verification Script 4: Cross-Page Consistency

**Setup:**
```bash
cd web && npm run dev
# Clear all leads (or use fresh org)
```

**Steps:**
1. Open `/leads` page
2. Note current lead count (e.g., 5 leads)
3. Create 1 new lead
4. Immediately navigate to `/kpis` page (without hard reload)
5. Check KPI `totalLeads` value

**Assertions:**
- ✅ `/kpis` page shows `totalLeads = 6` (5 + 1)
- ✅ No hard reload required
- ✅ Network tab shows exactly one `GET /api/kpis` after lead creation (from fetchQuery)
- ✅ Dashboard KPI tile (if mounted) also shows updated count

**Pass Criteria:**
- KPI numbers match lead counts
- Updates happen immediately (no reload)
- Single fetchQuery call per lead creation

---

### Verification Script 5: Server Log Consistency

**Setup:**
```bash
# Start server with diagnostics
cd server
DEV_DIAGNOSTICS=1 DEV_AUTH_BYPASS=1 npm run dev
```

**Steps:**
1. Create a lead via `/leads` page
2. Fetch KPIs via `/kpis` page

**Server Log Assertions:**
- ✅ Both requests log: `[DEV AUTH BYPASS FIRED] url=/api/leads orgId=org_dev userId=user_dev`
- ✅ Both requests log: `[DEV AUTH BYPASS FIRED] url=/api/kpis orgId=org_dev userId=user_dev`
- ✅ `orgId` is identical for both requests (`org_dev`)

**Pass Criteria:**
- Same `orgId` in logs for both endpoints
- Dev bypass path used (not JWT)

---

### Manual Verification Checklist

After each phase, verify:

- [ ] **Phase 1**: All `/api/*` requests in dev mode show `x-dev-org-id` header
- [ ] **Phase 1**: No `Authorization` header in dev mode (even if token exists)
- [ ] **Phase 1**: Server logs show consistent `orgId=org_dev`
- [ ] **Phase 2**: All files migrated (no `api/client` imports except in `api/index.ts`)
- [ ] **Phase 2**: All API calls still work (no broken imports)
- [ ] **Phase 3**: ESLint/script passes (no violations)
- [ ] **Phase 3**: Dev console shows warning if token exists in dev mode
- [ ] **Final**: Create lead → KPI updates immediately (no reload)
- [ ] **Final**: `/kpis` page shows correct totals
- [ ] **Final**: Dashboard KPI tile shows correct totals

---

## Rollback Procedures

### Phase 1 Rollback
```bash
git checkout web/src/api.ts
# Single file revert
```

### Phase 2 Rollback
```bash
git checkout web/src/api/hooks.ts
git checkout web/src/pages/LeadsPage.tsx
# ... revert all Phase 2 files
```

### Phase 3 Rollback
```bash
# Remove ESLint rule/script
# Remove runtime assertion
# Keep documentation (harmless)
```

---

## Success Criteria

**Primary:**
- ✅ Leads page and KPI pages always show consistent counts
- ✅ Creating a lead immediately updates KPIs (no reload)
- ✅ All API calls in dev mode use same `orgId` (`org_dev`)

**Secondary:**
- ✅ No dual client imports (except in `api/index.ts` re-exports)
- ✅ Prod builds don't send dev headers
- ✅ Token-based auth still works in prod

**Tertiary:**
- ✅ ESLint/script prevents future drift
- ✅ Documentation explains identity logic

---

## Next Steps

1. **Review this plan** - Confirm Option A and 3-phase approach
2. **Approve Phase 1** - Begin identity unification
3. **Test Phase 1** - Verify dev headers work correctly
4. **Approve Phase 2** - Begin call-site consolidation
5. **Test Phase 2** - Verify all migrations work
6. **Approve Phase 3** - Add guardrails
7. **Final verification** - Run all test scripts

---

**END OF PLAN**







