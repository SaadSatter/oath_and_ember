# Cow-passage follow-up fixes (2026-11-06)

The owner asked for three targeted fixes after [COW_PASSAGE_DIAGNOSIS.md](COW_PASSAGE_DIAGNOSIS.md). Implemented by the Claude Code implementation agent in commit `9f16035` on `midterm/evaluation`. Nothing has been pushed or merged, and no paid call was made.

Nothing about the game changed:

- the cow, its collision, the posts, the puzzle rules and the map;
- the sprite and the caption;
- every frozen scenario, its definition and start hashes;
- the scripted baselines.

Historical traces, including pilot-29's, were not repaired or overwritten.

## 1. Trace records are snapshots

`TraceWriter.write` (`packages/agent/src/trace.ts`) serializes each record once. It writes that text to the file and keeps the line parsed back from the same text. Changing an object after it was written can no longer change the kept line or its hash.

The format, the field order and the SHA-256 chain are unchanged. Every existing trace still verifies, and the scripted pins (`scriptedFreeze.test.ts`), which digest trace lines, still pass.

`CentralProgress.view()` also returns copies of each attempt's action and effect list. This is the array whose later growth broke pilot-29's in-memory check at line 118.

## 2. Centralized planner: retrying a blocked way

The four new prompt rules (`centralized.ts`) are general; a test checks they name no place, body, direction or coordinate:

- an observed change justifies walking a blocked way again, and no proof is needed first;
- trying is a test, not a claim, and `subgoals_done` still needs completion-eligible observed evidence;
- signs and captions describe, they do not measure collision;
- a stopped move or an unreachable go_to says what stopped it, so the planner should change its approach and retry after a relevant change, not avoid the place for good.

New observation-only evidence (`centralProgress.ts`, `PROGRESS.version` 2):

- **`route_change`**: a visible body no longer covers tiles it covered on the hero's previous view. It is a fact to test, not completion-eligible, and it does not restart the inactivity clock, which stays consistent with "another actor's movement is not progress".
- **`traversal`**: the hero stands on a tile it saw blocked (`#`, a body's extent) or where its own move was stopped. It is completion-eligible and counts as progress.
- The `displacement` text no longer says the change "does not confirm a puzzle is solved". The attempt outcome text now reads "Observable effects followed this attempt. If they changed an obstacle, walking through it is the test; a subgoal still needs its own observed result."

The planner input gains two fields per hero:

- `unreachable_goals`: each goal, its reason, and whether that hero's map near the way changed since;
- `walking_notices`.

## 3. `go_to` no longer oscillates

**Cause.** The hero memory stores a body's tiles as `:` ("something stood here"), which the grid treated as open once the body left the screen. A walk toward a shut way flipped direction every time the body came into or out of view.

Fix (`navigator.ts`, shared by model-navigator and model-centralized):

- **Remembered bodies.** Off-screen tiles that a body covered when last seen cost `rememberedBodyCost` (25) extra. The screen stays the truth for the tiles it shows, and a body is forgotten once the screen shows its tiles without it.
- **Cycle guard.** A walk that enters the same tile `cycleEntries` (3) times without its best path getting shorter is circling. Counting tile *entries*, not decisions, means lining up inside a tile and the game's corner slides are never counted. The walk tries one local recovery (`cycleRecoveries` = 1): it avoids the loop tiles. If it circles again, it ends unreachable with the tiles named.
- **Observable reason.** When a path exists only if a body is ignored, the reason says so. For example: "On your map only the body of cow (creature) on your screen now, covering x 24–28, y 23–27 closes the way; if it moves, the way may open".
- **Retry after a change.** A goal found unreachable is remembered with a signature of the hero's map around the way. Sending it again walks it again if the map changed. With nothing changed it is retried once (`blockedRetries`), since the change may be off this hero's screen, and then ends at once with the earlier reason. Re-sending the goal that is currently being walked continues the walk; it no longer resets its counters.

## Policy ids and pilot comparability

| Player | Before | After | Why |
| --- | --- | --- | --- |
| model-navigator | `navigator-1f2e87d3` | `navigator-5a8c202e` | new `NAV` bounds and controller behaviour |
| model-centralized | `centralized-9ab2dec9` | `centralized-f0592888` | `NAV_ID`, `PROGRESS.version` 2, new prompt rules (new prompt hash) |

Runs under the new ids are not comparable with:

- pilot-29 (model-centralized, `9ab2dec9`);
- the three model-navigator paid runs of 2026-11-05/06 (`1f2e87d3`).

Earlier pilots stay historical tuning evidence. They are not results for these players.

These are not affected: scripted baselines (they use `navigate.ts`, not `navigator.ts`), model-history/memory/guided players, the suite, held-out scenarios and start hashes.

The centralized test's `NAV_ID` pin was updated from `1f2e87d3` to `5a8c202e`, with the reason in the test.

## Verification (this session, at `9f16035`)

| Check | Result |
| --- | --- |
| The eight original cow-passage tests, after the fixes | 6 passed. The 2 that documented the trace bug failed as expected and were replaced by regression tests |
| `cowPassage.test.ts` (10) and `obstacleRetry.test.ts` (7) | 17/17 passed. They cover the trace mutation from the failed run, the exploration rules and evidence, the planner's `unreachable_goals`, go_to ending unreachable in S2-B (it oscillated for over 1,100 ticks before), a bounded unchanged retry, and arrival after Coco's Black Hole opens the way |
| Related suites (centralized, centralProgress, navigator, navigatorIntents, promptFreeze, scriptedFreeze, modelPlayers, wolfCatch, modelMemory) | all passed after the `NAV_ID` pin update |
| `npm run typecheck`, `npm run build` | passed |
| Full suite, 4 workers | 1,263/1,264 (131 files, 108 s) |
| Full suite, default concurrency | 1,263/1,264 (163 s) |
| Frozen baseline: `baseline-quest` S2-local seed 0, headless, through the launcher | success, 395 decisions, 0 invalid; start `fdc49877…`, end `6644f2cac04b9454…`, equal to the pin |
| Free manual-stop recording: model-centralized, mock gateway, SIGINT after about 75 s | exit 130, `manual_stop`; see below |

Manual-stop recording details:

- **Trace:** 1,877 lines, hash chain verified; trace SHA-256 `f2543775…`.
- **Records:** `summary.json` written; `live.json` shows `interrupted: true`, `error: null`.
- **Video:** `recording.json` shows saved, `finalConfirmed: true`. The video (1280×720, 79.9 s) decodes, and its last frame shows the overlay "finished: manual_stop · 49.0 s game time · 75 model calls · $0.0000".
- **The old bug's trigger occurred in this run.** Four attempts gained effect ids after a note about them had been traced, first at seq 1674, updated by seq 1794.
- These run files are local scratch, not committed.

### Full-suite failure, reported separately

`packages/agent/test/s2Shutdown.test.ts › bounded recorder cleanup › gives up on a video that never finalizes…` fails on an error-message match: it expects `/not a valid recording/`. **It also fails without these changes.** A clean worktree at `327c34a` failed this one test, 1,246/1,247, both at 4 workers and at default concurrency. It is the known recorder failure already recorded in MODEL_NAVIGATOR.md and MODEL_CENTRALIZED.md, and no recorder code changed.

The earlier load-dependent failures (6 and 12 tests in two 386 s runs, during the diagnosis session) did not reproduce. In this session the default-concurrency suite ran in 134 s (clean) and 163 s (changed), with only `s2Shutdown` failing. Their likeliest cause is other load on the machine at that time; this is not proven.

## Not done

- No paid run. The new behaviour's effect on model play is unmeasured.
- The session-evidence record for this session, and an independent `rules-reviewer` pass, are left to separate invocations as `CLAUDE.md` requires.
