# game-rules-audit: adapter (model-memory)

| Field | Value |
| --- | --- |
| Date | 2026-10-29 |
| Session | `682df3aa-7696-4130-bea0-211def84d0f6` (Claude Code, the implementing session; same-session checkpoint audit, **not an independent review**) |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| Commit audited | `dc00de2`, working tree clean (before this report) |
| Target and focus | adapter: the opt-in `model-memory` player (`packages/agent/src/heroMemory.ts`, `policies/llm.ts` persistent mode, runner `steps[k].after`, harness/kind registration) |
| Files read | `AGENTS.md`, `CLAUDE.md`, `MIDTERM_GUIDELINES.md` (rubric), `REQUIREMENTS_CHECKLIST.md`, `AGENT_INTERFACE.md`, `PILOT10_DIAGNOSIS.md`, `PILOT9_FIXES.md`; `heroMemory.ts`, `policies/llm.ts`, `policies/policy.ts`, `policies/kind.ts`, `policies/guidedMaze.ts`, `playerKinds.ts`, `harness.ts`, `runner.ts`, `batch.ts`, `environment.ts` (reset, observe, deliver, feedback), `perception.ts` (`PlayerMemory`, screen grid, `exploredRows`), `movementReport.ts`, `worldEvents.ts`, `actions.ts` (feedback strings), `finalAccess.ts`, `scripts/midterm/live.ts`, `scripts/midterm/evaluate.ts`, `test/modelMemory.test.ts`, `test/helpers/promptCapture.ts`, `test/scriptedFreeze.test.ts`. The player manual was not re-read in this audit: the change adds no game text to any player context. |
| Commands run | See below |

Commands run in this audit:
- `shasum -a 256 .claude/skills/game-rules-audit/SKILL.md`: hash above.
- `git rev-parse --short HEAD`: `dc00de2`. `git status --short`: clean.
- `git diff --stat 74adda8 dc00de2`: 16 files, +1331/−21. `git diff --name-only 74adda8 dc00de2 -- apps packages/shared manual Images`: empty.
- `grep '^import' heroMemory.ts`: two lines, both `import type`.
- `grep -rn '\.after\b' packages/agent/src`: set in `runner.ts:171`, read only in `heroMemory.ts`.
- `npx vitest run modelMemory.test.ts guidedMaze.test.ts --maxWorkers=2`: 35/36. The failure was a timeout in `guidedMaze` "offline engineering proof" (81.6 s) at load average ~60.
- `npx vitest run guidedMaze.test.ts --maxWorkers=1`: 9/9 pass.

Results the implementing session ran earlier, at the tree committed as `dc00de2`:
- typecheck pass;
- permitted agent files 438/445, all 7 failures load timeouts; the 6 affected files then 107/107 alone;
- `scriptedFreeze -t 'baseline on S[123]'` 6 pass, 1 skipped;
- 8/8 revision 2 baseline trajectories identical to `74adda8`;
- server/shared/client 557/558, `npcTalk` flake 3/3 alone;
- build pass;
- secret scan 0 findings.

Those results are recorded in `docs/midterm/MODEL_MEMORY.md` §5; this audit did not re-run them.

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | M | `packages/agent/src/heroMemory.ts`, `docs/midterm/MODEL_MEMORY.md` §4 | The remembered map is tile-exact and permanent for the episode, built from the hero's own screens. The client has no minimap or automap, and a human remembers a maze imperfectly. | An information-aid asymmetry against a human player and against `model-history`. It is not hidden state, but it is more than a human retains. | Owner decision: accept it as a documented interface aid. Report `model-memory` results only as their own player kind (already required in `EVALUATION_SUITE.md`). |
| 2 | Low | M | `packages/agent/src/finalAccess.ts:129`, `scripts/midterm/final-approve.ts` | `PLAYER_KINDS` now includes `model-memory`, and `checkApproval` accepts any listed kind. The final-run refusal lives only in `validatePlan`, which `evaluate.ts` calls before `authorizeFinalRun`. `final-approve.ts` does not call it. The same holds for `model-guided`. | An approval for `model-memory` could be recorded, but no final run can start (`validatePlan` refuses it). | Optionally make `checkApproval` refuse tuning-only kinds, with a test. Needs owner approval because it touches final-access code. |
| 3 | Low | M | `heroMemory.ts` `recordTurn` | A sent message's `tick` is the tick of the hero's observation before sending, not the server's delivery tick. The two can differ if the partner advanced time in between. | A small timing mismatch when comparing one's own message ticks with received ones. Documented in the type comment and `MODEL_MEMORY.md`. | None needed. If exact ticks matter, the environment could return the delivery tick on the message `StepResult` (an interface change). |
| 4 | Medium | M | `packages/agent/test/modelMemory.test.ts` | No test asserts that `runEpisode` actually fills `steps[k].after` with that hero's own observation in a real batch. The behaviour is covered only indirectly: synthetic `recordTurn` tests, and a real-run test that checks the memory content. | A regression in the runner hook would silently lose mid-batch screens. | Add a runner test: a 2-action batch, then check `turn.steps[0].after.player === id` and its tick against the trace's `inBatch` observation. |
| 5 | Low | M | `heroMemory.ts` `trimEvents`, terrain events | Periodic tile changes (raised hazards `^`, moving pushable walls) make terrain events that supersede each other. They are evicted first, but a burst of distinct, non-overlapping changes can still push old unsuperseded events out (cap 24). | An important early event could be lost in a long, busy episode. | Watch the pilot. If seen, keep the event cap per kind, or protect `game_feedback` events. |
| 6 | Low | H | `docs/midterm/MODEL_MEMORY.md` §7 | It says the audit "has not been run". | Outdated after this report. | Update the line to point to this report; the independent review stays pending. |

No Critical or High findings.

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass | No `World`/`GameRoom` write added. `heroMemory.ts` imports types only. The runner change stores an observation it already took. Players still submit only actions through `step`. |
| 2 Rules and art preserved | Pass | No change under `apps/`, `packages/shared/`, `manual/` or `Images/`. Scenarios, seeds, limits and success predicates unchanged. |
| 3 Real mechanics, no fixtures | Pass | The player runs on ordinary interface play. One test uses a labelled fixture (heroes placed in the maze for a real Black Hole pull); the fog-of-war test uses S2-local's own real-play prefix. |
| 4 Player-visible observations | Pass (Finding 1 for parity) | Memory inputs are only that hero's `Observation`s (decision-time and mid-batch, both already traced) and its own `StepResult`s. Real-play test: every remembered tile was on that hero's own screen, unseen tiles are `?`, and the partner's views do not reach it. Mobile things are kept out of the map; stale sightings are only listed off screen, with ticks. |
| 5 Legal actions leak nothing | Pass | `actions.ts` and `validate` unchanged. The reply schema is identical to `model-history` (tested). |
| 6 No solution in any player context | Pass | `MEMORY_SECTION` has no digits, directions, area, creature or puzzle words (tested). The engine produces no paths, targets or advice. Event rules are generic (feedback text, tile diffs, two sightings), with no maze-specific code. `model-memory` builds plain `LLMPlayer`s, never `GuidedMazePlayer`, so no walkthrough text reaches it (grep: no "guided" in `heroMemory.ts` or `llm.ts`). |
| 7 Independent players | Pass | One `HeroMemory` per `LLMPlayer`, and `policiesFor` makes two instances. `observe` refuses the other hero's observation. Tests: neither prompt contains the partner's notes, each sent list holds only that hero's messages, and received `messages` are unchanged. |
| 8 One interface | Pass, disclosed | Same observation, legal actions and validation for all players. `model-memory` additionally gets its own derived memory; disclosed in `MODEL_MEMORY.md` and `EVALUATION_SUITE.md`. Baselines unchanged and still do not read `after`. |
| 9 Limits and terminal reasons | Pass | No change to `ModelBudget`, runner limits or failure accounting. The memory player goes through `MeteredGateway` as before. |
| 10 Determinism and identical starts | Pass | Same seed gives identical prompt digests (test). Memory is fresh each episode and clears when time goes backwards. Iteration orders are sorted; no wall clock or randomness. Start hashes are unaffected (no environment change). |
| 11 Suite and reporting | Pass | Restricted to S1–S3 tuning; final runs refused by `validatePlan` (test). Change-log entry added. No held-out case run or inspected. No results claimed. Finding 2 on final approvals. |
| 12 Synchronization and recording | N/A | No client, server or recording change. |
| 13 Validation | Pass with known flakes | See Commands. Pinned `model-history`/`model-obs-only` prompt digests unchanged. Timeouts under machine load average ~60 pass when run alone. Full `npm test` not run: it includes held-out route content. |
| 14 No overclaiming, no secrets | Pass (Finding 6) | `MODEL_MEMORY.md` claims match the runs above. Secret scan of the 16 changed files: 0 findings. This report scanned below. |

## Recommended tests

- The runner fills `steps[k].after` with the acting hero's own mid-batch observation (Finding 4).
- If Finding 2 is accepted: `checkApproval` refuses `model-memory` (and `model-guided`) approvals.

## Open questions for the owner

1. Accept the tile-exact remembered map as a documented interface aid (Finding 1)?
2. Approve the proposed S2-local seed-0 `model-memory` pilot (`MODEL_MEMORY.md` §6, cap $0.60)?
3. Run the `rules-reviewer` subagent on `dc00de2` in a separate invocation as the independent review?
