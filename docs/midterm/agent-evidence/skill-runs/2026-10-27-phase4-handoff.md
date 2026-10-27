# game-rules-audit: packages/agent Phase 4 checkpoint

| Field | Value |
| --- | --- |
| Date | 2026-10-27 |
| Session | Codex `01a17e49-e8f5-7150-8932-837cfe871fe3` |
| Session URL | None. Local session; no shareable URL was created. |
| Skill file SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| Commit audited | `b51c1c0`, dirty working tree on `midterm/evaluation` |
| Target and focus | `packages/agent/`: inherited Phase 4 policies, harness and ledger after two ledger fixes |
| Files read | `AGENTS.md`, `CLAUDE.md`, requested midterm documents including the frozen suite, player manual, `packages/agent/src/{types,environment,perception,actions,runner,batch,budget,ledger,harness,suite,evaluator,trace,runtime}.ts`, policies, route director and route changes, Phase 4 tests, suite and full-route tests, session index and S23 evidence, existing Codex reviewer instructions |

This is a same-session implementation checkpoint using the named skill, **not an independent review**, not a fresh Claude skill session, and not live-model evidence. Implementation paused for this audit; the only audit output is this report. The two ledger defects described in the handoff were fixed before this audit.

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Info | M | `policies/questKnowledge.ts`, `BASELINE_PLAN.md` | Explicitly disclose route-derived waypoints and mirror angles, including knowledge from S4/F route development | Baseline knowledge is asymmetric with the model; held-out execution does not mean held-out static knowledge | Retain this disclosure alongside final comparison results |
| 2 | Info | M | `policies/llm.ts`, `EVALUATION_SUITE.md` | Observation-only mode removes policy notes/history; the unchanged observation still includes messages, recent feedback and explored outline | It measures removal of policy-managed memory, while retaining screen-provided history | Describe this distinction in the final report |
| 3 | Info | H/M | `MODEL_BUDGET.md`, `scripts/midterm/evaluate.ts` | Inherited price table and model availability were not verified online in this session; CLI has a `--paid` guard | Offline checks cannot validate provider availability or authorize expenditure | Reverify prices and obtain owner authorization before any paid stage; register final player configuration before final evaluation |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass within changed scope | Baselines return intent; harness uses the existing environment and runner. No game-state writes were added. Full server re-audit outside this checkpoint scope. |
| 2 Rules and art preserved | Pass | `git diff --name-only -- apps packages/shared Images` returned no files. Observation and scenario sources unchanged. |
| 3 Real mechanics, no fixtures | Pass | Existing checkpoint replay through the five operations reused. Quest baseline has no engine, suite or route runtime import; architecture test passes. |
| 4 Player-visible observations | Pass within changed scope | `types.ts`, `perception.ts`, and `environment.ts` read; existing per-hero contract retained. No schema/filter changes. Existing perception tests pass; no new browser parity observation was performed. |
| 5 Legal-action leakage | Pass within changed scope | Existing `actions.ts` reused without changes; no scenario-specific action hints introduced. |
| 6 No solution in model context | Pass within changed scope | Model prompts contain instructions/manual plus own observation and legal set; static quest knowledge is confined to disclosed scripted baseline/route modules. |
| 7 Independent players | Pass | One policy/context per hero. Generator context holds only own observation and heard messages; separate metered clients for model heroes. |
| 8 One interface | Pass with disclosure #1 | Both baselines and model modes use the same runner/environment; knowledge/compute asymmetry disclosed. |
| 9 Limits and terminal reasons | Pass offline | Budget/runner/harness tests passed, including failed-call accounting and unknown usage. Ledger reserves before dispatch; open reservations survive restart. Malformed ledger validation and fresh-directory regressions added and passed. |
| 10 Determinism and identical starts | Pass offline | Existing deterministic route/suite tests pass. Quest baseline determinism test passes. S2 and S3 have identical hashes for each tuning seed; hashes differ across seeds as expected from seeded ids/room code. No live baseline/model pair yet. |
| 11 Suite and reporting | Pass offline; final results unverified | Freeze commit `0c45f82` precedes Phase 4 work. Only S1–S3 seeds 0/1 run with quest baseline; all six pass. S4/F quest/model execution untouched. Existing route feasibility tests traverse the route and checkpoint reconstruction. |
| 12 Synchronization and recording honesty | N/A for recording; tests pass | No recording created or claimed. Existing real-socket/server tests included in full suite; no manual two-browser check this session. |
| 13 Validation | Pass | Commands/results below. |
| 14 No overclaiming or secrets | Pass within scanned scope | Results distinguish inherited code, implementation changes, tuning baseline trials, test fixtures and absent live results. Secret scanner initially reported 96 text files, 0 findings; report and final evidence rescanned afterwards. |

## Commands run and results

- `npm run typecheck`: exit 0, including after ledger fixes.
- `npx vitest run packages/agent/test/harness.test.ts packages/agent/test/questBaseline.test.ts packages/agent/test/modelPlayers.test.ts packages/agent/test/ledger.test.ts`: 4 files, 25 tests passed before ledger fixes.
- `npx vitest run packages/agent/test/ledger.test.ts`: 9 tests passed after fixes.
- `npm test`: 90 files / 667 tests passed before fixes; final run 90 files / **669 tests passed**.
- `npm run build`: first sandbox attempt failed because Vite could not write its temporary config in the sibling worktree. Rerun with write access passed; final post-fix run also exit 0. Vite reports its bundle-size warning.
- `node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S1,S2,S3 --seeds tuning --out evaluation-runs/codex-handoff-quest-tuning`: exit 0; six successes, zero invalid actions, zero model calls/spend. Per-seed game time: S1 4.8 s, S2 146.4 s, S3 52.9 s. Traces hash-verified by harness.
- `python3 -I scripts/evidence/scan_secrets.py docs/agent-sessions docs/midterm packages/agent scripts/midterm AGENTS.md scripts/evidence/sessions.json`: exit 0, 96 text files, 0 findings before final documentation.
- `shasum -a 256 .claude/skills/game-rules-audit/SKILL.md`: hash in metadata.
- `git log -4 --oneline`, `git status --short`, relevant `git diff`: verified branch/base and changed scope.

## Recommended tests

Before paid runs, perform the approved one-call metered smoke stage and compare returned model/cache/usage against freshly checked official pricing. Before publication, arrange fresh independent reviews and the normal-speed recording audit. Neither is replaced by this checkpoint.

## Open questions for the owner

No approval is requested for these completed offline changes. Paid stages, final held-out evaluation and publication remain gated by the owner's instructions. No paid API call, push, merge or held-out scenario change occurred here.
