# Hedge Maze cow passage: root-cause investigation (2026-11-06)

Investigation only. No gameplay, collision, scenario, hash, baseline or prompt change was made. No paid call, push or merge. The only new code is the offline test `packages/agent/test/cowPassage.test.ts` (8 tests). Scratch probes used for exploration are not committed.

Run examined: `evaluation-runs/live/S2-local-seed0-model-centralized-openai-2026-11-06T03-44-31-567Z` (pilot-29, `327c34a`, `openai:gpt-6-luna@medium`). Its trace is `S2-local-seed0/trace.jsonl`, SHA-256 `c930d8312274d159fdaed4492e709ac7357cc23fe305f311eea19d72dbb622c6`, 2,296 lines. It was not modified. The three model-navigator runs of 2026-11-05/06 were also examined.

## Summary

1. **The passage is physically open once the cow's centre has moved 36 px west, and one legal Black Hole cast moves it 69 px.** Direct moves, the model-navigator `go_to` controller and the scripted baseline all walk through the opening in the real engine. The navigation grid marks it correctly.
2. **The model-centralized run never tried to cross.** The cow was passable from tick 1509 and parked from tick 1560. After that, the planner replied 58 times and never ordered a hero north through the post gap. On one of its own orders Sieg walked through the south posts and stood beside the parked cow at (27.49, 24.52), tick 2029. The planner then ordered him back south: "The cow's movement is not proof the puzzle is solved". Its obstacle list kept repeating the fixed caption: "its sign says it is too wide for the posts".
3. **All three model-navigator runs did cross the passage** (ticks 3068, 4719 and 3169) and reached the wolf and gate side. Those runs failed later in the maze, not at the cow.
4. **What a human sees is misleading.** The cow sprite's visible pixels are 75 px wide but its collider is 128 px. That is why the passage *looks* open or nearly open in recordings while the cow is unmoved or only partly pulled. Agents get the collider rectangle, not the sprite.
5. **"Trace integrity failure at line 118" is a recording bug, not a gameplay divergence.** The trace file on disk verifies completely. An in-memory trace line held a live reference to an array that the centralized progress tracker kept appending to. The final in-memory check, run after the manual stop, saw the changed line. Because of that exception, `summary.json` was never written.

## 1. Geometry (real engine values)

The hero is a 26 px square (`HALF = 13`, `packages/shared/src/constants.ts:12`). Tile = 32 px. The lane is tiles x 24–28 (px 768–896), y 12–30 (`mazePaths [24,12,4,18]`, `packages/shared/src/hedgeMaze.ts`). The grazing bay is tiles x 18–24, y 23–27.

| Body | Collider (px) | Source |
| --- | --- | --- |
| Cow, unmoved | centre (832, 800); rect x 768–896, y 736–864 | `mazeCowRect`, `hedgeMaze.ts:118`; `newHedgeMaze` |
| Cow, parked (S2-C, seed 0) | centre (763.10, 800); rect x 699.1–827.1 | after the baseline's cast |
| North posts | x 768–830 and x 886–896, y 712–732 | `mazeCowPosts`, `hedgeMaze.ts:41-50` |
| South posts | x 768–830 and x 886–896, y 868–888 | same |
| Post gap | x 830–886 (56 px) | `MAZE_POST_GAP`, `hedgeMaze.ts:41` |
| East lane hedge | x ≥ 896 | `mazeHedges` |
| Cow sprite | 128×128 drawn at the cow's centre; **opaque pixels x 28–102, y 8–120 of the image** (75 × 113 px) | `apps/client/public/assets/environment/hedge-maze/cow.png`, `HedgeMazeView.ts:215` |
| Post sprite | width cropped to each post's width (matches); foliage 45 px tall centred on the 20 px post | `HedgeMazeView.ts:203-213` |

**Clearance.** Walking north at a fixed x, a hero's centre must fit in two places:

- the post rows, so 830 + 13 ≤ x ≤ 886 − 13, which is **843 ≤ x ≤ 873**;
- beside the cow, so x ≥ cow.x + 64 + 13.

So the passage is open if and only if **cow.x ≤ 796** (24.875 tiles), a westward displacement of at least **36 px**. Once the cow is parked at 763.1, the open band for hero centres is x 843–873 (tiles 26.34–27.28), which leaves 30 px (0.94 tile) of slack. The test checks this with the real `constrainMotion` and `collisionRects`: 796 passes, 797 is blocked, and the open band at the parked position is exactly [843, 873].

### Diagram: parked cow (S2-C, seed 0)

```
 px x:   699      768    800 827 830 843   873 886 896
 tile:   21.85    24     25  25.85     26.34 27.28   28
          |        |      |   |   |    |     |   |   |
 y 712 ###########[==post=====]   .  gap  .  [p]#####   north posts (y 712-732)
 y 732 ###########[===========]   .       .  [p]#####
 y 736 +------------------------+ .       .     #####
       |  COW collider          | .  hero .     #####
       |  128x128, centre       | . centre.     #####   lane beside the cow
       |  (763.1, 800)          | . band  .     #####   free for hero centres
       |  sprite body ~727-801  | . 843-  .     #####   at x 843-873
 y 864 +------------------------+ . 873   .     #####
 y 868 ###########[===========]   .       .  [p]#####   south posts (y 868-888)
 y 888 ###########[===========]   .       .  [p]#####
          grazing bay ->|<- lane x 768-896 ------------>|
```

### What each hero's screen and the navigator grid show (S2-C, rows 22-27, tiles 22-29)

The screen marks a cell `#` when the cell's **centre** is inside a wall (`perception.ts:701`). The cow is marked `C` on cells whose centre its rectangle covers. The navigator makes every cell the cow's extent overlaps impassable (`extentCells`, `navigator.ts:223`).

```
 tile x:   22 23 24 25 26 27 28 29
 row 22:    #  #  #  #  .  .  #  #     24-25 = post (centres 784, 816 < 830); 26-27 open
 row 23:    C  C  C  C  .  .  #  #     navigator: cells 21-25 hard (extent 21.85-25.85)
 row 24:    C  C  C  C  .  .  #  #
 row 25:    C  C  C  C  .  .  #  #
 row 26:    C  C  C  C  .  .  #  #
 row 27:    #  #  #  #  .  .  #  #     south post row
```

The grid is correct with one small exception. In the two post rows, column 27 is drawn `.` because its centre (880) is outside the post, which starts at 886. A hero centred at 880 would overlap the post (880 + 13 > 886). The engine's corner slide (`CORNER_SLIDE = 10`, `movement.ts:76`) nudges the hero 7 px onto x 873, and the move carries on. Live runs show this as one to three "Something stopped you" lines ending at x 27.28. It never blocked a crossing.

With the cow unmoved (S2-B), cells 24–27 of rows 23–26 are `C`, and the navigator correctly finds no way through the lane.

## 2. Reproduction: direct movement vs `go_to` (real engine, seed 0)

The heroes use only ordinary legal actions. `go_to` is the real `NavigatorPlayer` controller, given a fixed goal by a fixture in place of a model. All rows below are asserted in `cowPassage.test.ts` or come from the scratch probes that preceded it.

| Start | Hero / method | From → goal | Result |
| --- | --- | --- | --- |
| S2-B (cow unmoved) | Sieg, `move n` ×4 at x 26.5 | (26.5, 30.5) north | Stopped at y **27.4** (= 864 + 13, the cow's south edge) |
| S2-B | Coco, same | same | Stopped at y **27.4** |
| S2-B | Sieg, `go_to` | (26.5, 30.5) → (26.5, 19.5) | Never arrives. It walks to the bay, then alternates `sw`/`ne` between (19.56, 33.52) and (20.47, 32.61) for over 1,100 ticks, asking the model every 12 moves. It never reports the goal unreachable (secondary defect, §5c) |
| S2-C (cow parked) | Sieg, `move n` at x 26.5 | (26.5, 30.5) north | Through both post rows to y **12.4** (top of the lane), no stop |
| S2-C | Sieg, `move n` at x 27.5 | (27.5, 30.5) north | One slide to x 27.28 at the south post, then through to y 12.4 |
| S2-C | Sieg, `move n` at x 26.0 | (26.0, 30.5) north | Stopped at y **28.15** (= 888 + 13, the south post) |
| S2-C | Sieg, `go_to` | (26.5, 30.5) → (26.5, 19.5) | Arrived (26.39, 19.53), no stop |
| S2-C | Sieg, `go_to` | (27.5, 30.5) → (27, 19.5) | Arrived (27.48, 19.55), no stop |
| S2-C | Sieg, `go_to` | (20.5, 34.5) → (32.5, 19.5) | Arrived (32.49, 19.47) through the lane, no stop |
| S2-C | Sieg `go_to` north **and** Coco `go_to` south, at the same time | (26.5, 34.5) → (26.5, 19.5); (32.5, 19.5) → (26.5, 31.5) | Both arrived. They crossed in the same column. The only stop was Coco's corner slide onto x 27.28 |

## 3. The intended puzzle: Black Hole

Coco casts Black Hole east from the bay. The bolt stops at the cow's west edge, and the vortex pulls the cow along x only, toward the vortex, for up to 4 s at 100 px/s. The pull stops early in three cases (`pullMazeCow`, `apps/server/src/hedgeMaze.ts:162-212`):

- the vortex is more than 96 px away;
- a wall blocks the line;
- **a living hero is within 77 px (64 + `HALF`) of the cow's next centre on both axes** (lines 200–209).

Once the cow is parked (x ≤ 763.2) it can never move again (line 168).

| Coco's position, cast `e` | Cow centre after (tiles) | Moved | Passable? |
| --- | --- | --- | --- |
| (20.5, 25.5), the baseline's spot | 26 → **23.847**, parked (30 ticks: 24.63, 60 ticks: 23.87) | 68.9 px | yes |
| (20.5, 24.0) | 23.849, parked | 68.8 px | yes |
| (19.0, 25.0) | 23.813, parked | 70.0 px | yes |
| (21.5, 25.5) | 24.028, **not parked** (Coco's body stops it) | 63.1 px | yes |
| (22.0, 25.5) | 24.540, not parked | 46.7 px | yes |
| (22.5, 25.0) | 25.010, not parked | 31.7 px | **no**: 4 px short. Visually the gap looks wide open |
| (23.0, 25.5) | 25.495, not parked | 16.2 px | no |
| (21.0, 24.0), cast `ne` | unmoved | 0 | no (vortex out of range or line blocked) |
| (26.5, 30.5), cast `n` from the lane | unmoved | 0 | no (only the x component pulls; east is clamped) |
| (20.5, 25.5) with Sieg waiting at (26.5, 29) or (24.5, 30.5) | 23.847, parked | 68.9 px | yes: Sieg south of the posts does not obstruct |

Answers to the phase 3 questions:

- **Minimum displacement:** 36 px (cow centre ≤ 796 px, 24.875 tiles).
- **Can a legal cast produce it?** Yes. One cast from anywhere in the bay with x ≤ 22 does it within 30–60 ticks.
- **Can Coco move out of the way?** Yes. Only her own body near the cow's path stops the pull. From x ≤ 21.5 it parks or passes; from x ≥ 22.5 it stops short. An unparked cow can be pulled again by a later cast.
- **Is the opening large enough for both heroes?** The band admits one body width at a time (0.94 tile of slack), but heroes do not collide with each other (`collisionRects` adds players only on `BRIDGE_RUINS`, `maps.ts:382`). Both crossed at once in the test.
- **Does navigation detect the opening?** Yes. The cow's extent updates every observation, and `go_to` arrived through the gap in every S2-C trial. In the live run, Sieg's `go_to (27, 24.5)` reached the cell beside the parked cow.
- **Does the scripted baseline use the same rules?** It uses the same physics: every hero, scripted or model, submits move intents through `AgentEnvironment.step` into the same `GameRoom` movement (`movement.ts`). The planners differ. The baseline uses `navigate.ts planStep` over `asTunedMaze`'s screen (cow `C` cells drawn as `#`) and follows column 26.5 (`questKnowledge.ts:54`, `cocoToGateSide`), the centre of the open band. The model navigator uses `navigator.ts` A*. S2-C's own start (Coco at (32.5, 19.5)) is the baseline's real crossing, replayed.

## 4. Hypotheses

| | Hypothesis | Verdict | Evidence |
| --- | --- | --- | --- |
| A | Too narrow despite looking open | **Accepted only before 36 px of displacement**; rejected after | An unmoved cow and partial pulls under 36 px are physically shut (S2-B direct moves; the (22.5, 25) cast). Any cast that moves 36 px or more opens it (§1, §2) |
| B | Open, but the navigation grid marks it blocked | **Rejected** | Grid and screen in §1. `go_to` arrived in 4 of 4 S2-C trials |
| C | The pathfinder makes a route the controller cannot execute | **Minor, contributing only** | Column 27 shows `.` in the post rows although a centred hero overlaps the post. The corner slide recovers (one to three nudges per run, all ending at x 27.28). Separately, `go_to` never gives up when the lane *is* shut (§5c) |
| D | Cow collider or sprite misaligned | **Accepted for what humans see; no effect on agents** | The sprite is centred correctly, but its opaque body is 75 px wide inside a 128 px collider. Unmoved: the body looks like it leaves a 26 px strip (a hero's width) beside it, though clearance is 0. At cow 25.01: the strip looks 58 px wide, though the gap is 4 px too narrow. Observations report the collider (`perception.ts:405`, `floor: mazeCowRect`) |
| E | The heroes obstruct each other | **Rejected for walking**; heroes can obstruct the *pull* | No hero-to-hero collision outside the bridge; the crossing test passes. A hero within 77 px of the cow's path stops the cow (§3) |
| F | The cow moves during navigation | **Rejected** | A parked cow never moves (line 168). In the run it stayed at 23.84 from tick 1560 to the end |
| G | The agents never attempt the correct route | **Accepted: primary cause in the model-centralized run** | See below |

**G in detail (model-centralized, pilot-29):**

- Coco's cast at tick 1509 made the cow passable, and it was parked from 1560 to the end (3681).
- After 1509 the planner replied 58 times. None ordered a hero through the north posts (no hero was ever in the lane at y ≤ 23.3).
- At 1978 the planner sent Sieg `go_to (27, 24.5)`. The controller walked him through the south post gap: one corner slide at (27.53, 28.51) → (27.28, 27.85), then `nw`, `n`, `ne` to (27.49, 24.52), beside the parked cow.
- At 2029 the planner ordered him back south: "The cow moved, but the grazing-bay puzzle is not confirmed solved… Sieg moves south to clear the cow area." Later orders sent the heroes around the southern maze and back to the shrine.
- The most repeated lines in `known_obstacles` after 1509 were "The cow puzzle is unconfirmed; its sign says it is too wide for the posts" (6) and "The cow's movement does not confirm its puzzle is solved" (5).

Contributing sources, all agent-side or presentation, none physical:

- The caption `MAZE_COW_CAPTION` = "Harmless cow · too wide for the posts" (`perception.ts:293`, listed at `perception.ts:406-411`; drawn by `HedgeMazeView.ts:217`) is fixed text that stays on screen after the cow is parked. Read literally, it says the way past the posts is shut.
- The centralized prompt and progress tracker tell the model not to infer outcomes: "The saved completed text is the evidence fact itself, never a stronger inferred puzzle outcome" (`centralized.ts:94`), and "causation and subgoal completion are not assumed" (`centralProgress.ts:282`). Nothing generic tells the planner that cells it could not reach before are reachable now, so it kept treating the cow as an open question.

**The model-navigator runs crossed.** For each run: tick the cow became passable → tick a hero first crossed north of the posts.

- `…11-05T23-26-47`: 2352 → 3068 (Coco).
- `…11-06T00-44-00`: 3967 → 4719 (Coco).
- `…11-06T01-32-22`: 1340 → 3169 (Coco), with Sieg following at 3198.

In each run the heroes went on to the gate and wolf area (y < 12.5). The "cow-passage failure" there is a 12–30 s delay before crossing, not an inability to cross.

## 5. Proposed fixes (not implemented; each needs the owner's approval)

**a. Trace recording (agent side; no gameplay effect).** The smallest fix is one line in `TraceWriter.write` (`trace.ts:35-40`): store the parsed copy of what was written, `JSON.parse(text)`, instead of the live `line` object. Optionally also copy arrays in `CentralProgress.view` (`[...a.effects]` at `centralProgress.ts:381`, `{ ...a.action }`).

- Consequences: none for frozen scenarios, start or definition hashes, baselines or prompts. Hashes are computed from the same content, so every existing trace still verifies.
- The second trace test in `cowPassage.test.ts` would flip, to expect no throw.

**b. Model-centralized planner (agent side; must not become a hint).** This should be a generic, observation-only reachability fact. For example: "cells on your remembered map that no path reached before are reachable now", computed from the heroes' own maps when a blocking body moves. It must not mention the cow, the posts or the route.

- Alternative or addition: soften the "never a stronger inferred puzzle outcome" rules, so that an observed change to the map counts as progress.
- Consequences: a new centralized prompt and policy id (currently `centralized-9ab2dec9`), so later pilots are not comparable with pilot-29. No effect on the frozen suite, baselines or start hashes.
- This needs the information-boundary audit (`game-rules-audit`) before any run.

**c. Navigator controller (agent side).** `go_to` should declare a goal unreachable instead of oscillating (S2-B row in §2). The cause of the oscillation is not isolated yet. A likely candidate is the unknown-cell cost (`NAV.unknownCost = 3`) together with the 12-move re-ask, which keeps two routes alternating. Separately, the controller could avoid aiming at cell centres that sit within `HALF` of a wall (column 27 in the post rows). This is cosmetic: the corner slide already recovers.

- Consequences: the navigator and centralized policy ids change. No frozen-suite effect.

**d. Presentation (game change; owner approval, then the re-pin workflow).** Two options:

- Change or hide the cow caption once the cow is parked (`HedgeMazeView.ts:217`, `perception.ts:406-411`).
- Make the cow's drawn body match its 128 px collider, or shrink the collider to the drawn body. **Shrinking the collider is a rules change.** It would change the post-gap arithmetic and S2-B/S2-C state, so it is not recommended.

Consequences:

- Changing perception text changes every model player's observations from S2-A onward.
- Re-check `scriptedFreeze`/`asTunedMaze`: the baseline does not use the cow caption.
- Rerun the S2 start-hash and baseline pins, per the game-change workflow (main → merge → new revision).

No collision or puzzle change is needed for the puzzle to work as intended.

## 6. Trace integrity failure at line 118

- **On disk the trace is intact.** Recomputing every hash in `trace.jsonl` with the same digest as `verifyTrace` (`trace.ts:44-52`) finds 0 bad lines of 2,296. The final line is a normal `outcome` with `reason: manual_stop` at tick 3681.
- **Where the error came from:** `runOne` calls `verifyTrace(trace.lines)` on the **in-memory** lines after the episode (`harness.ts:465`). `TraceWriter.write` keeps the `line` object it hashed (`trace.ts:35-40`), and that object shares nested objects with the caller's `data`.
- **What changed line 118:** line 118 is Coco's planner `policy_note` at tick 548. Its `data.progress` came from `CentralProgress.view()`, which returns `confirmed_effect_ids: a.effects` (`centralProgress.ts:381`), the attempt's own array. Line 118 is the first note with an attempt that later received effects. That attempt was Coco's Fireball at tick 546, which burned the dry hedge. At a later update `a.effects.push(...)` (`centralProgress.ts:271`) appended `observed-13` … `observed-19` into that same array. The first later line showing them is seq 131. The in-memory line 118 then no longer matched its hash, and `verifyTrace` threw at index 118.
- **Verdict:**
  - not caused by manual cancellation (the stop only triggered the end-of-episode check; any ending would have thrown);
  - not a gameplay divergence;
  - a recording/serialization aliasing bug in the in-memory copy, present at `327c34a`.
  - It affects every model-centralized episode with a confirmed effect after a planner note. The model-navigator does not use `CentralProgress`.
- **Consequence for this run's evidence:** the exception was raised before `summary.json` was written, so the episode folder holds only `trace.jsonl`. `live.json` records `interrupted: true` and the error. Nothing was rewritten or discarded. A summary can be regenerated from the verified trace if the owner wants one.
- **Reproduced** by the last two tests in `cowPassage.test.ts`:
  - `view()` returns the same array instance each time;
  - a `TraceWriter` line whose nested array is pushed after writing verifies from the file but throws "Trace integrity failure at line 0" in memory.

## Checks run (this session)

- `npx vitest run packages/agent/test/cowPassage.test.ts`: 8/8 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm test`: **not green**. Two full runs failed 6 and 12 tests respectively, with different tests each time, all long-running (up to 184 s). Every failing file then passed when run on its own: `localStarts`, `harness`, `finalAccess`, `mirrorPondWalkthrough` (56/56), and `hedgeMazeSituations`, `paidSafety`, `recorderShutdown`, `suite` (55/55). These look like timeouts under parallel load. I did not run the full suite without the new test file to confirm the failures predate it.
