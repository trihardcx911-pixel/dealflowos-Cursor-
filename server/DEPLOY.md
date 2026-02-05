# Quick Deploy Guide: Fix POST /api/auth/session 500

## Problem
Production 500 error: `column "firebase_uid" does not exist` on User table

## Solution
Minimal Prisma migration adding ONLY fields that `sessionService.ts` actually uses.

## Files Changed
```
server/prisma/schema.prisma                                      # Added auth fields to User model
server/prisma/migrations/20260205000000_add_auth_fields/         # New migration (idempotent)
server/package.json                                              # Added migrate:deploy script
server/Dockerfile                                                # Run migrations on startup
```

## Deploy Steps

### 1. Test Locally (Optional)
```bash
cd server

# Apply migration to local DB
npm run migrate:deploy

# Verify
export DATABASE_URL="postgresql://..."  # Your local DB
./scripts/verify-migration.sh

# Test server
npm run dev
```

### 2. Commit & Push
```bash
git add server/
git commit -m "fix(auth): add firebase_uid column to User table for session endpoint"
git push origin main
```

### 3. Render Auto-Deploys
- Render detects push to main
- Dockerfile runs: `npx prisma migrate deploy && node --loader tsx src/server.ts`
- Migration applies automatically
- Server starts

### 4. Verify Production
```bash
# Check Render logs for:
# "1 migration found in prisma/migrations"
# "[BOOT] NODE_ENV = production"

# Test endpoint (get Firebase token from frontend after login):
curl -X POST https://your-app.onrender.com/api/auth/session \
  -H "Authorization: Bearer FIREBASE_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Expected: 200 OK with user object
```

## What Changed

### Prisma Schema
Added to User model:
- `firebase_uid` (unique, indexed) ← **CRITICAL FIX**
- `email` (unique)
- Auth fields: `display_name`, `photo_url`, `plan`, `status`, `trial_started_at`, `trial_ends_at`, `onboarding_complete`
- Session: `session_version`, `lock_state`, `disabled_at`, `lock_reason`, `lock_expires_at`
- Timestamps: `createdAt`, `updatedAt`

Added SecurityEvent model:
- Maps to `security_events` table (telemetry)
- All columns that `securityEvents.ts` line 60 inserts

### Migration SQL
- Idempotent (all `IF NOT EXISTS`)
- No data loss (only adds columns)
- Fast (<2 seconds)

### Dockerfile
```diff
- CMD ["node", "--loader", "tsx", "src/server.ts"]
+ CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node --loader tsx src/server.ts"]
```

## Safety
- ✅ Idempotent migration (safe to re-run)
- ✅ No data deletion
- ✅ No downtime (ALTERs are instant)
- ✅ Telemetry errors already caught (won't crash auth)
- ✅ Rollback: revert Dockerfile CMD

## Timeline
- Push to main: ~30 seconds
- Render build: ~2-3 minutes
- Migration: ~1-2 seconds
- Total: ~3-4 minutes from push to fixed

## Success Criteria
- [ ] Render logs show "Migration applied successfully"
- [ ] POST /api/auth/session returns 200 (not 500)
- [ ] User can sign up and get session token
- [ ] No more "firebase_uid does not exist" errors
