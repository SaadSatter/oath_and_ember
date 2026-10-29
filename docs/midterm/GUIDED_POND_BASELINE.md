# Instruction-guided Mirror Pond baseline — 2026-10-29

Branch `midterm/evaluation`, Claude Code session `f07e5a80-43c2-4426-b0ce-73fc9ff12313`. Owner-approved implementation and offline validation only. **No paid run has been authorized or made.** Current suite revision 2 **S3-local is Mirror Pond** (goal: the Vanity Mirror in the shared backpack). Older pre-revision-2 records called Mirror Pond "S2-local"; they are a different scenario id.

## Owner decisions (2026-10-29)

- Give the guided players a **full walkthrough**, the same depth as the guided Hedge Maze ([GUIDED_MAZE_BASELINE.md](GUIDED_MAZE_BASELINE.md)).
- Select it by **extending `--player model-guided`**: S2-local gets the Maze walkthrough, S3-local the pond walkthrough. No new player kind.
- Finish validation: test the walkthrough's paths against the game's collision rules, replace approximate timing with measured values, and keep the intended solution and the game unchanged.
- The two `guidedMaze.test.ts` assertions that refused S3-local now refuse S3 (approved).
- After validation: state the diagonal-first move for Coco's blocked culvert segment (approved; `model-guided` is explicitly solution-informed).

## Scenario and seed coverage

| Item | Value |
| --- | --- |
| Scenario | S3-local only (Mirror Pond entrance after the opening and ordinary travel; `suite.ts`) |
| Seeds | Tuning seeds 0 and 1 only. Final seeds and `--final` are refused (`validatePlan`, tested) |
| Refused | S1, S2, S3, S4, F, every `-v1` historical id. `model-guided` on S2-local still uses the unchanged Maze guide |
| Start state | Unchanged. The start hash of a `model-guided` run equals `environmentFor("S3-local").reset(seed)` (tested) |

## Walkthrough version and ID

- Version `mirror-pond-walkthrough-v1`, ID **`266e5a23de26`** (the first 12 hex digits of sha256 of both role texts, pinned in `guidedPond.test.ts`). It appears in call labels (`·guided-266e5a23de26`) and policy names (`·walkthrough-266e5a23de26`), so results are never pooled with other kinds or guide versions.
- Earlier IDs, none ever run:
  - `b8d263d30c89`: pre-validation draft, named in the checkpoint audit, never committed; its approximate timing text was replaced.
  - `c152ff4c8664`: committed in `a29046e`, before the culvert clarification.
- The Maze walkthrough is unchanged: ID `975e5580671c`, pinned by `guidedPond.test.ts`.
- Role text: 10,146 bytes for Sieg, 10,525 for Coco, appended after the ordinary system prompt, tutorial block and S3-local briefing. Each hero gets only its own role block.

## Source of solution knowledge

All positions, push lengths and angles are copied from the scripted route's frozen constants, `packages/agent/src/route/routeConstants.ts` (`TO_MIRROR`, `POND_PLAN`, `MIRROR_TARGET`, `MIRROR_REST`, `PAD`, `SHOT`), as used by `mirrorPond` in `route/fullQuest.ts`. They are not imported at runtime: the policy modules import no engine, route, navigation or filesystem code (tested). A few extra turning points come from where the route's navigator actually flew or walked:
- Coco's culvert points (31,20.5) and (31,16.5);
- her pad-to-pad legs;
- Sieg's walk to the sanctuary.

Every one of these legs is collision-tested (below). Mechanism facts come from the source (`packages/shared/src/mirrorPond.ts`): 1.5° per push tick, a 104 px (3.25 tile) push reach, and the station, brazier and resting angles. Ability durations and cooldowns come from the player manual. Nothing was taken from held-out S4/F.

The model still chooses every move, duration, ability, message and interaction. There is no runtime script, navigator, checkpoint detector, World read or state change in the policy.

## Deterministic validation

Node v26.9.0, offline. Every scripted reset and play is on S3-local seeds 0 and 1.

| Check | File | Result |
| --- | --- | --- |
| The route reaches the Vanity Mirror from the S3-local start | `guidedPond.test.ts` | Success at both seeds, 0 invalid actions, all four braziers lit, sanctuary raised, every mirror back at its resting angle. This is an engineering proof, **not** an LLM result |
| Guide data equals the route constants and the engine geometry | `guidedPond.test.ts` | Push spots, push ticks, angles, approaches, leave paths, pads, shot directions, facing moves, braziers, chest, spawns, spike columns |
| Every guide leg is traversable | `guidedPondValidation.test.ts` | 11 legs: Coco's culvert, A1→A2 (walking), A2→A3, A3→A4, A4→chest (flying); Sieg's start→spike mouth, spikes→M1, M1→M2, M2→M3, M3→M4, M4→sanctuary. The hero's box moves at the real per-tick step through the shared `constrainMotion`, against `collisionRects` (with `flightWalls` when flying) for the pond state at the moment the route starts that leg. All straight lines are clear at both seeds |
| Eight-direction splits | same | Each leg is also tested as diagonal-then-straight and straight-then-diagonal moves. All 11 legs are clear diagonal-first; all except the culvert are clear both ways. The culvert's (44,31.6)→(35,31) is blocked due-west-first and clear through the diagonal point (43.4,31), which the guide now states |
| Pads are safe ground | same | Coco's Flight ran out while she stood on A3 (about 25 s elapsed there), and she was still on A3 when the route moved her on |
| Prompts and isolation | `guidedPond.test.ts` | The guided system prompt is exactly the ordinary prompt plus the pond role block. `model-history`/`model-obs-only` S3-local prompts are byte-identical to before. User context and observations are unchanged. `decide` changes no game state |
| Budget and ledger | `guidedPond.test.ts` | The full augmented prompt is priced before dispatch and fails closed when it does not fit. A runSuite run writes a hash-chained trace and settles its scratch ledger under `model-guided/S3-local/` |
| Ordinary validation | `guidedPond.test.ts` | Coco's Push is refused as an invalid action; the guide gives no bypass |

### Measured timing (pinned as `POND_MEASURED`)

The walkthrough's only timing numbers. They are identical at seeds 0 and 1, in game ticks (60 per second), measured through the real environment. The text is built from the same object the tests assert, so the two cannot drift apart.

| Measurement | Ticks | How |
| --- | --- | --- |
| East spike column (x=43.5) shows "retracting" under Slow Time | 48 | Sieg at the spike mouth, Coco casts Slow Time, Sieg observes every tick |
| Super Speed from that cue to x < 37.5 | 79 | Unharmed; Slow Time was active throughout |
| From the cue until any column next shows "warning" or "raised" | 153 | Observed by Sieg every tick |
| Walking west from the same cue, no Slow Time or Super Speed | hit after 45 | HP 100 → 92; Sieg reappears at (44.5,33) |
| Coco's culvert flight along the listed straight path | 352 | The movement sweep above (5.9 s of the manual's 20 s Flight) |
| Fireball to brazier lit, braziers 1–4 | 89, 60, 77, 56 | Per-tick watch through the environment's trusted `tick` hook, shots from the route's pad positions |

Measuring these replaced statements in the draft text:
- "all four are down for about 5 s" was wrong: the measured safe window is 153 ticks (2.55 s).
- "cycle five times slower (about 8 s)" and "crosses in under 2 s" were replaced by the measured cue and crossing times.
- "walking cannot cross" is now the single measured case above.
- "wait about 150 ticks" for a shot was replaced by the measured 56–89 ticks.
- "within 0.5 deg is correct" was never verified and is removed. The text now says the listed angles are reached exactly, as the route always did.
- The 0.12-tile pad tolerance and the 0.4-tile correction step are described as what the verified route did, not as engine limits.

### Commands and results (this session)

```sh
npx vitest run packages/agent/test/guidedPond.test.ts packages/agent/test/guidedPondValidation.test.ts \
  packages/agent/test/guidedMaze.test.ts packages/agent/test/modelPlayers.test.ts packages/agent/test/harness.test.ts \
  packages/agent/test/budget.test.ts packages/agent/test/paidSafety.test.ts \
  packages/agent/test/route/checkpointFreeze.test.ts packages/agent/test/suite.test.ts --maxWorkers=2
npm run typecheck
npm run build
```

- After the final guide change (culvert clarification, ID `266e5a23de26`): focused tests **9 files, 76/76 passed**.
- Typecheck: pass. Build: pass, with the existing large-chunk warning.
- Frozen checkpoint pins: unchanged, `checkpointFreeze.test.ts` passes.
- The full `npm test` was not re-run after the validation work. Earlier in this session it was 1065/1066; the one failure, `s2Shutdown.test.ts`, comes from another session's uncommitted `recorder.ts` change, not from this work (see the checkpoint audit).

## Known limitations

- **Not an LLM result.** Every success above is the scripted route. Whether a model can follow the walkthrough is unknown until an approved pilot.
- **Measured once per seed, at the route's own phases.** The spike numbers come from one cue per seed. Because the run is deterministic, seeds 0 and 1 hit the same spike phase. A model that casts Slow Time at another moment waits a different time for the cue (422 ticks in the test) and may cross with less margin; the text tells it to retry if Slow Time ends first. The walking case shows a hit from that cue only; it does not prove walking can never cross.
- **Shot times depend on position.** The 56–89 tick figures are from the route's pad positions. Shots from a slightly different spot may take a little longer or miss.
- **Eight-direction moves.** Players move in eight directions, not along arbitrary lines. One culvert segment, (44,31.6) → (35,31), is blocked if flown due west first (Coco's box clips the culvert wall near x 42.4). The guide tells Coco to go northwest to (43.4,31) first, which is tested clear. For other legs it says to try the diagonal part first if a straight line is blocked; every other leg is clear both ways.
- **Corrections.** The correction advice (push more, step aside, reverse sides) is the route's closed-loop procedure. A model may need several tries.
- **Same-session audit.** The checkpoint audit ([2026-10-29-pond-guided-walkthrough.md](agent-evidence/skill-runs/2026-10-29-pond-guided-walkthrough.md)) ran in the implementing session and is not an independent review. Its findings 2–4 are addressed here; finding 5 by this record. Finding 6 (the recorder test) belongs to the recording workstream.

## Why guided results are excluded from the main comparison

The main comparison (rubric 2b and 4b) is between players with the same information: `model-history`/`model-obs-only` against the scripted baselines, all seeing only what a player could see or read. A guided player gets the puzzle's answer in its system prompt: the exact push spots, angles, pad positions and timing. That is an answer key, which rubric 2b rules out for the model player. So guided results:

- are reported in their own table, labelled "instruction-guided (solution supplied)", with the walkthrough ID;
- are never pooled with, averaged into, or presented as the unaided model player;
- answer a different question: whether the model can *carry out* a known plan through this interface (execution, coordination and recovery), not whether it can *work out* the puzzle.

Run labels, manifests, summaries, output folder names and ledger run keys all carry `model-guided` and the walkthrough ID, so they can be separated mechanically.

## Before any paid pilot (not authorized)

A first pilot would need the owner's separate approval: model, effort and a per-episode cap within the S3-local $1.25 ceiling and the remaining pilot allocation. Offline worst-case hold for the first call (gpt-6-luna, medium effort, network stubbed): **$0.00786 Sieg, $0.00781 Coco** guided, against $0.00649 / $0.00640 for `model-history`. These are conservative reservations, not predicted charges. For comparison, pilot-11 (guided Maze) had a $0.30 cap and was charged $0.083545.
