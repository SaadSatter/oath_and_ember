# Baseline plan and implementation

**Implementation checkpoint (2026-10-27):** the inherited Phase 4 implementation is present in `packages/agent/src/policies/{questBaseline,questKnowledge}.ts`. S1–S3 tuning trials on seeds 0/1 pass, with zero invalid actions. See `PHASE4_HANDOFF.md` for actual checks, provenance and limitations. The plan below is the original pre-implementation record; its statements about code not yet existing are historical. S4/F baseline/model trials remain unrun.

Owner decision 2026-10-27: build a credible quest-aware scripted baseline for two players. Each hero uses only its own observation and permitted messages. Its hand-coded quest knowledge is disclosed, and the exploration baseline is kept as a weaker comparison. This plan comes after the suite freeze (`EVALUATION_SUITE.md`, commit `0c45f82`), and no scenario-specific baseline code exists yet.

## What it is

Two independent `Policy` objects, `BaselineSieg` and `BaselineCoco` (`packages/agent/src/policies/questBaseline.ts`):
- they run under the same runner, limits and observations as the model player;
- each sees only its own observation, legal actions and last turn, and keeps its own small state machine;
- they coordinate **only** through the `message` action;
- they make no model calls; their per-decision compute is unbounded (disclosed).

## Where its knowledge comes from (disclosed)

| Knowledge | Source | A player could know it from |
| --- | --- | --- |
| Quest structure: three areas, which hero does what, both tools to the nest, the wig to the offering | the route (`docs/midterm/ROUTE_LOG.md`) and the design docs | the goddess's dialogue, the journal, signs, the manual |
| Puzzle procedures (bush → Fireball; cow → Black Hole; wolf → Slow Time + Super Speed + E; mirrors → Push then a reflected Fireball; nest → E with both tools) | the route | in-world labels as drawn, the manual |
| Map waypoints (maze corridors, pond walkway, shrine paths) | the route-development tools, which read static map geometry | exploring the screen; a human learns the map by walking it |
| Mirror target angles and push spots | `route-dev/pond-plan.ts` (engine geometry) | trial and error with the drawn angle; the geometry is visible but has to be worked out |

**Consequence to disclose.** The route-development work saw all of S4 and F, so the baseline's knowledge of the held-out scenarios is not held out. "Held out" applies to running and tuning: the baseline will not be **run** on S4 or F until the final evaluation. The same was true of the Prince of Persia baseline, whose rules knowledge was hand-coded.

## Design

- **One state machine per hero.** Its stages are the route's stages: opening, Hedge Maze, Mirror Pond, Griffin, finale. Each hero runs only its own part, for example Coco's culvert flight and pad shots, or Sieg's spike crossing and mirror turns.
- **Coordination by message only.** A fixed vocabulary, for example "ready for Slow Time", "mirror M2 set", "at the pad", "wig in the backpack", "at the exit". A hero waits (`wait`) until the partner's message arrives. Messages are capped at 64 per hero per episode, so the protocol must stay within that.
- **Movement and combat** use the observation-only `navigate.ts` and `combat.ts`, plus waypoints from the route.
- **Mirrors.** The push spots come from the route plan, with the route's closed-loop correction (drawn angle, off-axis step).
- **Situations.** Each machine starts from what the hero observes at reset (area, backpack, journal step), so the same code runs S1–S4 and F without a scenario flag.
- **Batching.** The baseline returns one action per decision (`maxBatch` 1), so its decision count measures its play rather than its batching.

## Development and testing rules

- Develop and debug on S1–S3 with tuning seeds 0 and 1 only. S4 and F are not run until the final evaluation.
- Tests: an architecture test that the baseline imports no engine, suite or route module, only observation types and `navigate`/`combat` (the route's constants are copied in, with comments); determinism (same seed, same trace); message-only coordination (a hero whose partner never messages waits and then hits a limit, and never reads the partner's state).
- The exploration baseline (`baseline.ts`) stays unchanged as the weaker comparison.

## Effort and risk

- **Estimate:** 1.5–2.5 working days. The coordination protocol (two loops instead of one director) is the main new work.
- **Risk:** without the director's lockstep, the hero who is waiting has to choose sensible wait lengths. A stalled partner must end in a limit, not a hang (the runner's limits guarantee this).
- **Ceiling effect:** the baseline will probably succeed on most scenarios, like Prince of Persia's 12/12. The comparison then rests on success, game time, decisions, invalid actions and messages, which the suite records.

## Decision needed

Approve this plan, including the disclosed use of route-derived waypoints and push spots. The alternative is a weaker, exploration-driven quest baseline that learns the map from the screen. That would be fairer to the held-out labels, but it is much more work and has a high risk of not finishing F.
