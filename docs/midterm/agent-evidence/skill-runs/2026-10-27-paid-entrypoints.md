# game-rules-audit: paid entrypoints before first real evaluation

| Field | Value |
| --- | --- |
| Date | 2026-10-27 |
| Session | Codex `01a17e49-e8f5-7150-8932-837cfe871fe3` (same-session supplement) |
| Session URL | None. Local session; no shareable URL was created. |
| Skill file SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| Canonical commit | `6bee662`, branch `midterm/evaluation`, dirty evidence files on entry |
| Target | Known paid CLI paths and shared-ledger prerequisites; no provider calls or real-ledger initialization |

This is a scoped same-session audit, not independent review. The main-worktree guard was implemented before this read-only audit. No canonical gameplay, launcher, observation or policy source was edited. Existing review/skill findings were preserved.

## Findings

| # | Severity | Source | File / area | Evidence and impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | High readiness blocker | H/M | Canonical launch prerequisites | Worktree has three modified evidence/index files and two untracked evidence reports at entry; paid launcher refuses dirty trees. Real shared ledger and init marker absent. Configured Anthropic credential absent (presence boolean only). | Owner must review/preserve and commit intended evidence, authorize one-time ledger initialization, configure the credential and separately approve the smoke call. None done here. |
| 2 | Medium | H | Runtime | Checks ran under Node `v26.9.0`; package declares `>=24 <25`. Tests/typecheck pass, but the runtime is outside the declared supported range. | Use the declared Node 24 runtime before the first paid run. |
| 3 | Low | H | Secret scan of existing tests/report | 121 text files scanned; five findings in existing files: two each at `paidSafety.test.ts:40` and `liveView.test.ts:145` (explicit synthetic CANARY constants), one at existing `2026-10-27-recording.md:18` quoting a truncated fake-canary example. The report was inspected through the redactor; no credential printed. | Preserve existing findings. Resolve these scanner false positives in a separately scoped change if a clean broad scan is required; this task does not modify existing tests or skill reports. |
| 4 | Low | M | `packages/agent/src/repo.ts` | `unmeteredWorktrees()` checks legacy `scripts/midterm/run-episode.ts`, not the archived `scripts/evaluation/run-shrine.ts`. Manual cross-worktree source inventory covered that gap here. | Treat detector output as a scoped warning, not an exhaustive security inventory; consider extending it separately. |

## Checks performed

| Step | Result | Scope / evidence |
| --- | --- | --- |
| 1 Server authority | Pass in changed scope | Only six guard lines added to untracked main-worktree `run-shrine.ts`; no game code changed. |
| 2 Rules/art preservation | Pass | No canonical source changes under apps/shared/assets; no main gameplay edits by this task. Pre-existing main changes untouched. |
| 3 Real mechanics / fixtures | Pass in changed scope | No evaluation or route executed. Tests use scratch ledgers/repos and S1 mocks or guard rejection; no actual shared ledger initialized. |
| 4 Per-hero observations | Preserved | No schema/perception changes. Existing model/mock tests passed. |
| 5 Legal-action information | Preserved | No action/validation changes. |
| 6 Player context solutions | Preserved | No prompts/manual/knowledge changed. |
| 7 Independent players | Pass offline | Existing mock model and policy-isolation checks included. |
| 8 One interface | Pass in canonical CLI scope | `evaluate.ts` and `live.ts` use `runSuite`, metered hero gateways and `SpendLedger.openCanonical(repo)`. Legacy `run-episode.ts` refuses paid policies before constructing gateways. |
| 9 Limits and accounting | Pass offline | Shared-ledger, recovery, concurrent budget and failure tests passed. Inventory: $25 total; smoke $0.10, pilot $8, final $15, contingency $1.90. Smoke retains one call, $0.01 reservation, 4,000 output maximum, 30 s timeout and no SDK retries. |
| 10 Determinism / starts | Pass in tested scope | Existing S1 mock/harness tests passed; no S4/F reset or outcome inspection. |
| 11 Suite and reporting | Pass in changed scope | No frozen definitions, seeds, limits or held-out outputs changed/read. Only safety tests selected; no suite/full-route/checkpoint-freeze tests run. |
| 12 Sync/recording | N/A | No browser gameplay or recording run. Baseline/replay argument handling checked without executing gameplay. |
| 13 Validation | Pass offline, runtime caveat | 74 tests/7 files and typecheck pass. Build/full gameplay suite unnecessary for a guard-only source change and not run. |
| 14 Evidence/secrets | Evidence preserved; scanner finding #3 | All 53 pre-existing evidence/session/skill/review/artifact files match their initial SHA256s. Existing five dirty canonical paths untouched. Broad scan result is five findings, not zero. New artifacts scanned separately. |

## Paid entrypoint inventory

- Main `scripts/evaluation/run-shrine.ts`: `--mode model` now throws before replay reads, output creation, credential handling or worker creation. Default/baseline/replay source remains unchanged. The original archived OpenAI/worker implementations remain as historical source; they are not the canonical execution path and were not edited.
- Canonical `scripts/midterm/evaluate.ts`: smoke and model modes require the shared Git-common-directory ledger, approved model/effort, clean code worktree and configured credential. Ledger override flags refused. Final runs require separate recorded approval.
- Canonical `scripts/midterm/live.ts`: paid mode checks the same allowlist, opens/reopens the same canonical ledger and dispatches through the harness. S4/F rejected. Mock mode uses scratch state.
- Canonical `scripts/midterm/run-episode.ts`: paid policies rejected by `requireLedgerEntrypoint`.
- Other four-worktree inventory: the agent-interface legacy paid runner is already guarded; the detached worktree scan found no such launcher. Current built-in `unmeteredWorktrees()` returns an empty list. Low-level historical adapters are preserved, not presented as approved paid launchers.

## Model and effort allowlist

`APPROVED_MODELS` is exactly `claude-haiku-5-5: [medium, low]`, checked in `AnthropicGateway` as well as launchers. The generic parser accepts a `high` enum but the approval validator rejects it. Smoke is explicitly restricted to `claude-haiku-5-5` at `medium`; `low` is not accepted for smoke. Other price-table entries do not grant model approval. No provider request was made to establish live availability.

## Commands and actual results

- Main guard execution: `node --import tsx scripts/evaluation/run-shrine.ts --mode model`: expected exit 1 with the explicit unmetered-paid-path-disabled error, before output/worker creation.
- TypeScript-transpiled argument-header test in an isolated VM: baseline/replay accepted; model rejected. Full current source minus the six inserted lines equals the saved original byte-for-byte.
- Main original SHA256: `21540269ab2c3097144d014b216f7b02949a6c8aeb6201f889610a915adc3103`; guarded: `d1f438ea45fc1514514e8939dd101085f602ae6fcde1f91290a2f4ddaf902389`. It remains untracked; nothing deleted, cleaned, staged or committed.
- `node --import tsx scripts/midterm/ledger.ts status`: read-only inventory, marker uninitialized; no canonical/legacy ledger or locks in any of four worktrees; zero unmetered legacy-runner warnings. Confirmed actual `.git/oath-eval` directory remains absent afterward.
- `npx vitest run packages/agent/test/paidSafety.test.ts packages/agent/test/ledgerCanonical.test.ts packages/agent/test/ledgerRecovery.test.ts packages/agent/test/ledger.test.ts packages/agent/test/budget.test.ts packages/agent/test/modelPlayers.test.ts packages/agent/test/harness.test.ts`: **74/74 tests**, **7 files**, exit 0. Test-only ledger initialization uses throwaway repositories/directories, not the real shared ledger.
- `npm run typecheck`: exit 0.
- `node --version`: `v26.9.0`; declared engine `>=24 <25`.
- Broad secret scanner: **121 files, 5 findings** described above. A diagnostic assertion initially failed because the existing report quotes a truncated rather than complete canary; redacted inspection established its actual content. No secret was printed or changed.
- Git checks and source inventory were read-only. Existing modified paths: `docs/agent-sessions/README.md`, `docs/midterm/EVIDENCE_INDEX.md`, `scripts/evidence/sessions.json`. Existing untracked paths: `docs/agent-sessions/29-claude-phase4-review-and-fixes.md`, `docs/midterm/agent-evidence/skill-runs/2026-10-27-recording.md`.

## Readiness and next approval

**Not ready to dispatch a paid smoke call yet.** The paid-path guards and offline safety tests pass; clean-tree evidence review/commit, one-time real-ledger initialization and a configured credential remain prerequisites. Align Node with the declared runtime. This report and the new session supplement also remain uncommitted. No cleanup or automatic commit of another session's evidence was attempted.

No real-ledger initialization, API call, S4/F execution, gameplay change, push or merge. Stop for the owner's approval before proceeding.
