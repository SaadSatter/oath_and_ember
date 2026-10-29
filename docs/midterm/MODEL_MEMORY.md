# Opt-in persistent memory player: `model-memory` (2026-10-29)

Workstream B, after the [pilot-10 diagnosis](PILOT10_DIAGNOSIS.md). Written by
the Claude Code implementation agent; this is not an independent review. No
paid call, held-out S4/F run or inspection, pin change, gameplay change, push
or merge.

`model-memory` is `model-history` plus one extra field, `memory`, in each
user message, and one extra prompt section that explains it. Nothing else
changes: the same observation, legal actions, batching, notes, action logs,
budget, ledger and traces. It is opt-in and restricted to S1–S3 tuning runs.

## 1. Architecture findings

| Question | Answer |
| --- | --- |
| Where observations are made | `perception.ts` `perceive()`, called by `AgentEnvironment.observe()` (`environment.ts`). Per-hero `PlayerMemory` (environment-owned) holds feedback, received messages, dialogue log and the coarse `exploredRows` blocks. |
| Where per-hero state can live safely | In the policy instance. `harness.policiesFor()` builds a new pair of `LLMPlayer`s for every episode, one per hero, each with its own metered gateway. A policy only ever receives its own hero's observation, legal actions and turn report (`runner.ts`). Putting the memory there needs no environment or observation change, so other players cannot be affected. |
| Reset, seeds, replay, isolation | `reset(seed)` rebuilds the room and both `PlayerMemory`s and replays the scenario prefix by real play. Game time is deterministic, and the scripted mock gateway gives identical prompts for identical seeds (tested). Policies are rebuilt per episode; `HeroMemory` also clears itself if game time ever goes backwards. |
| How policies are selected | `--player` → `PlayerKind` (`playerKinds.ts`) → `policiesFor()` (`harness.ts`); `validatePlan()` gates scenarios, seeds and final runs; `policyKind()` (`policies/kind.ts`) classifies a pair for final tickets. |
| What each hero genuinely sees | Its own `Observation`: screen grid (20×12 tiles), `visible`, dialogue, journal, backpack, feedback, received messages, dialogue log, `exploredRows`; plus its own `StepResult`s (including `movement` from/to). |
| How baselines use messages and `exploredRows` | The quest baseline matches partner phrases in `observation.messages` by text. The exploration baseline walks toward `?` blocks in `exploredRows`. Neither field changed. |

One additive interface change was needed. The runner already observes a hero
between batched actions (for `batchStop` and the trace's `inBatch` lines) but
threw that observation away. It is now kept on the turn report as
`steps[k].after` (`policy.ts`, `runner.ts`). Without it, the up to three
screens a hero saw mid-batch would be missing from its map. Only
`model-memory` reads it; the `model-history` user message is built from
explicit fields and is byte-identical (pinned, see §5).

## 2. The memory (`packages/agent/src/heroMemory.ts`)

One `HeroMemory` per hero per episode, inside that hero's `LLMPlayer`.
Inputs, and nothing else:
- each observation the hero received (decision-time, and `after` between batched actions);
- the hero's own previous turn report (executed messages, and move/Push `movement` reports).

The file imports types only; a test checks that it cannot reach `World`, the
room, maps or puzzle code. It never merges the two heroes' memories, and it
refuses another hero's observation.

### Remembered map
- One grid per area (at most 8 areas, at most 128×128 tiles each), initialised to `?`.
- Every screen tile is copied in at tile resolution: `#`, `.`, `~`, `o`, `>`, `^` as drawn. A tile keeps its last value after it leaves the screen, with its last-seen tick.
- Mobile things (`@`, `P`, `E`, `C`, `*`) are never stored as terrain. The ground under them keeps its earlier value, or `:` ("seen, but something stood on it") if never seen bare.
- Walked tiles are a separate layer:
  - the hero's own tile at every observation;
  - both ends of each executed move or Push, as the game reported them;
  - the tiles between the ends only when the hero's own walking did all the moving (no ticks moved by the game) and the path was straight (sideways drift ≤ 0.35 tiles, forward progress).
  - A blocked move marks only where the hero stood; a partial one only as far as it got.
- Rendered as `memory.remembered_map`: cropped to seen or walked tiles, with two x-axis rows (tens, units) and a y label on every row, `@` for the hero now, `+` for walked ground, and `on_screen_now` giving the part that is current. Other areas appear only as counts (`other_areas`).

### Last-seen things
- From `visible`, without projectiles and effects. At most 24.
- A remembered thing is dropped when the screen shows its place again (it is then either listed again or gone).
- When exactly one thing of a kind and name is seen now and exactly one is remembered in the area, they are treated as the same thing.
- Only things not on screen now are rendered (`last_seen_things`, with `seen_at_tick` and `seconds_ago`), so a stale sighting is never shown as current.

### Verified events (at most 24)
Generic, not scenario-specific. Three sources only:

| Kind | Source | Rule |
| --- | --- | --- |
| `game_feedback` | Lines new in `observation.feedback` since the previous observation | Kept once per exact text with count and first/last tick. Routine action-mechanics lines (movement shortfall, J recovering, "Message sent.", "nothing responded", damage, …) are skipped: they are already in `last_turn`. |
| `terrain_changed` | Two of the hero's own views of the same tiles that differ | One event per (from → to) pair per observation, with the tiles' span and both ticks. A later change to any of the same tiles supersedes it (`superseded_by`). |
| `seen_moving` | One creature or object seen at two places at least one tile apart | First and latest sighting with ticks, updated in place. |

- An accepted action is never treated as an effect: casting at something records nothing until the screen or the game's feedback shows a change.
- An enemy that disappears is not recorded as defeated or moved.
- Nothing comes from milestones, journal internals, puzzle flags or the partner.
- Superseded events are evicted first, then the oldest.

### Sent messages
- `recent_sent_messages`: the last 6 executed `message` actions, as `{from, to, text, tick}`.
- The tick is that of the hero's own observation just before sending.
- Refused and skipped messages are not listed.
- `observation.messages` (received only) is unchanged; the two are never merged.

## 3. Prompt (`MEMORY_SECTION`, `model-memory` only)

Appended to the general prompt after the action rules. It explains:
- the record's sources and limits, and that it never says where to go;
- the current observation is authoritative; memory is history;
- the map legend and coordinates, and that seen is not walked;
- last-seen things may have moved;
- verified events and supersession, and that an accepted action is not an event;
- messages, the hero's own included, are communications, not verified facts. An older partner request does not override a verified event or the current observation;
- notes are plans and guesses.

It contains no digits, coordinates, compass directions, area or creature
names, or puzzle steps (tested). Its exact text is in `policies/llm.ts`.

Player name suffix: `·memory`, for example
`llm(openai:gpt-6-luna@medium)·batch4·memory·tutorial-…·briefing-…`.

## 4. `model-history` versus `model-memory`

| | `model-history` | `model-memory` |
| --- | --- | --- |
| Observation, legal actions, validation | same | same |
| Notes (400 chars), completed (8), rejected (4), `last_turn` | yes | yes |
| Terrain beyond the current screen | only via notes | tile map, last-seen ticks, `?` for unseen |
| Walked vs seen | no | `+` vs `.` |
| Things off screen | no | last 24, dated |
| Completed changes (hedge burned, cow moved, gate refused) | only while in feedback (last 8) or notes | kept as verified events until superseded |
| Own sent messages | only while in `completed_actions` (last 8 actions) | last 6, separate field |
| Mid-batch screens | lost | kept |
| Extra prompt | none | `MEMORY_SECTION` (2,194 chars, cached with the system prompt) |
| Extra user-message size | none | ~1.2 k chars early in the scripted mock run; bounded below 12 k chars (test), about 3 k tokens at most |
| Restriction | tuning and final | S1–S3 tuning only, never final |

**Cost.** Pilot-10 averaged about 8.2 k input tokens per call. In the worst
case `memory` adds roughly 3 k (about +35% input per call); typical maze
states should be well under that. Whether fewer calls are needed is the open
question the pilot would answer.

**Fairness.**
- A tile-perfect map is more than a human remembers, but it is built only from the hero's own screens. It works as a sketch the player keeps, an interface aid in the sense of `PILOT10_DIAGNOSIS.md`.
- Results must be reported as `model-memory`, separately from `model-history`, never pooled.

## 5. Tests and checks (this session)

New `packages/agent/test/modelMemory.test.ts`, 27 tests. They are labelled
SYNTHETIC (hand-written observations, no game state), REAL PLAY (S2-local via
its own real-play prefix, seed 0, no fixture) and FIXTURE (one test places
the heroes for a real Black Hole pull, as `pilot6Fixes.test.ts` does).

They cover:
- tile-resolution accumulation and last-seen ticks; legend and coordinates; mobile things never stored as terrain;
- seen versus walked; blocked, partial, game-moved and sideways moves; mid-batch screens;
- stale things: listed only when off screen, dropped when their place is seen empty, a move recorded as two dated sightings, an enemy disappearing not recorded as defeated;
- terrain-change events and supersession; feedback dedupe and routine-line filter; accepted actions recording nothing;
- sent messages: executed only, from/to, tick; refused and skipped messages excluded;
- isolation and leakage:
  - a hero refuses the other hero's observation;
  - in real play, each hero's map holds exactly the tiles its own screen showed and `?` elsewhere;
  - Sieg's walk reached none of Coco's memory, and more than half the maze stays unknown;
  - the engine imports types only;
  - neither hero's prompt contains the partner's notes;
- the player: kind `model-memory`, `·memory` name, refused for final runs and outside S1–S3; separate memories and sent lists; received messages unchanged;
- determinism (identical prompts on rerun) and a fresh memory each episode; reset when game time goes back;
- bounds after 600 observations across 12 areas;
- prompt: `MEMORY_SECTION` only in the memory prompt, the history prompt otherwise identical, no game content;
- compatibility pins: the full prompt digests of a scripted 40-decision S2-local seed-0 episode for `model-history` (Sieg `97349d30e0a20a26`, Coco `41d7ef253328e3e2`, 82 calls) and `model-obs-only` (`db8e03e513c8297f`, `18e8d8b20fd42496`). Recorded at `346cdd4` and `3b7115b` before any change, and unchanged after.

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `modelMemory.test.ts` | 27/27 pass |
| Permitted agent files (all except `suite`, `fullQuest`, `checkpointFreeze`, `scriptedFreeze`, `finalAccess`), 30 files, `--maxWorkers=4` | 438/445 pass; the 7 failures were timeouts and one recording-timing check under machine load average ~59. The 6 affected files rerun alone with `--maxWorkers=1`: 107/107 pass |
| `scriptedFreeze.test.ts -t 'baseline on S[123]'` | 6 pass, 1 skipped (`route/seed1`, held out). No pin changed |
| Revision 2 baseline trajectories, before (`74adda8`) and after: quest and explore on S2, S3, S2-local, S3-local, seed 0 | 8/8 identical (status, ticks, end hash, action/state digest, step count); `explore/S2-local` digest `7eef31333d9855b4` as recorded in `PILOT9_FIXES.md` |
| Server, shared and client tests, `--maxWorkers=4` | 557/558; `apps/server/test/npcTalk.test.ts` failed once (socket timing under load) and passed 3/3 alone. No server or client file changed |
| `npm run build` | pass (existing chunk-size warning) |

Not run: the full `npm test` (it includes held-out content), `route/seed1`,
`checkpointFreeze`, `suite.test.ts`, `finalAccess.test.ts`, any S4/F
scenario, any paid call.

## 6. Proposed pilot (not run; needs owner approval)

Same configuration as pilot-10 except the player, so the two compare directly:

```sh
npm run eval:live -- --scenario S2-local --seed 0 --player model-memory \
  --gateway openai --model gpt-6-luna --effort medium \
  --max-spend-usd 0.60 --paid --no-viewer
```

Before running it:
- re-verify the price;
- report the result as `model-memory`, separate from pilot-10's `model-history`.

Questions it answers:
- Do the heroes walk unexplored `.` corridors?
- Does the dry-hedge loop disappear?
- How many calls does it take to reach the key gate, compared with pilot-10's ~220?

## 7. Risks and limits

- **Stale memory.** The map can still show a tile as it was (a hedge that has since burned, a gate since opened) until the hero looks again. It is labelled as history, but a model may over-trust it, as Coco over-trusted "cow blocks the lane" in pilot-10.
- **Feedback can be missed.** Feedback is diffed between consecutive observations of a rolling 8-line window. More than 8 new lines between two observations would lose some; this has not been seen in traces.
- **Interpolation is conservative.** Walked tiles between a move's ends are filled only for straight, self-driven moves, so some walked tiles may show as `.`.
- **Identity is heuristic.** "Same thing" means one of that kind and name seen now and one remembered. Several identical enemies are tracked by position only, with no movement events.
- **Prompt size.** Up to about 3 k extra tokens per call.
- **Not an independent review.** The `rules-reviewer` subagent and the `game-rules-audit` skill have not been run on this change. Both are pending the owner's decision.
