# Showcase guidance v2: diagnosis and proposed text

November 7, 2026. Claude Code implementation agent, at the owner's request. Same-session diagnosis; **not an independent review**. Status: **approved by the owner on 2026-11-07** (see "Owner approval" below). No paid run, no change to v1, the engine, the planner, the observations or any A/B/C definition.

## The problem the owner reported

The three continuous showcase runs on November 7 (Pilot-37, Pilot-38 and the run started 21:45Z, called Pilot-39 here) moved through the Hedge Maze in a way that looked like random search. The standalone maze run that succeeded, Pilot-30 (`S2-local`, 89.5 game-s), looked more purposeful.

## What the traces show

The game rules and the planner/controller code are unchanged since Pilot-30 (`040685c`). `centralized.ts` gained only the optional guidance parameter. The differences are the start, the briefing/task and the showcase guidance block. Measured over planner replies while either hero was in the Hedge Maze:

| | Pilot-30 (standalone) | Pilot-37 | Pilot-38 | Pilot-39 (in progress at ~3,240 ticks) |
| --- | --- | --- | --- | --- |
| Guidance | none | phase plan 3.4K + v4 | 4.0K + v4 | 4.8K + v4 |
| Maze outcome | Shears | Shears (61 s after entry) | stopped at the cow | not yet |
| Plans with avoid / retreat / preserve / safer | 23% | 21% | 40% | **68%** |
| Plans repeating "Shears not confirmed" | 6% | 47% | 55% | **83%** |
| Plans stating phase / both heroes' HP | 0% / 2% | 100% / 100% | 100% / 97% | 100% / 100% |
| Plans mentioning Black Hole, bay or pull | 22% | 13% | 32% | **11%** |
| Coco ability uses in the maze | 7 | 5 | 5 | **2** |

In Pilot-39, Coco fell to 17 HP fighting the sentinel. Every later plan gives her some version of "explore, avoiding threats, conserve health", including "avoiding the harmless cow". She is the hero with the pull ability, so the maze cannot progress. Pilot-30 kept the cow in `known_obstacles` as an open question ("whether Black Hole can move it is unconfirmed").

Caveats: one run per prompt version, and model sampling varies a lot. Pilot-30 also wandered for long stretches and is a single success, not a reliable standard. Pilot-37 cleared the maze faster than Pilot-30 and failed later, on the Griffin trail.

## Likely causes, all in the guidance text

1. **Health emphasis everywhere.** v1 says health is scarce in every phase, asks for both heroes' HP in every plan, and says "Preserve health here: the Griffin fight comes later". The appended v4 combat text says to give a low-health hero a safer role. Under the game's real rule (manual, *Health and recovery*; `GameRoom.ts` damage), a knockout restores 100 HP at the area's starting point and keeps all progress. Over-caution in the maze costs much more than it saves.
2. **Griffin combat guidance active during the maze.** v4 is appended unscoped, so the maze is planned as a fight to manage.
3. **Plan memory spent on bookkeeping.** The plan is capped at 600 characters (`CENTRAL.planChars`). Restating phase, evidence, HP and "Shears not confirmed" each time crowds out the hypotheses Pilot-30 kept there.

## Owner decision (2026-11-07)

After reading the diagnosis, the owner stated: "Health is inconsequential for this showcase run even for the griffin." v2 below implements that decision.

## Proposed changes (`showcase-maze-griffin-v2`)

Text: `SHOWCASE_PHASE_PLAN_V2` in `packages/agent/src/policies/situationGuidance.ts`. **The guidance is the phase plan only. `b-post-combined-v4` is no longer appended.** Its step 1 ("Protect both heroes first... give a low-health hero a safer role") and step 7 ("keep both heroes alive") are built on health. It is frozen, owner-approved text shared with B and C, so it cannot be edited for the showcase. Its non-health tactics (track which position, direction and timing landed, and change one thing when nothing lands) are restated briefly in Phase 3. This is the implementation agent's judgment and needs the owner's confirmation. The alternative is to keep v4 and add an override line, which leaves the prompt contradicting itself.

| Paragraph | Change from v1 |
| --- | --- |
| Intro | Start the plan with a short phase tag; use the rest for learned facts and next tests; do not restate unchanged facts. |
| Health | Replaced. Health does not matter in any phase, including the Griffin fight. Restates the manual's knockout rule (full health at the area's starting point, progress kept). Never retreat, hold back, postpone or change roles because of health; do not track health in the plan. After a knockout, regroup and continue. |
| Positioning | Unchanged. |
| Phase 0 | Unchanged. |
| Phase 1 | Removes "Preserve health here". Adds: treat the maze as a puzzle, read signs and captions, keep blockers and candidate abilities in `known_obstacles`, test them instead of searching for a way around, deal with enemies that block or attack. Role split unchanged. |
| Phase 2 | Directions unchanged. Drops "avoid damage on the way" and the pre-Griffin health/role note. |
| Phase 3 | Rewritten. Keep both heroes attacking (Coco from range, Sieg when in reach); use the Griffin's label to time and verify hits; step off a warning line only if it costs no attack; track what landed; change one thing when nothing does. The combat-route-only rule (no nest, no backpack item while the Griffin lives) is unchanged. |
| Phase 4 | Unchanged. |

It names no coordinate, waypoint, cow, wolf, key, burn, Black Hole, mirror or grooming. It passes the same no-answer patterns as v1, and a test checks that it contains no health-preservation phrases.

Size: the guidance is 5,154 characters, compared with about 8,050 for v1 (phase plan plus v4). The full prompt is 37,307 characters, compared with 40,186.

| Identity | SHA-256 |
| --- | --- |
| v1 guidance (approved, unchanged) | `ea5d75ba9b74a4c72ac60f0b2f35aaa8e991c5e767737a34fc14b871a355d320` |
| v1 full prompt (unchanged) | `0099a850c7219c31797e0802bc82c7a688c99512adc600fe4a4aa808b7087e8b` |
| **v2 guidance (proposed)** | `364acf1a96ca45899d91f3e35f142d21a32ab91a406e745e57def868a8128664` |
| **v2 full prompt (proposed)** | `711e901edeb31c90e68db033003a4be9ed9fb83d549831995ebfd3119563487a` |

### Remaining conflict: the showcase briefing

The showcase scenario's briefing (`SHOWCASE_BRIEFING`, `packages/agent/src/suite.ts`) still says **"Protect both heroes' health throughout."** It is part of the pinned showcase definition, not the guidance. Removing it changes the definition hash and the prompt hash, which existing tests and authorization records reference. It is not changed here. Owner decision needed: remove or reword that sentence in a new definition revision, or leave it.

## Lock state and what approval would need

- v2 has status `proposed` with no approved hash. `SHOWCASE_PAID_SCOPE.guidance` still pins v1, so the paid path refuses v2. A test confirms this.
- Mock (free) runs may use v2.
- A paid v2 run needs the owner to:
  1. approve this exact text and hash;
  2. decide whether the showcase scope moves from v1 to v2;
  3. authorize one attempt and its budget. Before Pilot-39, the pilot stage had $2.304996 left, and Pilot-39 reserved up to $2.

  This is a v1-to-v2 change to an owner-approved decision (the health-aware revision 2), so it is the owner's call.

## Validation (this session)

- `npm run typecheck`: pass. `npm run build`: pass.
- After the health revision: `showcaseGuidanceV2` and `showcase` gave 16/16 pass; typecheck passes.
- First draft: `showcaseGuidanceV2`, `showcase`, `showcasePaidScope` and `bPostTransferGuidance` gave 27/28 pass. The one failure is `showcasePaidScope` "the exact live CLI validates and cannot dispatch without credentials". With uncommitted edits, the CLI stops at "paid runs need a clean, committed tree", one check before the missing-key check the test expects. It is expected to pass once the draft is committed; not yet verified.
- Full `npm test` (first draft, run while the owner's paid Pilot-39 recording was running): 1,366 pass, 30 fail. 25 failures are timeouts. `collisionPrediction` passes alone. The recorder tests still fail alone while the paid run records. One recorder-message wording failure was already known. Re-run after Pilot-39 ends.

## Owner approval (2026-11-07)

After reviewing the revision above, the owner wrote: "I approve it all, once fixed, give me the command and I'll run it in parallel to the current one." This covers:

1. The v2 guidance text at guidance hash `364acf1a96ca45899d91f3e35f142d21a32ab91a406e745e57def868a8128664`.
2. Dropping `b-post-combined-v4` from the showcase.
3. Removing "Protect both heroes' health throughout." from `SHOWCASE_BRIEFING`. Showcase definition version 4, hash `e6136fa454a18085118f69a109e5e00bd1085d405d3d50309e423e1b4e94d45d`.
4. Switching the paid scope to v2 (`SHOWCASE_GUIDANCE_ID`).
5. Budget for another attempt. Asked where it should come from, the owner chose "Move $2 from final": pilot $9 → $11, final $15 → $13, total $25 unchanged.

With the new briefing, the full v2 planner prompt hash is `3045e66d8ac6ea06abb76396242eeb3e6f6fe70320999a6444db2e9cc1449a77` (37,267 characters). v1 stays in the code, unchanged at `ea5d75ba…`, but is no longer admitted for paid runs.

Everything else in the paid scope is unchanged: OpenAI `gpt-6-luna`, medium effort, batch 4, seed 0, $2 cap, 7,200 s, 400 calls per hero, one attempt, no automatic retry. The owner launches the run.

### Not run in parallel

The owner asked to run v2 alongside Pilot-39. That is not possible without bypassing the spend ledger's safety checks, which was not done:

- A paid run holds the canonical ledger's exclusive lock for its whole duration. Pilot-39 (pid 90974) held it. `ledgerCanonical.test.ts` checks that another worktree is refused while the lock is held.
- The pilot stage had about $0.31 left beyond Pilot-39's open $2 reservation.
- The code and the ledger file must have the same stage split. Changing the file while Pilot-39 runs would make its final settlement fail.

So the order is: Pilot-39 finishes and settles; then `scripts/midterm/ledger-reallocate.ts --apply` migrates the stage split; then the v2 run. When this was written, Pilot-39 had obtained the Shears, returned, entered the Griffin Enclosure and brought the Griffin to 320/640 HP or below.

### Ledger migration script

`scripts/midterm/ledger-reallocate.ts` (check-only by default; `--apply` to migrate) refuses unless:

- the ledger is unlocked;
- its config is exactly the previous split;
- no reservation is open;
- its id matches the init marker;
- committed spend fits the new caps.

It takes the ledger's own exclusive lock, rewrites only `config`, checks that the entries are byte-identical afterwards, and writes `docs/midterm/evidence/showcase-v2-authorization/reallocation.json`. A rehearsal on a scratch copy of the real ledger (with Pilot-39 artificially settled at $1.25) confirmed:

- refusal while Pilot-39 was open, with the lock released;
- the check-only mode writes nothing;
- `--apply` migrates with all 39 entries preserved (pilot remaining $3.054996 in that rehearsal);
- re-running refuses as already migrated;
- the real ledger stays unchanged.
