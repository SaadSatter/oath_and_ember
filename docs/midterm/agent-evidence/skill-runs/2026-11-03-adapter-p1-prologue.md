# game-rules-audit: adapter (P1 "Into the Forest", Prologue observation boundary)

| Field | Value |
| --- | --- |
| Date | 2026-11-03 |
| Session | 2535c444-503f-4bd0-b122-23d0289cd46a. **This is the implementation session that built P1, not a fresh session.** The audit is a self-check: it is not independent and does not count as a separate-session invocation of the skill |
| Session URL | None |
| Skill file SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| Commit audited | Candidate commit `7c4d875` (uncommitted to any branch), base `16f1a6d`, checked out clean and detached in a scratch worktree. The shared working tree was not audited: it holds unrelated uncommitted changes from other sessions (the Hedge Maze B/C work; `apps/server/src/hedgeMaze.ts`, `apps/client/src/main.ts`, `EnemyView.ts`, `HedgeMazeView.ts`; `apps/server/test/zz_*` probes) |
| Target and focus | adapter: the P1 observation boundary and hidden-state leakage. `perception.ts` (`prologueProps`, `nearAlden`, `areaNames`), `actions.ts` (`localTalk`), `environment.ts` (checkpoint, progress), `evaluator.ts` (`P1_EPISODE`), `prologueSituation.ts`, `policies/questBaseline.ts` and `questKnowledge.ts` (`PROLOGUE`), `test/prologueSituation.test.ts` |
| Files read | `AGENTS.md`, `CLAUDE.md`, `docs/midterm/MIDTERM_GUIDELINES.md` (rubric), `REQUIREMENTS_CHECKLIST.md`, `AGENT_INTERFACE.md` (via the existing contract in `types.ts`), `manual/Oath_and_Ember_Player_Manual.md` (search for Prologue content: none), the files above, `apps/server/src/prologue.ts`, `apps/server/src/storyCheckpoints.ts`, `apps/server/src/GameRoom.ts` (E handling, doors, travel), `packages/shared/src/prologue.ts`, `prologueWoods.ts`, `environmentSolids.ts` (yard fence), `maps.ts`, `apps/client/src/main.ts` (map-point labels, `sealedExit`, the local E handler, HUD goal), `apps/client/src/entities/AldenView.ts`, `apps/client/src/ui/questLog.ts`, `storyDialogue.ts` |
| Commands run | See below |

**Commands and results:**
- `git diff --stat 16f1a6d 7c4d875 -- apps packages/shared manual Images`: no changes. No game code, story, map, manual or art is touched.
- `git diff --name-only 16f1a6d 7c4d875`: 21 files, all in `packages/agent/**`, `scripts/midterm/**`, `docs/midterm/**` and `midterms/saadsatter/*.md`.
- `grep questKnowledge|PROLOGUE|prologueSituation` in `policies/llm.ts`, `guided*.ts`, `heroMemory.ts`, `playerKnowledge.ts` and `runner.ts`: none. The route never reaches a model prompt.
- `git diff … -- packages/agent/src | grep` for state writes (`w.story/players/inventory/puzzles … =`, `flags.push`, `.hp =`, `.x =`, `relocate(`): none.
- `python3 -I scripts/evidence/scan_secrets.py <21 changed files>`: 21 text files scanned, 0 findings.
- `npm run typecheck`: **failed.** `packages/agent/test/prologueSituation.test.ts(295,16)` and `(296,16)`: TS18047, `'o.dialogue' is possibly 'null'`.
- `npm test`: **2 failed, 1,122 passed (121 files)**:
  - `situationA.test.ts`, "is a label for the existing S2-local scenario, adding no scenario id": the exact list of current ids now has `P1` appended;
  - `s2Shutdown.test.ts`, "gives up on a video that never finalizes": also fails at base `16f1a6d` (re-run there: 1 failed, 11 passed), so it predates this change.
- `npm run build`: built (the usual chunk-size warning).
- `npx vitest run packages/agent/test/prologueSituation.test.ts` (in the shared tree, before the candidate was assembled): 22 tests, all passed.

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | H | `packages/agent/test/prologueSituation.test.ts:295-296` | `npm run typecheck` fails with TS18047. `o.dialogue` is used after an optional-chained comparison with a possibly undefined value (`own[0].elsewhere`), so TypeScript does not narrow it | The test triad is not green; CI would fail | Narrow `o.dialogue` explicitly (for example `const d = o.dialogue; if (player === "coco" && d && d.text === …)`), then re-run typecheck |
| 2 | Medium | M | `packages/agent/test/situationA.test.ts:86` | It expects `SITUATIONS` ids to equal exactly the seven pre-P1 ids. The S2-A definition hash (`4b3c9bb3…`) and every S2-A pin still pass | A failing existing test. The assertion's intent (S2-A adds no id) still holds; it is P1 that adds one | Append `"P1"` to that expected list with a comment that P1 is a separate situation. Do not change any S2-A pin |
| 3 | Low | M | `packages/agent/src/perception.ts` (`prologueProps`, garden gate) | The yard fence (`aldenYardFenceSolids`) has a 32 px opening at x 464–496 that lies between two tile centres, so the centre-sampled grid draws it as `#`. P1 lists `garden gate (open)` and marks its cell `o` | The listing reflects what the picture shows (a gap in the fence art), but it is an interpretation added by the interface, not drawn text. The same centre-sampling limit could hide narrow gaps elsewhere; the prompt already warns that a `#` tile can be partly open | Keep it, disclosed in `PROLOGUE_SITUATION.md`. Ask the independent reviewer and the owner to confirm it. Do not change the grid rule inside frozen situations |
| 4 | Low | M | `perception.ts` (`areaNames`, Alden) | The client draws no area banner. "Main house", "Alden's Magic Shop" and "Forest Trail" come from the game's checkpoint and composed-scene names. Alden's sprite carries no name label; he is listed as `creature` "Alden" | Small, consistent with the existing practice for shrine areas. A human player learns these names from the journal ("Visit Alden's magic shop") and the dialogue | Disclose (done in `PROLOGUE_SITUATION.md`). No change needed |
| 5 | Low | M | `prologueSituation.ts`, `questKnowledge.ts` | The baseline's route was developed on P1 before the freeze, and the definition was designed with full knowledge of the code | P1 is not a held-out case. It is frozen and excluded from prompt tuning | Already disclosed in the definition (`role`), the record and EVALUATION.md. Keep stating it |
| 6 | Info | M | `actions.ts` (`localTalk`), `perception.ts` (`inPrologue`) | Local E conversations and Prologue props apply only before the `ERRAND` stage. Alden's errand lines, villagers and later inscriptions are not covered | None for P1, which ends at `WOODS` | Extend only with a new situation and approval |
| 7 | Info | H | `s2Shutdown.test.ts` | Fails at base `16f1a6d` too (video finalization text) | Pre-existing; unrelated to P1 | Track separately |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass | `localTalk` returns text and sends no input (tested: the state hash is unchanged by the press). Perception only reads. The only room creation is the documented reset with the game's own `prologue` checkpoint |
| 2 Rules and art preserved | Pass | No diff under `apps/`, `packages/shared/`, `manual/` or `Images/` |
| 3 Real mechanics, no fixtures | Pass | No prefix; `beginStoryCheckpoint("prologue")` is the title-screen start. The baseline acts through `step()` only. Tests use ordinary actions; the only raw-state reads are trusted assertions |
| 4 Observations player-visible only | Pass, with Findings #3 and #4 | The leak test scans every observation and legal list of a full run: no ids, room code, flags, stage or scene ids, HUD goal lines, map hint line, or lines from scenes P1 never reaches. The cart is unsignposted. `E · FOLLOW THE TRACKS` is absent before the cart scene. Inner narration goes only to its hero. Alden's `E Talk` follows `nearAlden` and the client's prompt-hiding rule |
| 5 Legal actions leak nothing | Pass | `legalActions` is unchanged. During scenes only dialogue, wait and message are legal; `advance_dialogue` is offered only to the line's reader. "You pressed E; nothing responded." at a closed road is what a human sees (nothing happens) |
| 6 No solution in player context | Pass | P1 has no briefing, tutorial block or walkthrough. System prompts are unchanged, and their SHA-256 values are pinned in the definition. `PROLOGUE` is imported only by the baseline and by `prologueSituation.ts` (hashing) |
| 7 Independent players | Pass | Unchanged runner and memories. Messages are only via `message` |
| 8 One interface | Pass | Baseline and models share `observe`, `legal_actions` and `step`. The baseline's route knowledge is disclosed (`questKnowledge.ts`, `PROLOGUE_SITUATION.md`) |
| 9 Limits and terminal reasons | Pass | `episodes.P1` sets 10,800 ticks, 1,600 decisions, 250 calls and 4,000,000 tokens per hero; `EPISODE_CAP_USD.P1` is $0.60; the harness default wall clock applies. Tick and decision limits are tested. The model-call, token and spend paths are the existing `ModelBudget`, unchanged |
| 10 Determinism | Pass | Start hashes are pinned at seeds 0 and 1, and repeated resets are identical. Both heroes' views are identical across seeds. The baseline plays an identical trajectory at seeds 0 and 1 (tested). Evaluation ids are seeded |
| 11 Suite and reporting | Pass, with Finding #5 | The EVALUATION_SUITE change log entry is dated 2026-11-03. P1 is a tuning-seed case, not held out (disclosed). No model run yet |
| 12 Synchronization and recording honesty | N/A | No recording produced. The baseline is labelled as scripted everywhere |
| 13 Validation | Findings #1 and #2 (and #7, pre-existing) | Exact counts above |
| 14 No overclaiming, no secrets | Pass | The docs state that the three-situation requirement is not met, that P1 is not held out, and that Coco is not required. Secret scan: 0 findings |

## Recommended tests

- After fixing #1 and #2, re-run `npm run typecheck`, `npm test` and `npm run build` on the clean candidate.
- A test that `perception.ts` lists no Prologue prop outside the Prologue stages. It is covered indirectly by the unchanged S2-A, S2-B and S2-C pins, and could be made explicit.

## Open questions for the owner

- Is listing the fence opening as `garden gate (open)` (Finding #3) an acceptable as-drawn description?
- Should `s2Shutdown.test.ts` (Finding #7, pre-existing) be fixed before the course CI run?
