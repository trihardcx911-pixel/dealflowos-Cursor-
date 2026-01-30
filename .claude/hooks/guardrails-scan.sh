#!/usr/bin/env bash
# guardrails-scan.sh - Tier 2.1 DFOS guardrails with signature-based delta
# Key format: RULE|FILE|SIGNATURE - matches baseline precisely
# Status = VIOLATIONS_NEW only if NEW violations found (not in baseline)
# Always exits 0 (fail-open)

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="$PROJECT_DIR/.claude/state"
BASELINE_FILE="$STATE_DIR/guardrails_baseline.txt"
REPORT_FILE="$STATE_DIR/guardrails_last.txt"
STATUS_FILE="$STATE_DIR/guardrails_status.txt"
PROGRESS_FILE="$PROJECT_DIR/PROGRESS.md"

mkdir -p "$STATE_DIR" 2>/dev/null || true

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
ALL_VIOLATIONS=()
NEW_VIOLATIONS=()

# --- Signature helper ---
compute_signature() {
  local match_str="$1"
  if command -v shasum &>/dev/null; then
    echo -n "$match_str" | shasum -a 1 2>/dev/null | cut -c1-12
  elif command -v sha1sum &>/dev/null; then
    echo -n "$match_str" | sha1sum 2>/dev/null | cut -c1-12
  else
    echo "${match_str:0:40}" | tr -d '\n' | tr '|' '_'
  fi
}

# Check baseline using grep (works on all bash versions)
is_in_baseline() {
  local key="$1"
  if [[ -f "$BASELINE_FILE" ]]; then
    grep -Fxq "$key" "$BASELINE_FILE" 2>/dev/null
  else
    return 1
  fi
}

# Count baseline entries
BASELINE_COUNT=0
if [[ -f "$BASELINE_FILE" ]]; then
  BASELINE_COUNT=$(grep -c '^[^#]' "$BASELINE_FILE" 2>/dev/null || echo "0")
fi

log_violation() {
  local rule="$1"
  local file="$2"
  local match_str="$3"
  local detail="$4"
  local sig
  sig=$(compute_signature "$match_str")
  local key="$rule|$file|$sig"

  ALL_VIOLATIONS+=("[$rule] $file: $detail (sig:$sig)")

  if ! is_in_baseline "$key"; then
    NEW_VIOLATIONS+=("[$rule] $file: $detail")
  fi
}

# --- Get changed files ---
CHANGED_FILES=""
if command -v git &>/dev/null && [[ -d "$PROJECT_DIR/.git" ]]; then
  cd "$PROJECT_DIR" || exit 0
  CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only 2>/dev/null || echo "")
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -100)
  if [[ -n "$UNTRACKED" ]]; then
    CHANGED_FILES="$CHANGED_FILES"$'\n'"$UNTRACKED"
  fi
else
  echo "OK" > "$STATUS_FILE"
  echo "[$TIMESTAMP] No git available, skipping guardrails scan" > "$REPORT_FILE"
  exit 0
fi

if [[ -z "$CHANGED_FILES" ]]; then
  echo "OK" > "$STATUS_FILE"
  echo "[$TIMESTAMP] No changed files, guardrails OK" > "$REPORT_FILE"
  exit 0
fi

# --- Scan each changed file ---
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  [[ ! -f "$PROJECT_DIR/$file" ]] && continue

  filepath="$PROJECT_DIR/$file"

  # ===========================================
  # RULE 1: React/JSX structural guardrails
  # ===========================================
  if [[ "$file" == web/src/*.tsx ]] || [[ "$file" == web/src/**/*.tsx ]]; then
    # Fragment check
    while IFS= read -r match; do
      [[ -n "$match" ]] && log_violation "REACT-FRAGMENT" "$file" "$match" "Contains React fragment (<>)"
    done < <(grep -n '<>' "$filepath" 2>/dev/null || true)
    while IFS= read -r match; do
      [[ -n "$match" ]] && log_violation "REACT-FRAGMENT" "$file" "$match" "Contains React fragment (</>)"
    done < <(grep -n '</>' "$filepath" 2>/dev/null || true)

    # return null
    while IFS= read -r match; do
      [[ -n "$match" ]] && log_violation "REACT-RETURN-NULL" "$file" "$match" "Contains 'return null'"
    done < <(grep -n 'return null' "$filepath" 2>/dev/null || true)

    # Early return
    while IFS= read -r match; do
      [[ -n "$match" ]] && log_violation "REACT-EARLY-RETURN" "$file" "$match" "Early return pattern"
    done < <(grep -En 'if\s*\([^)]+\)\s*return' "$filepath" 2>/dev/null | grep -v '//' || true)
  fi

  # ===========================================
  # RULE 2: Environment file guardrails
  # ===========================================
  if [[ "$file" == *.env ]] || [[ "$file" == */.env ]]; then
    if [[ "$file" != "server/.env" ]] && [[ "$file" != ".env.example" ]] && \
       [[ "$file" != "web/.env.example" ]] && [[ "$file" != "server/.env.example" ]] && \
       [[ "$file" != *.env.save ]] && [[ "$file" != *.env.bak ]]; then
      log_violation "ENV-LOCATION" "$file" "env-file-exists" "Env outside authorized locations"
    fi
  fi
  if [[ "$file" == prisma/.env ]] || [[ "$file" == */prisma/.env ]]; then
    log_violation "ENV-PRISMA" "$file" "prisma-env-exists" "prisma/.env detected"
  fi

  # ===========================================
  # RULE 3: OrgId derivation (server/src/routes)
  # ===========================================
  if [[ "$file" == server/src/routes/*.ts ]]; then
    # (req as any).orgId
    while IFS= read -r match; do
      [[ -n "$match" ]] && log_violation "ORGID-CAST" "$file" "$match" "Uses (req as any).orgId"
    done < <(grep -n '(req as any)\.orgId' "$filepath" 2>/dev/null || true)

    # Inline header access
    while IFS= read -r match; do
      [[ -n "$match" ]] && log_violation "ORGID-INLINE" "$file" "$match" "Inline orgId header access"
    done < <(grep -En "req\.headers\[['\"]x-.*org" "$filepath" 2>/dev/null | grep -v 'getOrgId' || true)

    # x-dev-org-id usage
    while IFS= read -r match; do
      [[ -n "$match" ]] && log_violation "ORGID-DEV-HEADER" "$file" "$match" "x-dev-org-id header usage"
    done < <(grep -in 'x-dev-org-id' "$filepath" 2>/dev/null || true)

    # DEV_BYPASS patterns
    while IFS= read -r match; do
      [[ -n "$match" ]] && log_violation "DEV-BYPASS" "$file" "$match" "DEV_BYPASS logic"
    done < <(grep -En 'DEV_BYPASS.*=.*true|if.*DEV_BYPASS' "$filepath" 2>/dev/null | grep -v '//' || true)

    # ===========================================
    # RULE 3b: ORGID-INVARIANT (Task C)
    # Routes using org-scoped DB ops must use getOrgId
    # ===========================================
    if grep -qE '\.findMany\(|\.findUnique\(|\.create\(|\.update\(|\.delete\(|prisma\.' "$filepath" 2>/dev/null; then
      if grep -q 'orgId' "$filepath" 2>/dev/null; then
        if ! grep -qE 'getOrgId\(|req\.orgId' "$filepath" 2>/dev/null; then
          log_violation "ORGID-INVARIANT" "$file" "db-ops-without-getOrgId" "Route uses org-scoped DB ops without getOrgId(req) or req.orgId"
        fi
      fi
    fi
  fi

  # ===========================================
  # RULE 4: Import safety (leads.import.ts)
  # ===========================================
  if [[ "$file" == *leads.import.ts ]]; then
    if ! grep -q 'fileSize' "$filepath" 2>/dev/null; then
      log_violation "IMPORT-NO-FILESIZE" "$file" "missing-fileSize" "Missing multer fileSize limit"
    fi
    if ! grep -qE 'rows.*limit|limit.*rows|maxRows|MAX_ROWS|validateImport' "$filepath" 2>/dev/null; then
      log_violation "IMPORT-NO-ROWLIMIT" "$file" "missing-rowlimit" "Missing row count limit"
    fi
    # Task D: Check parity between preview and commit handlers
    if grep -q 'preview' "$filepath" 2>/dev/null && grep -q 'commit' "$filepath" 2>/dev/null; then
      # Both handlers exist - check they share validation
      if ! grep -qE 'validateImport|IMPORT_LIMITS|sharedLimits' "$filepath" 2>/dev/null; then
        log_violation "IMPORT-NO-PARITY" "$file" "missing-shared-validation" "Preview/commit handlers may lack shared validation"
      fi
    fi
  fi

done <<< "$CHANGED_FILES"

# --- Write report ---
TOTAL_ALL=${#ALL_VIOLATIONS[@]}
TOTAL_NEW=${#NEW_VIOLATIONS[@]}

{
  echo "========================================"
  echo "DFOS Guardrails Scan Report (Tier 2.1)"
  echo "Timestamp: $TIMESTAMP"
  echo "========================================"
  echo ""
  echo "Baseline: $BASELINE_COUNT known violations"
  echo "Current scan: $TOTAL_ALL violations in changed files"
  echo "NEW violations: $TOTAL_NEW"
  echo ""

  if [[ $TOTAL_NEW -eq 0 ]]; then
    echo "Status: OK"
    echo "No NEW violations detected. All findings match baseline signatures."
  else
    echo "Status: VIOLATIONS_NEW"
    echo ""
    echo "========== NEW VIOLATIONS (blocking) =========="
    for v in "${NEW_VIOLATIONS[@]}"; do
      echo "  ! $v"
    done
    echo "================================================"
    echo ""
    echo "Action required:"
    echo "  Fix NEW violations OR regenerate baseline and acknowledge in PROGRESS.md"
  fi

  if [[ $TOTAL_ALL -gt 0 ]]; then
    echo ""
    echo "---------- All violations in changed files ----------"
    for v in "${ALL_VIOLATIONS[@]}"; do
      echo "  - $v"
    done
  fi
} > "$REPORT_FILE"

# --- Write status file ---
if [[ $TOTAL_NEW -eq 0 ]]; then
  echo "OK" > "$STATUS_FILE"
else
  echo "VIOLATIONS_NEW" > "$STATUS_FILE"
  if [[ -f "$PROGRESS_FILE" ]]; then
    echo "- \`$TIMESTAMP\` | NEW GUARDRAIL VIOLATIONS ($TOTAL_NEW): ${NEW_VIOLATIONS[0]%%:*}..." >> "$PROGRESS_FILE"
  fi
fi

echo "[guardrails] Scan: $TOTAL_ALL total, $TOTAL_NEW NEW (signature-based delta)"
exit 0
