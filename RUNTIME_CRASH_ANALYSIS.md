# Runtime Crash Analysis - Leads Import 404 Root Cause

## 1. Entry Point Confirmation

**File path:** `server/src/server.ts`

**Script name:** `dev`

**Exact command executed:** `tsx watch src/server.ts`

**Confirmation:** `package.json` line 5 shows `"dev": "tsx watch src/server.ts"`. The `tsx watch` process monitors `src/server.ts` for changes and re-executes it on file modifications.

---

## 2. Crash Source & Export Mismatch

**File throwing error:** `server/src/routes/kpis.dev.ts`

**Import line causing error:** Line 6: `import { leads } from "./leads.dev.js";`

**Exports from leads.dev.ts:**
- `export const leadsDevRouter` (line 7)
- `export let leadsByUser: Record<string, any[]>` (line 12)
- **NO export named `leads`**

**Expected by kpis.dev.ts:**
- `import { leads } from "./leads.dev.js"` (line 6)
- Used in `buildLeadTimeseries()` (line 16) and `calculateKpis()` (line 31)

**Exact mismatch identified:**
- `kpis.dev.ts` expects a `leads` array export
- `leads.dev.ts` exports `leadsByUser` (a Record keyed by userId) and `leadsDevRouter`
- The export `leads` does not exist, causing `SyntaxError: The requested module './leads.dev.js' does not provide an export named 'leads'`

---

## 3. Boot Sequence Analysis

**Why failure blocks everything:**

The crash occurs during **module import time**, before Express app initialization completes:

1. `server.ts` line 25: `import { kpisDevRouter } from "./routes/kpis.dev.js"` executes
2. `kpis.dev.ts` line 6: `import { leads } from "./leads.dev.js"` executes
3. **CRASH:** Module resolution fails with SyntaxError
4. Node.js terminates the process before reaching:
   - Express app creation (line 38)
   - Route mounting (lines 72, 77, 85, etc.)
   - `app.listen()` (line 167)

**Does the server reach app.listen?**
- **NO** - The process crashes during import phase, before any Express code executes

**Evidence:**
- Import statements execute top-to-bottom before any runtime code
- The error occurs at import time, not request time
- No logs from `app.listen()` callback would appear
- No `[SERVER]` debug middleware logs would appear (middleware never registered)

**Does Express reach app.use("/api/leads-import", ...)?**
- **NO** - Line 77 is never executed because the process crashes at line 25 (import statement)

---

## 4. Option A Safety Assessment

**If we comment out:** `app.use("/api/kpis", requireAuth, apiRateLimiter, makeKpisRouter(pool));`

**Route functionality table:**

| Route Group | Mount Path | Still Functions? | Reason |
|-------------|------------|-------------------|--------|
| Auth | `/api/auth` | ✅ YES | No dependency on kpis.dev.ts |
| Admin Security | `/api/admin/security` | ✅ YES | No dependency on kpis.dev.ts |
| Leads CRUD (dev) | `/api/leads` | ✅ YES | Uses `leadsDevRouter`, independent of kpis |
| **Leads Import** | `/api/leads-import` | ✅ YES | Uses `leadsImportRouter`, independent of kpis |
| Calendar | `/api/calendar` | ✅ YES | No dependency on kpis.dev.ts |
| Billing | `/api/billing` | ✅ YES | No dependency on kpis.dev.ts |
| Debug | `/api/debug/db-schema` | ✅ YES | No dependency on kpis.dev.ts |
| KPI Routes | `/api/kpis` | ❌ NO | Disabled by Option A |

**Additional considerations:**
- `kpisDevRouter` is imported at line 25 but **never mounted** (line 25 comment says "KEEP import for now (not used)")
- The real KPI router is `makeKpisRouter(pool)` mounted at line 85
- Commenting out line 85 would disable KPI routes but allow server to boot
- **However:** The import at line 25 still executes and still crashes

**Critical finding:** Option A (commenting out the mount) is **INSUFFICIENT** because:
- The crash occurs at **import time** (line 25), not mount time (line 85)
- Even if line 85 is commented, line 25 still executes and crashes
- **Both** the import (line 25) and mount (line 85) must be removed/disabled

---

## 5. Prisma Dependency Map

**Route → Persistence mapping:**

| Route | File | Persistence | Prisma Usage |
|-------|------|-------------|--------------|
| `/api/leads` (CRUD) | `leads.dev.ts` | **In-memory** (`leadsByUser`) | ❌ NO |
| `/api/leads-import` (preview) | `leads.import.ts` line 39 | **File parsing only** | ❌ NO |
| `/api/leads-import/commit` | `leads.import.ts` line 278 | **Prisma** (`prisma.lead`) | ✅ YES |
| `/api/kpis` | `kpis.ts` (real) | **In-memory mock** | ❌ NO |
| `/api/kpis` (dev) | `kpis.dev.ts` | **In-memory** (broken import) | ❌ NO |
| `/api/calendar` | `calendar.ts` | **Prisma** (`prisma.calendarEvent`) | ✅ YES |
| `/api/auth` | `auth.ts` | **Prisma** (likely) | ✅ YES (assumed) |
| `/api/billing` | `billing.ts` | **External (Stripe)** | ❌ NO Prisma |

**Key findings:**
- `/api/leads-import` **preview endpoint** (POST `/`) does NOT use Prisma - only file parsing
- `/api/leads-import/commit` **commit endpoint** (POST `/commit`) DOES use Prisma for:
  - Fetching existing `addressHashes` (line 304)
  - Batch insert via `prisma.lead.createMany` (line 448)
  - Fallback individual inserts (line 457)

**Whether disabling KPI routes avoids Prisma initialization:**
- **NO** - Prisma is initialized when `leads.import.ts` is imported (line 8: `import { prisma } from "../db/prisma.js"`)
- Prisma client initialization happens at module load time, not request time
- Even if KPI routes are disabled, Prisma still initializes because `leadsImportRouter` import (line 23) triggers Prisma import

---

## 6. Final Diagnosis

**Single blocking root cause:**

The server crashes during **module import phase** due to an **export mismatch** between `kpis.dev.ts` and `leads.dev.ts`. Specifically:

- `kpis.dev.ts` line 6 attempts to import `{ leads }` from `leads.dev.js`
- `leads.dev.ts` does not export `leads` (only exports `leadsDevRouter` and `leadsByUser`)
- This causes a `SyntaxError` at import time (line 25 of `server.ts`)
- The process terminates before Express app initialization, route mounting, or `app.listen()` executes
- Therefore, `/api/leads-import` never becomes available because the server never starts

**Root cause classification:**

This is an **export mismatch** issue, not an entry file mismatch or hybrid persistence boot failure. The entry point (`src/server.ts`) is correct, but a broken import dependency prevents the module from loading.

**Option A safety assessment:**

Option A (commenting out the KPI router mount) is **INSUFFICIENT** as a temporary unblock because:

1. The crash occurs at **import time** (line 25), not mount time (line 85)
2. Commenting out the mount does not prevent the import from executing
3. **Both** the import statement (line 25) and the mount (line 85) must be removed/disabled

**Recommended fix approach:**

To unblock `/api/leads-import`, either:
- **Option A+:** Remove/comment BOTH line 25 (import) and line 85 (mount) for `kpisDevRouter`
- **Option B:** Fix the export mismatch by either:
  - Exporting `leads` from `leads.dev.ts` (create a flattened array from `leadsByUser`)
  - OR updating `kpis.dev.ts` to use `leadsByUser` instead of `leads`

**Prisma impact:**

Disabling KPI routes does NOT avoid Prisma initialization because `leads.import.ts` imports Prisma at line 8. However, Prisma initialization should succeed if `DATABASE_URL` is properly configured. The current crash prevents Prisma from even being tested because the process dies during the `kpis.dev.ts` import.










