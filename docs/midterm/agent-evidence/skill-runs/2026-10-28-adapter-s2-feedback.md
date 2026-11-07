# game-rules-audit: adapter (proposed S2 feedback and observation changes)

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Session | 1d2c5393-985f-4736-86c2-40baf5a01504 (Claude Code) |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756 |
| Commit audited | 4abf87f, working tree clean (before this report) |
| Target and focus | `adapter`: pre-implementation audit of the **proposed** changes from the S2 seed 0 OpenAI diagnosis (run `S2-seed0-model-history-openai-2026-10-28T05-45-18-865Z`): (a) feedback when an attack press produces no attack because the weapon is recovering, plus a proposed remaining-recovery time for J; (b) world-change feedback for changes on the hero's own screen (hedge burned, cow moved); (c) per-action-type OpenAI strict schema so `attack` carries no `ticks`; (d) prompt guidance on batching, cooldowns and repeated messages. Nothing is implemented yet. |
| Files read | `AGENTS.md`, `CLAUDE.md`, `docs/midterm/MIDTERM_GUIDELINES.md` (rubric and interface sections), `docs/midterm/REQUIREMENTS_CHECKLIST.md` (head), `docs/midterm/AGENT_INTERFACE.md` (feedback and batching sections), `manual/Oath_and_Ember_Player_Manual.md` (combat and ability sections), `packages/agent/src/{environment,perception,actions,batch,runner,budget}.ts`, `packages/agent/src/policies/{llm,openai,questBaseline,baseline}.ts`, `apps/server/src/GameRoom.ts` (attack input, lines 1040–1100), `apps/server/src/hedgeMaze.ts` (`burnMazeBush`, `pullMazeCow`), `packages/shared/src/hedgeMaze.ts`, `apps/client/src/main.ts` (HUD ability bar), `apps/client/src/environment/HedgeMazeView.ts`, `apps/client/src/audio/SoundEvents.ts` (maze sounds), the S2 run's trace and summary |
| Commands run | `git rev-parse --short HEAD` → `4abf87f`; `git status --short` → clean; `shasum -a 256 .claude/skills/game-rules-audit/SKILL.md` → above; Node v24.22.1 (official tarball, SHA-256 verified against `SHASUMS256.txt`, unpacked in the session scratchpad; the system `node` is v26.9.0); `npm run typecheck` → exit 0; `npx vitest run packages/agent/test --exclude '**/suite.test.ts' --exclude '**/route/fullQuest.test.ts' --exclude '**/checkpointFreeze.test.ts'` → 17 files, 255/255 passed. Full `npm test` and `npm run build` not run in this audit (no code changed yet). `scan_secrets.py` on this report → 1 file, 0 findings. |

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | High | M | proposed `perception.ts` `abilityBar` | The HUD draws seconds only for Slow Time, Flight, Black Hole and Super Speed (`apps/client/src/main.ts:491–546`). There is no J indicator at all. Perception already reports J only as `recovering`/`ready` (`perception.ts:620,628`). The manual gives nominal spacing only (about 0.45 s sword, about 0.6 s fireball). | Reporting exact remaining J recovery would be more precise than anything drawn (step 4). | **Drop the proposed J countdown.** Keep the existing `recovering` word. Feedback may say the swing or cast did not happen and that the weapon was still recovering; the manual's nominal timings are already in the prompt. |
| 2 | High | M | proposed environment feedback | Server swing rules differ by hero and state (`GameRoom.ts:1050–1100`). Sieg strikes while J is held, with no edge required, once the cooldown clears. With Heavy Break, a press starts a charge and the release strikes. Coco needs a fresh press. All of them are gated by `!p.cooldowns.attack`. Predicting "no attack" from the press time and cooldown could misreport some of these cases. | A wrong "nothing happened" line is misleading feedback. | Detect from the authoritative outcome: a strike resets `cooldowns.attack` to its full value during the action's ticks. Report only swung or not swung, which is what the swing animation shows. Never report hit or miss, damage or the remaining time. |
| 3 | High | M | proposed world-change feedback | `viewRect` (`perception.ts:146`) is the hero's camera at a given tick. Comparing only an action's first and last observation would report a change that happened while the spot was briefly off-screen. | Off-screen state leak (step 4). | Evaluate every tick, against that tick's camera rectangle for that hero, using the same rule `perceive` uses (prop centre within the view, 8 px pad). Report only to a hero whose scene matches the change. Partners get it only if it is on their own screen. |
| 4 | High | M | proposed event wording | The maze has a hidden `cow.parked` flag; the client signals it only by sound (`SoundEvents.ts:527`, "Cow parked / lane cleared"). | Text such as "the cow is parked" or "the lane is clear" would leak puzzle state. | Describe only the drawn change: an object that was on screen is no longer drawn, or a drawn object moved (direction, and its new position at the rounding perception already uses). Do not state causes, puzzle progress or flags. |
| 5 | Medium | M | `batch.ts` `batchStop` | A batch stops on any feedback (`batch.ts:24`). | New feedback lines will stop LLM batches more often, which partly offsets the batching guidance in (d). The no-swing line *should* stop a batch, because the player must look again. | Accept the documented rule: any feedback stops a batch. Disclose it in `AGENT_INTERFACE.md`, and keep event lines to one per object per action, so a cow sliding for 4 s gives one line, not one per tick. |
| 6 | Medium | M/H | traces of baseline runs | `QuestBaseline` stores `last` but never reads `feedback` (`questBaseline.ts:448`; no other use). The new lines are written into `result` trace lines and `observation.feedback`. | Baseline moves and game-state hashes (start, `result.hash`, end) should stay identical. The trace's line hash chain will differ wherever a new line appears, for example an S1 baseline attack during recovery. | Verify with the S1 baseline that start, state and end hashes and the action sequence are unchanged. Report plainly that trace-line hashes change where the new feedback appears. Do not rewrite historical traces. |
| 7 | Medium | M | client vs perception (pre-existing) | The client keeps the label "FIREBALL · dry hedge" drawn at (19, 31.5) after the burn and hides only the orange shrubs (`HedgeMazeView.ts:185,222`). Perception removes the whole object (`perception.ts:300`). The cow's label is drawn fixed at (26, 27.7), but perception moves it with the cow. | Pre-existing fidelity gaps, not leaks. The first one contributed to the agents' "where is the hedge" loop. | Out of this change's scope. List them for the owner. The burn event in (b) partly compensates by reporting the shrubs vanishing when it happens on screen. |
| 8 | Info | M | client audio | The client plays scene-wide sounds a human hears even when the spot is off-screen: "Burn amber maze bush" and "Cow parked / lane cleared" (`SoundEvents.ts:526–528`). | Under the owner's "visible on screen" scope these are excluded. That is stricter than what a human gets. | Owner question below. Default: exclude sounds. |
| 9 | Info | M | `openai.ts` `openaiSchema` | Strict mode turns every optional field into a required nullable one (`openai.ts:49–72`). 79 `attack` actions carried a numeric `ticks` and were refused (`Unexpected field "ticks"`). | A provider artefact, not a rules issue. | A per-type `anyOf` with only that type's fields is safe. It uses only the public action vocabulary (types, directions, ability names, which are already in the schema and the manual) and no per-situation legality. Keep `validate()` unchanged. Apply it to the OpenAI conversion only; Anthropic's schema keeps optional fields optional. |
| 10 | Low | M | proposed prompt text | Step 6: no solution in any player context. | Guidance that names the cow, the hedge, Black Hole aiming or the grazing bay would be a hint. | Keep guidance generic: batch routine steps, read J's `recovering` state before attacking, don't repeat a message that has not been answered. No scenario content. Re-check after implementation. |
| 11 | Low | H | docs | `AGENT_INTERFACE.md` documents the StepResult fields and the feedback sources. | Docs would not describe the new lines. | Update `AGENT_INTERFACE.md`. `SERVER_CHANGES.md` is unaffected if every change stays in `packages/agent` and `scripts/midterm`. |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass (proposal) | All proposed changes read state after server ticks. None writes `World`. The no-swing check reads `cooldowns.attack`. |
| 2 Rules and art preserved | Pass (proposal) | No server, shared or client change is needed. Cow pull, combat and collision are untouched. |
| 3 Real mechanics, no fixtures | Pass | Not affected. |
| 4 Observations player-visible only | Findings 1, 3, 4, 7, 8 | The J countdown must be dropped. Events must be evaluated per tick against the camera and worded as drawn. |
| 5 Legal actions leak nothing | Pass (proposal) | Legal actions are unchanged. The schema change uses only the public vocabulary (finding 9). |
| 6 No solution in player context | Finding 10 | Applies to the new prompt text. Re-check after implementation. |
| 7 Independent players | Pass (proposal) | Events go only to a hero who saw them. No shared memory. |
| 8 One interface | Pass (proposal) | Feedback comes from the environment for every policy. Baselines ignore it (finding 6). The schema is adapter-only. |
| 9 Limits and terminal reasons | N/A | Not changed by (a)–(d). The output-cap change belongs to the runaway fix, outside this audit's focus. |
| 10 Determinism | Finding 6 | Events and no-swing detection are pure functions of state per tick, so deterministic. Trace line hashes change where lines are added. |
| 11 Suite and reporting | Pass | Tuning stays on S1–S3. No held-out case was used. |
| 12 Sync and recording | N/A | Not in this focus. |
| 13 Validation | Partial | Node 24.22.1: typecheck exit 0; agent tests 255/255 (17 files, 3 held-out-related files excluded). `npm test` and `npm run build` are to be run after implementation. |
| 14 No overclaiming, no secrets | Pass | `python3 -I scripts/evidence/scan_secrets.py` on this report: 1 file scanned, 0 findings. |

## Recommended tests

- **No-swing feedback:** an attack pressed during recovery returns "did not swing / still recovering". An attack pressed when ready swings with no such line. Cover Sieg (with and without Heavy Break if reachable), Coco, and a press whose cooldown expires mid-action.
- **World events:**
  - The hedge burning while on a hero's screen produces one line for that hero.
  - The partner off-screen or in another area gets nothing.
  - A burn that happens while the spot is off-screen produces no line later.
  - A cow move produces one line per action, and no line mentions `parked`.
- **Schema:** the OpenAI schema for `attack` has no `ticks`. Every legal-action example validates against the schema. The schema contains no scenario words.
- **Baseline:** the S1 baseline's start, end and per-step state hashes and its action list are unchanged.

## Open questions for the owner

1. Should audible scene-wide cues ("Burn amber maze bush", "Cow parked / lane cleared") be reported to heroes in the same area even when off-screen, as a human would hear them? Default: no, visible only.
2. Is it accepted that trace-line hashes change where the new feedback appears, while game-state hashes and baseline actions stay identical?
3. Should the pre-existing label mismatches (finding 7) be scheduled separately?
