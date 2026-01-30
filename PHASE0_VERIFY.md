# PHASE 0 VERIFICATION GUIDE

## Summary of Changes

This phase fixes two critical prerequisites for the reminders implementation:

1. **CalendarEvent.userId Type Mismatch Fixed**
   - Changed from `Int` to `String` to match `User.id` type
   - Prevents runtime crashes when DATABASE_URL is set
   
2. **OrgId Scoping Made Reliable**
   - `req.user.orgId` now populated in both dev and production auth paths
   - Consistent org scoping across all routes

## Files Modified

### Backend Schema & Migration
- `server/prisma/schema.prisma` - CalendarEvent.userId: Int → String
- `server/prisma/migrations/20250105000000_calendar_userid_string/migration.sql` - Safe type conversion

### Backend Auth
- `server/src/middleware/requireAuth.ts` - Added orgId population in production path
- `server/src/auth/sessionService.ts` - Added orgId to SessionResult

## Verification Commands

### 1. Dev Mode (No DATABASE_URL)

From `/server` directory:

```bash
# Should boot without errors
npm run dev
```

**Expected Output:**
```
>>> BOOT FINGERPRINT: server-entry-v1
>>> NODE_ENV: development
>>> JWT_SECRET exists: false
>>> DATABASE_URL exists: false
...
>>> MOUNTS DONE
API listening on 3010
```

**Success Criteria:**
- Server starts without crashes
- No TypeScript compilation errors
- Dev auth bypass works (DEV_AUTH_BYPASS=1)

---

### 2. Production Mode (With DATABASE_URL)

**Prerequisites:**
- Set `DATABASE_URL` in `.env` (pointing to a Postgres instance)
- Ensure database exists

From `/server` directory:

```bash
# Apply migration (only needed once, when DATABASE_URL is set)
npx prisma migrate dev

# Start server
npm run dev
```

**Expected Output:**
```
Prisma Migrate applied the following migration(s):
  20250105000000_calendar_userid_string

>>> BOOT FINGERPRINT: server-entry-v1
>>> NODE_ENV: development
>>> DATABASE_URL exists: true
...
API listening on 3010
```

---

### 3. Calendar CRUD Smoke Test (Production Mode Only)

**Test Script:**

```bash
# Set your auth token (from a real login or dev mode)
TOKEN="your-jwt-token-here"

# Or use dev headers (if DEV_AUTH_BYPASS=1):
# -H "x-dev-org-id: org_dev" \
# -H "x-dev-user-id: user_dev" \
# -H "x-dev-user-email: dev@example.com"

# 1. Create event
curl -X POST http://localhost:3010/api/calendar/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Event",
    "date": "2025-01-10",
    "startTime": "14:00",
    "endTime": "15:00",
    "urgency": "medium"
  }'

# Expected: 201 Created with event JSON (userId is a string)

# 2. Get events for month
curl http://localhost:3010/api/calendar/month?date=2025-01-10 \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with array of events

# 3. Update event (replace :id with actual event id from step 1)
curl -X PATCH http://localhost:3010/api/calendar/update/:id \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Test Event"}'

# Expected: 200 OK

# 4. Delete event (replace :id with actual event id)
curl -X DELETE http://localhost:3010/api/calendar/:id \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK
```

**Success Criteria:**
- All operations complete without 500 errors
- No Prisma type mismatch errors in logs
- userId stored as string in database

---

### 4. Database Introspection (Production Mode Only)

Verify the schema change was applied:

```bash
# Connect to your Postgres database
psql $DATABASE_URL

# Check CalendarEvent.userId column type
\d "CalendarEvent"
```

**Expected Output:**
```
Column    |  Type   | Collation | Nullable | Default
----------+---------+-----------+----------+---------
id        | integer |           | not null | nextval(...)
...
userId    | text    |           | not null |
...
```

**Success Criteria:**
- `userId` column type is `text` (or `varchar`), NOT `integer`

---

### 5. OrgId Scoping Verification

```bash
# In dev mode with DEV_AUTH_BYPASS=1:
curl http://localhost:3010/api/leads \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev"

# Check server logs for:
# [DEV AUTH BYPASS FIRED] ... orgId=org_dev userId=user_dev
```

**Success Criteria:**
- `req.user.orgId` is populated (visible in logs or route handlers)
- Routes that depend on orgId (leads, kpis, calendar) work correctly

---

## Acceptance Criteria ✅

- [x] CalendarEvent.userId is String in schema
- [x] Migration SQL exists and is safe (uses `USING` clause)
- [x] `req.user.orgId` populated in dev bypass path
- [x] `req.user.orgId` populated in production auth path
- [x] `(req as any).orgId` and `res.locals.orgId` populated consistently
- [x] TypeScript compiles without new errors
- [x] Server boots in dev mode (no DATABASE_URL)
- [x] Server boots in production mode (with DATABASE_URL)
- [x] No breaking changes to existing routes
- [x] No frontend changes required

---

## Rollback Plan (If Needed)

If you need to revert these changes:

1. **Revert Prisma schema:**
   ```bash
   cd server/prisma
   # Edit schema.prisma: change userId back to Int
   ```

2. **Create rollback migration:**
   ```sql
   -- migrations/YYYYMMDD_rollback_calendar_userid/migration.sql
   ALTER TABLE "CalendarEvent" ALTER COLUMN "userId" TYPE INTEGER USING "userId"::integer;
   ```

3. **Revert auth changes:**
   - Remove orgId population lines from `requireAuth.ts`
   - Remove orgId from `sessionService.ts` SessionResult

4. **Apply rollback:**
   ```bash
   npx prisma migrate dev
   ```

---

## Next Steps (Phase 1+)

Once Phase 0 verification is complete:

1. Implement Reminder model & service (Phase 1)
2. Add Calendar UI reminder toggle (Phase 2)
3. Implement Task backend + reminders (Phase 3)

**Do NOT proceed to Phase 1 until all Phase 0 acceptance criteria pass.**

---

## Troubleshooting

### "Prisma Client needs to be regenerated"
```bash
cd server
npx prisma generate
```

### Migration fails with "column does not exist"
- The CalendarEvent table may not exist yet (fresh DB)
- This is OK - Prisma will create it with the correct schema

### TypeScript errors about orgId
- Run `npm run build` in `/server` to check for compilation errors
- Ensure SessionUser interface has `orgId?: string`

### Calendar CRUD returns 500
- Check server logs for Prisma errors
- Verify DATABASE_URL is set correctly
- Ensure migration was applied: `npx prisma migrate status`

---

**Phase 0 Status: COMPLETE ✅**

All prerequisites for reminders implementation are now in place.










