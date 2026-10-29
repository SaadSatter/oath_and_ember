#!/usr/bin/env bash
# Deterministic checks for rubric 3c. No network, no model, no API key.
#
#   bash scripts/midterm/ci-checks.sh            # typecheck, all permitted tests, build
#   bash scripts/midterm/ci-checks.sh --tests    # tests only
#
# Run from the project root: the repository root here, or midterms/saadsatter/
# in the course repository.
#
# Five check kinds (see EVALUATION.md, "CI evidence"):
#   rule invariants       apps/server/test/*, packages/shared tests
#   legal/illegal actions packages/agent/test/environment.test.ts ("action validation")
#   terminal outcome      the quest baseline reaching success on S1-S3 (scriptedFreeze.test.ts)
#   observed regression   pilot6Fixes.test.ts (Slow Time false collision), budget.test.ts (failed calls counted)
#   episode limits        budget.test.ts, environment.test.ts ("termination"), reliability.test.ts
#
# Excluded, because they build or play the held-out S4/F starts (owner rule:
# no held-out content in tuning sessions; running them in CI is an open owner
# decision): the scripted full-quest route and its checkpoint freeze, the
# suite and final-access tests, and the route case of scriptedFreeze.
set -euo pipefail

HELD_OUT=(
  "packages/agent/test/route/fullQuest.test.ts"
  "packages/agent/test/route/checkpointFreeze.test.ts"
  "packages/agent/test/suite.test.ts"
  "packages/agent/test/finalAccess.test.ts"
  "packages/agent/test/scriptedFreeze.test.ts"
)
exclude=()
for f in "${HELD_OUT[@]}"; do exclude+=(--exclude "$f"); done

tests() {
  # Everything else, including the server rule tests and the agent interface tests.
  npx vitest run "${exclude[@]}" --maxWorkers="${VITEST_WORKERS:-2}"
  # The frozen scripted baselines on the tuning scenarios (terminal outcome), not the route.
  npx vitest run packages/agent/test/scriptedFreeze.test.ts -t "baseline on S[123]"
}

case "${1:-all}" in
  --tests) tests ;;
  all)
    npm run typecheck
    tests
    npm run build
    ;;
  *) echo "usage: $0 [--tests]" >&2; exit 2 ;;
esac
