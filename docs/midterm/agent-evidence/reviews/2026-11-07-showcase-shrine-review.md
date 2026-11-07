# Read-only review: shrine-start continuous showcase

**Provenance:** Reviewer subagent `/root/shrine_review`, launched from the implementing Codex session. I did not implement these changes. This is a separate reviewer invocation within that session, not an independent top-level session. Review date: 2026-11-07.

**Scope:** Working diff against `cee07132ea8aedd4c676616ef4dc249aa12ce3e5`, inspected while dirty. Applied `.agents/skills/oath-rule-information-boundary/SKILL.md`, SHA-256 `553399eafd554c3b9062efa8b9d1fd9080c99bfadb151cb817ea40b77437fb21`. No files edited, policies operated, paid calls made, or tests executed by this reviewer.

## Findings

1. **Major — success does not yet enforce combat after the maze and subsequent Griffin entry.**  
   `packages/agent/src/evaluator.ts:242–243` requires presence of five history markers but checks no event ordering. `showcaseMilestones()` at lines 257–262 records combat defeat and Wig acquisition unconditionally. `packages/agent/src/environment.ts:875–879` sequences selected visits, but does not require combat to happen after the post-maze Griffin entry.

   A code-derived counterexample is: read quest → visit Griffin and defeat it → return and complete maze → return shrine → enter Griffin again → collect Wig → return and finish. All current required markers and final-state conditions could be satisfied, despite violating the requested quest order. I did not execute this alternate policy.

   **Recommendation:** Enforce the complete ordered history, using first-occurrence ticks or explicit phase transitions. Prevent pre-maze combat defeat from being retrospectively accepted after a later Griffin visit. Add a negative regression test for early defeat followed by the otherwise valid remaining history.

2. **Low — stale source comments describe the superseded maze start.**  
   `packages/agent/src/showcase.ts:5–7` still describes the Hedge Maze entrance and S2-A prefix. The header in `packages/agent/src/policies/showcaseRoute.ts` omits the new opening phase, and the comment above `SHRINE_START` in `packages/agent/test/showcase.test.ts` still references S2-A.

   **Recommendation:** Update these explanatory comments. The implemented reset, showcase object and guidance already describe the shrine correctly.

## Verified observations

- Showcase reset uses the existing default `goddess` checkpoint; a showcase prefix is explicitly rejected in `environment.ts:325–326`. No new fixture or state injection appears in the diff.
- Opening quest evidence uses the normal `chapter0.goddess-meet` flag. Existing story code starts that scene at the shrine and attaches the flag to its completion.
- The new scripted opening reads visible dialogue and legal actions, then searches remembered observations for the labelled maze exit. Its one-second dialogue waits are ordinary game actions and a disclosed baseline presentation choice.
- Evaluator history is separate from policy observations. No changes to perception, action validation or centralized planner implementation appear in the reviewed diff.
- Paid protection is restored: `SHOWCASE_PAID_APPROVED = false`; showcase guidance is `proposed` without an approved hash.
- The protected-path diff against `cee0713` is empty for `apps`, `packages/shared`, `manual`, `Images`, official evaluation documentation and frozen trace paths.
- Centralized control of both heroes and intended quest-order guidance are owner-authorized; legacy independent-player wording is not treated as a blocker.

## Actual evidence inspected

The **free scripted development baseline**, not a live model run, reports success at tick **10,166**, **169.4 game seconds**, zero model calls and zero knockouts.

Its actual trace records this order:

| Event | Tick |
|---|---:|
| Opening quest received | 1,486 |
| Maze entered | 1,666 |
| Shears acquired | 3,556 |
| Shrine return | 4,006 |
| Griffin entered | 4,776 |
| Combat defeat | 6,777 |
| Wig acquired | 9,342 |
| Shrine return with Wig | 9,518 |
| Offering accepted | 9,985 |
| Chapter 0 complete | 10,166 |

Evidence inspected: `/tmp/oath-showcase-shrine/baseline-final-dev/showcase-maze-griffin-complete-v1-seed0/{trace.jsonl,summary.json}`.

The positive baseline follows the intended sequence; it does not resolve finding 1. The existing test log reports **16 passed tests in two files**; these tests were run by the implementing session, not this reviewer.

## Limitations and remaining checks

The revised replay video and final committed free-evidence package were not available when inspected. Consequently, opening-scene visibility, normal-speed playback, final exact replay, current ledger balance and final clean-commit provenance remain unverified by this reviewer. No paid-model behavior or revised end-to-end model recovery has been demonstrated.

Resolve the major ordering finding, rerun the relevant free checks, inspect the actual opening video, preserve final hashes and obtain the owner’s new exact-hash approval before unlocking paid execution.
