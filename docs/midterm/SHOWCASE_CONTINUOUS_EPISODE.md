# Showcase: one continuous episode, Hedge Maze → Griffin → Goddess

> **Prompt-tuned continuous gameplay demonstration — excluded from official A/B/C evaluation results.**

Scenario `showcase-maze-griffin-complete-v1`, guidance `showcase-maze-griffin-v1`. Prepared 2026-11-07 by the Claude Code implementation agent at the owner's request. **Status: free validation done; paid run locked.** No paid call, push or merge has been made. Nothing in the official A/B/C evaluation was changed (see "What was not touched").

## 1. Feasibility: yes, with no gameplay change

The engine already supports the whole route in one episode. The game keeps one world: the shared backpack, each hero's health, quest flags and the Griffin persist across the area transitions (Hedge Maze → its RETURN exit → Goddess Shrine → NORTH · GRIFFIN TRAIL → Griffin Enclosure → RETURN → shrine). The scripted full-quest route (`route/fullQuest.ts`) and B-return already crossed the same transitions.

Facts from the source and the free runs that shape the showcase:

- **Combat is the only wig route here.** The party never visits Mirror Pond, so it has no Vanity Mirror. The Shears alone start nothing at the nest (`apps/server/src/griffin.ts`). No rule had to change to force combat.
- **Health carries over.** Nothing heals between areas. In the free run the heroes left the maze with Sieg 60 and Coco 88 HP and fought the Griffin from there. A model may arrive more damaged. This is the main risk (section 8).
- **The Shears are not used up** on the combat route, so "Shears held at the end" plus "maze chest claimed" proves the maze step.
- **A peaceful wig cannot satisfy the predicate**: a groomed Griffin ignores all damage forever, so HP 0 with the wig claimed implies a combat defeat.

## 2. Changes made (all additive; no gameplay, rule, tuning, story or asset change)

| File | Change |
| --- | --- |
| `packages/agent/src/showcase.ts` (new) | Definition, pinned by hash; paid lock `SHOWCASE_PAID_APPROVED = false`; proposed paid scope; summary label `SHOWCASE` with `officialEvaluation: false` and the disclosure text |
| `packages/agent/src/suite.ts` | New `SHOWCASE_SITUATIONS` list (one entry), briefing and task line; `situation()` also searches it. `SITUATIONS` and `ABC_SITUATIONS` unchanged |
| `packages/agent/src/evaluator.ts` | New preset: `showcaseComplete` predicate, knockout failure, proposed limits, `showcaseMilestones` |
| `packages/agent/src/environment.ts` | Records the showcase and Griffin milestones in the trace for this preset only |
| `packages/agent/src/harness.ts` | Cap $2.00 and 7,200 s wall-clock ceiling (proposed); the showcase runs only `model-centralized` or its own baseline; paid runs refused while locked; summary label |
| `packages/agent/src/playerKinds.ts` | New player kind `baseline-showcase-route` |
| `packages/agent/src/policies/showcaseRoute.ts` (new) | Free validation baseline (section 5) |
| `packages/agent/src/policies/situationGuidance.ts` | New **proposed** entry `showcase-maze-griffin-v1` (section 4). Existing entries untouched |
| `scripts/midterm/live.ts`, `scripts/midterm/replay-video.ts` | Accept the showcase scenario; the launcher refuses paid showcase runs while locked |
| `scripts/midterm/replay-video.ts` (`6fc3102`) | **Pacing fix** (section 5): replays now schedule ticks on one game clock, so a speed-1 replay video runs in real time. Ticks, order and compared hashes are unchanged |
| `scripts/midterm/showcase.ts` (new) | Free checks: start hashes, guidance and prompt export |
| `packages/agent/test/showcase.test.ts` (new) | 8 tests (section 6) |

The planner (`centralized.ts`, id `f0592888`), `llm.ts`, perception, actions, navigation and both frozen baselines are byte-identical. The B/C run-path pin tests pass: `suite.ts`, `evaluator.ts`, `environment.ts`, `harness.ts` and `live.ts` are the files those tests already allow to grow additively.

## 3. Scenario

| | Value |
| --- | --- |
| Scenario id = preset | `showcase-maze-griffin-complete-v1` |
| Definition hash | `23701f01086385d245a929640c58c1c596934a1ee21f0cddf885d2f911495d29` |
| Start | S2-A's ordinary prefix (goddess checkpoint, opening scene, walk to the shrine's east exit, E). No fixture. Absolute tick 405 |
| Start hash, seed 0 | `fdc498771fe89a1ac96fb1ce8bd972c38ad96e84bdeb18b195292e42e20203ca`, **identical to S2-A's** (episode id `showcase-maze-griffin-complete-v1-0-fdc49877`) |
| Start hash, seed 1 | `febddd1a479ac6f2750c940ac2fa9f6e469d6a5bd2d4ec89bac9f32514f86519`, identical to S2-A's seed 1 |
| Start conditions | Both heroes 100 HP with all abilities; maze pristine (dry hedge, cow in the lane, wolf with the key, gate shut, chest unclaimed); Griffin 640/640 at its nest; no Mirror, Shears or wig; offering not made |
| Success (authoritative state) | Shears Chest claimed **and** Enchanted Shears held **and** Griffin HP 0 **and** wig claimed **and** the Griffin never took the tools **and** offering accepted **and** `chapter0.complete` |
| Failure | Any knockout, checked first on every tick (**proposed**; see decision B in section 9) |
| Milestones (trace only) | `showcase:1-maze-complete`, `2-griffin-defeated`, `3-wig-acquired-after-defeat`, `4-offering-accepted`, `5-chapter0-complete`; plus the Griffin HP quarters and the ordinary story/inventory markers. A wig taken while HP > 0 would be marked `showcase:peaceful-wig (does not satisfy the showcase)` |
| Limits (**proposed**) | 36,000 ticks (600 game-s); 4,000 decisions, 400 model calls and 8M tokens per hero; 30 s per call; 3 consecutive policy failures; 7,200 s wall clock; $2.00 per episode |

Obtaining the wig is never reported as success; the episode ends only at `chapter0.complete` (or a failure or limit).

## 4. Proposed guidance `showcase-maze-griffin-v1` (status: proposed)

| | Value |
| --- | --- |
| Guidance SHA-256 | `c0f7382e577a59b4a71d2141dad90b2037880a7dad55c1f01e34592c636a9c61` (5,142 characters) |
| Full planner system prompt SHA-256 | `fecf10c70440a6e0c8f8283c774098d1150b3448add661be8d8b9ced17fdf753` (36,964 characters) |
| Policy name | `centralized-f0592888(<gateway>)·batch4·tutorial-2ec2f251·briefing-a7116c6b·task-a3e1355f·guidance-c0f7382e` |
| Prompt parts | the public manual (`4b091a66…`), the tutorial (`2ec2f251`, as in A), the showcase briefing (`a7116c6b`), the showcase task line (`a3e1355f`), then one guidance block |
| Full texts | `midterms/saadsatter/evidence/showcase/free-validation/guidance-showcase-maze-griffin-v1.txt` and `planner-system-prompt.txt` |

The guidance is a four-phase plan followed by the **unchanged, owner-approved `b-post-combined-v4` text** (the guidance that won B in Pilot-33). The plan:

1. **Hedge Maze.** Cooperate to obtain the Shears. Coco takes the environmental obstacles her fire, pull or flight can affect; Sieg takes enemies, gates and anything to be chased, struck, pushed or reached quickly. Phase 1 ends only when the backpack lists the Shears.
2. **Travel.** Leave by the maze's RETURN exit; at the shrine take the exit marked for the Griffin; ordinary exits only; no other areas; keep together; health carries over.
3. **Griffin combat.** Fight until the label shows it defeated; Coco at range, Sieg protects himself, keeps out of Coco's line and strikes in reach. While it is alive, do not go to the nest or use any item there. Keep both heroes alive.
4. **Wig and Goddess.** Only after the defeat, Coco claims the wig at the nest by flight; confirm it in the backpack; return; offer it; read and answer every dialogue until Chapter 0 is complete. "Holding the wig is not the end."

Every phase change is tied to something the screens show (area name, backpack, label, dialogue), never to elapsed time or an accepted order. The text names no coordinate, waypoint, hidden state or maze answer (no cow, wolf, key, hedge or Black Hole step); a test checks this. **This follows `CLAUDE.md`'s rule against answer keys in prompts**, which still applies to a demonstration. If the owner wants a more explicit maze walkthrough, that is decision C in section 9.

The frozen A/B/C prompts and guidance texts are unchanged (tests check the v4 and C3 hashes).

## 5. Free end-to-end validation

Implementation commit `c30d2fb`. Every run below was first made on the uncommitted change and then repeated from the clean commit for the evidence folder, with identical hashes.

### Scripted baseline `baseline-showcase-route-v1` (labelled baseline, never presented as a model)

It composes the frozen baselines without changing them: `baseline-maze-heuristic-v2` until its own backpack panel lists the Shears; then an observation-only walk to the exit whose drawn label reads `RETURN` (maze) or `GRIFFIN` (shrine), over its own remembered screens, exploring if the exit is unseen; then `baseline-griffin-heuristic-v1` from the enclosure on. Each hero has its own instance and memory. No coordinates, routes or engine state.

| Run | Seed | Result | Game time | Decisions (Sieg / Coco) | Invalid | Calls | End hash |
| --- | --- | --- | --- | --- | --- | --- | --- |
| headless 1 | 0 | **success** | 141.7 s (8,500 ticks) | 962 / 1,064 | 0 | 0 | `2678c3a0…0647` |
| headless 2 | 0 | **success**, identical | 141.7 s | 962 / 1,064 | 0 | 0 | `2678c3a0…0647` |
| headless | 1 | **success** | 141.7 s | 962 / 1,064 | 0 | 0 | `4dab6f58…` |
| live viewer, recorded, speed 1 | 0 | **success**, identical to headless | 141.7 s (158.7 s recording) | 962 / 1,064 | 0 | 0 | `2678c3a0…0647` |

Milestones in the seed-0 trace (game seconds): Shears + maze complete 31.5; Griffin awake 65.5; HP ≤480 74.9, ≤320 80.5, ≤160 83.2, **0 at 85.2**; wig claimed after defeat 127.9; offering accepted 138.7; **`chapter0.complete` 141.7**. Final HP: Sieg 34, Coco 62.

- **Replay:** `replay-video.ts --check-only` on the seed-0 trace matches the start hash, all 2,025 step results, the end (success, `2678c3a0…`) and 8,500 ticks.
- **Recording:** 1280×720 WebM, `saved`, ready and final frames confirmed, no warnings. The whole file decodes (`scripts/evidence/verify-video.ts`). The last frame shows `finished: success · 141.7 s game time · 0 model calls` and all five showcase milestones; the mid-run frame shows both heroes at the shrine with the quest line "Recover the Divine Wig ✓ Shears". The status strip and milestone line sit above and below the two game views and do not cover them.

### Replay video at normal speed, and a defect found and fixed

`replay-video.ts` re-rendered the baseline's trace to video with no model call. The first render matched the trace, but sampled frames showed it played about 10% fast: 141.7 game-s in about 132 s. Cause: the environment's paced loop (`runPaced`, `environment.ts`) waits between ticks only while both heroes have an action running, so the tick where one action ends and the next starts is not waited for. That is intended in a live run, where game time is frozen while a hero decides, but in a replay the roughly 2,000 skipped waits add up. The shared environment was not changed. The replay script now paces each tick on one absolute game clock (`6fc3102`). Re-rendered: `matchesTrace: true`, measured pacing 141.65 s wall for 141.65 game-s, and frames 75.9 s apart in the video are 76.5 game-s apart on the on-screen clock (equal within its 0.1 s display and frame timing). Earlier replay videos made with the old pacing (for example in `midterms/saadsatter/evidence/`) are slightly fast; their game content and replay checks are unaffected.

### Mock model run (launcher and prompt path; not a result)

`model-centralized` + `showcase-maze-griffin-v1` with the mock gateway (random legal actions, $0, scratch ledger): ended `error` (the planner's existing stall watchdog) at 240.3 game-s after 108 calls, 3 invalid actions. Its summary records the proposed guidance, the prompt hash `fecf10c7…` and the SHOWCASE label. Its trace replays exactly (1,070 results, 14,416 ticks).

### Paid lock

`npm run eval:live -- --scenario showcase-maze-griffin-complete-v1 … --gateway openai … --paid` stops with "locked for paid model runs until the owner approves the showcase". `validatePlan` refuses it too (tested).

## 6. Tests

`packages/agent/test/showcase.test.ts`, 8 tests (all pass). Full suite at `c30d2fb`: **1,381 of 1,382 pass**; the one failure is `s2Shutdown.test.ts` "gives up on a video that never finalizes" (a 200 ms timing assertion), which fails the same way on the untouched `eeb2b59` (checked in a temporary checkout). `npm run typecheck` and `npm run build` pass. Tests: separation from the frozen lists and the label; proposed limits; start equal to S2-A at seeds 0 and 1 and identical on reset; guidance proposed, pinned and equal to plan + v4; no coordinates or maze answers in the plan; prompt = generic prompt + one block (hash pinned); paid lock and player restrictions; the baseline's full run (success, pinned end hash, five milestones in order, no peaceful marker) and, on copies of the final world, that removing any one required step (Griffin alive, wig unclaimed, tools taken, chest unclaimed, Shears gone, no `chapter0.complete`) fails the predicate.

## 7. Evidence

`midterms/saadsatter/evidence/showcase/free-validation/` (see its README): the free-check report, the guidance and full prompt texts, the recorded baseline run's trace, summary, run and recording metadata, replay and video checks, the mock run's summary and replay check, and a SHA-256 manifest. Videos stay in `evaluation-runs/live/` (Git-ignored, local only) and are identified by SHA-256.

## 8. Planned paid recording and its risks (not run)

**Proposed command** (refused until the owner approves; needs a clean commit, the shared ledger and the key):

```sh
npm run eval:live -- --scenario showcase-maze-griffin-complete-v1 --seed 0 --player model-centralized \
  --guidance showcase-maze-griffin-v1 --gateway openai --model gpt-6-luna --effort medium \
  --max-spend-usd 2.00 --wall-seconds 7200 --paid
```

**Two videos, one episode.** The live viewer shows the human game UI, including the HUD goal lines that the agents do not receive (an existing owner decision); that is what a player sees, not agent input. The environment is lockstep: game time stops while the planner thinks. The live recording therefore lasts about as long as the run's wall time (about 1–2 hours), mostly frozen frames. It is kept unedited as the raw continuous original. The 3–5 minute submission clip is then made with `replay-video.ts` from that run's trace at speed 1: it resubmits the recorded actions to the real engine, makes no model call, must match every step result and the end hash, and is titled "REPLAY of … (recorded actions, no model calls)". With the pacing fix its episode part lasts exactly the game time. Neither is sped up or cut.

**Estimates** (from Pilot-30 on A and Pilot-33 on B, same planner, model and effort):

| | Estimate | Basis |
| --- | --- | --- |
| Game time | 170–300 s (about 3–5 min); could fall just under 3 min if play is efficient. Not padded if so | Pilot-30 maze 89.5 s + travel 20–60 s + Pilot-33 fight to `chapter0.complete` 51 s + wig search |
| Model calls | about 450 (350–650) | Pilot-30 167 + Pilot-33 251 + travel and dialogue |
| Cost | about $1.10 ($0.85–1.60); the $2.00 cap binds near 800 calls | $0.0022–0.0027 per call |
| Wall time | about 4,400 s (3,300–6,500 s); limit 7,200 s | 8.7–11.7 s per call |
| Ledger | the pilot stage has **$2.13** left of $8 | `scripts/midterm/ledger.ts`, read-only |

**Risks**

1. **Knockout in the Griffin fight (largest).** At full health, B pre-tuned (Pilot-31) and the first B post-tuned (Pilot-32) were knocked out; only Pilot-33 (v4) won. Here the heroes arrive with whatever health the maze left. I estimate roughly an even chance that a single paid run fails here.
2. **Maze stall.** Before tuning, the planner got stuck at the cow (Pilot-28/29). The current planner (Pilot-30) solved it once. One success is not a reliability measure.
3. **Planner stall watchdog** ends the episode as `error` if no verified progress is made for too long (seen in mock runs).
4. **Known controller limits** (disclosed for B): the planner is not woken by a new beam warning, and its `fight` intention cannot target the Griffin, so the fight runs on ordinary attack/move/defend orders.
5. **Budget for retries.** One $2.00 run fits the pilot balance. A second attempt would need the owner to move money from contingency ($1.90) or final ($15), which the launcher does not use today.
6. **Wall-clock.** A slow API day could approach 7,200 s.

A failed or partial run is still preserved and reported as what it is. It is never labelled a success, and a later attempt never erases it.

## 9. Decisions needed from the owner before the paid run

- **A. Limits and cap:** 600 game-s, 4,000 decisions, 400 calls and 8M tokens per hero, 7,200 s wall clock, $2.00 cap. Approve or change.
- **B. Knockout rule:** (1) terminal failure, as in B and C (implemented now); or (2) record a knockout as a disclosed milestone and let the game's own respawn continue the episode. Option 2 is closer to normal play and raises the chance of a finished recording; option 1 matches the evaluation's survival rule.
- **C. Guidance text:** approve `c0f7382e…` as written, or edit it. A more explicit maze walkthrough would conflict with `CLAUDE.md`'s rule against answer keys in prompts; it would need an explicit owner override for this demonstration.
- **D. Model and run:** `gpt-6-luna` at medium effort, batch 4, seed 0, one run. Approval is a reviewed commit that sets `SHOWCASE_PAID_APPROVED = true` and the guidance status to `approved` with its hash.
- **E. Budget for a retry**, if wanted, before the first run (see risk 5).
- **F. Review:** run `rules-reviewer` and `game-rules-audit recording` on this change before the paid run (not yet done), and record this session with `session-evidence`.

## What was not touched

Frozen scenario definitions, start hashes and definition hashes (A, B, B-return, C); every guidance text and its hash; the planner; both baselines; declarations, result manifests and `EVALUATION.md`; Pilot-28 to Pilot-35 evidence. The full test suite result at the implementation commit is recorded in the evidence README.
