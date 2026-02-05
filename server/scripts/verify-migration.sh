#!/bin/bash
# Verification script for auth schema migration
# Usage: ./scripts/verify-migration.sh

set -e

echo "=== Migration Verification Script ==="
echo ""

# Check DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set"
  echo "   Load it from .env: export DATABASE_URL=..."
  exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Check firebase_uid column exists
echo "1. Checking firebase_uid column..."
RESULT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='firebase_uid';")
if [ "$RESULT" -eq 1 ]; then
  echo "   ✓ firebase_uid column exists"
else
  echo "   ❌ firebase_uid column missing"
  exit 1
fi

# Check security_events table exists
echo "2. Checking security_events table..."
RESULT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='security_events';")
if [ "$RESULT" -eq 1 ]; then
  echo "   ✓ security_events table exists"
else
  echo "   ❌ security_events table missing"
  exit 1
fi

# Check required User columns
echo "3. Checking all required User columns..."
REQUIRED_COLS=("email" "firebase_uid" "display_name" "photo_url" "plan" "status" "trial_started_at" "trial_ends_at" "onboarding_complete" "session_version" "lock_state" "createdAt" "updatedAt")
for col in "${REQUIRED_COLS[@]}"; do
  RESULT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='$col';")
  if [ "$RESULT" -eq 1 ]; then
    echo "   ✓ $col"
  else
    echo "   ❌ $col missing"
    exit 1
  fi
done

# Check security_events columns
echo "4. Checking security_events columns..."
SEC_COLS=("id" "event_type" "user_id" "ip" "user_agent" "path" "method" "status_code" "reason" "meta" "created_at")
for col in "${SEC_COLS[@]}"; do
  RESULT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='security_events' AND column_name='$col';")
  if [ "$RESULT" -eq 1 ]; then
    echo "   ✓ $col"
  else
    echo "   ❌ $col missing"
    exit 1
  fi
done

# Check indexes
echo "5. Checking indexes..."
RESULT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND tablename='User' AND indexname='User_firebase_uid_key';")
if [ "$RESULT" -eq 1 ]; then
  echo "   ✓ User_firebase_uid_key index exists"
else
  echo "   ❌ User_firebase_uid_key index missing"
  exit 1
fi

echo ""
echo "=== ✅ All checks passed! ==="
echo ""
echo "Next steps:"
echo "  1. Start the server: npm run dev"
echo "  2. Test POST /api/auth/session with a Firebase token"
echo "  3. Commit and deploy to Render"
