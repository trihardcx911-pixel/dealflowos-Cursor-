# Prisma migration reconciliation: 20250105010000_add_reminders

## Problem
- `npx prisma migrate deploy` fails with **P3018** on migration `20250105010000_add_reminders`.
- DB error: **42P07** `relation "Reminder" already exists`.
- Later migrations (e.g. auth schema) never run → production 500s.

## 1) Target DB check

**You must run against the Render/production DB.** If `DATABASE_URL` is localhost, set it to production first.

```bash
cd server

# Load env (server/.env)
set -a && [ -f .env ] && . ./.env; set +a

# Mask password and show target
echo "DATABASE_URL (masked):"
echo "$DATABASE_URL" | sed 's/\/\/.*@/\/\/***@/' | sed 's/\?.*//'

# Prove connection (strip ?schema=... for psql if needed)
DB_URL="${DATABASE_URL%%\?*}"
psql "$DB_URL" -c "select current_database(), inet_server_addr(), inet_server_port();"
```

- If `inet_server_addr()` is `::1` or `127.0.0.1` → **STOP**. Set `DATABASE_URL` to the Render Postgres connection string and re-run.
- If it shows the Render DB host → proceed.

## 2) Schema comparison

### What the migration expects (`20250105010000_add_reminders/migration.sql`)

- **Table**: `"Reminder"` (case-sensitive).
- **Columns**:
  - `id` TEXT NOT NULL (PK)
  - `orgId`, `userId`, `targetType`, `targetId` TEXT NOT NULL
  - `remindAt` TIMESTAMPTZ NOT NULL
  - `reminderOffset` INTEGER NOT NULL
  - `channel`, `status`, `idempotencyKey` TEXT NOT NULL
  - `sentAt`, `deliveredAt`, `failedAt` TIMESTAMP(3) nullable
  - `errorMessage` TEXT nullable
  - `retryCount` INTEGER NOT NULL DEFAULT 0
  - `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  - `updatedAt` TIMESTAMP(3) NOT NULL (no default)
- **Indexes**:
  - `Reminder_pkey` (PK on `id`)
  - `Reminder_idempotencyKey_key` UNIQUE
  - `Reminder_orgId_userId_status_remindAt_idx`
  - `Reminder_status_remindAt_idx`
  - `Reminder_orgId_userId_targetType_targetId_reminderOffset_ch_key` UNIQUE

### What the DB has (example from local; production may differ)

Run:

```bash
psql "$DB_URL" -c '\d "Reminder"'
```

**Typical outcome**: Table already exists with the same columns (and possibly extra ones, e.g. `timezone`).

- If the table has **all** columns and indexes above (or a **superset**, e.g. extra nullable column like `timezone`): safe to mark the migration as applied.
- If something required by the migration is **missing** (column, index, or constraint): do **not** use `resolve --applied`; fix the schema first (see “If schemas do not match” below).

## 3) Safe action: mark migration as applied

Only after confirming the Reminder table exists and matches (or is a superset of) the migration.

```bash
cd server
set -a && [ -f .env ] && . ./.env; set +a

# Use DB_URL if your DATABASE_URL has ?schema=public
export DB_URL="${DATABASE_URL%%\?*}"

# 1) Resolve the stuck migration (no data loss)
npx prisma migrate resolve --schema prisma/schema.prisma --applied 20250105010000_add_reminders

# 2) Deploy remaining migrations (e.g. auth fields)
npx prisma migrate deploy --schema prisma/schema.prisma

# 3) Status
npx prisma migrate status --schema prisma/schema.prisma
```

## 4) If schemas do not match

Do **not** run `prisma migrate resolve --applied` until the table matches.

- **Missing column**: add it with `ALTER TABLE "Reminder" ADD COLUMN ...`.
- **Missing index**: add with `CREATE INDEX ...` / `CREATE UNIQUE INDEX ...`.
- **Wrong type/nullability**: add a new migration that alters the column to match the intended schema.

Re-run `\d "Reminder"` and compare again, then run `resolve --applied` and `migrate deploy`.

## 5) Verification checklist

Run against the **same** DB you use for deploy (production).

| Check | Command | Expected |
|-------|--------|----------|
| DB is not localhost | `psql "$DB_URL" -c "select inet_server_addr();"` | Not `::1` / `127.0.0.1` |
| Reminder exists | `psql "$DB_URL" -c '\d "Reminder"'` | Table with columns above (or superset) |
| Migration recorded | `psql "$DB_URL" -c "select migration_name, finished_at from \"_prisma_migrations\" where migration_name = '20250105010000_add_reminders';"` | One row, `finished_at` NOT NULL after resolve |
| Deploy success | `npx prisma migrate deploy --schema prisma/schema.prisma` | "No pending migrations" or "X migration(s) applied" |
| Status | `npx prisma migrate status --schema prisma/schema.prisma` | "Database schema is up to date" |

## 6) Commands in order (production)

```bash
cd server
set -a && [ -f .env ] && . ./.env; set +a
export DB_URL="${DATABASE_URL%%\?*}"

# Confirm target
echo "$DATABASE_URL" | sed 's/\/\/.*@/\/\/***@/' | sed 's/\?.*//'
psql "$DB_URL" -c "select current_database(), inet_server_addr(), inet_server_port();"

# Inspect Reminder
psql "$DB_URL" -c '\d "Reminder"'

# Optional: current migration state
psql "$DB_URL" -c 'select migration_name, finished_at, rolled_back_at from "_prisma_migrations" order by started_at desc limit 20;'

# Resolve (only if Reminder table matches or is superset)
npx prisma migrate resolve --schema prisma/schema.prisma --applied 20250105010000_add_reminders

# Deploy remaining migrations
npx prisma migrate deploy --schema prisma/schema.prisma

# Verify
npx prisma migrate status --schema prisma/schema.prisma
psql "$DB_URL" -c 'select migration_name, finished_at from "_prisma_migrations" order by started_at desc limit 10;'
```

## Summary

- **Root cause**: Reminder table already existed (e.g. created manually or by a previous partial run), so `CREATE TABLE "Reminder"` in the migration fails.
- **Fix**: Confirm schema compatibility, then `prisma migrate resolve --applied 20250105010000_add_reminders` and `prisma migrate deploy`. No reset, no data loss.
- **Critical**: Use production `DATABASE_URL` when reconciling production; use a connection string without `?schema=...` for `psql` if needed (`DB_URL="${DATABASE_URL%%\?*}"`).
