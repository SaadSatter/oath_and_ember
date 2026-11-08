# game-rules-audit: packages/agent Phase 4 smoke readiness

| Field | Value |
| --- | --- |
| Date | 2026-10-27 |
| Session | Codex `01a17e49-e8f5-7150-8932-837cfe871fe3` |
| Session URL | None. Local session; no shareable URL was created. |
| Skill file SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| Commit audited | `b51c1c0` plus uncommitted Phase 4 changes, branch `midterm/evaluation` |
| Target | `packages/agent/`, budget/ledger, harness/resume, mock observation-only comparison and CLI guards |
| Files read | Existing project instructions and midterm references from the handoff; `ledger.ts`, `budget.ts`, `runner.ts`, `harness.ts`, `policies/llm.ts`, relevant tests, `scripts/midterm/{evaluate,run-episode}.ts`; existing observation/action contract reused |

Same-session implementation checkpoint using the actual skill procedure, not an independent review or a fresh Claude skill session. Implementation was paused for this audit; this report is its only output. It does not revise earlier skill findings.

## Findings

| # | Severity | Source | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Info | M | Ledger and metered gateways | Offline tests prove reservation/exhaustion behavior with fake responses, including unknown usage. Live billing has not been observed. | Real billing depends on the provider honoring the dated price schedule and token maximum. | Use exactly the approved one-call smoke stage next; verify returned model id, cache fields, usage, cost and truncation. |
| 2 | Info | H/M | Ledger recovery and harness resume | Crash-left lock blocks all new opens; recovery test confirms owner process is dead before removing that lock. Open reservation remains charged. | Deliberate conservative holds may prevent a resume despite unspent money. | Preserve the canonical ledger. Remove a stale lock only after verifying its PID is dead; do not reclaim unknown spend without evidence. Resume restarts interrupted episodes, not in-memory model/game state. |
| 3 | Info | M | Frozen suite and baseline | S4/F execution tests excluded. Quest baseline static knowledge remains disclosed in the original plan. | Holdout status is preserved for this readiness work; baseline knowledge asymmetry remains. | Keep final evaluation separately approved and distinguish static knowledge from held-out execution. |

## Checks performed

| Step | Result | Evidence / scope |
| --- | --- | --- |
| 1 Authority | Pass in changed scope | No changes under server, shared gameplay or client code. Policies submit ordinary intent. |
| 2 Rules/art | Pass | `git diff --name-only -- apps packages/shared Images` empty. |
| 3 Real mechanics | Pass in changed scope | Existing environment and suite reused. New tests execute S1/milestone only; synthetic choice and accounting fixtures explicitly labelled. No injected evaluation progress. |
| 4 Observations | Pass offline | Existing schema/filter unchanged. Synthetic private-choice/hidden-flag canaries never appear in mock prompts; payload equals own `observe` and `legal_actions` outputs. |
| 5 Legal leakage | Pass in changed scope | Existing validation unchanged; model gets only own legal actions. |
| 6 No solution context | Pass in changed scope | No prompt solutions added; manual plus current own observation/legal set only in observation-only mode. |
| 7 Independence | Pass offline | Separate model instances, notes and per-hero meters. Mock tests exclude partner choices, ids and private previous-turn data. |
| 8 Same interface | Pass with disclosure | Both baselines/model variants reuse runner and five operations. Scripted baseline's static knowledge remains disclosed. |
| 9 Limits/accounting | Pass offline | Cross-process exclusivity; concurrent hero reservations; unknown/malformed usage; $25 global exhaustion across restart; finite caps; aborts; no double settlement. Legacy paid entrypoint and alternate CLI ledgers blocked before provider access. |
| 10 Reproducibility | Pass offline | Two S1 mock runs reproduce semantic actions/observations/results and raw end hashes. Wall measurements/hash-chain bytes are intentionally not identical. Completed resumes verify configuration and trace integrity before skipping dispatch. |
| 11 Suite/reporting | Pass offline | Suite definitions unchanged. Incremental per-episode results include actions, invalids, calls, usage/cache, spend, ticks, wall time, messages, limits and reasons. Prior interrupted attempts remain in reports and on disk. |
| 12 Sync/recording | N/A recording | No recording created or claimed. Existing socket tests included in non-held-out suite. |
| 13 Validation | Pass with explicit exclusions | Commands/results below. |
| 14 Honest evidence/secrets | Pass in scanned scope | No paid outcomes claimed. Pre-documentation secret scan: 99 files, 0 findings. Final docs are rescanned separately. |

## Commands and actual results

- `npm run typecheck`: exit 0 after final infrastructure edits.
- `npm test -- --exclude packages/agent/test/suite.test.ts --exclude packages/agent/test/route/fullQuest.test.ts`: **676/676 tests**, **88 files**, exit 0. Earlier readiness run: 675 tests passed before the last guard test was added. The two exclusions execute held-out S4/F and are intentionally unverified in this turn.
- `npx vitest run packages/agent/test/ledger.test.ts packages/agent/test/budget.test.ts packages/agent/test/modelPlayers.test.ts packages/agent/test/harness.test.ts`: **48/48 tests**, 4 files, exit 0 after final smoke error-path edit.
- `npm run build`: exit 0; existing Vite bundle-size warning only.
- `python3 -I scripts/evidence/scan_secrets.py docs/agent-sessions docs/midterm packages/agent scripts/midterm AGENTS.md scripts/evidence/sessions.json`: 99 text files, 0 findings before this report.
- `git diff --check`: exit 0. `git rev-parse --short HEAD`: `b51c1c0`. Skill SHA256 in metadata.

## Recommended next check / open questions

Infrastructure is ready for an explicitly approved small paid smoke test: one call, configured `claude-haiku-5-5`, effort `medium`, 4,000 maximum output tokens including thinking, $0.01 reservation, $0.10 smoke-stage and $25 global caps. No paid call, held-out execution, push or merge was made. Provider/account access remains unverified. Existing independent review and final evaluation requirements remain separate.

Two proposed fixture-writing commands were rejected by automatic approval review for possible held-out content access. They did not execute. A wholly independent synthetic fixture was accepted and passed; no blocked operation remains and no approval was sought to weaken the holdout.
