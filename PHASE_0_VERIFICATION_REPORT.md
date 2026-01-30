# PHASE 0 — Verification Report

## Step 1 — Vite Proxy Config (Read-Only)

### A) Vite Config File Location
**File:** `web/vite.config.ts`

### B) Proxy Configuration
```typescript
proxy: {
  "/api": {
    target: "http://127.0.0.1:3010",
    changeOrigin: true,
    secure: false,
  },
}
```

### C) Verification
✅ **Proxy is correctly configured:**
- Proxies `/api` requests to `http://127.0.0.1:3010`
- `changeOrigin: true` is set (required for proper proxying)
- Uses `127.0.0.1` instead of `localhost` (avoids IPv6 resolution issues)

**Status:** Proxy config is correct. No changes needed.

---

## Step 2 — Backend Connectivity Tests

### A) Backend Startup
**Note:** Backend must be started manually with:
```bash
cd server
DEV_DIAGNOSTICS=1 npm run dev
```

**Expected startup logs:**
- `[ENV] loadedFrom=...`
- `[BOOT] NODE_ENV = development`
- `>>> Starting server on port 3010...`
- `API listening on 3010`

### B) Direct Backend Calls (Bypass Vite)
**Commands to run:**
```bash
curl -i http://127.0.0.1:3010/api/health
curl -i http://127.0.0.1:3010/api/user/me
```

**Expected Results:**
- `/api/health` → `200 OK` with JSON: `{"ok":true,"pid":...,"port":3010,"ts":"..."}`
- `/api/user/me` → `401 Unauthorized` with JSON: `{"error":"Missing or invalid Authorization header"}`

**Status:** ⚠️ **Cannot verify (network blocked in sandbox)** - User must run these commands manually.

### C) Vite Proxy Calls
**Commands to run:**
```bash
curl -i http://127.0.0.1:5173/api/health
curl -i http://127.0.0.1:5173/api/user/me
```

**Expected Results:**
- Should match backend responses (200 for health, 401 for /me)
- If you get 404 or HTML, proxy is not working

**Status:** ⚠️ **Cannot verify (network blocked in sandbox)** - User must run these commands manually.

### D) Backend Console Logs
**When calling `/api/user/me` via proxy, backend should log:**
```
[AUTH DIAG] enter { path: '/api/user/me', method: 'GET' }
[AUTH DIAG] branch { hasBearer: false, devBypassEnabled: true }
```

**Status:** ⚠️ **Cannot verify (requires running backend)** - User must check console logs.

---

## Step 3 — DB Connectivity

### A) Backend Connection Logs
**Check backend startup logs for:**
- Database connection success messages
- Any connection errors

### B) Direct psql Test
**Command to run:**
```bash
cd server
set -a; source .env; set +a
echo "DATABASE_URL=${DATABASE_URL:0:30}...${DATABASE_URL: -10}"  # Redact creds
psql "$DATABASE_URL" -c "SELECT now();"
```

**Expected Result:**
- Should return current timestamp
- If fails, check DATABASE_URL format and credentials

**Status:** ⚠️ **Cannot verify (network/DB access blocked in sandbox)** - User must run manually.

---

## Step 4 — Auth Tables Verification

### Commands to Run:
```bash
cd server
set -a; source .env; set +a

# Check if tables exist
psql "$DATABASE_URL" -c "SELECT to_regclass('public.revoked_tokens') AS revoked_tokens, to_regclass('public.security_events') AS security_events;"

# Get table definitions
psql "$DATABASE_URL" -c "\d+ revoked_tokens" || echo "Table does not exist"
psql "$DATABASE_URL" -c "\d+ security_events" || echo "Table does not exist"
```

### Expected Results:

**revoked_tokens table:**
- Should exist if migration `phase6_account_safety.sql` was run
- Columns: `jti` (TEXT PRIMARY KEY), `user_id` (TEXT), `revoked_at` (TIMESTAMPTZ), `expires_at` (TIMESTAMPTZ), `reason` (TEXT)

**security_events table:**
- Should exist if migration `add_security_events.sql` was run
- Columns: `id` (BIGSERIAL PRIMARY KEY), `created_at` (TIMESTAMPTZ), `event_type` (TEXT), `user_id` (TEXT), `ip` (TEXT), `user_agent` (TEXT), `path` (TEXT), `method` (TEXT), `status_code` (INT), `reason` (TEXT), `meta` (JSONB)

**Status:** ⚠️ **Cannot verify (DB access blocked in sandbox)** - User must run manually.

---

## Step 5 — User Table Verification

### Commands to Run:
```bash
cd server
set -a; source .env; set +a

# Find user tables
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND lower(table_name) IN ('user','users') ORDER BY table_name;"

# Get all columns
psql "$DATABASE_URL" -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND lower(table_name) IN ('user','users') ORDER BY table_name, column_name;"

# If "User" exists, get its columns specifically
psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='User' ORDER BY column_name;" || true
```

### Required Columns Checklist:
- ✅ `id` - Primary key
- ✅ `email` - User email
- ✅ `status` - Account status (active/disabled)
- ✅ `plan` - Subscription plan (trial/bronze/silver/gold)
- ⚠️ `session_version` OR `sessionVersion` - Session versioning
- ⚠️ `trial_ends_at` OR `trialEnd` OR `trialEndsAt` - Trial expiration
- ⚠️ `lock_state` OR `lockState` - Account lock state
- ⚠️ `lock_expires_at` OR `lockExpiresAt` - Lock expiration
- ⚠️ `billingStatus` OR `billing_status` - Billing status
- ⚠️ `cancelAtPeriodEnd` OR `cancel_at_period_end` - Cancel flag
- ⚠️ `currentPeriodEnd` OR `current_period_end` - Period end date

**Status:** ⚠️ **Cannot verify (DB access blocked in sandbox)** - User must run manually.

---

## Step 6 — user_dev Existence Check

### Commands to Run:
```bash
cd server
set -a; source .env; set +a

# Try different table name casings
psql "$DATABASE_URL" -c "SELECT id, email, status, plan, session_version FROM \"User\" WHERE id='user_dev';" || echo "Query failed"
psql "$DATABASE_URL" -c "SELECT id, email, status, plan, session_version FROM \"user\" WHERE id='user_dev';" || echo "Query failed"
psql "$DATABASE_URL" -c "SELECT id, email, status, plan, session_version FROM users WHERE id='user_dev';" || echo "Query failed"
```

### Expected Result:
- Should return one row with `id='user_dev'`, `email='dev@example.com'` (or provided email), `status='active'`, `plan='gold'`, `session_version=1`

**Status:** ⚠️ **Cannot verify (DB access blocked in sandbox)** - User must run manually.

---

## Step 7 — Token Verification Test

### A) Get Fresh JWT
1. Perform dev login in browser: `POST /api/auth/login` with `{"email":"user@example.com"}`
2. Copy the `token` from response

### B) Decode Token Payload (No Secret Required)
**Command:**
```bash
TOKEN="PASTE_TOKEN_HERE"
node -e "const t='$TOKEN'; const p=JSON.parse(Buffer.from(t.split('.')[1],'base64').toString()); console.log(JSON.stringify(p, null, 2));"
```

**Expected Payload:**
```json
{
  "iss": "dealflowos",
  "sub": "user_dev",
  "userId": "user_dev",
  "firebaseUid": "firebase_dev",
  "email": "user@example.com",
  "plan": "gold",
  "jti": "...",
  "sv": 1,
  "iat": 1769032645,
  "exp": 1769637445
}
```

### C) Test Token with Backend
**Commands:**
```bash
# Direct backend
curl -i -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3010/api/user/me

# Via Vite proxy
curl -i -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5173/api/user/me
```

**Expected Results:**
- If token is valid and user exists: `200 OK` with user JSON
- If token is valid but user missing: `404 USER_NOT_FOUND`
- If token invalid/expired: `401` with error message
- If DB error: Should be `503` (after fix) or `401` (current bug)

**Backend DIAG Logs to Check:**
- `[AUTH DIAG] enter { path: '/api/user/me', method: 'GET' }`
- `[AUTH DIAG] branch { hasBearer: true, devBypassEnabled: true }`
- `[AUTH DIAG] 401 { step: '...', errorName: '...', errorMessage: '...', pg: '...' }` (if fails)

**Status:** ⚠️ **Cannot verify (network blocked in sandbox)** - User must run manually.

---

## Summary Report Template

**Fill in after running commands:**

1. **Proxy works?** 
   - ✅ Config is correct (verified from code)
   - ⚠️ Runtime verification needed (run curl commands)

2. **Backend reachable on 3010?**
   - ⚠️ **PENDING** - Run: `curl -i http://127.0.0.1:3010/api/health`

3. **DB connectivity ok?**
   - ⚠️ **PENDING** - Run: `psql "$DATABASE_URL" -c "SELECT now();"`

4. **revoked_tokens exists?**
   - ⚠️ **PENDING** - Run: `psql "$DATABASE_URL" -c "SELECT to_regclass('public.revoked_tokens');"`

5. **security_events exists?**
   - ⚠️ **PENDING** - Run: `psql "$DATABASE_URL" -c "SELECT to_regclass('public.security_events');"`

6. **Actual User table name is:**
   - ⚠️ **PENDING** - Run: `psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND lower(table_name) IN ('user','users');"`

7. **Missing required columns?**
   - ⚠️ **PENDING** - Compare actual columns vs required list above

8. **user_dev exists?**
   - ⚠️ **PENDING** - Run queries in Step 6

9. **With fresh token, which step fails?**
   - ⚠️ **PENDING** - Check backend DIAG logs when calling `/api/user/me` with token

---

## Next Steps

**User must manually run the verification commands** (network/DB access is blocked in sandbox):

1. Start backend: `cd server && DEV_DIAGNOSTICS=1 npm run dev`
2. Run all psql commands from Steps 3-6
3. Run curl commands from Steps 2 and 7
4. Fill in the Summary Report above
5. Share the results before proceeding with code changes

**Critical checks:**
- If `revoked_tokens` or `security_events` are missing → Run migrations
- If User table is `"user"` or `users` (not `"User"`) → Schema detection needed
- If `user_dev` doesn't exist → UPSERT needed in dev login
- If step fails at `user_access_check` → Likely schema mismatch issue







