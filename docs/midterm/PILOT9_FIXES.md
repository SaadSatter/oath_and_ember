# Pilot-9 observation, Push feedback and prompt fixes (2026-10-29)

Implementation commit `a3b19ad` on `midterm/evaluation`. Owner-approved after the pilot-9 diagnosis. Written by the Claude Code implementation agent (session `a209a67a-330b-4dd1-9a07-4cb129ceff9a`); this is not an independent review. No paid call, held-out S4/F run, push or merge.

## Why

Pilot-9 ran on 2026-10-29: revision 2 S2-local (Hedge Maze), seed 0, OpenAI `gpt-6-luna` at medium effort, ledger entry `pilot-9`, git `cd13ed7`. The run record is local and not committed.

- **Result:** ended with reason `error` at 67.9 game-seconds, after 359 calls; $0.2495 charged.
- **The cow was moved.** Coco's Black Hole fired east from the west lane at tick 3539 pulled the cow from x 26 to 23.84. Her earlier shots landed east of the cow or against hedge, and Sieg standing next to the cow would have stopped any pull.
- **What went wrong** (diagnosis from the trace and the maze code):
  - The cow's caption "Harmless cow · blocks the lane" was listed as an `object`, separate from the cow. Sieg pushed at it 22 times. After the cow moved, Coco took the caption for the blocker, adopted Sieg's stale report and turned back from north of the cow.
  - "BLACK HOLE → grazing bay" was an `object` drawn `o` on a hedge cell. Both heroes pressed E there.
  - The cow's 4×4 body was drawn as hedge (`#`).
  - Push gave no movement result.
  - Messages were repeated: "I can't cast Black Hole" eight times, often several messages in one turn.
- **Separate from gameplay:**
  - Sieg's last three calls failed: two timeouts (49.5 s and 32.9 s), then a transport error. The 30 s timer firing at 49.5 s means the runner's event loop was blocked for about 19 s; the cause is not established.
  - The 46-minute 1080p video did not save within 120 s.

## What changed (`a3b19ad`)

**Captions.**
- "Harmless cow · blocks the lane" and "BLACK HOLE → grazing bay" are listed as kind `label` with no screen character: the mechanism pilot-7 used at Mirror Pond.
- The hedge cell under the arrow, (22, 22), now shows `#`.
- Text and positions are unchanged.

**Genuine objects:** the dry hedge, key gate and shears chest are still objects (`o`).

**The cow.**
- Listed as creature "cow" at its centre, with `extent` (its 4×4 body: the engine's collision rectangle, which the client's 128 px sprite covers).
- Every cell whose centre the body covers is drawn `C`. That is the terrain grid's own rule, so these are exactly the cells that showed `#` before.
- Both the drawing and the extent follow the cow as it moves; the existing "The cow moved …" line is unchanged.
- It is listed while any part of the body is on screen.
- No hidden state (`parked`, targets or thresholds) is exposed.

**Multi-tile marks:** they now use the terrain's cell-centre rule. For whole-tile floor art (the pond spike columns) the cells are the same as before.

**Push.**
- A Push with a direction reports walking exactly like a move: the `movement` field, a "…only X of Y tiles… Something stopped you." line, and "Your push n was blocked at once…".
- Every Push also gets one line: "You pushed, but nothing moved." or "Something you could push moved while you were pushing." It is decided by comparing only what Push can move (bridge boulder, pond mirrors, forest crate, pushable offsets) before and after the action.
- Push mechanics are unchanged.

**General prompt** (for both heroes, every scenario):
- trust your latest own observation over an older partner report or your own older notes, and say what changed;
- report significant changes (something moved, a passage opened, something appeared or disappeared) with where;
- do not repeat acknowledged information;
- message only for new information or coordination, keep it short, and one message usually covers it;
- one sentence explains the new Push lines.

No hard message limit, and no API change. The existing guess/fact rule is kept.

**Scripted route and quest baseline** (`asTunedMaze`, `policies/navigate.ts`).
- They navigate by `#` and treat `C` and `o` as walkable.
- `asTunedMaze` rebuilds the earlier maze screen from the observation alone: cow cells back to `#`, its centre `C`, the arrow cell `o`.
- It is a policy-side choice like `asTuned`; every player receives the same observation.
- It guards the frozen route and the held-out S4 start the route builds, which this session may not run.
- A unit test shows it reproduces the earlier screen exactly, at whole and half-tile cow positions.
- The exploration baseline is not adapted and sees the new screen.

**Not changed:** game rules, collision, Push, Black Hole, the cow, enemies, the manual, briefings, scenarios, seeds, limits and checkpoints.

**Existing tests updated** (they pinned the old listing):
- `pilot6Fixes.test.ts`: the caption's kind is now `label`.
- `independentReviewFixes.test.ts`: the cow is now listed from a spot where only part of its body is on screen, and the caption is a label.

## Frozen scripted trajectories: no change

Both versions were run offline (seed 0) with the `scriptedFreeze.test.ts` fingerprint:
- before: an export of `cd13ed7`;
- after: the working tree that became `a3b19ad`.

The comparison covered the quest and exploration baselines on S1, S2-v1, S3-v1, S2, S3, S2-local and S3-local.

**All 14 trajectories are identical:** same outcome, ticks, end hash, action/state digest and step count. No pin was re-pinned. The exploration baseline on the Hedge Maze start is unchanged too: `explore/S2-local` terminated at 6,000 ticks, digest `7eef31333d9855b4`.

A scratch copy with `asTunedMaze` disabled gave the same fingerprints for `quest/S3-v1`, `explore/S3-v1`, `quest/S2-local` and `explore/S2-local`. The adapter is therefore not what keeps these permitted pins; it is kept for the scripted route, which could not be run. `route/seed1` and `checkpointFreeze` were not run (held-out content).

## Verification (this session, at the tree committed as `a3b19ad`)

| Check | Result |
| --- | --- |
| `pilot9Fixes.test.ts` (new): labels and no `o` on hedge, genuine objects kept, captions not targets, cow extent and cells at whole and half positions, a real Black Hole pull (extent, cells and feedback move), `asTunedMaze` equivalence, Push unobstructed / partial / blocked against the cow / no direction / pond mirror moved / deterministic, prompt rules with no scenario content or message limit | 15/15 pass |
| Permitted agent files (all except `suite`, `fullQuest`, `checkpointFreeze`, `scriptedFreeze`, `finalAccess`), `--maxWorkers=4` | 28 files, 409/409 pass |
| `scriptedFreeze.test.ts -t 'baseline on S[123]'` | 6 pass, 1 skipped (`route/seed1`) |
| Server, shared and client tests | 79 files, 563/563 pass |
| `npm run typecheck` / `npm run build` | pass / pass (existing chunk-size warning) |
| Secret scan of changed files | 0 findings |

Not run: the full `npm test`, `route/seed1`, `checkpointFreeze`, held-out S4/F, any paid call.

## Limits

- **Model results before and after `a3b19ad` are reported separately:** the observation and the general prompt changed for every scenario.
- **"Nothing responded" is often missing in the maze.** In the Hedge Maze, the "You pressed E; nothing responded." line can be suppressed while the key-carrying wolf roams, because the press fingerprint includes puzzle state. This existed before this change and is unchanged.
- **The 30 s call timer can fire late** if the runner's event loop stalls (pilot-9: 49.5 s); not addressed here.
- These changes have not been tried with a model.

## Recording: finding and proposal (not implemented)

**Finding.**
- Watched runs record the viewer at 1920×1080 with Playwright. The video is finalized after the episode, under a fixed 120 s limit (`live.ts`: `closeTimeoutMs: 120_000`).
- Videos up to 1,636 s (27 min) saved. Pilot-9's 2,764 s (46 min) recording did not finish within 120 s, and its 199 MB partial file remains in `.recording-tmp/`. Finalizing takes longer as recordings get longer.
- Pacing at speed 1 makes the video as long as the run's real time, which slow model calls dominate.

**Already supported (no code change):**
- `--no-record` keeps the live viewer but records nothing.
- `--no-viewer` runs headless: no viewer, no pacing, no video.
- `startRecorder` already accepts a `size`, but `live.ts` does not expose it.

**Proposed smallest safe fix** (needs approval):
1. Run exploratory pilots with `--no-record`, or `--no-viewer` (which also removes the viewer's load from the runner's process).
2. For recorded evidence runs, make the finalization limit grow with the recording's length in `live.ts`, for example the larger of 120 s and 15% of the recorded seconds, with an upper bound. Pilot-9 would have had about 415 s.
3. Optionally add a `--record-size` flag (for example 1280×720) that passes the existing `size` option through. `recording.json` already records the resolution.

None of these touches the recorder's capture path or the final-evidence workflow.
