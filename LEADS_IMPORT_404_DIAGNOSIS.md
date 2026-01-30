# Leads Import 404 Error - Diagnosis Report

## A) Server Listening Configuration

**Backend PORT:** 3010 (server.ts line 165-167)
- Server prints: `[api] listening on port ${PORT}` where PORT defaults to 3010

**Frontend Proxy Configuration:**
- Vite config (web/vite.config.ts lines 10-15) proxies `/api` → `http://localhost:3010`
- Frontend calls: `POST /api/leads/import` (LeadsPage.tsx line 246)
- This gets proxied to: `POST http://localhost:3010/api/leads/import`

**Expected Log Output:**
- Debug middleware (server.ts lines 55-58) should print: `[SERVER] POST /api/leads/import`
- If no log appears, request never reached backend (proxy/CORS/port issue)

---

## B) Mount Map (Source of Truth)

From `server/src/server.ts`, all mounts starting with `/api/leads`:

| Order | Mount Path | Router Variable | Middleware | Line |
|-------|------------|----------------|------------|------|
| 1 | `/api/leads` | `leadsDevRouter` | `requireAuth, apiRateLimiter` | 72 |
| 2 | `/api/leads/import` | `leadsImportRouter` | **NONE** | 77 |

**Critical Finding:** Mount order is `/api/leads` BEFORE `/api/leads/import`

---

## C) Router Internal Paths

### Import Router Endpoints → Final URLs

From `server/src/routes/leads.import.ts`:

| Method | Router Path | Mount Base | Final URL |
|--------|------------|------------|-----------|
| POST | `/` | `/api/leads/import` | `POST /api/leads/import` ✓ |
| POST | `/commit` | `/api/leads/import` | `POST /api/leads/import/commit` ✓ |

### Dev Leads Router Endpoints → Final URLs

From `server/src/routes/leads.dev.ts`:

| Method | Router Path | Mount Base | Final URL |
|--------|------------|------------|-----------|
| GET | `/` | `/api/leads` | `GET /api/leads` |
| POST | `/` | `/api/leads` | `POST /api/leads` |
| GET | `/summary` | `/api/leads` | `GET /api/leads/summary` |
| PATCH | `/:id` | `/api/leads` | `PATCH /api/leads/:id` |
| DELETE | `/:id` | `/api/leads` | `DELETE /api/leads/:id` |

**No `/import` route exists in leadsDevRouter** - it only has `/`, `/summary`, and `/:id`

---

## D) Collision / Shadowing Check

**Question:** Does any mount at `/api/leads` occur BEFORE `/api/leads/import`?
- **Answer: YES** - Line 72 mounts `/api/leads` before line 77 mounts `/api/leads/import`

**Question:** Does leadsDevRouter contain any route that could respond with 404 or intercept `/import`?
- **Answer: POTENTIALLY YES** - Express route matching behavior:
  - When `/api/leads` router is mounted first, Express may attempt to match `/api/leads/import` against `leadsDevRouter`
  - `leadsDevRouter` has `POST /` which matches `/api/leads` exactly
  - `leadsDevRouter` has `PATCH /:id` and `DELETE /:id` which use parameter matching
  - Express should prioritize more specific mounts (`/api/leads/import`) over less specific ones (`/api/leads`), BUT this depends on Express's internal route matching algorithm

**However:** Express typically matches more specific paths first when routers are mounted. The issue is likely NOT route shadowing.

**Alternative Explanation:** The `/api/leads/import` mount at line 77 has **NO middleware** (no `requireAuth`), but the `/api/leads` mount at line 72 has `requireAuth`. If the request is being intercepted by middleware or if there's an authentication issue, it could fail before reaching the import router.

---

## E) Runtime Verification

**Required Check:** What log line appears when attempting import from UI?

Expected log sequence:
1. `[SERVER] POST /api/leads/import` (from debug middleware, line 56)
2. If auth middleware runs: potential 401/403
3. If router matches: handler execution or 404

**If no log appears:**
- Request never reached backend
- Possible causes: wrong port, proxy misconfiguration, CORS blocking, frontend calling wrong URL

**If log appears but 404:**
- Router matching failed
- Possible causes: route shadowing, incorrect mount path, router not properly exported

---

## F) Concrete Root Cause List (Ranked by Likelihood)

### 1. **Route Shadowing / Mount Order Issue** (HIGH PROBABILITY)
- **Evidence:** `/api/leads` mounted before `/api/leads/import` (lines 72 vs 77)
- **Mechanism:** Express may attempt to match `/api/leads/import` against `leadsDevRouter` first
- **Fix Required:** Reorder mounts so `/api/leads/import` comes BEFORE `/api/leads`, OR ensure Express properly prioritizes more specific paths

### 2. **Missing Authentication Middleware** (MEDIUM PROBABILITY)
- **Evidence:** `/api/leads/import` mount has NO `requireAuth` (line 77), but `/api/leads` has it (line 72)
- **Mechanism:** If `requireAuth` middleware on line 72 somehow intercepts the request, it could return 401/403 before reaching the import router
- **Fix Required:** Add `requireAuth` to import router mount, OR ensure middleware doesn't block the request

### 3. **Router Export/Import Issue** (LOW PROBABILITY)
- **Evidence:** Import statement exists (line 23): `import { leadsImportRouter } from "./routes/leads.import.js";`
- **Mechanism:** If router is not properly exported or is undefined, mount would fail silently
- **Fix Required:** Verify router is properly exported from `leads.import.ts` (confirmed: line 10 exports it)

### 4. **Request Never Reaches Backend** (MEDIUM PROBABILITY)
- **Evidence:** Vite proxy configured correctly, frontend calls correct URL
- **Mechanism:** CORS, proxy misconfiguration, or wrong port
- **Fix Required:** Check server logs for `[SERVER] POST /api/leads/import` - if missing, request isn't reaching backend

### 5. **Multer Middleware Issue** (LOW PROBABILITY)
- **Evidence:** Import router uses `upload.single("file")` middleware (line 39)
- **Mechanism:** If multer fails to parse multipart/form-data, it could return 400/404
- **Fix Required:** Verify file upload format matches multer expectations

---

## Root Cause (Definitive)

**Most Likely:** Route shadowing due to mount order. Express may be attempting to match `/api/leads/import` against `leadsDevRouter` (mounted at `/api/leads`) before checking the more specific `/api/leads/import` mount. While Express should prioritize more specific paths, the mount order and lack of explicit route in `leadsDevRouter` for `/import` could cause Express to return 404.

**Secondary:** If the `[SERVER] POST /api/leads/import` log appears but still returns 404, the router matching is failing. If no log appears, the request is not reaching the backend (proxy/CORS issue).

**Recommended Fix:** Reorder mounts so `/api/leads/import` is mounted BEFORE `/api/leads`, ensuring Express matches the more specific path first.










