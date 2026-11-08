# Pilot-7 observation and prompt fixes (2026-10-28)

Implementation commit `5ab4693` on `midterm/evaluation`. Owner-approved after the
pilot-7 diagnosis. Written by the Claude Code implementation agent; this is not
an independent review.

## Why

Pilot-7: S2-local, seed 0, OpenAI `gpt-6-luna` at medium effort, ledger entry `pilot-7`.
The owner had the run stopped at 11.3 s of game time; it cost $0.058202. Neither
hero entered the pond. Two observation problems misled both heroes:

- **Spike columns were drawn as one cell.** Each column covers four tiles
  (x 40–43, y 24–28), and the human client draws one plate per tile
  (`MirrorPondView.ts`). The observation gave one point and one screen cell at
  y 26, so both heroes read "a row of traps at y≈26" with clear lanes beside
  it. Sieg walked into a rising column at y 24.4.
- **Painted text was shown as interactable objects.** The pond's painted text
  was listed as kind `object` and drawn as `o`. Both heroes pressed E on it about
  30 times. Pressing E on nothing produced no result line, so the prompt rule
  against repeating unchanged actions never applied. The entrance text also drew
  `o` over a wall cell at (45,23), and Sieg walked into that wall repeatedly.

Pilot-7 also showed communication failures. Coco twice reported crossing the culvert,
but never left the court. Sieg never answered Coco's four repeated requests.

## What changed (implementation `5ab4693`)

| Change | Detail |
| --- | --- |
| Spike columns at full height | Every tile of a column is marked `^` (raised) or `o` (other phases). Each `spike trap` entry gains `extent: {x, y, w: 1, h: 4}`. Name, centre (x 40.5–43.5, y 26) and phase text are unchanged. Only the current, drawn phase is reported: no timer, progress, next phase or safe window. A column is listed while any part of it is on screen. Floor marks are drawn under people. |
| Painted text as labels | The entrance, culvert and pond sign, and the A1–A4 floor markings, are now kind `label` with no screen character. Text and positions are unchanged. `VisibleThing.kind` gains `label`; `VisibleThing` gains the optional `extent`. |
| E press with no effect | For an `interact` with nothing in the backpack panel's reach, the environment compares a read-only fingerprint of everything an E press can change, before and after the press. The fingerprint covers phase, areas, the hero's placement epoch, checkpoint, story, villager talks, backpack, inventory targets, puzzles, bridge, interactables and pushables. If nothing changed and the press was not interrupted, the result adds `You pressed E; nothing responded.` The press is still accepted. The pond spike clock is left out, because it is the only field measured to change by time alone (offline probe, S2-local, S3-local and S2, 150 two-tick samples each). Any other change suppresses the line. So a press with any effect, including one with no visible result yet, is never reported as doing nothing. |
| System prompt | Legend entries for kind `label`, `extent` and `^` ("a raised hazard"). The rule on failed actions now covers any failure. New rules: report only progress your observation supports, mark guesses as guesses, answer a partner's direct question before repeating your own request. A test checks that the prompt names no area, puzzle, item or coordinate. |

Not changed: game rules, collision, spike timing, the manual, briefings,
scenarios, seeds, limits and checkpoints. The Hedge Maze's text-only signs
still draw `o`; they were left out of scope.

Model results before and after `5ab4693` are not comparable. Runs record
their `gitHash`, so they can be told apart.

## Frozen scripted trajectories: re-pin of exploration S2/S3 only

`packages/agent/test/scriptedFreeze.test.ts` pins scripted behaviour. One entry
moved: the shared exploration-baseline trajectory that S2 and S3 both start from.
The owner approved re-pinning it (Option 1). No other entry was changed.

| Entry | Old pin (historical, until `fd8c115`) | New pin (from `5ab4693`) |
| --- | --- | --- |
| `explore/S2` | terminated, 6000 ticks, end `cc9ad696c917e214`, digest `53edd2605b70c7ac` | terminated, 6000 ticks, end `ba34603a00ee793d`, digest `e78c8b162f8c735b` |
| `explore/S3` | the same as `explore/S2` (one trajectory) | the same as `explore/S2` |

**Cause.** The old trajectory relied on the "SIEG · Super Speed (2) · East spike
entrance" painted text drawing `o` over the impassable wall cell (45,23). The
exploration baseline treats `o` as walkable. With the text listed as a label, the
cell shows the wall, `#`.

**First divergence** (Sieg's and Coco's decisions interleaved):
- Decisions 1–213 are identical.
- Decision 214, tick 2,999, Sieg at (44.61, 24.4) in Mirror Pond:
  - Old screen: cell (45,23) is `o`, and Sieg chooses `move ne 30`, toward the wall.
  - New screen: cell (45,23) is `#`, and Sieg chooses `move e 30`.
- The cell first appears on screen at decision 208, tick 2,909, where it is `o` in the old screen and `#` in the new one. The choices match until decision 214.
- Both runs make 429 decisions.

**Reproduction.** In an offline scratch replay on tuning scenario S2, seed 0
(no model), the exploration baseline was shown its observations with only the
old `o` restored at (45,23). That reproduced the old pin exactly: end
`cc9ad696c917e214`, digest `53edd2605b70c7ac`.
- Restoring any other old label cell alone does not reproduce it. The other cells
  are (44,31), (24,38) and the four floor markings.
- Restoring the old single-cell spike drawing alone does not change the trajectory.

Unchanged and passing at their original pins: quest S1, quest S2, quest S3 and
exploration S1. `route/seed1` was not run: it plays held-out S4/F content, and
the owner's instruction excludes it.

## Verification (this session, at `5ab4693`, Node v24.19.0)

| Check | Result |
| --- | --- |
| `pilot7Fixes.test.ts` (new): spike extent and cells, phases over time, partial visibility, drawing order, labels, A4 marking, no-effect press, label press, early ignored travel press, travel press, press during a real mirror turn, determinism, prompt rules and absence of scenario content | 12/12 pass |
| Focused regression files: `perception`, `environment`, `s2Feedback`, `s2Briefing`, `modelPlayers`, `localStarts`, `pilot6Fixes`, `pilot6ReviewFixes`, `independentReviewFixes`, `questBaseline`, `s2Adapter`, `openai`, `liveView` (with `pilot7Fixes`) | 14 files, 202/202 pass |
| `scriptedFreeze.test.ts`, baselines on S1–S3 at seed 0 | 6/6 pass, with explore S2/S3 at the new pin; `route/seed1` skipped by filter |
| S2-local scripted solution (quest baseline, offline, tuning seeds 0 and 1, scratch run) | success at 4,544 ticks on both seeds, 0 invalid actions, no `nothing responded` lines |
| `npm run typecheck` | pass |
| `npm run build` | pass, with the existing warning about a client bundle over 500 kB |

Not run: the full `npm test`, `route/seed1`, `checkpointFreeze` and any held-out
or paid run. Earlier on the same day, before this change, the complete suite
passed 950/950 at `fd8c115`.

## Limits

- The fingerprint is conservative. A change made by the partner during the press
  (for example a mirror turn) suppresses the line, even if the press itself did
  nothing.
- These changes have not yet been tried with a model. Whether they help a model
  finish Mirror Pond is untested until the next pilot, which needs the owner's
  approval and spend cap.
