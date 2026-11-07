# game-rules-audit: recording

| Field | Value |
| --- | --- |
| Date | 2026-10-27 |
| Session | 0e1e6792-3057-4cbf-9c6d-3afcd5d64504 (the same Claude Code session that implemented the audited commits; this is a same-session checkpoint, **not an independent review**) |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756 |
| Commit audited | b612285, working tree clean |
| Target and focus | recording: the live launcher and viewer, plus the H1–H3 fixes on `midterm/evaluation`, commits bc377ee..b612285 (`scripts/midterm/live.ts`, `packages/agent/src/liveViewer.ts`, `mockGateway.ts`, the `environment.ts` hooks, `harness.ts`, `runner.ts`, `finalAccess.ts`, `ledger.ts`, `repo.ts`, `route/routeConstants.ts`) |
| Files read | `AGENTS.md`, `CLAUDE.md`, `docs/midterm/MIDTERM_GUIDELINES.md` (rubric), `REQUIREMENTS_CHECKLIST.md`, `AGENT_INTERFACE.md`, `SERVER_CHANGES.md`, `EVALUATION_SUITE.md`, `MODEL_BUDGET.md`, `PHASE4_HANDOFF.md`, `LIVE_RUN.md`; the audited sources above; `apps/server/src/app.ts` (`createApp`, `stepRoom`, `view:attach`, `registerViewer`), `GameRoom.add`, `RoomManager`; `packages/agent/src/runner.ts`, `suite.ts`, `route/fullQuest.ts`, `policies/questKnowledge.ts`, `policies/llm.ts`; the new and changed tests. The player manual was not re-read in this session; no manual or prompt text changed |
| Commands run | `shasum -a 256 .claude/skills/game-rules-audit/SKILL.md` → hash above. `git rev-parse --short HEAD` → b612285; `git status --porcelain` → empty. `git diff --stat 1ae8d8d..HEAD -- apps packages/shared Images manual` → no changes. `git diff --stat 1ae8d8d..HEAD -- packages/agent/src/{perception,actions,types}.ts policies/llm.ts` → only `llm.ts` (+7/−1: optional `apiKey` constructor argument). `npx tsc --noEmit` → pass. `npx vitest run` on 10 files (liveView, finalAccess, ledgerCanonical, ledger, harness, route/checkpointFreeze, environment, modelPlayers, apps/server viewOnly, manualDriver) → **10 files, 102 tests passed**. `python3 -I scripts/evidence/scan_secrets.py` on 14 changed docs and sources → **2 findings**, both `packages/agent/test/liveView.test.ts:145` (Finding 1). Full-suite and build results come from the implementation run earlier in this session (706/706 with the two held-out route files excluded; build pass); they were not re-run for this audit |

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Low | H | `packages/agent/test/liveView.test.ts:145` | The secret scanner flags `CANARY = "sk-ant-test-canary-…"` as `anthropic-key` and `openai-key`. It is a fake test value used to prove the key never reaches output | Evidence secret scans over test files will keep reporting 2 findings, which hides a real hit among false positives | Build the canary at runtime (e.g. `["sk", "ant", "test", …].join("-")`) or have the scanner allow-list this marked fixture; re-run the scan to 0 findings |
| 2 | Medium | M | `packages/agent/src/finalAccess.ts` (module header) | Approvals are recorded by a library function (`recordApproval`) that any process can call. The typed confirmation lives only in `final-approve.ts`. The hash chain detects edits but not deleting the newest lines (both documented in the header and `LIVE_RUN.md`) | An agent with shell access could record an approval or drop recent claims. The guard prevents accidental held-out access, not deliberate misuse | Owner decision: accept as documented, or anchor the register's latest hash somewhere the agent cannot rewrite (e.g. an owner-signed commit or tag recording it before each final run) |
| 3 | Low | M | `packages/agent/src/finalAccess.ts:205`, `runner.ts` | The runner's held-out gate recognizes the S4 start by preset (`S4`, `full`), final seeds, or the S4 prefix's **name**. A custom prefix under another name that replays the same route would not be recognized. `Director`/`AgentEnvironment` used directly (as the scripted route and `fullQuest.test.ts` do) is not gated, by design | Only intentional circumvention bypasses it; scripted-route feasibility runs stay allowed as the suite documents | Note it in the independent review. Optionally compare the prefix function's identity as well as its name |
| 4 | Low | H | `packages/agent/src/ledger.ts` `initCanonical` | The "already exists" check runs before the ledger lock is taken. Two concurrent `init --adopt` runs could both adopt the same legacy file. The result over-counts spend; it fails closed, but is wrong | Unlikely (an owner-only, typed-confirmation command); errs toward refusing spend | Re-check emptiness after `SpendLedger.open` takes the lock, and abort if entries already exist |
| 5 | Low | H | `packages/agent/src/environment.ts` `runPaced` | In paced (watched) mode, an exception during a tick is caught, traced as `pacing_error` and ends the episode with reason `error`. In headless mode the same exception propagates to the caller | Failure reporting differs between watched and headless runs; the outcome is still explicit (`error`) | Add a test for a throwing `tick` hook in both modes, or rethrow through the pending step promise |
| 6 | Medium | H | `.github/workflows/` (absent on this branch) | `CLAUDE.md` responsibility 7 requires CI. No workflow exists on `midterm/evaluation`. Pre-existing; not introduced by these commits | The new tests run only when someone runs them locally | Add or merge the CI workflow on this branch (owner approval needed for the workflow scope) |
| 7 | Info | M | `packages/agent/src/liveViewer.ts`, the browser client | The viewer's browsers receive the full room state (`state:sync`), and the client HUD shows hints that player observations omit (seen in the S2 screenshot: "Coco: enter the side bay and cast Black Hole…"). This is for the human watcher only: no player reads the viewer, and `liveView.test.ts` checks that the viewer module never calls player operations | None for the players. A recording made from this viewer shows the HUD hints, which matters only if someone reads them as the players' view | Label recordings as "human view with HUD hints; players observe through the interface" |
| 8 | Info | H | `scripts/midterm/live.ts` paid path | Authentication, real usage and cost, refusals, and interruption during a real provider call through the launcher are **untested**. Only mock and refusal paths were exercised | Unknown behaviour of the first paid run | Run the separately approved smoke call first, then one S1 watched run, and check `live.json`, the ledger and the trace |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass | The viewer server is `createApp({ manualDriver: true, viewers: true })`. Viewers use server-enforced view-only tokens. `liveView.test.ts` sends 20 inputs plus `story:read` and `inventory:use` from an attached viewer: every request returns "View-only session." and the hashes are unchanged. The only new writes to the room's registry are `manager.rooms.set/delete` of the environment's own room |
| 2 Rules and art preserved | Pass | No diff under `apps/`, `packages/shared/`, `Images/` or `manual/`. `routeConstants.ts` copies the route's values unchanged (test compares them with `questKnowledge.ts`) |
| 3 Real mechanics, no fixtures | Pass | Start states still come from the route prefix through the interface. S2/S4 start ticks and hashes are pinned and match the pre-change values. The mutation test shows baseline edits do not move S4 |
| 4 Observations player-visible only | Pass (unchanged) | `perception.ts`, `actions.ts` and `types.ts` are unchanged. The new status page and terminal output are trusted, human-facing and never passed to policies (Finding 7) |
| 5 Legal actions leak nothing | Pass (unchanged) | `legal_actions` is not modified. The mock gateway reads only the legal list and observation from the prompt |
| 6 No solution in player context | Pass | No prompt or system-message change. `MockGateway` has no game knowledge. `routeConstants.ts` is reached only by the suite/route, never by policies (closure test) |
| 7 Independent players | Pass | The harness still builds two `LLMPlayer`s with separate `MeteredGateway`s. Communication is still only through the `message` action |
| 8 One interface | Pass | The launcher calls `runSuite`, so baselines, mock and paid model players use the same environment and validation. The mock is labelled `mock:random-legal@<seed>` and is not a reported player |
| 9 Limits and terminal reasons | Pass, with Finding 5 | The episode cap can only be lowered (`episodeCap`, tested via launcher refusal). The ledger reserves the cap before dispatch. Ctrl-C ends with `manual_stop`, settles the reservation and keeps the verified partial trace (test). The wall-clock limit includes paced time |
| 10 Determinism and identical starts | Pass | Watched (paced, server-driven, with a viewer) and headless S1 have identical semantic traces, decisions and hashes (test). Manual S2 seed 0: both end at `3119923352c08724…`. Wall-clock fields (`waitMs`, `wallMs`) differ, as already documented |
| 11 Suite and reporting | Pass, with Findings 2–3 | `EVALUATION_SUITE.md` unchanged. Held-out access is now gated by an approval and the register. The launcher refuses S4/F, `--final` and final seeds unconditionally (test). No held-out episode was played. `checkpointFreeze.test.ts` resets S4 (start state only), as `suite.test.ts` already did |
| 12 Synchronization and recording honesty | Pass, with Findings 7–8 | Both browser views attach to the one room the agents play. Speed is stated (`--speed`, default real time). The pacer was fixed in this session to stop catching up on decision time (an earlier run measured 129.8 s wall for 146.4 s game time). No video recording or replay exists yet; the Playwright recorder in `SERVER_CHANGES.md` §4 is not built |
| 13 Validation | Pass (targeted) | Typecheck pass; 102/102 targeted tests. The full suite and build were not re-run for this audit (see Commands run) |
| 14 No overclaiming, no secrets | Finding 1 | `LIVE_RUN.md` and `PHASE4_HANDOFF.md` state "no paid call" and "tested offline only", which matches the runs. The only scanner hits are the fake canary |

## Recommended tests

- A `tick` hook that throws, in paced and headless modes (Finding 5).
- Two concurrent `initCanonical` calls adopting the same legacy ledger (Finding 4).
- After the approved smoke call: a paid S1 watched run, interrupted once mid-call, checking that the call's full reservation is charged and the trace is verified.

## Open questions for the owner

1. Is the documented trust model for approvals and the register acceptable (Finding 2), or should the register head be anchored somewhere the implementation agent cannot write?
2. Should CI be added to `midterm/evaluation` now (Finding 6)?
3. Should watched recordings carry a label explaining the HUD hints (Finding 7)?
