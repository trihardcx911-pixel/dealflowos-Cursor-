# Production Migration Fix: Step-by-Step Commands

## ⚠️ CRITICAL: Set Production DATABASE_URL First

**Current `server/.env` points to localhost.** You MUST set `DATABASE_URL` to your Render Postgres connection string before running these commands.

### Step 0: Set Production DATABASE_URL

```bash
cd server

# Option A: Edit .env file and set DATABASE_URL to Render Postgres URL
# Example: DATABASE_URL=postgresql://user:pass@dpg-xxxxx-a.oregon-postgres.render.com/dbname

# Option B: Export for this session only
export DATABASE_URL="postgresql://user:pass@dpg-xxxxx-a.oregon-postgres.render.com/dbname"

# Verify it's NOT localhost
echo "$DATABASE_URL" | sed 's/\/\/.*@/\/\/***@/' | sed 's/\?.*//'
```

---

## Step 1: Confirm DB Target

```bash
cd server
set -a && [ -f .env ] && . ./.env; set +a

# Strip query string for psql compatibility
export DB_URL="${DATABASE_URL%%\?*}"

# Print masked URLs
echo "=== DATABASE_URL (masked) ==="
echo "$DATABASE_URL" | sed 's/\/\/.*@/\/\/***@/' | sed 's/\?.*//'
echo ""
echo "=== DB_URL (no query string) ==="
echo "$DB_URL" | sed 's/\/\/.*@/\/\/***@/'
echo ""

# Test connection and show server address
echo "=== DB Connection Test ==="
psql "$DB_URL" -c "select current_database(), inet_server_addr(), inet_server_port();"
```

**Expected Output:**
```
 current_database | inet_server_addr | inet_server_port 
------------------+------------------+------------------
 your_prod_db     | dpg-xxxxx-a...  |             5432
```

**⚠️ STOP if `inet_server_addr()` is `127.0.0.1` or `::1`** → Set `DATABASE_URL` to Render production first.

---

## Step 2: Fix Prisma Migration Blockage

### 2a) Check if Reminder table exists

```bash
psql "$DB_URL" -c '\d "Reminder"'
```

**Expected Output (if exists):**
```
                                  Table "public.Reminder"
     Column     |              Type              | ...
----------------+--------------------------------+-----
 id             | text                           | ...
 orgId          | text                           | ...
 ...
```

**If table exists:** Proceed to Step 2b.  
**If table does NOT exist:** Skip Step 2b, go to Step 3.

### 2b) Mark Reminder migration as applied (if table exists)

```bash
npx prisma migrate resolve --schema prisma/schema.prisma --applied 20250105010000_add_reminders
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "...", schema "public" at "..."

Migration 20250105010000_add_reminders marked as applied.
```

---

## Step 3: Apply Remaining Migrations

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

**Expected Output (if migrations pending):**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "...", schema "public" at "..."

X migrations found in prisma/migrations

Applying migration `20260205000000_add_auth_fields`

The following migration(s) have been applied:

migrations/
  └─ 20260205000000_add_auth_fields/
    └─ migration.sql
      
All migrations have been successfully applied.
```

**Expected Output (if already applied):**
```
No pending migrations to apply.
```

### 3b) Verify migration status

```bash
npx prisma migrate status --schema prisma/schema.prisma
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "...", schema "public" at "..."

X migrations found in prisma/migrations

Database schema is up to date!
```

### 3c) Confirm migrations in _prisma_migrations table

```bash
psql "$DB_URL" -c 'select migration_name, finished_at, rolled_back_at from "_prisma_migrations" order by started_at desc limit 10;'
```

**Expected Output:**
```
                      migration_name                      |          finished_at          | rolled_back_at 
----------------------------------------------------------+-------------------------------+----------------
 20260205000000_add_auth_fields                           | 2026-02-05 ... | 
 20250105010000_add_reminders                             | 2026-02-05 ... | 
 20250105000000_calendar_userid_string                    | 2026-02-05 ... | 
 20260114200000_calendar_event_status_and_canonical_times | 2026-01-14 ... | 
```

**Check:** Both `20250105010000_add_reminders` and `20260205000000_add_auth_fields` should have non-null `finished_at`.

---

## Step 4: Verify Schema Required by /api/auth/session

### 4a) Check User.firebase_uid column

```bash
psql "$DB_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='firebase_uid';"
```

**Expected Output:**
```
 column_name  | data_type | is_nullable 
--------------+-----------+-------------
 firebase_uid | text      | YES
(1 row)
```

**If missing:** Migration `20260205000000_add_auth_fields` did not apply. Check Step 3 output for errors.

### 4b) Check security_events table

```bash
psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='security_events';"
```

**Expected Output:**
```
 table_name      
-----------------
 security_events
(1 row)
```

**If missing:** Same migration should have created it. Check Step 3 output.

### 4c) Check all required User columns (optional, for completeness)

```bash
psql "$DB_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name IN ('firebase_uid', 'email', 'display_name', 'photo_url', 'plan', 'status', 'session_version', 'lock_state', 'createdAt', 'updatedAt') ORDER BY column_name;"
```

**Expected Output (10 rows):**
```
 column_name  
--------------
 createdAt
 display_name
 email
 firebase_uid
 lock_state
 photo_url
 plan
 session_version
 status
 updatedAt
```

---

## Step 5: If Schema is Correct but 500 Persists

### 5a) Get Latest Request ID from Render Logs

1. Go to Render Dashboard → Your Service → Logs
2. Find the most recent `POST /api/auth/session` request
3. Copy the `requestID` (usually in format `req-xxxxx` or similar)
4. Find the stack trace **above** the request summary (look for `Error:` or `at ...` lines)

### 5b) Share Stack Trace

Paste the stack trace here. Look for:
- File paths (e.g., `dist/auth/sessionService.js:35`)
- Error messages (e.g., `column "firebase_uid" does not exist`)
- Function names (e.g., `establishSession`, `pool.query`)

### 5c) Common Issues & Fixes

**If error is still "column firebase_uid does not exist":**
- Migration did not apply → Re-run Step 3 and check for errors
- Wrong database → Verify `DATABASE_URL` is production (Step 1)

**If error is "relation security_events does not exist":**
- Migration did not apply → Re-run Step 3
- Telemetry should not crash (has try/catch), but table should exist

**If error is something else:**
- Share stack trace → I'll propose minimal code fix

---

## Complete Command Sequence (Copy-Paste Ready)

```bash
# Step 0: Set DATABASE_URL to Render production (if not already set)
export DATABASE_URL="postgresql://user:pass@dpg-xxxxx-a.oregon-postgres.render.com/dbname"

# Step 1: Confirm target
cd server
set -a && [ -f .env ] && . ./.env; set +a
export DB_URL="${DATABASE_URL%%\?*}"
echo "$DATABASE_URL" | sed 's/\/\/.*@/\/\/***@/' | sed 's/\?.*//'
psql "$DB_URL" -c "select current_database(), inet_server_addr(), inet_server_port();"

# Step 2: Fix Reminder migration (if table exists)
psql "$DB_URL" -c '\d "Reminder"' && \
npx prisma migrate resolve --schema prisma/schema.prisma --applied 20250105010000_add_reminders

# Step 3: Apply remaining migrations
npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma migrate status --schema prisma/schema.prisma
psql "$DB_URL" -c 'select migration_name, finished_at from "_prisma_migrations" order by started_at desc limit 10;'

# Step 4: Verify schema
psql "$DB_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='firebase_uid';"
psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='security_events';"
```

---

## Conclusion

After running Steps 1-4:

**If schema verification passes (firebase_uid exists, security_events exists):**
→ **"DB fixed; 500 should stop. If 500 persists, share Render logs stack trace (Step 5)."**

**If schema verification fails:**
→ **"Migration did not apply. Check Step 3 output for errors. Re-run `npx prisma migrate deploy` and share error output."**

**If schema is correct but 500 persists:**
→ **"DB is correct; next likely fault is [X] with proof [Y]. Share stack trace from Render logs (Step 5) for exact fix."**
