# Phase 4 handoff (2026-10-27)

Worktree: `oath_and_ember-eval`, branch `midterm/evaluation`, base commit `b51c1c0`.


## Agent-interface reliability pass (2026-10-27, Claude Code S31)

Owner-approved fixes from the first real-LLM S1 run (code `4193424`), committed as `5c3de48`. See `AGENT_INTERFACE.md`, "Reliability pass", and session record S31. The five operations, observation boundaries, rules, scenarios and success conditions are unchanged. The original S1 trace, results and ledger are untouched.

**Next step needs owner approval:** another real-LLM run. Recommended first: `game-rules-audit adapter` and an independent `rules-reviewer` pass on `5c3de48`. The first paid call will be the first time structured output (`output_config.format`) meets the real API. If the API rejects the schema, `AnthropicGateway(..., structured = false)` turns it off, and replies are still validated by `parseReply()`.

**Uncommitted, not from S31:** recording work from a parallel session (`recorder.ts`, `recorder.test.ts`, `scripts/midterm/live.ts`, `LIVE_RUN.md`, `.gitignore`, and a `ready` hook in `environment.ts`/`harness.ts`) remains in the working tree, unstaged.

## Evidence finalized and Node 24 verification (2026-10-27)

The owner authorized completion of the remaining offline preparation and local evidence/documentation commits only. Pending session 29, session 30 and the recording/paid-entrypoint audit reports are preserved; no evidence was deleted to clean Git. The existing session-evidence extractor, redactor and renderer were used, and session 30 is explicitly registered as a supplement to the same session as 28, not a new independent review.

**Runtime:** bundled Node `v24.19.0`, satisfying `>=24 <25`. For subsequent local commands, select it explicitly:

```sh
export PATH="/Users/saadsatter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --version
```

**Actual checks under Node 24:** `npx vitest run packages/agent/test/paidSafety.test.ts packages/agent/test/ledgerCanonical.test.ts packages/agent/test/ledgerRecovery.test.ts packages/agent/test/ledger.test.ts packages/agent/test/budget.test.ts packages/agent/test/modelPlayers.test.ts packages/agent/test/harness.test.ts` passed **74 tests / 7 files**. `npm run typecheck` and `npm run build` passed (Vite bundle-size warning only). S4/F, full-route and checkpoint-freeze tests were not run. All test ledger initialization was confined to scratch directories/repositories.

**Secret scanning:** the broad scanner still reports the same five known matches. Exact-match verification establishes four findings in two explicit synthetic CANARY constants and one in a truncated fake-canary quotation in the historical recording audit. There are no unexpected matches. The original scanner/redactor and global rules remain unchanged. The proof file, `evidence/phase4/synthetic-canary-verification-2026-10-27.json`, records locations, reasons and SHA256 fingerprints without credential-shaped matched text. Historical audit reports remain byte-for-byte intact; their old findings are not rewritten.

**Paid entrypoints:** `evaluate.ts` and paid `live.ts` both use `SpendLedger.openCanonical(repo)` at the Git common directory, not a per-worktree ledger. Canonical and agent-interface legacy paid runners refuse paid policies; main's untracked `scripts/evaluation/run-shrine.ts` retains the earlier model-mode guard and is outside this documentation-only commit. No main-worktree file is staged here. Allowlist remains `claude-haiku-5-5` medium/low; smoke is medium only.

**Read-only real ledger inventory:** canonical ledger, permanent init marker and lock absent; legacy ledgers and locks absent in all four worktrees; `unmeteredWorktrees: []`. The actual `.git/oath-eval` directory remains absent. No ledger initialized, adopted, reconciled or modified.

**Readiness:** evidence/runtime/safety preparation is complete after the local documentation commit and clean-tree verification. Dispatch still requires separately approved one-time ledger initialization and a configured credential (currently absent), followed by paid-smoke approval. Provider authentication and billing are untested. The future smoke configuration is unchanged: exact `claude-haiku-5-5`, medium effort, 4,000 output-token maximum including thinking, 30 s timeout, one attempt, $0.01 reservation, $0.10 smoke-stage and $25 global caps.

No paid/provider API request, S4/F execution, gameplay/source change, push or merge occurred. The final documentation-only commit hash and Git status are reported to the owner after commit. Code validated: `6bee662`; all pending changes in the commit are evidence/documentation and its session plan.

## Re-review fixes (2026-10-27, Claude Code)

The owner asked for the independent re-review's confirmed findings to be fixed before any paid evaluation. Local commits only: no paid call, no ledger initialization, no S4/F episode, no push, merge or PR. No other worktree was modified.

| Finding | Commit | Fix |
| --- | --- | --- |
| H2-a forgeable, reusable grants; player kind ignored | `37f4c66` | Grants, tickets and route access need a module-private token. `claim()` returns a single-use `EpisodeTicket` (claimed → bound → used → finished, state held privately). `runEpisode` binds it only to policies of the approved exact class (`policies/kind.ts`) |
| H2-b gate only in `runEpisode` | `37f4c66` | `AgentEnvironment.reset()` runs `admitReset()` before anything exists. Held-out or final-seed resets need a bound ticket (used up) or explicit `routeDevelopmentAccess(purpose)`, which `runEpisode` refuses and which allows reset only at final seeds |
| M5 held-out test policy | `37f4c66`, docs | Route, suite and checkpoint tests take named route access. `npm test` may build held-out start states (reset only at final seeds). `suite.test.ts` and `route/fullQuest.test.ts` stay excluded. See `LIVE_RUN.md` |
| M1 ledger deletion restored $25 | `c6761a7` | Permanent init marker with the ledger id; missing or replaced ledgers refused; init runs once; adoption checked in memory |
| M4 no recovery for interrupted reservations | `c6761a7` | Traced `ledger_reservation` and `model_call_start`; `reconcile()` plus `ledger.ts open / unlock / reconcile` with typed confirmation; calls started without a record are charged their whole hold |
| H1-a unmetered runner in `oath_and_ember-agent` | `c6761a7` (warning only) | Read-only detection in the inventory and paid entrypoints. **Fix awaits the owner's choice** (below) |
| M2 any priced model or effort | `f5cf5cf` | `APPROVED_MODELS` enforced by `AnthropicGateway`; smoke only `claude-haiku-5-5` at `medium` |
| M3 stale lock during launcher startup | `f5cf5cf` | Handlers first; ledger checked then closed before the prompt and build, reopened before the run; exit handler always releases the lock |
| L1–L4 | `f5cf5cf` | `safeText` for terminal lines; explicit key, fixed endpoint, stdout/stderr redaction; `launch`, `wallLimitSeconds`, `episodeCapUsd`, `finalClaim` in summaries; per-hero mock streams |
| Test robustness | `8837f88` | Stale-lock test polls for the child's lock |

Edited existing tests (needed by the gate and trace changes): `finalAccess.test.ts` (rewritten), `checkpointFreeze.test.ts`, `ledgerCanonical.test.ts` (refusal wording), `harness.test.ts` (smoke trace lines), `suite.test.ts` and `route/fullQuest.test.ts` (route access; `suite.test.ts`'s stepping S4 case moved from seed 101 to 1). The last two were **not run** (held-out policy). New tests: `ledgerRecovery.test.ts`, `paidSafety.test.ts`.

Validation after the final code commit: `npm run typecheck` pass. `npm test -- --exclude packages/agent/test/suite.test.ts --exclude packages/agent/test/route/fullQuest.test.ts`: **730 tests / 94 files passed**. This includes `checkpointFreeze.test.ts`, which resets S4 at seeds 0, 1, 100 and 101 under route access; the pinned hashes still match. `npm run build` pass (Vite chunk-size warning only). `git diff --check` pass. The real `.git/oath-eval/` still does not exist.

**H1-a options (owner decision; nothing done):**
1. Commit a guard on `midterm/agent-interface` in that worktree so its `run-episode.ts` refuses paid policies, as this branch's does (recommended if that worktree is still in use).
2. Remove the worktree with `git worktree remove` after checking it is clean and its branch is preserved. This worktree's `node_modules` is a symlink into it, so this needs a local `npm ci` first.
3. Procedure only: rely on the warning and never run paid commands there.

Remaining risks: in-process code can still deliberately bind a real ticket and drive other policies (needs a recorded approval; leaves a claim). Deleting both the ledger and its marker allows re-initialization. Register truncation is not detected by the chain. The clean-tree check ignores gitignored files (`node_modules`). Provider behaviour and billing are untested until the smoke call.

## Review H1–H3 fixes and the live launcher (2026-10-27, Claude Code)

The owner approved the launcher architecture and gave the independent review's H1–H3 findings. Local commits only: no paid call, no ledger initialization, no S4/F evaluation, no push, merge or PR. **The earlier one-call smoke approval is not renewed**; the owner will approve a new smoke call separately.

| Finding / feature | Commit | What changed |
| --- | --- | --- |
| H1: per-worktree ledgers | `bc377ee`, `5f9074f` | One ledger in the git common directory (`repo.ts`, `SpendLedger.openCanonical` / `initCanonical`). It is never created implicitly. Legacy ledgers are inventoried and must be adopted explicitly. Git checks use the code's own worktree. `scripts/midterm/ledger.ts` for inventory and one-time init |
| H3: mutable baseline knowledge in the S4 checkpoint | `d701242` | `route/routeConstants.ts`: a deep-frozen copy of the route's constants. S2/S4 start hashes are pinned for seeds 0, 1, 100, 101 (reset only) |
| H2: held-out access | `ab7ae51` | Owner approval tied to a full commit hash and a clean tree, recorded by `final-approve.ts` in a hash-chained register. Episodes are claimed once per approval. `runEpisode` refuses held-out and final-seed episodes without a claimed grant, whatever the entrypoint |
| Live launcher | `aea9570` | `npm run eval:live` (`scripts/midterm/live.ts`, `liveViewer.ts`, `mockGateway.ts`, environment room/tick/pace hooks). See `LIVE_RUN.md` |

Read-only ledger inventory on 2026-10-27: no canonical ledger and no legacy ledger in any of the four worktrees. Nothing was created.

Validation after the final code commit: `npm run typecheck` pass. `npm test -- --exclude packages/agent/test/suite.test.ts --exclude packages/agent/test/route/fullQuest.test.ts`: **706 tests / 92 files passed** (the same two held-out route files excluded as before). `npm run build` pass, with the Vite chunk-size warning only. `git diff --check` pass. Manual offline launcher runs: baseline-quest S1 seed 0, headless and watched, both succeed at 4.8 s with end hash `7e22d17e…`. Baseline-quest S2 seed 0, watched in a headless browser screenshot and headless, both succeed at 146.4 s with end hash `3119923352c08724…`.

Next steps for the owner: an independent review of these commits; initializing the shared ledger (`node --import tsx scripts/midterm/ledger.ts init`); then a separately approved smoke call.



## Authorized one-call smoke preflight: blocked before dispatch (2026-10-27)

The owner approved exactly one `claude-haiku-5-5` smoke call at medium effort, 4,000 maximum output tokens including thinking, 30 s timeout, $0.01 call reservation, $0.10 smoke-stage cap and $25 global cap. No retries, model switches, budget increases, pilots or S4/F evaluations were authorized.

Preflight at clean commit `c6be0f2` found that the configured `ANTHROPIC_API_KEY` environment variable is absent. Only its presence was checked; no credential value was printed/logged or searched for elsewhere. [Provider documentation](https://platform.claude.com/docs/en/models/haiku-5-5/overview) lists the exact identifier, but authenticated model acceptance and account access **could not be verified**. The canonical `evaluation-runs/spend-ledger.json` and its lock do not exist; no ledger was created or modified because dispatch prerequisites failed.

**Zero paid calls dispatched.** Authentication and model request success are untested; no agent response, token/cache/thinking usage, refusal or truncation exists to assess. Spend is **$0**. No reservation or settlement occurred, and no model trace or smoke summary was written. The evidence file `evidence/phase4/smoke-preflight-2026-10-27.json` is explicitly a preflight record, not a model-run trace or result. Existing evidence is preserved.

Next prerequisite: the owner configures the credential in the canonical runner's environment without pasting it into chat. Then perform an authenticated read-only model lookup, validate/create the canonical ledger through `SpendLedger`, and dispatch only the one approved smoke call. This preflight did not consume that call authorization. Stop here; do not run additional experiments.

## Latest status: offline infrastructure ready for an approved smoke test

Follow-up requested 2026-10-27: complete infrastructure and make local commits; no paid calls, pushes, merges, or S4/F execution. This section supersedes the earlier handoff validation below. The earlier full-route tests/results predate the stricter follow-up holdout instruction.

### Completed infrastructure

- Ledger tests cover same-process concurrent reservations, real cross-process exclusion, a killed lock owner, stale-lock recovery after confirming the PID is dead, unknown/malformed usage, stage/global exhaustion, conservative rounding, reopening and interruption/resume. A normal two-hero S1 runner run at the last $0.20 allowance stays within **$25**; reopening refuses the next episode before dispatch.
- Per-call reservations use UTF-8 bytes plus a 4,096-token framing margin, maximum output including thinking, and the relevant cache-write/long-context prices. Non-finite caps/reservations are rejected. Meter aborts resolve even when a mock ignores cancellation, and a settled call cannot be charged twice.
- The harness checkpoints after every episode, stores configuration/manual hash, preserves raw traces, verifies their hash chain on resume, and records per-hero actions/decisions, invalid actions, calls/failures/timeouts/unknown usage, token/cache totals, spend, simulation ticks/seconds, wall time, messages, limits, terminal reasons, and start/end hashes. Aggregates retain per-scenario metrics and previous interrupted attempts. Wall measurements are not expected to reproduce byte-for-byte; semantic traces and raw game-state hashes do reproduce for the tested S1 mocks.
- `--resume` skips validated completed episodes without dispatch. Interrupted/partial episodes restart in a new attempt directory and reservation; prior bytes, outcomes and charges remain. It does not resume an in-memory game or model context. Crash-left unknown reservations are never automatically reclaimed.
- Observation-only tests assert exact equality with the existing per-hero `observe`/`legal_actions` outputs. An independent synthetic unit fixture checks that private choice data, hidden canaries, internal ids, notes, previous turns and batch history are not added to model input. No existing held-out scene was used as the fixture.
- Paid CLI paths use the canonical `evaluation-runs/spend-ledger.json`; alternate ledger flags are refused. The legacy model runner refuses paid policies before constructing a gateway. The future one-call smoke writes its own hash-chained trace and summary.

### Validation in this follow-up

| Command | Actual result |
| --- | --- |
| `npm run typecheck` | Pass, exit 0 after final code edits |
| `npm test -- --exclude packages/agent/test/suite.test.ts --exclude packages/agent/test/route/fullQuest.test.ts` | **676 tests / 88 files passed**, exit 0 |
| `npx vitest run packages/agent/test/ledger.test.ts packages/agent/test/budget.test.ts packages/agent/test/modelPlayers.test.ts packages/agent/test/harness.test.ts` | **48 tests / 4 files passed**, exit 0, rerun after final smoke error-path edit |
| `npm run build` | Pass, exit 0; Vite bundle-size warning only |
| `git diff --check` | Pass |
| Secret scan over session/midterm docs, agent code, midterm scripts, `AGENTS.md`, session plan | **100 text files / 0 findings** after the readiness report; repeated after final documentation |

`suite.test.ts` and `route/fullQuest.test.ts` are intentionally excluded because they execute S4/F route/checkpoint material. Interface unit tests that previously used the full preset now use the non-held-out milestone preset. No S4/F evaluation preset was executed, no held-out outcomes were inspected and no held-out tuning was done in this follow-up. The frozen definitions are unchanged. Ordinary server unit fixtures remain unit fixtures, not scenario trials.

### Exact next smoke configuration (not executed)

- Model identifier: **`claude-haiku-5-5`**, explicit effort **`medium`**.
- One attempted call maximum; **4,000 maximum output tokens**, thinking included; **30 s** timeout; SDK retries disabled.
- **$0.01** call/smoke reservation; **$0.10** smoke-stage cap; **$25** global cap.
- Other configured stage caps: pilot **$8**, final **$15**, contingency **$1.90**. Suite episode caps remain S1 $0.20, S2/S3 $1.25, S4 $1.00 and F $3.00; listing these limits does not authorize held-out execution.
- Identifier, effort default and prices checked on 2026-10-27 against [official overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview) and [pricing](https://platform.claude.com/docs/en/about-claude/pricing). No credential/account/provider request was made.

After explicit smoke approval, from this worktree the canonical entrypoint is `node --import tsx scripts/midterm/evaluate.ts --smoke --paid --model claude-haiku-5-5 --effort medium`. Do not execute it before approval. It requires a clean committed tree and an owner-provided credential.

Remaining risks: provider/account access, live usage/cache/refusal/truncation behavior and billing have not been tested; spending bounds assume the provider honors the dated rates and output cap. Preserve the shared ledger; a stale lock requires manual PID verification and crash-left reservations can conservatively block further work. Independent review and final held-out evaluation remain separate requirements.

Automatic approval review rejected two proposed fixture edits for possible held-out access before they executed. The accepted test constructs independent synthetic data and passes; no unresolved approval block remains.

### Local implementation commits

- `0e4920b` — independent quest baseline, disclosed route knowledge, tuning tests and earlier tuning evidence.
- `f657a0a` — persistent ledger, safe metering, resumable metrics/traces, mock observation-only tests and paid CLI guards.
- Handoff instructions, skill reports and session evidence are recorded in the subsequent documentation commit (its hash is reported to the owner).

Same-session audit: `agent-evidence/skill-runs/2026-10-27-phase4-readiness.md`; this is not an independent review. No paid model calls, push or merge occurred.

## Audit before changes

All requested references existed: `CLAUDE.md`, `AGENTS.md`, the assignment, recurring instructions, requirements and evidence indexes, route log, baseline plan, model budget proposal, server changes, and the actual frozen suite `EVALUATION_SUITE.md`. Relevant history was read in `docs/agent-sessions/23-claude-gap-analysis-evidence-foundation.md` and the session index. Both requested skills exist under `.claude/skills/`; the existing Codex reviewer is `.codex/agents/oath-rule-reviewer.toml`.

| Component | Existing implementation reused |
| --- | --- |
| Five operations and shared simulation clock | `packages/agent/src/environment.ts` |
| Observation schema and presentation | `packages/agent/src/types.ts`, `perception.ts` |
| Legal actions and validation | `packages/agent/src/actions.ts` |
| Independent hero loops and limits | `packages/agent/src/runner.ts`, `budget.ts` |
| Action batching and interruption | `packages/agent/src/batch.ts` |
| Scripted full route and checkpoint replay | `packages/agent/src/route/`, `suite.ts` |
| Frozen scenarios, goals and seeds | `docs/midterm/EVALUATION_SUITE.md`, `suite.ts`, `evaluator.ts` |
| Hash-chained evaluator traces | `packages/agent/src/trace.ts` |

Substantial uncommitted Phase 4 work was already present when this session arrived: `questBaseline.ts`, `questKnowledge.ts`, the observation-only mode in `llm.ts`, `ledger.ts`, `harness.ts`, `scripts/midterm/evaluate.ts`, and their tests. This session does not claim authorship of those inherited implementations. Harness tests and `.gitignore` also changed externally during initial inspection; those edits were preserved.

The minimal completion plan was to validate those modules, repair reproduced defects, and record evidence. No new evaluation framework, observation schema, game rules or scenario definitions were added.

## Resulting behavior

- Quest-aware policies are independent instances, use only their own observation and messages, and submit one action per decision through the existing runner. Static route-derived waypoints and mirror solutions are explicitly disclosed in `questKnowledge.ts` and `BASELINE_PLAN.md`. Their knowledge includes held-out material from route development; baseline/model held-out execution remains separate.
- The weaker exploration baseline is retained unchanged.
- `LLMPlayer` observation-only mode sends current observations and legal actions without model-written notes, recent action history or previous-turn results. Screen-provided messages, feedback and discovered outlines remain part of the same observation contract.
- The harness reserves an episode's cap before model dispatch, settles reported/unknown spend conservatively, records traces and summaries, and rejects held-out tuning runs. The ledger uses an exclusive lock and atomic writes.
- Two reproduced ledger issues were corrected here: parent directories are created for a new ledger; malformed stages/statuses, duplicate entry ids, non-finite amounts and undercharged unknown settlements fail closed. Tests cover both regressions.
- `AGENTS.md` now points future Codex handoffs to the existing plans, actual observation code and skills. The original project invariants remain intact.

## Running offline comparisons

From this worktree:

```sh
node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S1,S2,S3 --seeds tuning
node --import tsx scripts/midterm/evaluate.ts --player baseline-explore --situations S1,S2,S3 --seeds tuning
```

Local traces and the spend ledger belong in ignored `evaluation-runs/`. The `--paid` CLI switch is an execution guard, not owner approval. No paid calls are authorized by this report. Model availability and pricing must be rechecked before any approved paid stage; this session did not verify the inherited price table.

## Remaining work and limits

No live-model result, final held-out result, independent review or recording is claimed. S4 and F were not run with a quest baseline or model in this session. Existing scripted route and checkpoint reconstruction tests may traverse those areas as feasibility checks, as the frozen suite already documents. The suite file was left untouched, including its provisional status and pending player-registration decisions. The owner must authorize paid stages and final evaluation separately.

Validation and local tuning results are recorded below after completion. Session evidence: `docs/agent-sessions/28-codex-evaluation-handoff.md`.

## Verified validation and tuning evidence

- `npm run typecheck`: pass after fixes.
- `npm test`: **669/669** tests, 90 files, pass after fixes.
- `npm run build`: pass after fixes (Vite bundle-size warning). The first sandbox attempt failed on a temporary-config write; the rerun with worktree write access passed.
- Secret scan: 0 findings before final documentation; final scan reported separately in session evidence.
- `game-rules-audit`: same-session checkpoint at `agent-evidence/skill-runs/2026-10-27-phase4-handoff.md`; not an independent review.

| Quest baseline scenario | Tuning trials | Successes | Game seconds per trial | Invalid actions |
| --- | --- | --- | --- | --- |
| S1 | seeds 0, 1 | 2/2 | 4.8 | 0 |
| S2 | seeds 0, 1 | 2/2 | 146.4 | 0 |
| S3 | seeds 0, 1 | 2/2 | 52.9 | 0 |

Portable summaries: `evidence/phase4/quest-tuning-summary.json`. Full local traces: `evaluation-runs/codex-handoff-quest-tuning/`; hash integrity verified by the harness. These are development/tuning trials of a scripted baseline on `b51c1c0+dirty`, not final comparison or live-model evidence. Hashes match across S2/S3 for each seed and differ across seeds, because ids and room code are seeded.
