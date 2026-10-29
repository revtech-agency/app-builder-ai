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

base=$(git merge-base origin/main HEAD 2>/dev/null) || base=""
changed=""
[ -n "$base" ] && changed=$(git diff --name-only --diff-filter=d "$base" -- '*.ts' '*.tsx' '*.js' '*.mjs' | grep -v '^scripts/hubspot/data/')

# Counts eslint problems in its output; an eslint crash (exit 2) fails instead of counting 0.
count_problems() {
  local out rc
  out=$("$@"); rc=$?
  [ $rc -ge 2 ] && { echo "eslint crashed (exit $rc) on: $*" >&2; return 1; }
  printf '%s\n' "$out" | grep -cE '^ +[0-9]+:[0-9]+ '
  return 0
}

# Fails only if a changed file has more lint problems than it had at the branch point.
lint_new() {
  local f now before bad=0
  while IFS= read -r f; do
    now=$(count_problems bunx eslint "$f") || return 1
    if git cat-file -e "$base:$f" 2>/dev/null; then
      before=$(git show "$base:$f" | count_problems bunx eslint --stdin --stdin-filename "$f") || return 1
    else
      before=0
    fi
    echo "$f: $before -> $now"
    [ "$now" -gt "$before" ] && bad=1
  done <<< "$changed"
  return $bad
}

check tests bun run test
check types bunx tsc --noEmit -p .
if [ -z "$base" ]; then
  echo "FAIL  lint  (no merge base with origin/main: run git fetch origin)"
  failed=1
elif [ -n "$changed" ]; then
  check lint lint_new
else
  echo "SKIP  lint  (no changed files)"
fi
check build bun run build
check hubspot-ids bun scripts/hubspot/check-ids.ts

exit $failed
