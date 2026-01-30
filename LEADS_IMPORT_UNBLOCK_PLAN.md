# Leads Import Unblock Plan

## Immediate Unblock Plan (Option A+)

### Objective
Remove `kpis.dev.ts` from the runtime dependency graph to allow Express to initialize and mount `/api/leads-import`.

### Step-by-Step Implementation

**Step 1.1: Remove kpis.dev.ts import**
- **File:** `server/src/server.ts`
- **Action:** Comment out or delete line 25: `import { kpisDevRouter } from "./routes/kpis.dev.js";`
- **Rationale:** This import executes at module load time and crashes before Express initializes
- **Verification:** Server should no longer crash with "does not provide an export named 'leads'"

**Step 1.2: Remove kpis.dev.ts mount (if present)**
- **File:** `server/src/server.ts`
- **Action:** Verify no mount exists for `kpisDevRouter` (it should not, based on line 25 comment "KEEP import for now (not used)")
- **Rationale:** Even if import is removed, any mount would fail
- **Verification:** No `app.use("/api/kpis", kpisDevRouter)` exists

**Step 1.3: Preserve real KPI router**
- **File:** `server/src/server.ts`
- **Action:** Keep line 26 (`import { makeKpisRouter }`) and line 85 (`app.use("/api/kpis", makeKpisRouter(pool))`) unchanged
- **Rationale:** Real KPI router is independent and functional
- **Verification:** `/api/kpis` routes remain available via `makeKpisRouter`

**Step 1.4: Verify Express initialization**
- **Expected behavior after fix:**
  - Server prints: `[api] listening on port 3010`
  - Server prints: `>>> DEV LEADS IMPORT router mounted at /api/leads-import`
  - Server prints: `>>> ROUTES: /api/leads (dev CRUD), /api/leads-import (import)`
  - Debug middleware logs: `[SERVER] POST /api/leads-import` when called

**Step 1.5: Smoke test**
- **Command:** `curl -i -X POST http://localhost:3010/api/leads-import`
- **Expected:** 400 or 415 (missing multipart file) — NOT 404
- **Success criteria:** Endpoint is reachable, server responds

### Guarantees After Step 1
- ✅ Express initializes successfully
- ✅ `/api/leads-import` is reachable (returns 400/415, not 404)
- ✅ `/api/leads-import/commit` is reachable (may return 401/400, not 404)
- ✅ All other routes (`/api/leads`, `/api/calendar`, etc.) remain functional
- ✅ Real KPI router (`/api/kpis`) remains functional

---

## Import Commit Strategy Decision

### Current State Analysis

**Preview endpoint (`POST /api/leads-import`):**
- **Persistence:** None (file parsing only)
- **Prisma dependency:** ❌ NO
- **Status:** Will work immediately after unblock

**Commit endpoint (`POST /api/leads-import/commit`):**
- **Persistence:** Prisma (`prisma.lead.findMany`, `prisma.lead.createMany`)
- **Prisma dependency:** ✅ YES (lines 304, 448, 457)
- **Current risk:** Will fail if `DATABASE_URL` is missing or Prisma client fails to initialize

### Decision: Path A (Dev-First, Safer Now)

**Recommended path:** Temporarily switch import commit to in-memory store

**Justification:**
1. **Minimizes second-order bugs:** Import feature becomes fully functional without DB setup
2. **Preserves dev workflow:** Matches existing `/api/leads` CRUD pattern (in-memory)
3. **Clear migration path:** Can switch to Prisma later when DB is ready
4. **Consistency:** All dev routes use in-memory storage, import should match
5. **User experience:** Bronze users can test import flow end-to-end without infrastructure

**Implementation approach:**
- Modify `/api/leads-import/commit` to use `leadsByUser` from `leads.dev.ts` instead of Prisma
- Keep Prisma code commented/guarded for future migration
- Add clear TODO comment indicating this is temporary dev-only behavior

**Future migration:**
- When DB is ready, uncomment Prisma code and remove in-memory fallback
- No schema changes needed (Prisma model already exists)
- Import logic remains identical, only persistence layer changes

**Alternative (Path B) rejected because:**
- Requires DB setup for dev, blocking immediate testing
- Calendar routes already have Prisma issues, adding import dependency compounds the problem
- Violates "dev-first" principle where dev should work without infrastructure

---

## Execution Order (Stage 1 → Stage N)

### Stage 1: Immediate Boot Unblock (Critical Path)
**Goal:** Server boots, `/api/leads-import` is reachable

1. **Remove kpis.dev.ts import** (`server/src/server.ts` line 25)
   - Comment out: `// import { kpisDevRouter } from "./routes/kpis.dev.js";`
   - Verify: Server boots without crash

2. **Verify route mounting**
   - Check server logs for: `>>> DEV LEADS IMPORT router mounted at /api/leads-import`
   - Test: `curl -X POST http://localhost:3010/api/leads-import`
   - Expected: 400/415 (not 404)

3. **Verify other routes still work**
   - Test: `curl http://localhost:3010/api/leads` (should return 401, not crash)
   - Test: `curl http://localhost:3010/api/kpis` (should work via `makeKpisRouter`)

**Success criteria:** Server boots, import preview endpoint responds (not 404)

---

### Stage 2: Import Commit Stabilization (Second-Order Fix)
**Goal:** `/api/leads-import/commit` works in dev without Prisma

1. **Modify commit endpoint to use in-memory store**
   - **File:** `server/src/routes/leads.import.ts`
   - **Action:** Replace Prisma calls (lines 304, 448, 457) with `leadsByUser` from `leads.dev.ts`
   - **Import:** Add `import { leadsByUser } from "./leads.dev.js";` at top
   - **Logic:** Use same deduplication pattern but against `leadsByUser[orgId]` instead of Prisma

2. **Preserve Prisma code for future**
   - Comment out Prisma code blocks with clear TODO markers
   - Add comment: `// TODO: Switch to Prisma when DATABASE_URL is configured`

3. **Update addressHash lookup**
   - Replace `prisma.lead.findMany({ where: { orgId }, select: { addressHash: true } })`
   - With: `Object.values(leadsByUser[orgId] || []).map(l => l.addressHash)`

4. **Update insert logic**
   - Replace `prisma.lead.createMany` and `prisma.lead.create`
   - With: `leadsByUser[orgId].push(...validLeads)`

5. **Test commit flow**
   - Upload file → preview → confirm import
   - Verify leads appear in `/api/leads` response
   - Verify deduplication works (same file imported twice)

**Success criteria:** Full import flow works end-to-end in dev mode

---

### Stage 3: Long-Term Guardrails (Prevent Regression)
**Goal:** Prevent future import-time crashes and hybrid persistence issues

1. **Add explicit dev/prod boundaries**
   - **File:** `server/src/server.ts`
   - **Action:** Add comment block at top explaining dev-only routes
   - **Content:** Document which routes are dev-only (in-memory) vs prod-ready (Prisma)

2. **Conditional import pattern (optional, if needed)**
   - **Pattern:** Use dynamic import for optional dev routes
   - **Example:** `if (process.env.NODE_ENV === 'development') { await import('./routes/kpis.dev.js') }`
   - **Rationale:** Prevents import-time crashes if dev file has issues

3. **Explicit "no Prisma in dev" rule documentation**
   - **File:** `server/README.md` or `server/DEV_NOTES.md`
   - **Content:** Document that dev routes use in-memory storage, Prisma is for production
   - **Rationale:** Prevents future developers from accidentally adding Prisma to dev routes

4. **Separate dev entry file (future consideration)**
   - **Current:** `src/server.ts` handles both dev and prod
   - **Future option:** `src/dev.server.ts` for dev-only routes, `src/server.ts` for prod
   - **Rationale:** Complete isolation prevents cross-contamination
   - **Not recommended now:** Adds complexity, current structure is fine if imports are fixed

**Success criteria:** Documentation exists, future developers understand boundaries

---

## Why This Won't Regress Later

### Technical Guarantees

1. **Import-time crash eliminated:**
   - `kpis.dev.ts` is completely removed from import graph
   - No code path can trigger the broken import
   - Even if `kpis.dev.ts` is fixed later, it won't be imported unless explicitly added back

2. **Route isolation:**
   - `/api/leads-import` is mounted independently at `/api/leads-import`
   - No dependency on `/api/leads` router
   - No dependency on KPI routers
   - Mount order is irrelevant (no path collision)

3. **Persistence consistency:**
   - Dev routes use in-memory storage (`leadsByUser`)
   - Prod routes use Prisma
   - Clear boundary prevents mixing

4. **Verification hooks:**
   - Server logs confirm mount: `>>> DEV LEADS IMPORT router mounted at /api/leads-import`
   - Debug middleware logs every request: `[SERVER] POST /api/leads-import`
   - Curl test in comment block provides quick verification

### Process Guarantees

1. **Documentation:**
   - Plan document explains why changes were made
   - Code comments explain temporary dev-only behavior
   - Future developers can understand context

2. **Explicit boundaries:**
   - Dev vs prod routes are clearly marked
   - Import commit strategy is documented
   - Migration path to Prisma is clear

3. **Testing:**
   - Curl verification commands in code comments
   - Server logs provide runtime verification
   - Import flow can be tested end-to-end

---

## What NOT To Do (Anti-Patterns)

### ❌ Do NOT Fix kpis.dev.ts Export Mismatch Yet
- **Why:** Not needed for import unblock
- **Risk:** Introduces unnecessary complexity
- **When:** Fix later as separate task if KPI dev router is actually needed

### ❌ Do NOT Merge Routers
- **Why:** Violates separation of concerns
- **Risk:** Creates tight coupling between unrelated features
- **Correct:** Keep import router separate, independent mount

### ❌ Do NOT Add Auth/Rate Limiting to Import Router
- **Why:** User explicitly requested no middleware
- **Risk:** Introduces new failure modes
- **Correct:** Keep import router simple, add auth later if needed

### ❌ Do NOT Refactor leads.dev.ts to Export `leads`
- **Why:** Not needed (kpis.dev.ts is being removed)
- **Risk:** Changes data structure unnecessarily
- **Correct:** Remove the broken import, don't fix the export

### ❌ Do NOT Switch Import Commit to Prisma Immediately
- **Why:** DB may not be ready, creates second-order failure
- **Risk:** Import feature becomes unusable in dev
- **Correct:** Use in-memory store first, migrate to Prisma later

### ❌ Do NOT Create New Entry Files Yet
- **Why:** Current structure is fine once imports are fixed
- **Risk:** Adds unnecessary complexity
- **Correct:** Fix imports in existing `server.ts`, consider separate entry files later if needed

### ❌ Do NOT Touch Frontend Code
- **Why:** Frontend already uses correct endpoints (`/api/leads-import`)
- **Risk:** Introduces new bugs
- **Correct:** Backend fix is sufficient

### ❌ Do NOT Add Feature Flags or Complex Conditionals
- **Why:** Over-engineering for current problem
- **Risk:** Adds complexity without solving root cause
- **Correct:** Simple removal of broken import is sufficient

### ❌ Do NOT Modify Prisma Schema
- **Why:** Schema is correct, issue is runtime initialization
- **Risk:** Unnecessary database changes
- **Correct:** Fix import-time crash, Prisma will work when DB is ready

---

## Success Criteria for Next Agent Step

After this plan is executed, the following must be true:

1. **Server boots successfully:**
   - `npm run dev` completes without crashing
   - Server prints: `[api] listening on port 3010`
   - No SyntaxError about missing exports

2. **Import preview endpoint is reachable:**
   - `curl -X POST http://localhost:3010/api/leads-import` returns 400/415 (not 404)
   - Server log shows: `[SERVER] POST /api/leads-import`
   - Error message indicates missing file (expected), not "route not found"

3. **Import commit endpoint is reachable:**
   - `curl -X POST http://localhost:3010/api/leads-import/commit -H "Content-Type: application/json" -d '{"leads":[]}'` returns 400 (not 404)
   - Server log shows: `[SERVER] POST /api/leads-import/commit`
   - Error message indicates validation failure (expected), not "route not found"

4. **Other routes remain functional:**
   - `/api/leads` still works (may return 401, but not crash)
   - `/api/kpis` still works (via `makeKpisRouter`)
   - `/api/calendar` still works (if Prisma is configured)

5. **Full import flow works (after Stage 2):**
   - Upload file → preview table appears
   - Confirm import → leads appear in `/api/leads` response
   - Deduplication works (same file imported twice, second time skips duplicates)

---

## Implementation Notes

### File Modifications Required

**Stage 1 (Immediate Unblock):**
- `server/src/server.ts`: Remove/comment line 25 (kpis.dev.ts import)

**Stage 2 (Commit Stabilization):**
- `server/src/routes/leads.import.ts`: 
  - Add import: `import { leadsByUser } from "./leads.dev.js";`
  - Replace Prisma calls with in-memory store logic
  - Comment out Prisma code with TODO markers

**Stage 3 (Documentation):**
- `server/src/server.ts`: Add comment block explaining dev/prod boundaries
- Optional: Create `server/DEV_NOTES.md` with persistence strategy documentation

### Testing Checklist

After each stage:
- [ ] Server boots without errors
- [ ] Import preview endpoint responds (not 404)
- [ ] Import commit endpoint responds (not 404)
- [ ] Other routes still functional
- [ ] Server logs show expected mount messages
- [ ] Curl tests pass (400/415 acceptable, 404 is failure)

---

## Long-Term Considerations

### When to Migrate Import Commit to Prisma

**Prerequisites:**
- `DATABASE_URL` is configured and stable
- Prisma client initializes without errors
- Calendar routes work with Prisma (proves DB is ready)
- Import preview has been tested and validated

**Migration steps:**
1. Uncomment Prisma code in `leads.import.ts`
2. Remove in-memory fallback logic
3. Test with real database
4. Verify deduplication works correctly
5. Remove TODO comments

### When to Fix kpis.dev.ts (If Needed)

**Only if:**
- KPI dev router is actually needed for development
- Real KPI router (`makeKpisRouter`) is insufficient
- Team explicitly requests dev-only KPI functionality

**Fix approach:**
- Export `leads` array from `leads.dev.ts` (flatten `leadsByUser` values)
- OR: Update `kpis.dev.ts` to use `leadsByUser` directly
- Re-enable import and mount in `server.ts`

---

## Summary

This plan provides a three-stage approach:
1. **Immediate unblock:** Remove broken import, server boots, import endpoints become reachable
2. **Stabilization:** Switch commit endpoint to in-memory store, full import flow works in dev
3. **Guardrails:** Documentation and boundaries prevent future regressions

The approach prioritizes:
- **Immediate functionality:** Import feature works now
- **Dev-first philosophy:** Works without infrastructure
- **Clear migration path:** Easy to switch to Prisma later
- **Minimal risk:** No unnecessary refactoring or complexity










