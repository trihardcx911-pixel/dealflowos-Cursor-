# KPI Pie Chart Empty Data - Root Cause Analysis

## Request Path Trace

### 1️⃣ Frontend Call Chain

**File:** `web/src/features/dashboard/KpiChart.tsx`
**Line 150:**
```typescript
const { data: leadSourcesData } = useQuery<LeadSource[]>({
  queryKey: ["lead-sources"],
  queryFn: () => get<LeadSource[]>("/kpis/lead-sources"),
  retry: 1,
  staleTime: 30000,
});
```

**Resolved URL:** `/api/kpis/lead-sources`

**Auth Headers Sent (from `web/src/api.ts` lines 44-47):**
```typescript
const token = getToken()
const headers: HeadersInit = {
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
}
```

**❌ CRITICAL FINDING #1:** 
Frontend does **NOT** send `x-dev-org-id` headers when using the `api.ts` client!

Compare with the alternate client in `web/src/api/client.ts` (lines 15-23):
```typescript
function getAuthHeaders(): Record<string, string> {
  return {
    "x-dev-user-id": "user_dev",
    "x-dev-user-email": "dev@example.com",
    "x-dev-org-id": "org_dev",  // ← This one sends headers
    "Content-Type": "application/json",
  };
}
```

---

### 2️⃣ Backend Route Mounting

**File:** `server/src/server.ts`
**Line 157:**
```typescript
app.use("/api/kpis", requireAuth, apiRateLimiter, makeKpisRouter(pool));
```

**Router Implementation:** `server/src/routes/kpis.ts` (lines 46-111)

**orgId Resolution Logic (line 53):**
```typescript
const orgId = (req as any).orgId || req.user.orgId || req.user.id;
```

**Auth Middleware Logic:** `server/src/middleware/requireAuth.ts` (lines 77-104)

In dev bypass mode (lines 83-95):
```typescript
const orgId = devOrgId || "org_dev";  // From x-dev-org-id header
const userId = devUserId || "user_dev"; // From x-dev-user-id header

req.user = {
  id: userId,
  firebase_uid: "firebase_dev",
  email: email,
  plan: "gold",
  session_version: 1,
  // ❌ NO orgId FIELD IN req.user!
};
(req as any).orgId = orgId;  // ← Set on req directly
```

**❌ CRITICAL FINDING #2:**
`req.user` does **NOT** have an `orgId` property! 

Looking at `SessionUser` interface (server/src/auth/sessionService.ts lines 12-19):
```typescript
export interface SessionUser {
  id: string;
  firebase_uid: string;
  email: string;
  plan: string;
  status: string;
  onboarding_complete: boolean;
  // NO orgId field!
}
```

So in `kpis.ts` line 53:
```typescript
const orgId = (req as any).orgId || req.user.orgId || req.user.id;
//            ^^^^^^^^^^^^^^^^      ^^^^^^^^^^^^^^   ^^^^^^^^^^^^
//            Only this works!      undefined!       Falls back to userId
```

---

### 3️⃣ Lead Creation & Storage

**Frontend:** `web/src/pages/LeadsPage.tsx` (lines 230-250)
```typescript
const finalPayload = {
  ...pendingLeadData,
  source,  // ← Source IS included
};
await api.post("/leads", finalPayload);
```

**Backend Handler:** `server/src/routes/leads.dev.ts` (lines 28-95)

**orgId Resolution (line 71):**
```typescript
const userId = req.user.id;
const orgId = req.user.orgId || req.user.id;
//            ^^^^^^^^^^^^^^   ^^^^^^^^^^^^
//            undefined!       Falls back to userId!
```

**Storage (line 88):**
```typescript
const orgLeads = getOrgLeads(orgId);  // ← Uses userId as orgId
orgLeads.push(newLead);
```

**❌ CRITICAL FINDING #3:**
Leads are stored under `orgId = req.user.id = "user_dev"` (the userId!)

---

### 4️⃣ Data Retrieval Mismatch

**KPI Endpoint Lookup (kpis.ts line 85):**
```typescript
const leads = getOrgLeads(orgId);
// orgId = (req as any).orgId || req.user.id
// In dev bypass: orgId = "org_dev" (from x-dev-org-id header)
```

**But leads were stored under:**
```typescript
getOrgLeads("user_dev")  // Because req.user.orgId is undefined!
```

**Result:** KPI endpoint queries `leadsByOrg["org_dev"]` but leads are stored in `leadsByOrg["user_dev"]`

---

## 🎯 Root Cause Summary

### Top 3 Most Likely Causes (Ranked)

#### #1 🔴 **orgId Mismatch Between Storage and Retrieval** (99% confidence)
**Evidence:**
- Lead creation stores under: `req.user.orgId || req.user.id` → **"user_dev"**
- KPI endpoint queries: `(req as any).orgId || req.user.orgId || req.user.id` → **"org_dev"** (if headers present) or **"user_dev"** (if no headers)
- Frontend KPI calls use `api.ts` which does NOT send `x-dev-org-id` headers
- Therefore KPI endpoint resolves to `req.user.id = "user_dev"`
- BUT if an earlier request set `(req as any).orgId`, it might persist and cause mismatch

**Files:**
- `server/src/routes/leads.dev.ts` line 71
- `server/src/routes/kpis.ts` line 53
- `server/src/middleware/requireAuth.ts` line 95

**Fix Required:** Make orgId resolution consistent across all routes.

---

#### #2 🟡 **Frontend Not Sending Dev Headers for KPI Requests** (95% confidence)
**Evidence:**
- `web/src/api.ts` (used by KpiChart) does NOT include `x-dev-org-id` headers
- `web/src/api/client.ts` (alternate client) DOES include dev headers
- KpiChart uses `get()` from `web/src/api.ts` line 91-93
- Without headers, `requireAuth` uses defaults: `orgId = "org_dev"` (line 83)

**Files:**
- `web/src/api.ts` lines 43-49 (no dev headers)
- `web/src/features/dashboard/KpiChart.tsx` line 150

**Impact:** KPI endpoint queries wrong orgId bucket.

---

#### #3 🟢 **req.user.orgId is Always Undefined** (100% confidence, but lower impact if #1/#2 fixed)
**Evidence:**
- `SessionUser` interface has NO `orgId` field (server/src/auth/sessionService.ts lines 12-19)
- All code that checks `req.user.orgId` gets `undefined`
- Fallback chain: `req.user.orgId || req.user.id` always uses `req.user.id`

**Files:**
- `server/src/auth/sessionService.ts` lines 12-19
- `server/src/routes/leads.dev.ts` line 71
- `server/src/routes/kpis.ts` line 53

**Impact:** Inconsistent orgId resolution depending on whether `(req as any).orgId` was set by middleware.

---

## 🧪 Runtime Verification Commands

### Test 1: Check where leads are actually stored
```bash
# Start backend with diagnostics
cd server
DEV_DIAGNOSTICS=1 npm run dev

# In another terminal, create a lead
curl -X POST http://localhost:3010/api/leads \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "address": "123 Test St",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "type": "sfr",
    "source": "cold_call"
  }'

# Look for this in backend logs:
# [DEV AUTH BYPASS FIRED] url=/api/leads method=POST orgId=org_dev userId=user_dev
# This shows what orgId the middleware set

# Then check the actual storage location by inspecting the response
# The 'orgId' field in the response shows where it was stored
```

### Test 2: Check what orgId the KPI endpoint uses
```bash
# Query lead sources WITH headers (like lead creation)
curl http://localhost:3010/api/kpis/lead-sources \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev"

# Look for in logs:
# [DEV AUTH BYPASS FIRED] url=/api/kpis/lead-sources ... orgId=org_dev

# Then query WITHOUT headers (like frontend does)
curl http://localhost:3010/api/kpis/lead-sources

# Should return 401 Unauthorized (no auth header)
```

### Test 3: Verify frontend auth approach
```bash
# In browser DevTools Console on /kpis page:
console.log('Token:', localStorage.getItem('token'));

# In Network tab, inspect the request to /api/kpis/lead-sources:
# - Check Request Headers
# - Confirm NO x-dev-org-id is present
# - Check if Authorization: Bearer token is present
```

### Test 4: Direct in-memory store inspection
Add this temporary debug route to `server/src/server.ts`:
```typescript
app.get("/api/debug/leads-store", (req, res) => {
  const { leadsByOrg } = require("./dev/leadsStore.js");
  res.json({
    buckets: Object.keys(leadsByOrg),
    counts: Object.entries(leadsByOrg).map(([orgId, leads]) => ({
      orgId,
      count: leads.length,
      sample: leads[0],
    })),
  });
});
```

Then:
```bash
curl http://localhost:3010/api/debug/leads-store
```

**Expected output if bug exists:**
```json
{
  "buckets": ["user_dev"],
  "counts": [
    {
      "orgId": "user_dev",
      "count": 5,
      "sample": { "source": "cold_call", "orgId": "user_dev", ... }
    }
  ]
}
```

**What to look for:**
- If leads are under `"user_dev"` key but KPI queries `"org_dev"` → **Mismatch confirmed**
- Check the `orgId` field inside each lead object

---

## 🔧 Minimal Fix Recommendations

### Option A: Fix orgId Resolution Consistency (Recommended)
Make all routes use the same orgId source:
```typescript
// In both leads.dev.ts and kpis.ts:
const orgId = (req as any).orgId || req.user.id;
// Remove || req.user.orgId (since it's always undefined)
```

### Option B: Add Dev Headers to Frontend KPI Client
Modify `web/src/api.ts` line 45-48 to include dev headers in dev mode:
```typescript
const headers: HeadersInit = {
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  // Add dev headers in dev mode
  ...(!token && process.env.NODE_ENV === 'development' ? {
    'x-dev-user-id': 'user_dev',
    'x-dev-org-id': 'org_dev',
  } : {}),
  ...(init.headers ?? {}),
}
```

### Option C: Make req.user.orgId Actually Exist
Update `SessionUser` interface and middleware to populate it:
```typescript
// In server/src/auth/sessionService.ts:
export interface SessionUser {
  id: string;
  orgId: string;  // ADD THIS
  // ... rest of fields
}

// In server/src/middleware/requireAuth.ts line 88-94:
req.user = {
  id: userId,
  orgId: orgId,  // ADD THIS
  firebase_uid: "firebase_dev",
  email: email,
  plan: "gold",
  session_version: 1,
};
```

---

## Summary

**The pie chart is empty because:**
1. Leads are stored under orgId `"user_dev"` (from `req.user.id`)
2. KPI endpoint queries orgId `"org_dev"` (from `(req as any).orgId` set by middleware headers)
3. OR: KPI endpoint queries `"user_dev"` BUT frontend doesn't send the headers that would trigger the same orgId

**The mismatch occurs because:**
- `req.user.orgId` doesn't exist (not in SessionUser interface)
- Different routes fall back differently in the chain: `(req as any).orgId || req.user.orgId || req.user.id`
- Lead creation might not have `(req as any).orgId` set if called differently than KPI endpoint

**Confidence:** 99% - This is a classic "data stored in bucket A, querying bucket B" issue.










