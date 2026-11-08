# Scripted full-quest route: development log

Phase 3: prove the Bald Goddess quest can be finished from the `goddess` checkpoint to `chapter0.complete` with normal agent actions only. The route lives in `packages/agent/test/route/` (`director.ts` and `fullQuest.ts`).

At runtime the route calls the five operations only: `reset`, `observe`, `legal_actions`, `step` and `outcome`. It steers from each hero's own observation. It never reads or writes `GameRoom`/`World`, uses no fixtures or teleports, injects no items, and calls no server method directly.

Its constants were worked out offline from the development references (`scripts/*-playthrough.ts`, `apps/server/test/*Walkthrough.test.ts`) and from the planning tools in `scripts/midterm/route-dev/`. Those tools do read engine state, and they are never run by the route. Debug-only peeks at engine state were used while diagnosing failures in scratch scripts and are noted below; none are in the route.

The shared helpers `packages/agent/src/policies/navigate.ts` (search over the hero's own screen grid) and `combat.ts` (nearest visible enemy) are observation-only. The quest-aware baseline can reuse them.

## Milestones

| Date | Milestone | Result | Seed |
| --- | --- | --- | --- |
| 2026-10-27 | Opening scene and party travel | Works: scene read by tick 221, travel at the shrine's exits | 1 |
| 2026-10-27 | Hedge Maze → Enchanted Shears | Works: all 5 guards killed in combat, bush burned, cow pulled, wolf tagged, gate opened, chest claimed, exit by tick 4,725 | 1 |
| 2026-10-27 | Mirror Pond → Vanity Mirror | Works: spikes crossed on the first attempt, 4 mirrors turned to their exact target angles, 4 shots fired, sanctuary chest claimed, back at the shrine by tick 9,916 (165 s of game time) | 1 |
| 2026-10-27 | Griffin Enclosure → wig | Works (peaceful solution): Coco flies to the nest, takes one beam hit (20 damage), drops both tools with one E, and the griffin grooms, trims and flies away; the second E picks up the wig. Sieg takes the party home | 1 |
| 2026-10-27 | Offering, revelation, choices, ending → `chapter0.complete` | **Works: `status: success` at tick 12,412 (206.9 s of the 480 s game-time limit)** | 1 |
| 2026-10-27 | Robustness across seeds | Seeds 1–8 all succeed, with identical ticks (12,351 before the M2 restore fix). The id-based tie-breaks never come into play on this route, so **seeds do not change a scripted run** | 1–8 |

**Verified route (seed 1, `scripts/midterm/run-route.ts`; evidence in `docs/midterm/evidence/route/seed1/`):**

- **Outcome:** success at tick 12,412 with 0 invalid actions. Every hash-chained trace line verifies (5,874 lines, 414 KB gzipped).
- **Determinism:** the same seed reproduces the same raw end state (`32e86111…`), as tested in `fullQuest.test.ts`.
- **Decisions:** Sieg 1,727, Coco 1,203. Most are waits (1,257 and 1,009) that keep one hero in step while the other acts. Excluding waits: Sieg 293 moves, 136 dialogue presses, 20 abilities, 14 attacks and 6 E presses; Coco 134 moves, 27 attacks, 24 E presses, 7 abilities, 1 item use and 1 choice.
- **Stage ticks:** opening done at 221; Hedge Maze 426 → 4,725; Mirror Pond 5,137 → 9,979; Griffin 10,232 → 11,399; ending 11,744 → 12,412.

## Failures and fixes, in order

1. **Probe stopped before the scene started.** At tick 0 the goddess's greeting is in a lead-in (line −1) with no dialogue shown. Fix: `Director.untilDialogue()`.
2. **Deadlock with unequal action lengths.** Game time runs only while both heroes have an action. A hero who finishes first, or who takes an instant action, freezes time until it decides again. Fix: `Director.both()` drains settled actions and keeps the early finisher busy with 1-tick waits. An earlier version could hand a filler to the wrong hero when two actions settled on the same tick; it was rewritten as drain-then-fill.
3. **`wait` of 120 ticks rejected.** The interface caps a timed action at 60 ticks. Fix: `Director.wait()` splits long waits.
4. **Both heroes pressing E on one shared line** produced "line had already moved on". Fix: one press per shared line, Sieg first.
5. **Maze guards.** The intent-only maze walkthrough deletes all guards (`w.enemies = {}`); the route cannot. Fix: observation-only combat (`policies/combat.ts`). Sieg died once in the first fight and respawned at the maze spawn with full HP (death is not fatal in this game). Debug peek: all 5 guards dead after the two fights; Coco's fireballs also burned the dry bush.
6. **Wolf not on screen at the walkthrough's chase spot.** The wolf flees within its own section (the top corridor, plus a lane at row 12.5). Fix: Sieg enters by the middle entrance; Slow Time then Super Speed; he chases the wolf's last seen position and sweeps the corridor when it is out of view; he presses E when the panel offers the wolf. First success at tick 3,180.
7. **Gate path assumed the catch happened in the top corridor.** In one run it happened in the row-12.5 lane. Fix: choose the corridor from Sieg's observed position.
8. **Exit path blocked by the parked cow.** The offline legs first assumed a parked cow was gone; it actually stays, as a 128 px body, at about (23.8, 25). Fix: legs recomputed with the cow in place.
9. **One-tick fillers for the idle hero** (13,523 decisions for Coco in one run). Fix: the idle hero waits as long as the mover's action.
10. **Spike corridor.** The reference waiting spot (43, 26) is inside the spike columns (x 40.5–43.5); Sieg took 16 damage and was reset. Fix: wait at (45, 26) and go when the east column is retracting.
11. **Mirror push did nothing.** Torque needs Sieg off the mirror's axis, at an end and to one side (`pondPushTurn`); standing on the axis has none. One push tick turns a mirror 1.5° (90°/s; the code comment says 45°/s). Fix: offline push planning (`route-dev/pond-plan.ts`).
12. **Planned push spots on the far side of a turning mirror.** Mid-turn, a mirror cuts the ring walkway, and Sieg could not walk to a second spot. A first fix with coarse tile reachability was still wrong: the coarse 32 px grid cannot represent the diagonal frame, so Sieg pressed into it. Fix: plan with exact 4 px paths and the hero's ±13 px box, with the mirror at its angle at that moment. Each mirror is now solved from one spot (45 push ticks = 67.5°) and restored from two.
13. **Navigator cut a corner** around a blocked cell. Fix: the no-corner-cutting rule also applies to the one-cell shortcut in `planStep`.
14. **First torch did not light.** Slow Time from the spike crossing was still active, and it slows fireballs to 20%. Fix: wait until time is no longer slowed before firing.
15. **"Brazier 4 not lit" was a false negative.** A debug trace showed the reflected shot reaching the torch, but brazier 4 at (17, 35) is off both heroes' screens. Fix: the route checks success by the sanctuary chest becoming reachable.

16. **Griffin banter scene not read.** It starts after a lead-in, after the arrival check. Coco's moves were refused during the scene ("in a story scene"). Fix: after travel, wait up to 90 ticks for a scene and read it.
17. **Coco walked into the enclosure without flying.** Flight was still recharging from the pond (about 25 s), so the activation was refused. She stopped at the water's edge, and a beam hit her for 26. Fix: wait until Flight is ready before using it.
18. **`go()` with a one-step limit throws** when it does not arrive. Fix: the nest approach uses `planStep` directly.
19. **Arrival behind the goddess statue.** Returning from the north puts both heroes at (20–21, 11); the straight line to the offering is blocked. Fix: Coco walks round the east side and Sieg round the west (`legs.ts`).
20. **Interface bug (fixed in `perception.ts`).** On the motivation-choice line a hero who had to choose was also told "Your partner's line.": the line has no reader, so the "partner's line" note was added. That misleads any agent. Fix: no waiting note while a hero has choices to make. A regression check is in `fullQuest.test.ts`.
21. **M2 not fully restored** (stopped 28.5° short). Its planned second restore spot is about 11 px from the mirror's axis, and the 0.1-tile position rounding put Sieg inside the 6 px dead zone. Making the planner require a 5 px margin left no valid second spots, so that change was reverted. Fix in the route instead: if a correction push changes nothing, Sieg steps 0.4 tile away from the axis along the mirror's normal, worked out from the drawn angle, and pushes again. All four mirrors now return exactly to rest.

## Measurements for the cost estimate (owner request, 2026-10-27)

These describe the scripted route. They are not a measurement of a model player, which would choose its own actions and wait lengths.

| Quantity | Value | Source |
| --- | --- | --- |
| Game time to finish | 12,412 ticks (206.9 s) | route, seed 1 |
| Non-wait actions | Sieg 470, Coco 194 | route |
| Prompt per call: observation and legal actions | mean 4,219 characters (p50 4,319, p95 4,830, max 5,413), about 1,100–1,300 tokens | 1,562 route observations |
| System prompt (instructions and player manual) | 12,637 characters, about 3,200–3,600 tokens, identical every call and cached (`cache_control`) | `systemPrompt()` |
| Other per-call input (notes, last 8 actions, last result) | about 500–800 characters | `LLMPlayer` |

**Model decisions per hero for the full episode (F).**
- The route needs about 470 non-wait actions for Sieg, with knowledge a model does not have.
- A model also has to explore, retry and wait. A plausible range is 500–1,500 calls per hero.
- **The provisional 400-call limit is likely to end F before success even for good play.** S1–S4 are much shorter.
- This is an estimate, not a measurement.

**Token estimate per model call:** about 1,400 uncached input tokens, about 3,400 cached input tokens (read at 0.1× after the first call), and an output of about 100–300 tokens.

**Cost per episode = calls × (1,400 × P_in + 3,400 × 0.1 × P_in + 200 × P_out) / 10⁶.** P_in and P_out are USD per million tokens and must be verified and dated on the day of a paid run. The prices in `llm.ts` are unverified (recorded 2026-10-06). As an illustration only, for 2 heroes × 1,000 calls:
- at $1 / $5 per M (input / output): about $5.4 per F episode;
- at $3 / $15: about $16.

**Ways to cut calls without leaking information (investigated, not implemented):**
- **Action batching.** Let a player return a short plan, for example up to 4 actions, executed in order and cut short on any interruption (new dialogue, damage, area change), exactly as single actions are now. It changes the action schema, so it needs owner approval. It could cut calls 2–4× for movement-heavy stretches.
- **Prompt caching.** Already on for the system prompt and manual. Caching the stable part of each observation is not possible, because observations change every call.
- **Longer waits.** A model can already choose `wait` up to 60 ticks; the route's 1-tick fillers are director mechanics, not something a model has to do.
