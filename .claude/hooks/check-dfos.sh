#!/usr/bin/env bash
# check-dfos.sh - PostToolUse hook for Write/Edit
# Runs lint/typecheck if available, always exits 0 (fail-open)
# Appends progress entry on file changes

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

echo "=== DFOS Check Hook ==="

# --- Helper: run command if script exists in package.json ---
run_if_script_exists() {
  local dir="$1"
  local script="$2"
  local pkg="$dir/package.json"

  if [[ ! -f "$pkg" ]]; then
    return 0
  fi

  # Check if script exists in package.json
  if ! grep -q "\"$script\"" "$pkg" 2>/dev/null; then
    return 0
  fi

  echo "[check] Running $script in $dir..."

  if command -v pnpm &>/dev/null; then
    pnpm -C "$dir" -s run "$script" 2>&1 || echo "[warn] $script had issues (non-blocking)"
  elif command -v npm &>/dev/null; then
    npm --prefix "$dir" run -s "$script" 2>&1 || echo "[warn] $script had issues (non-blocking)"
  else
    echo "[skip] No package manager found"
  fi
}

# --- Run checks for web/ ---
if [[ -d "$PROJECT_DIR/web" ]]; then
  run_if_script_exists "$PROJECT_DIR/web" "lint"
  run_if_script_exists "$PROJECT_DIR/web" "typecheck"
fi

# --- Run checks for server/ ---
if [[ -d "$PROJECT_DIR/server" ]]; then
  run_if_script_exists "$PROJECT_DIR/server" "lint"
  run_if_script_exists "$PROJECT_DIR/server" "typecheck"
fi

# --- Append progress entry ---
"$PROJECT_DIR/.claude/hooks/append-progress.sh" "auto: hook write/edit" 2>/dev/null || true

echo "=== Check complete ==="
exit 0
