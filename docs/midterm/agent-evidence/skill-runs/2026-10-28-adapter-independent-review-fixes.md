# game-rules-audit: adapter (proposed fixes for independent-review findings 1–5 and evidence corrections)

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Session | 4bd24137-7c42-410e-b365-f6f9798a700f (Claude Code, the implementing session; this is not an independent review) |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756 |
| Commit audited | fb844ae. The working tree held one untracked file that this session did not write: `docs/midterm/agent-evidence/skill-runs/2026-10-28-suite-local-starts-preflight.md`, from a concurrent Codex session `01a17e49…`. It was left untouched. |
| Target and focus | `adapter`: pre-implementation audit of the owner-approved fixes for findings 1–3 of `docs/midterm/agent-evidence/reviews/2026-10-28-pilot6-independent-review.md` (committed unchanged in `fb844ae`), plus the regression and documentation work for findings 4–6. Proposal: (1) movement classification in unrounded world units, relative to open ground; (2) lethal-hit detection by observing the public `GameRoom.damage` call, interrupting any running action with a neutral line; (3) two-decimal truncation for listed partners, enemies, creatures, projectiles and effects, with `asTuned` extended for scripted players; (4) a committed Slow Time carry test and a loud failure if the carry record is missing; (5) story-walk ticks counted as not applied, from `World.story.walks`; (6) evidence corrections. Nothing is implemented yet. |
| Files read | The independent review and session record 37; `apps/server/src/GameRoom.ts` (`damage` 1753–1782, and every player-HP write in `apps/server/src`); `apps/client/src/animation/PlayerPresentation.ts:124–130`; `apps/client/src/net/{prediction,interpolation,NetworkClient}.ts` (epoch handling); `manual/Oath_and_Ember_Player_Manual.md:108`; `packages/shared/src/storyWalk.ts`, `gameTypes.ts` (`walks`); `packages/agent/src/{environment,movementReport,perception}.ts`, `policies/{navigate,combat,questBaseline,baseline}.ts`, `route/fullQuest.ts`; `scripts/evidence/{extract_sessions,render_sessions}.py`; the session records that contain the example PR URL |
| Commands run | `git rev-parse --short HEAD` → `fb844ae`; `git status --short` → the one foreign untracked file above. Bundled Node v24.19.0: `npm run typecheck` → exit 0; `npx vitest run packages/agent` → 28 files, 356/358, with 2 failures in `openai.test.ts` ("keeps both legacy paid entrypoints disabled", "canonical launchers reject unapproved OpenAI configurations …"); `npx vitest run packages/agent/test/openai.test.ts` alone → 37/37 passed (subprocess launcher tests under parallel load). `npm run build` and the full `npm test` were not run in this audit; they run after implementation. `scan_secrets.py` on this report → 1 file, 0 findings. |

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | M | `packages/agent/src/movementReport.ts:96–107, 124–128` | Confirmed by the review (repro D): one slowed tick on open ground covers 0.633 px = 0.0198 tiles, which is under the absolute `STILL_TILES` 0.02, so the move is classified `none`. The line is gated on the **rounded** `requestedTiles`. | A false collision line on a legal move; it stops batches. | Classify relative to the open-ground distance, in unrounded world units: `none` when distance travelled < 5% of open ground; `full` when progress ≥ 90%; otherwise `partial`. Gate the collision line on the unrounded open-ground distance (> 0). Word the `none` line so it never contradicts `movedTiles`. Test 1-tick and short moves for both heroes, with and without Slow Time, and blocked short moves. |
| 2 | Medium | H/M | `apps/server/src/GameRoom.ts:1753–1782`; `packages/agent/src/environment.ts` interruption rule | Every lethal player hit passes through `GameRoom.damage` (direct calls and the callbacks at 1457, 1583, 1644, 1646, 1699; pond spikes floor HP at 1, `mirrorPond.ts:117`). Inside the call: HP reset to 100, move to spawn, `movementEpoch++`. Nothing else in `damage` changes the epoch. **What a human sees:** the client shows "defeated" only when a snapshot has `hp <= 0` (`PlayerPresentation.ts:126`), which never happens because HP is reset in the same call. The hero jumps instantly to spawn ("Teleports, respawns and scene changes appear at once", `prediction.ts:137`) with a full health bar. The manual tells players this rule (`Player_Manual.md:108`). | Today the death is silent for every action. A model can misread its position or progress. | Observe the call, without changing it: on each reset, wrap the room instance's public `damage` with a function that calls the original with the same arguments and records the hero when the epoch changed inside the call. This is exact, needs no inference, and is deterministic. On such a tick, interrupt the hero's running action (move, wait, defend, any timed action) with one neutral line that matches the manual and the screen, e.g. "Your health ran out. You are back at this area's starting point with full health." State no damage source or amount. Respawn displacement stays a game-moved tick, never walking. Document that the wrapper is trusted-side observation. |
| 3 | Medium | M/H | `packages/agent/src/perception.ts` (`visible` x/y); `policies/{combat,questBaseline}.ts`, `route/fullQuest.ts` | The scripted players read the listed coordinates of enemies, creatures (the wolf, the cow, the griffin), projectiles and the partner. Truncating those changes their inputs. | Possible change to frozen scripted behaviour (start states, baseline results). | Truncate the listed `x/y` of the partner, enemies, creatures, projectiles and effects; leave static objects and exits on `round1`. Extend `asTuned` to round the same kinds back to one decimal for scripted players. Treat the committed `scriptedFreeze.test.ts` as the gate: **if any pinned value changes, stop and ask the owner; do not re-pin.** Test values just below integer boundaries (25.96, 25.996) for the listed value against the drawn cell. |
| 4 | Low | M | `packages/agent/src/environment.ts` `carried()` | The private `GameRoom.carried` record is read through an unchecked cast; a rename would silently switch off carry detection (review finding 4). | A silent regression. | Fail loudly at reset if the record is not a `Map`. Commit the review's carry repro as a test (Hedge Maze entrance row, Sieg at (3, 33), Coco 27 px east, Super Speed and Slow Time, Sieg moving east). The test fails if detection breaks. |
| 5 | Low | M | `packages/shared/src/storyWalk.ts:28–52`; `GameRoom.ts:997–999` | A story walk replaces the input with a normalised vector `(dx/d, dy/d)`, keeping the frame's `seq`. It equals an agent frame only when exactly axis-aligned and in the same direction (agent frames are ±1/0, unnormalised on diagonals). The same null-condition as `storyWalkInput` (`walks[id]` present and `tick >= start`) identifies walked ticks from the public `World.story.walks` record, which is also sent to clients. `tickStory` runs only at the start of `tick` (892), so the record after the tick is the one movement used. | Same-direction walks would be counted as applied. | Count a tick as not applied when that condition holds after the tick. Reproduce first with a **labelled** fixture walk mark placed directly along the hero's move. If it cannot be reproduced, document the risk instead. |
| 6 | Low | H | `scripts/evidence/extract_sessions.py:33, 84`; records 23–25, 27, 28, 30, 33, 37 | The PR regex collects `game-dev-f26/pull/123`, the example URL quoted in `MIDTERM_GUIDELINES.md`, whenever a session reads the guidelines. | The evidence lists a PR that does not belong to this project. | Exclude that exact URL in the extractor, with a comment. Have the renderer say so on the PR line. Re-render the affected records and accept a re-render **only** if its diff is limited to that line. Keep every narrative, including session 37's, unchanged. |
| 7 | Info | M | `packages/agent/test/scriptedFreeze.test.ts:39, 41` | The `explore/S2` and `explore/S3` pins are one trajectory (review finding 7). | They could be double-counted in a comparison. | Say so in the test, in `EVALUATION_SUITE.md` and wherever results are reported. |
| 8 | Info | M | `movementReport.ts` | `from`/`to` are truncated independently, while distances are measured on exact positions. Their displayed difference can differ from `movedTiles` by up to 0.01. | Cosmetic (review finding 8). | Explain it in the type comment and `AGENT_INTERFACE.md`; make the line text consistent with `movedTiles`. |
| 9 | Info | H | worktree | A concurrent Codex session (`01a17e49…`) is writing in this worktree (an untracked S2-local/S3-local suite audit). | Risk of mixing another session's files into these commits. | Stage only this change's paths; check `git status` before each commit; report the overlap to the owner. |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass (planned), finding 2 | The `damage` wrapper calls the original unchanged and only records. All other measurements are reads or copies. |
| 2 Rules and art preserved | Pass (planned) | No file under `apps/` or `packages/shared/`. |
| 3 Real mechanics, no fixtures | Pass, with conditions | Lethal-hit, carry and story-walk tests may set up area, positions, HP or a walk mark through **labelled** fixtures; every outcome comes from real ticks. |
| 4 Observations player-visible only | Findings 2, 3 | The defeat line restates the manual's rule and what the screen shows. Truncation adds no entity and no hidden information. |
| 5 Legal actions leak nothing | Pass | Unchanged. |
| 6 No solution in any player context | Pass | No content change to prompts or the briefing beyond general wording. |
| 7 Independent players | Pass | Per-hero detection and lines. |
| 8 One interface | Finding 3 | Same observation for all players; `asTuned` stays scripted-only. |
| 9 Limits and terminal reasons | Pass | An interruption ends an action, not the episode. |
| 10 Determinism | Pass (planned) | Gate: `scriptedFreeze.test.ts`. |
| 11 Suite and reporting | Finding 7 | Record the observation change in the `EVALUATION_SUITE.md` change log. |
| 12 Synchronization and recording honesty | N/A | |
| 13 Validation | Typecheck passes; agent tests pass apart from 2 load timeouts in `openai.test.ts` (37/37 alone) | Full suite after implementation. |
| 14 No overclaiming, no secrets | Finding 6 | `scan_secrets.py` on this report: 1 file, 0 findings. |

## Recommended tests

- 1-tick and 3-tick open-ground moves, for both heroes, with and without Slow Time → `full`, no line. The same moves against a wall → `none` or `partial` with the line.
- A lethal hit during a `move` and during a `wait` → the action is interrupted with the defeat line; the respawn tick is game-moved; no collision line; deterministic across two runs.
- Listed partner and enemy coordinates at 25.96 and 25.996 → listed value truncated, and its whole part equals the drawn cell.
- Slow Time carry → `movedByGame > 0`, the neutral line, no collision line.
- A same-direction story walk (labelled fixture walk mark) → not applied.
- `scriptedFreeze.test.ts` unchanged and passing.

## Open questions for the owner

1. Should the defeat line interrupt instant actions as well? They take no game time, so no death can occur during one; the proposal covers timed actions only.
