#!/usr/bin/env bash
# Runs the offline checks plus the read-only HubSpot ID check and prints one pass/fail line each.
# Exits 1 if any check fails. Full output of each check goes to $LOG_DIR (default: a temp folder).
#
#   scripts/check-all.sh
#
# Lint covers only files changed since the branch left origin/main, and fails only on new
# problems: the repo has ~459 old lint errors.
# check-ids.ts needs HUBSPOT_ACCESS_TOKEN in .env.local (bun loads it).
set -u
cd "$(dirname "$0")/.."
LOG_DIR="${LOG_DIR:-$(mktemp -d)}"
failed=0

check() {
  local name="$1"; shift
  if "$@" >"$LOG_DIR/$name.log" 2>&1; then
    echo "PASS  $name"
  else
    echo "FAIL  $name  (see $LOG_DIR/$name.log)"
    failed=1
  fi
}

base=$(git merge-base origin/main HEAD)
changed=$(git diff --name-only --diff-filter=d "$base" -- '*.ts' '*.tsx' '*.js' '*.mjs' | grep -v '^scripts/hubspot/data/')

# Fails only if a changed file has more lint problems than it had at the branch point.
lint_new() {
  local f now before bad=0
  for f in $changed; do
    now=$(bunx eslint "$f" | grep -cE '^ +[0-9]+:[0-9]+ ')
    before=$(git show "$base:$f" 2>/dev/null | bunx eslint --stdin --stdin-filename "$f" | grep -cE '^ +[0-9]+:[0-9]+ ')
    echo "$f: $before -> $now"
    [ "$now" -gt "$before" ] && bad=1
  done
  return $bad
}

check tests bun run test
check types bunx tsc --noEmit -p .
if [ -n "$changed" ]; then check lint lint_new; else echo "SKIP  lint  (no changed files)"; fi
check build bun run build
check hubspot-ids bun scripts/hubspot/check-ids.ts

exit $failed
