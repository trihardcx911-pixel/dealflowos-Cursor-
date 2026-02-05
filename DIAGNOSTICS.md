# Diagnostics for "Auth subsystem unavailable" Error

## What Was Added

### 1. Enhanced Logging in `server/src/middleware/requireAuth.ts`

Added diagnostic logging at three critical points where database errors can cause "Auth subsystem unavailable" (503):

#### Location 1: Session Cookie DB Error (Line ~349)
```javascript
console.error("[AUTH] Session cookie verification/DB failed:", {
  error: err?.message?.substring(0, 200),
  code: err?.code,
  pgCode: pgCode(err),
  isFirebaseError: err?.errorInfo?.code || err?.code?.startsWith?.('auth/'),
  isDbError: err?.code && !err?.code?.startsWith?.('auth/'),
  path: req.path,
});
```

#### Location 2: JWT Revocation Check Error (Line ~524)
```javascript
console.error('[AUTH] Revocation check DB error:', {
  code: error?.code,
  message: error?.message?.substring(0, 200),
  pgCode: pgCode(error),
  isUndefinedTable: pgCode(error) === "42P01",
  isUndefinedColumn: pgCode(error) === "42703",
  path: req.path,
  userId: userId?.substring(0, 8) + '...',
});
```

#### Location 3: User Access Check Error (Line ~567)
```javascript
console.error('[AUTH] User access check DB error:', {
  code: error?.code,
  message: error?.message?.substring(0, 200),
  pgCode: pgErrCode,
  isUndefinedTable: pgErrCode === "42P01",
  isUndefinedColumn: pgErrCode === "42703",
  isSchemaError,
  path: req.path,
  userId: userId?.substring(0, 8) + '...',
  query: 'SELECT status, plan, "trialEnd", ... FROM "User" WHERE id = $1',
});
```

### 2. Database Schema Verification Script

Created `server/verify-db-schema.js` - a standalone script that:
- Tests database connection
- Lists all existing tables
- Checks for required tables (User, Lead, Deal, Task)
- Verifies User table columns match Prisma schema
- Reports missing columns, type mismatches, or connection issues

## How to Use

### Check Production Database Schema

**On Render (or any production environment):**

1. SSH/shell into your server or run locally with production DATABASE_URL:
   ```bash
   cd server
   DATABASE_URL=<production-database-url> npm run verify:schema
   ```

2. Review the output:
   - ✅ Green checks = OK
   - ❌ Red X = Critical issue (missing table/column)
   - ⚠️ Yellow warning = Minor issue (type mismatch, optional table missing)

**Example output if User table is missing:**
```
❌ User - MISSING

❌ SCHEMA VERIFICATION FAILED

Issues found. To fix:
  1. Run migrations: cd server && npx prisma migrate deploy
  2. Or generate and push: cd server && npx prisma db push
  3. Verify DATABASE_URL points to correct database
```

**Example output if connection fails:**
```
❌ ERROR during schema verification:

Message: connect ECONNREFUSED 127.0.0.1:5432
Code: ECONNREFUSED

Database connection refused. Check:
  1. DATABASE_URL host and port are correct
  2. Database server is running
  3. Firewall/network allows connection
```

### View Diagnostic Logs in Production

**After deploying the updated code to Render:**

1. Go to Render dashboard → Your service → Logs
2. Trigger the error (visit onboarding/plan page and click "Continue to checkout")
3. Look for diagnostic log entries:

```
[AUTH] User access check DB error: {
  code: '28P01',
  message: 'password authentication failed for user "postgres"',
  pgCode: '28P01',
  isUndefinedTable: false,
  isUndefinedColumn: false,
  isSchemaError: false,
  path: '/api/billing/create-checkout-session',
  userId: 'user_abc...'
}
```

### Common Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| `ECONNREFUSED` | Can't connect to database | Check DATABASE_URL host/port, database is running |
| `28P01` | Auth failed (wrong password) | Check DATABASE_URL credentials |
| `3D000` | Database doesn't exist | Check DATABASE_URL database name, create database |
| `42P01` | Table doesn't exist | Run `prisma migrate deploy` or `prisma db push` |
| `42703` | Column doesn't exist | Run `prisma migrate deploy` or `prisma db push` |
| `53300` | Too many connections | Increase connection pool limit or close unused connections |

## Quick Diagnosis Checklist

If you see "Auth subsystem unavailable" in production:

1. **Check Render environment variables:**
   ```
   ✓ DATABASE_URL is set (use Internal Database URL from Render Postgres)
   ✓ NODE_ENV=production
   ✓ JWT_SECRET is set (≥32 characters)
   ✓ FRONTEND_URL matches your domain (e.g., https://dealflowos.net)
   ```

2. **Run schema verification:**
   ```bash
   cd server
   DATABASE_URL=<from-render> npm run verify:schema
   ```

3. **Check Render logs for diagnostic output:**
   - Look for `[AUTH] ... DB error:` entries
   - Note the `code` and `message` fields
   - Use the error codes table above to identify the issue

4. **Fix based on error:**
   - **Missing tables/columns** → Run migrations in Render shell:
     ```bash
     cd server && npx prisma migrate deploy
     ```
   - **Connection refused** → Check DATABASE_URL, verify Render Postgres is running
   - **Auth failed** → Verify DATABASE_URL username/password
   - **Wrong database** → Check DATABASE_URL database name

## Removing Diagnostics Later

Once the issue is resolved, you can remove the diagnostic logging from `requireAuth.ts`:

1. Search for `// DIAGNOSTIC:` comments
2. Remove the `console.error(...)` blocks (keep the actual error handling logic)
3. The schema verification script (`verify-db-schema.js`) can stay - it's useful for future debugging

## Files Modified

1. `server/src/middleware/requireAuth.ts` - Added 3 diagnostic log statements
2. `server/verify-db-schema.js` - Created new schema verification script
3. `server/package.json` - Added `verify:schema` npm script
4. `DIAGNOSTICS.md` - This file (can be deleted after debugging)
