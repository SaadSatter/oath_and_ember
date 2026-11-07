# game-rules-audit: suite combined local-start and observation integration

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Session | Codex 01a17e49-e8f5-7150-8932-837cfe871fe3; implementer checkpoint, not independent review |
| Session URL | None. Local session; no shareable URL was created. |
| Skill SHA256 | 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756 |
| Revision | e1829af, initially clean; all four owner-approved commits are ancestors |
| Scope | Combined S2-local/S3-local and observation fixes; permitted offline verification only |

## Findings

| # | Severity | Source | File | Evidence and impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | Low | H/M | packages/agent/test/suite.test.ts | Static registry assertion still expects five IDs; isolated safe selection reproduces one failure, one pass, two skipped. Reset assertions assume every scenario starts at the shrine and only three start hashes exist. These expectations predate approved additive starts. | Owner explicitly permits test-only expectation correction. Add the two IDs and their declared areas/hash count. Do not change implementation, original scenario definitions or checkpoints. |
| 2 | Info | H/M | offline test selection | Five files construct or play held-out starts. Unfiltered npm test would violate the owner's held-out restriction. | Run every other offline test, then only permitted static suite and tuning freeze checks by name. Report excluded cases explicitly. |

## Checks performed

| Step | Result | Evidence / limitation |
| --- | --- | --- |
| 1 Server authority | Pass, scoped diff | Approved commits change evaluator-side observations and scenario preparation; no gameplay source changes. Prefix calls normal interface actions. |
| 2 Rules and art | Pass | No apps/server, apps/client, shared maps/mechanics, checkpoint or audio changes in approved implementation commits. |
| 3 Real mechanics | Pass | Existing goddess reset/opening plus ordinary movement and interaction; tests disclose fixtures separately. |
| 4 Player-visible observations | Pass, source review | Truncation for moving objects, neutral health/respawn notification, movement feedback; no source/amount added to defeat line. Local resets use the same observation interface. |
| 5 Legal actions | Pass, scoped diff | Validation and capabilities unchanged. |
| 6 Player context | Pass, scoped diff | Local briefing states approved start/objective and normal travel; S2 briefing text unchanged by local addition. |
| 7 Independent players | Pass, source review | Environment reset clears per-hero memory; harness makes separate policies and histories. |
| 8 One interface | Pass | Same environment and prefix for both providers; provider-labelled mocks test equal starts. Scripted baseline retains disclosed prior knowledge. |
| 9 Limits/accounting | Pass, source review | Local caps equal parents, shared ledger unchanged. Harness reservation key includes exact scenario ID; no network used here. |
| 10 Determinism | Validation in progress at pre-correction checkpoint | Existing local and selected historical tests running on combined commit. |
| 11 Suite/reporting | Finding 1 | Additive IDs documented in change log; no held-out case executed. |
| 12 Recording/synchronization | Unverified live video | Recorder path unchanged; no new recording or paid-model result claimed. |
| 13 Validation | In progress at pre-correction checkpoint | Node v24.19.0; typecheck/build and permitted suite launched; final results in integration report. |
| 14 Honest evidence/secrets | Pass, scope | Failures, scratch-probe assumptions, exclusions and remaining risks will be reported. Preserve historical canary evidence. |

## Sources and commands

Read AGENTS.md, CLAUDE.md, skills, rubric/requirements, recurring instructions, evidence index, handoff and local-start record; baseline/budget/route/interface/manual references previously read in this ongoing session and relevant sections refreshed. Read suite and local tests, independent-review regression tests, reset/tick/observation/movement/harness/ledger paths. `git status --short`: initially empty. `git log -6` and four `git merge-base --is-ancestor` checks: all approved commits present. Selected static suite test: one stale registry failure, one architecture pass, two held-out-capable cases skipped. Full permitted test/build/freeze results are deferred to the final integration report, not presumed here.

## Open questions

No additional approval required for the owner's explicitly authorized test-only corrections. Stop before editing implementation if a behavioral failure is found. No paid execution authorized. Audit phase ends before any test correction.
