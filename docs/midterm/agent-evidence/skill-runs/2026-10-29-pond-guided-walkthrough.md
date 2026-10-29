# game-rules-audit: pond (instruction-guided Mirror Pond walkthrough)

| Field | Value |
| --- | --- |
| Date | 2026-10-29 |
| Session | f07e5a80-43c2-4426-b0ce-73fc9ff12313 (Claude Code). **The same session wrote the change; this is a checkpoint self-audit, not an independent review.** |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756 |
| Commit audited | a38d892 plus uncommitted working tree (dirty). The change under audit is uncommitted. The tree also holds another session's uncommitted recorder/shutdown work (Codex S43) and an earlier uncommitted `scripts/midterm/replay-video.ts` from this session; neither is in scope. |
| Target and focus | `pond`: the new opt-in `model-guided` walkthrough for S3-local. Files: `packages/agent/src/policies/guided.ts` (new), `guidedPondInstructions.ts` (new), `guidedMaze.ts` (now a re-export), `harness.ts`, `policies/kind.ts`, `test/guidedPond.test.ts` (new), `test/guidedMaze.test.ts` (two assertions changed). Owner decisions 2026-10-29, this session: full walkthrough; selected by extending `model-guided`. |
| Files read | `AGENTS.md`, `CLAUDE.md`, `MIDTERM_GUIDELINES.md` (rubric lines and searched sections), `REQUIREMENTS_CHECKLIST.md`, `AGENT_INTERFACE.md` (searched), `GUIDED_MAZE_BASELINE.md`, `BASELINE_PLAN.md`, the manual's Push/Slow Time/Flight sections, `packages/shared/src/mirrorPond.ts`, `apps/server/src/mirrorPond.ts` (lines 1–100), `packages/agent/src/route/fullQuest.ts` (`mirrorPond`, helpers), `route/routeConstants.ts`, `route/localStarts.ts`, `suite.ts` (situations), `harness.ts` (validatePlan, policiesFor), `policies/kind.ts`, `perception.ts` (pond section), the changed files above |
| Commands run | `git diff --stat -- apps packages/shared manual Images`: empty (no game, map, manual or art change). `git diff --stat -- packages/agent`: harness.ts, kind.ts, guidedMaze.ts, guidedMaze.test.ts from this change, plus another session's recorder.ts, shutdown.ts, recorder.test.ts. `python3 -I scripts/evidence/scan_secrets.py <7 changed/new files>`: "scanned 7 text files; 0 finding(s)". `npx vitest run guidedPond guidedMaze modelPlayers harness` (after `a38d892`): 4 files, **34/34 passed**. `npm run typecheck`: exit 0. Earlier in this session, before `a38d892` landed: `npm run build` exit 0 (existing large-chunk warning); `npm test` **1065/1066 passed, 1 failed** (see finding 6). Node v26.9.0. |

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical (owner-accepted by design) | M | `policies/guidedPondInstructions.ts` | The system prompt of both guided heroes holds the full pond solution: push spots, push lengths, target and rest angles for M1–M4, pad positions, shot directions, the spike-timing rule, flight paths and the chest location. Rubric 2b requires "no answer key". | `model-guided` results on S3-local cannot serve as 2b evidence or be pooled with `model-history`/`model-obs-only`. Accepted by the owner on 2026-10-29 as a labelled, separately reported treatment, like the Maze guide. Labels carry `guided-b8d263d30c89` / `walkthrough-b8d263d30c89`. | Keep it opt-in and S3-local-only (enforced and tested). Report it in its own table, named "instruction-guided (solution supplied)". Never present it as the main model player. |
| 2 | Medium | M | `policies/guidedPondInstructions.ts` | Several turning points come from positions observed in one scripted run, not from the route's frozen constants: Coco's flight points (31,20.5), (31,16.5); A1→A2 (27.5,12.6), (26,12.6); A2→A3 (23.4,12), (19.2,16.1); A3→A4 (20,22.2), (20,23.6); A4→chest (22.7,21.6); Sieg's straight (27.5,29.5)→(27.5,21.5) leg, where the route's navigator went diagonally. `guidedPond.test.ts` checks only the endpoints and the route's own go targets. | A straight segment between two listed points might clip a wall, so a model that follows it literally could get blocked. | Add a test that sweeps each listed segment against the pond's collision map, flying for Coco and walking for Sieg. Or derive these legs from `route-dev` tooling. |
| 3 | Medium | M/H | `policies/guidedPondInstructions.ts` | Some spike and timing statements are calculated from source, not measured: "about 5 s" safe window, "crosses in under 2 s", and "8 HP and you are put back at the court" (source: the clamp-and-relocate pond recovery; the route never took a hit). The 150-tick shot wait and "within about 0.12 tile" are the route's own choices, not engine bounds. | If any number is wrong, the guide misleads the model. That is a fairness question for the guided treatment only. | Add an offline test: under Slow Time, start at the easternmost column's `retracting`, Super Speed west, and assert no damage. Also check where Sieg reappears after a spike hit. Or soften the wording to "the route used". |
| 4 | Low | H | `test/guidedMaze.test.ts` | Two existing assertions that refused `model-guided` on S3-local now use S3 instead. This follows from the approved decision, but `CLAUDE.md` lists editing existing tests as needing owner approval. | Process only. The Maze guide text, ID `975e5580671c` and labels are unchanged; `guidedPond.test.ts` pins the ID. | The owner should confirm the edit explicitly in the PR. |
| 5 | Low | H | docs | No `GUIDED_POND_BASELINE.md`, suite change-log line or evidence-index entry exists yet. The proposed pilot command and cost are not yet written down. | The evidence trail is incomplete until they exist. | Write the record before any pilot. Do not edit `EVIDENCE_INDEX.md` while another session has uncommitted edits to it without coordinating. |
| 6 | Info | H | `packages/agent/test/s2Shutdown.test.ts` | Full `npm test`: 1 failure. The test expects /not a valid recording/; the working tree's `recorder.ts` (another session's uncommitted change) no longer emits it. HEAD's `recorder.ts` contains the text, and `s2Shutdown.test.ts` is unmodified. | Not caused by this change, but the suite is not green on this working tree. | The owning session should update the test or the message. Re-run `npm test` once its work is committed. |
| 7 | Info | H | — | Checks ran on Node v26.9.0. The guided Maze record used v24.19.0. | Possible toolchain difference. | Re-run on 24.19.0 before a paid pilot if that is the canonical version. |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass | The guided player only appends system text and delegates to `LLMPlayer`, which submits actions through `step`. No World/GameRoom access. The architecture test passes: no server, shared, environment, route, navigate or fs import, and no `.step`/`.observe` call in `guided.ts` or `guidedPondInstructions.ts`. |
| 2 Rules and art preserved | Pass | No diff under `apps/`, `packages/shared/`, `manual/` or `Images/`. Route constants are unchanged; the guide copies them. |
| 3 Real mechanics, no fixtures | Pass | The proof test plays the existing `mirrorPond` route through the five operations from the S3-local start (itself reached by real play). It reads room state only to assert the result, and stops at success. Seeds 0 and 1 both succeed at 4559 episode ticks with 0 invalid actions. Not an LLM result. |
| 4 Observations player-visible | Pass (unchanged) | No change to `perception.ts`. The test asserts the user context's observation is byte-identical to `env.observe`. The angles the guide refers to are the drawn mirror labels players already see. |
| 5 Legal actions leak nothing | Pass (unchanged) | No change to `actions.ts`. Coco's illegal Push is refused by ordinary validation (tested). |
| 6 No solution in player context | Finding #1 | Solution intentionally supplied to `model-guided` only. `model-history` and `model-obs-only` S3-local prompts are asserted byte-equal to the plain construction and free of the guide. |
| 7 Independent players | Pass | Separate `GuidedPlayer`, `LLMPlayer`, `MeteredGateway` and notes per hero. Each request carries only its own role block (tested: no "YOU ARE <partner>"). The shared section describes the plan statically; nothing from the partner's memory. |
| 8 One interface | Pass, asymmetry disclosed | Same observations, legal actions and validation. The asymmetry is prompt knowledge (finding #1) and a larger prompt: first-call worst-case hold about $0.00780 (Sieg) / $0.00774 (Coco) guided, against $0.00649 / $0.00640 for `model-history` (offline, gpt-6-luna medium, network stubbed). |
| 9 Limits and terminal reasons | Pass | Runner limits are unchanged. The guide is inside `MeteredGateway`, so the reservation prices the full prompt and fails closed before dispatch (tested). A runSuite run settles the scratch ledger with a `model-guided/S3-local/` run key. |
| 10 Determinism, identical starts | Pass | The runSuite start hash equals `environmentFor("S3-local").reset(0)` (tested). The proof is identical at seeds 0 and 1. |
| 11 Suite and reporting | Pass with note | No scenario, seed, limit or predicate changed; S3-local is tuning, not held out. Restricted to seeds 0/1, final runs refused (tested). Suite change-log entry not yet written (finding #5). |
| 12 Sync and recording honesty | N/A | No recording or run in scope. Any future video must be labelled instruction-guided. |
| 13 Validation | Finding #6 | Targeted 34/34; typecheck pass; build pass; full suite 1065/1066 with one failure from another session's change. |
| 14 No overclaiming, no secrets | Pass | Secret scan: 0 findings on 7 files. No paid call was made. Nothing here claims an LLM completed the pond. |

## Recommended tests

- Collision sweep of every guide segment against the pond map (finding #2).
- Spike-window test under Slow Time and Super Speed starting at the easternmost `retracting`; spike-hit recovery location (finding #3).
- An optional mock-gateway S3-local run that just checks the guided treatment's labels, run key and video label end to end through `live.ts`.

## Open questions for the owner

1. Confirm the two edited assertions in `guidedMaze.test.ts` (finding #4).
2. Should findings 2–3 be fixed before a paid S3-local guided pilot? A pilot would also need your separate approval, and a cap (for comparison, pilot-11 on the Maze used $0.30 and was charged $0.0835).
