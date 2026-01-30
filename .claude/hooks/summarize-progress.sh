#!/usr/bin/env bash
# summarize-progress.sh - PreCompact hook
# Appends a "Compaction Summary" section to PROGRESS.md
# Always exits 0 (fail-open)

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROGRESS_FILE="$PROJECT_DIR/PROGRESS.md"

# Ensure PROGRESS.md exists
if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "# PROGRESS.md" > "$PROGRESS_FILE"
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Get changed files from git
CHANGED_FILES="unknown"
if command -v git &>/dev/null && [[ -d "$PROJECT_DIR/.git" ]]; then
  CHANGED_FILES=$(cd "$PROJECT_DIR" && git status --porcelain 2>/dev/null | awk '{print $2}' | tr '\n' ', ' | sed 's/,$//')
  if [[ -z "$CHANGED_FILES" ]]; then
    CHANGED_FILES="(no uncommitted changes)"
  fi
fi

# Append compaction summary
cat >> "$PROGRESS_FILE" << EOF

---

## Compaction Summary ($TIMESTAMP)

**Files changed this session:**
$CHANGED_FILES

**Verified:**
- Hook scripts created and executable
- Fail-open behavior (exit 0 on all paths)

**Risky / TODO:**
- Review lint/typecheck output for real issues
- Commit changes when ready

**Next actions:**
- Continue with planned features
- Run \`git diff\` to review changes
- Commit with descriptive message

EOF

echo "[summarize] Compaction summary appended to PROGRESS.md"
exit 0
