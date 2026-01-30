#!/usr/bin/env bash
# dfos-sanity.sh - Tier 2 DFOS environment and tooling sanity checks
# Warns about common issues but never blocks (advisory only)
# Always exits 0 (fail-open)

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="$PROJECT_DIR/.claude/state"
REPORT_FILE="$STATE_DIR/sanity_last.txt"

mkdir -p "$STATE_DIR" 2>/dev/null || true

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
WARNINGS=()

warn() {
  local category="$1"
  local message="$2"
  WARNINGS+=("[$category] $message")
}

# ===========================================
# CHECK 1: New .env files outside authorized locations
# ===========================================
if command -v git &>/dev/null && [[ -d "$PROJECT_DIR/.git" ]]; then
  cd "$PROJECT_DIR" || exit 0

  # Check untracked .env files
  NEW_ENV_FILES=$(git ls-files --others --exclude-standard 2>/dev/null | grep -E '\.env$' | grep -v 'server/.env' | grep -v 'web/.env' | grep -v '.env.example' | grep -v '.env.save' | grep -v '.env.bak')

  if [[ -n "$NEW_ENV_FILES" ]]; then
    while IFS= read -r envfile; do
      warn "ENV" "New .env file outside authorized locations: $envfile"
    done <<< "$NEW_ENV_FILES"
  fi
fi

# ===========================================
# CHECK 2: server/.env missing in dev
# ===========================================
if [[ ! -f "$PROJECT_DIR/server/.env" ]]; then
  if [[ -f "$PROJECT_DIR/server/package.json" ]]; then
    warn "ENV" "server/.env missing. Copy server/.env.example to server/.env for dev"
  fi
fi

# ===========================================
# CHECK 3: Tooling availability
# ===========================================
TOOLING_NOTES=()

if ! command -v pnpm &>/dev/null; then
  TOOLING_NOTES+=("pnpm not available - use npm instead")
fi

if ! command -v rg &>/dev/null; then
  TOOLING_NOTES+=("ripgrep (rg) not available - grep will be used")
fi

if ! command -v node &>/dev/null; then
  warn "TOOLING" "node not found in PATH"
elif [[ -n "$(command -v node)" ]]; then
  NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//')
  MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [[ "$MAJOR_VERSION" -lt 18 ]]; then
    warn "TOOLING" "Node version $NODE_VERSION is below required 18.x"
  fi
fi

if ! command -v npm &>/dev/null; then
  warn "TOOLING" "npm not found in PATH"
fi

# ===========================================
# CHECK 4: Common command mistakes in recent history
# ===========================================
# Check if any recent commands assumed pnpm when it's not available
if ! command -v pnpm &>/dev/null; then
  # Look for pnpm in shell history (if accessible) - advisory only
  if [[ -f "$HOME/.zsh_history" ]]; then
    if tail -20 "$HOME/.zsh_history" 2>/dev/null | grep -q 'pnpm'; then
      warn "TOOLING" "Recent shell history contains pnpm commands but pnpm is not installed"
    fi
  fi
fi

# ===========================================
# Write report
# ===========================================
{
  echo "========================================"
  echo "DFOS Sanity Check Report"
  echo "Timestamp: $TIMESTAMP"
  echo "========================================"
  echo ""

  if [[ ${#WARNINGS[@]} -eq 0 ]]; then
    echo "Status: OK"
    echo "No warnings."
  else
    echo "Status: WARNINGS (${#WARNINGS[@]})"
    echo ""
    for w in "${WARNINGS[@]}"; do
      echo "  ! $w"
    done
  fi

  if [[ ${#TOOLING_NOTES[@]} -gt 0 ]]; then
    echo ""
    echo "Tooling notes:"
    for n in "${TOOLING_NOTES[@]}"; do
      echo "  - $n"
    done
  fi

  echo ""
  echo "Available tools:"
  echo "  node: $(command -v node 2>/dev/null || echo 'not found')"
  echo "  npm: $(command -v npm 2>/dev/null || echo 'not found')"
  echo "  pnpm: $(command -v pnpm 2>/dev/null || echo 'not found')"
  echo "  rg: $(command -v rg 2>/dev/null || echo 'not found')"
  echo "  git: $(command -v git 2>/dev/null || echo 'not found')"
} > "$REPORT_FILE"

echo "[sanity] Check complete: ${#WARNINGS[@]} warning(s)"
exit 0
