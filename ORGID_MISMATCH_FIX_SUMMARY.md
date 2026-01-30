# orgId Mismatch Fix - Implementation Summary

## Changes Applied

### 1. `server/src/auth/sessionService.ts`
**Line 13:** Added optional `orgId` field to `SessionUser` interface

```typescript
export interface SessionUser {
  id: string;
  orgId?: string;  // ← ADDED (optional for backwards compatibility)
  firebase_uid: string;
  email: string;
  plan: string;
  status: string;
  onboarding_complete: boolean;
}
```

---

### 2. `server/src/middleware/requireAuth.ts`
**Line 89:** Populated `orgId` on `req.user` object in dev bypass mode

```typescript
req.user = {
  id: userId,
  orgId: orgId,  // ← ADDED (now populated from header or default)
  firebase_uid: "firebase_dev",
  email: email,
  plan: "gold",
  session_version: 1,
};
```

---

### 3. `server/src/routes/leads.dev.ts`
**Updated orgId derivation in ALL route handlers to use consistent priority chain:**

```typescript
const orgId = (req as any).orgId || req.user.orgId || req.user.id;
```

**Changed in:**
- Line 20: `GET /` (list leads)
- Line 71: `POST /` (create lead)
- Line 106: `GET /summary`
- Line 127: `PATCH /:id`
- Line 196: `DELETE /:id`

**Previous (inconsistent):**
```typescript
const orgId = req.user.orgId || req.user.id;
```

---

### 4. `server/src/routes/kpis.ts`
**No changes required** - Already using correct derivation:
```typescript
const orgId = (req as any).orgId || req.user.orgId || req.user.id;
```

---

## What This Fixes

### Before (Broken)
1. **Lead creation** stored leads under `orgId = "user_dev"` (from `req.user.id`)
2. **KPI endpoint** queried leads under `orgId = "org_dev"` (from `(req as any).orgId`)
3. **Result:** Empty array `[]` - leads stored in wrong bucket

### After (Fixed)
1. **Lead creation** stores under `orgId = "org_dev"` (from `req.user.orgId`)
2. **KPI endpoint** queries under `orgId = "org_dev"` (from `req.user.orgId`)
3. **Result:** Correct data returned - both use same bucket

---

## Verification

### Test 1: Create lead with source
```bash
curl -X POST http://localhost:3010/api/leads \
  -H "Authorization: Bearer dev-jwt-token-123" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "single_family",
    "address": "999 Test St",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "source": "cold_call"
  }'
```

**Expected:** Lead created with `orgId: "org_dev"`

### Test 2: Query lead sources
```bash
curl http://localhost:3010/api/kpis/lead-sources \
  -H "Authorization: Bearer dev-jwt-token-123"
```

**Expected:** 
```json
[
  { "source": "cold_call", "count": 1 }
]
```

### Test 3: Verify with dev headers
```bash
curl -X POST http://localhost:3010/api/leads \
  -H "x-dev-org-id: org_custom" \
  -H "x-dev-user-id: user_dev" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "888 Custom St",
    "city": "Dallas",
    "state": "TX",
    "zip": "75201",
    "source": "sms"
  }'

curl http://localhost:3010/api/kpis/lead-sources \
  -H "x-dev-org-id: org_custom" \
  -H "x-dev-user-id: user_dev"
```

**Expected:** Returns SMS lead (both use `org_custom`)

---

## Key Design Decisions

1. **Made `orgId` optional on `SessionUser`** - Preserves backwards compatibility with production auth flows that may not set it yet

2. **Used consistent priority chain** - `(req as any).orgId || req.user.orgId || req.user.id` ensures deterministic resolution across all routes

3. **Kept `(req as any).orgId` assignment** - Maintained for backwards compatibility with any code that might rely on it

4. **No frontend changes** - Fix is entirely backend, frontend continues to work as-is

5. **No production impact** - Changes only affect dev bypass mode where `DEV_AUTH_BYPASS=1`

---

## Linter Status
✅ **No errors** - All TypeScript compiles cleanly

---

## Files Modified
- `server/src/auth/sessionService.ts` (1 line added)
- `server/src/middleware/requireAuth.ts` (1 line added)
- `server/src/routes/leads.dev.ts` (5 lines changed)
- `server/src/routes/kpis.ts` (no changes - already correct)

**Total:** 7 lines changed across 3 files










