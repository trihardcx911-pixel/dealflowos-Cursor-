#!/usr/bin/env bash
# guardrails-baseline.sh - Tier 2.1 baseline with signature-based keys
# Key format: RULE|FILE|SIGNATURE (sha1 of matched line, or truncated match)
# Always exits 0 (fail-open)

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="$PROJECT_DIR/.claude/state"
BASELINE_FILE="$STATE_DIR/guardrails_baseline.txt"

mkdir -p "$STATE_DIR" 2>/dev/null || true

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
VIOLATIONS=()

# --- Signature helper ---
compute_signature() {
  local match_str="$1"
  # Try shasum (macOS) or sha1sum (Linux)
  if command -v shasum &>/dev/null; then
    echo -n "$match_str" | shasum -a 1 2>/dev/null | cut -c1-12
  elif command -v sha1sum &>/dev/null; then
    echo -n "$match_str" | sha1sum 2>/dev/null | cut -c1-12
  else
    # Fallback: truncated match string (no hash available)
    echo "${match_str:0:40}" | tr -d '\n' | tr '|' '_'
  fi
}

collect_violation() {
  local rule="$1"
  local file="$2"
  local match_str="$3"
  local sig
  sig=$(compute_signature "$match_str")
  VIOLATIONS+=("$rule|$file|$sig")
}

# Check git
if ! command -v git &>/dev/null || [[ ! -d "$PROJECT_DIR/.git" ]]; then
  echo "# Baseline created: $TIMESTAMP" > "$BASELINE_FILE"
  echo "# No git available" >> "$BASELINE_FILE"
  echo "[baseline] No git, empty baseline created"
  exit 0
fi

cd "$PROJECT_DIR" || exit 0

# Get ALL files for baseline (tracked + untracked)
ALL_FILES=$(git ls-files 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -200)
if [[ -n "$UNTRACKED" ]]; then
  ALL_FILES="$ALL_FILES"$'\n'"$UNTRACKED"
fi

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  [[ ! -f "$PROJECT_DIR/$file" ]] && continue

  filepath="$PROJECT_DIR/$file"

  # ===========================================
  # React/JSX checks (web/src/**/*.tsx)
  # ===========================================
  if [[ "$file" == web/src/*.tsx ]] || [[ "$file" == web/src/**/*.tsx ]]; then
    # Fragment check
    while IFS= read -r match; do
      [[ -n "$match" ]] && collect_violation "REACT-FRAGMENT" "$file" "$match"
    done < <(grep -n '<>' "$filepath" 2>/dev/null || true)
    while IFS= read -r match; do
      [[ -n "$match" ]] && collect_violation "REACT-FRAGMENT" "$file" "$match"
    done < <(grep -n '</>' "$filepath" 2>/dev/null || true)

    # return null
    while IFS= read -r match; do
      [[ -n "$match" ]] && collect_violation "REACT-RETURN-NULL" "$file" "$match"
    done < <(grep -n 'return null' "$filepath" 2>/dev/null || true)

    # Early return
    while IFS= read -r match; do
      [[ -n "$match" ]] && collect_violation "REACT-EARLY-RETURN" "$file" "$match"
    done < <(grep -En 'if\s*\([^)]+\)\s*return' "$filepath" 2>/dev/null | grep -v '//' || true)
  fi

  # ===========================================
  # Env checks
  # ===========================================
  if [[ "$file" == *.env ]] || [[ "$file" == */.env ]]; then
    if [[ "$file" != "server/.env" ]] && [[ "$file" != ".env.example" ]] && \
       [[ "$file" != "web/.env.example" ]] && [[ "$file" != "server/.env.example" ]] && \
       [[ "$file" != *.env.save ]] && [[ "$file" != *.env.bak ]]; then
      collect_violation "ENV-LOCATION" "$file" "env-file-exists"
    fi
  fi
  if [[ "$file" == prisma/.env ]] || [[ "$file" == */prisma/.env ]]; then
    collect_violation "ENV-PRISMA" "$file" "prisma-env-exists"
  fi

  # ===========================================
  # OrgId checks (server/src/routes/*.ts)
  # ===========================================
  if [[ "$file" == server/src/routes/*.ts ]]; then
    # (req as any).orgId
    while IFS= read -r match; do
      [[ -n "$match" ]] && collect_violation "ORGID-CAST" "$file" "$match"
    done < <(grep -n '(req as any)\.orgId' "$filepath" 2>/dev/null || true)

    # Inline header access
    while IFS= read -r match; do
      [[ -n "$match" ]] && collect_violation "ORGID-INLINE" "$file" "$match"
    done < <(grep -En "req\.headers\[['\"]x-.*org" "$filepath" 2>/dev/null | grep -v 'getOrgId' || true)

    # x-dev-org-id usage
    while IFS= read -r match; do
      [[ -n "$match" ]] && collect_violation "ORGID-DEV-HEADER" "$file" "$match"
    done < <(grep -in 'x-dev-org-id' "$filepath" 2>/dev/null || true)

    # DEV_BYPASS patterns
    while IFS= read -r match; do
      [[ -n "$match" ]] && collect_violation "DEV-BYPASS" "$file" "$match"
    done < <(grep -En 'DEV_BYPASS.*=.*true|if.*DEV_BYPASS' "$filepath" 2>/dev/null | grep -v '//' || true)

    # ORGID-INVARIANT check (Task C)
    if grep -qE '\.findMany\(|\.findUnique\(|\.create\(|\.update\(|\.delete\(|prisma\.' "$filepath" 2>/dev/null; then
      if grep -q 'orgId' "$filepath" 2>/dev/null; then
        if ! grep -qE 'getOrgId\(|req\.orgId' "$filepath" 2>/dev/null; then
          collect_violation "ORGID-INVARIANT" "$file" "db-ops-without-getOrgId"
        fi
      fi
    fi
  fi

  # ===========================================
  # Import safety (leads.import.ts)
  # ===========================================
  if [[ "$file" == *leads.import.ts ]]; then
    if ! grep -q 'fileSize' "$filepath" 2>/dev/null; then
      collect_violation "IMPORT-NO-FILESIZE" "$file" "missing-fileSize"
    fi
    if ! grep -qE 'rows.*limit|limit.*rows|maxRows|MAX_ROWS|validateImport' "$filepath" 2>/dev/null; then
      collect_violation "IMPORT-NO-ROWLIMIT" "$file" "missing-rowlimit"
    fi
    # Task D: Parity check
    if grep -q 'preview' "$filepath" 2>/dev/null && grep -q 'commit' "$filepath" 2>/dev/null; then
      if ! grep -qE 'validateImport|IMPORT_LIMITS|sharedLimits' "$filepath" 2>/dev/null; then
        collect_violation "IMPORT-NO-PARITY" "$file" "missing-shared-validation"
      fi
    fi
  fi

done <<< "$ALL_FILES"

# Write baseline
{
  echo "# DFOS Guardrails Baseline (Tier 2.1)"
  echo "# Created: $TIMESTAMP"
  echo "# Total: ${#VIOLATIONS[@]} known violations"
  echo "#"
  echo "# Format: RULE|FILE|SIGNATURE"
  echo "# Signature = sha1(matched_line)[0:12] for precise delta detection"
  echo ""
  for v in "${VIOLATIONS[@]}"; do
    echo "$v"
  done
} > "$BASELINE_FILE"

echo "[baseline] Created with ${#VIOLATIONS[@]} known violations (signature-based)"
exit 0
