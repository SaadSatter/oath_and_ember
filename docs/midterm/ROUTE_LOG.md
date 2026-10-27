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
| | Griffin Enclosure → wig | In progress | |
| | Offering, revelation, choices, ending → `chapter0.complete` | Not started | |

Opening plus both item areas: 0 invalid actions, about 920 decisions per hero, about 4 s of wall-clock time.

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

## Known imperfections, still to fix

- Mirror M2's restore stops 28.5° short of rest: its second restore spot does not turn it. Sieg can still pass. The route should finish restoring it, as a careful player would.
- Mirror M4's shot waits about 19 s for Coco's flight to recharge.
