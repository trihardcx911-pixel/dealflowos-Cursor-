#!/usr/bin/env bash
# append-progress.sh - Appends a timestamped entry to PROGRESS.md
# Usage: append-progress.sh "note text"
# Always exits 0 (fail-open)

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROGRESS_FILE="$PROJECT_DIR/PROGRESS.md"
NOTE="${1:-auto: unknown}"

# Ensure PROGRESS.md exists
if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "# PROGRESS.md" > "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
  echo "## Session Log" >> "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
fi

# Get timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Get changed files from git status (if git available)
CHANGED_FILES=""
if command -v git &>/dev/null && [[ -d "$PROJECT_DIR/.git" ]]; then
  CHANGED_FILES=$(cd "$PROJECT_DIR" && git status --porcelain 2>/dev/null | head -5 | awk '{print $2}' | tr '\n' ', ' | sed 's/,$//')
fi

# Build entry
if [[ -n "$CHANGED_FILES" ]]; then
  ENTRY="- \`$TIMESTAMP\` | files: $CHANGED_FILES | $NOTE"
else
  ENTRY="- \`$TIMESTAMP\` | $NOTE"
fi

# Append to PROGRESS.md
echo "$ENTRY" >> "$PROGRESS_FILE"

exit 0
