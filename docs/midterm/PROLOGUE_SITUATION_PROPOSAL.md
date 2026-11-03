# Proposal: a Prologue evaluation situation (for approval)

**Status: approved by the owner on 2026-11-03 as P1 (option P1) and implemented; see [PROLOGUE_SITUATION.md](PROLOGUE_SITUATION.md). The text below is the proposal as written.** Originally: proposal only. Nothing is implemented. No code, prompt, suite, frozen hash, trace or manifest was changed, no model was called, and nothing was committed. Prepared by the Claude Code implementation agent on 2026-11-03 at the owner's request.

**Naming.** "Situation B" is already taken: `S2-B` (cow puzzle) in [HEDGE_MAZE_SITUATIONS.md](HEDGE_MAZE_SITUATIONS.md). This document calls the Prologue candidates **P1–P3** so the two sets cannot be confused. The final id is the owner's choice.

**Three-situation requirement.** Adding one Prologue situation does not satisfy it. This proposal does not claim it does. Whatever the suite becomes, each situation still needs two live trials per player, and a held-out case is still missing.

## 1. The Prologue as implemented

Sources: `packages/shared/src/prologue.ts`, `prologueWoods.ts`, `storyCheckpoints.ts`; `apps/server/src/prologue.ts`, `prologueWoods.ts`, `storyCheckpoints.ts`; tests `apps/server/test/prologue.test.ts` and `prologueWoods.test.ts`. Everything below is in the code and covered by those tests. Nothing comes from plans alone.

**Start (`prologue` title-screen checkpoint, `beginPrologue`).** Stage `ARRIVAL`. Sieg is outside on the road in front of the shop (`MAIN_HOUSE`, 760, 490, facing west). Coco is inside the shop (`HOUSE_INTERIOR`, 590, 322). Alden stands at his table. Sieg has Guard and Super Speed. Coco has Ward, Slow Time, Flight and Black Hole. The shared backpack is empty.

| # | Stage | Scene | What starts it (server) | Player action needed | Who can do it |
| --- | --- | --- | --- | --- | --- |
| 1 | ARRIVAL | Shop exterior / interior | Sieg is inside the shop | Sieg walks to the shop door and presses E | **Sieg only** (role check) |
| 2 | → LEAVING | `visit`: 14 lines | — | Advance dialogue | Either hero |
| 3 | LEAVING | Shop → road | A hero in `MAIN_HOUSE` reaches the road (y ≥ 456) | Walk to the shop's exit, E, walk south to the road | Either hero |
| 4 | → FOREST_BOUND | `fork`: 13 lines (3 are Sieg's inner thoughts; Coco sees a neutral line) | — | Advance dialogue | Either; Sieg-only lines need Sieg |
| 5 | FOREST_BOUND | Road west | E at the west road point, drawn as "← FOREST" | Walk west, E | Either; the whole party travels |
| 6 | → TRAIL | `PROLOGUE_TRAIL` | A hero within 96 px of the cart | Walk to the tipped cart (not signposted) | Either |
| 7 | | `cart`: 6 lines | — | Advance dialogue | Either |
| 8 | TRAIL | Trail exit, "E · FOLLOW THE TRACKS" (shown only after the cart) | E at the exit | Walk north-west, E | Either |
| 9 | → WOODS | `PROLOGUE_WOODS`, the Mossling Woods tutorial: an intro (5 lines), then five lessons, each with a 3–5 line scene | Each lesson ends when every hero has done their part and its mosslings are dead | **Attack** (both J), **Defend** (both block one spike), **Time** (Coco Slow Time, Sieg Super Speed), **Flight** (Coco flies to the islet, E at the crate, flies back to Sieg), **Black Hole** (Coco hits a mossling with it) | **Both required** for attack, defend and time; Coco for flight and black hole |
| 10 | | `woods-done`: 5 lines, then E at the east exit | — | Walk, E | Either |
| 11 | → AMBUSH | `PROLOGUE_CLEARING` | A hero within 110 px of the clearing's centre | Walk in | Either |
| 12 | → FIGHT | `ambush`: 7 lines, then a survival fight | Ends after 45 s, or when a hero is at 25 HP or less | Fight. **It cannot be won or lost**: HP never drops below 15 and beaten monsters are replaced | Both fight |
| 13 | → HOME | `rescue` (8), `home` (34), `farewell` (9, Sieg only), `morning` (12, 11 Coco only) | Automatic, chained | Advance dialogue only | Per audience |
| 14 | → ERRAND | `morning` ends: flag **`prologue.complete`**; Chapter 0's `errand` scene follows at once | — | — | — |

Total dialogue from the start to `prologue.complete`: 133 lines.

**Automatic (no player choice).** The scenes themselves, the walk-ins before scenes, the whole rescue → home → farewell → morning chain, and the party travel at stages 5, 8 and 10. No scene in the Prologue offers a dialogue choice.

**What a player is told** (separately from the HUD):

- the **quest journal** (`questLog`, already in observations): "Prologue · A Promise Kept", with the steps *Visit Alden's magic shop*, *Find the merchants' lost shipment*, *Train in the Mossling Woods*, *Survive the ambush in the clearing* and *Make it home*;
- the **dialogue**, for example Coco's "merchants lost a shipment in the forest" and "The tracks keep going. North-west, into the trees", and the woods' "Tutorial" lines, which name each skill and what to do with it;
- **signs drawn in the world**: "EMBERBROOK →", "← FOREST", "E · INSPECT", "E · FOLLOW THE TRACKS", "E · TAKE THE CRATE" (Coco only, during the flight lesson). The cart and the clearing are deliberately not signposted (`sealedExit` in `apps/client/src/main.ts`).

**The HUD goal line** spells out each step, for example "E at the FOREST sign" or "Press E at the trail's east end". Under the owner's standing decision, agents never see HUD goal lines.

## 2. Candidate boundaries

All three start at the `prologue` checkpoint at tick 0. Only the terminal milestone differs. Each milestone is a quest-journal step boundary, read from the authoritative story stage.

| | P1 "Into the Forest" | P2 "Through the Woods" | P3 "A Promise Kept" (full Prologue) |
| --- | --- | --- | --- |
| Success | Story stage reaches `WOODS` (the party follows the tracks out of the trail). Journal: *Find the merchants' lost shipment* is done | Story stage reaches `AMBUSH` (the party leaves the woods into the clearing). Journal: *Train in the Mossling Woods* is done | Flag `prologue.complete` (end of the `morning` scene) |
| Covers rows | 1–8 | 1–10 | 1–14 |
| Dialogue lines | 33 | 63 | 133 |
| Gameplay | Narrative navigation: a shop visit, following story directions across 4 areas, finding an unmarked object | P1, plus a guided combat and ability tutorial | P2, plus an unloseable fight and 70 lines of non-interactive dialogue |
| Both heroes needed? | **Weakly.** Only the shop entry must be Sieg's. Coco can finish it by just following. Her contribution can be measured but is not required | **Yes.** The engine requires each hero's own part in three lessons, and Coco's flight and black hole | Same as P2. The extra part adds no requirement |
| Distinct from the Hedge Maze? | **Most distinct**: no puzzle, no combat | Partly. The tutorial uses the same skills as the maze, but every step is stated in the game | Same as P2, plus padding |

## 3. Recommendation: P1, "Into the Forest"

Main reasons:

1. **It tests what the owner asked for.** P1 tests directed, narrative play: read the dialogue and journal, and go where the story points. Every step can be worked out from information a human player sees, even with the HUD goal line hidden. For example, Coco says the shipment is "in the forest", the road sign reads "← FOREST", and Coco says "north-west" after the cart. P1 has no spatial puzzle and no combat, so it does not repeat the Hedge Maze.
2. **It fits the budget and the 3,600 s wall-clock limit.** P2 and P3 probably do not fit; see §9.
3. **Its terminal is natural and unambiguous.** It is a journal-step completion, an area change and a single stage value.

**Its weakness is the one to weigh.** Coco is not required. A passive Coco still lets Sieg succeed. If both heroes' participation matters more than cost and wall time, choose **P2**. It is the only boundary in which the engine requires both heroes. P2 needs a longer wall-clock limit, or a real-play local start at the woods entrance (as S2-local does for the maze), to fit.

I do not recommend P3. Its extra content is a fight whose outcome is fixed and 70 lines of dialogue clicking. Those add cost and wall time but cannot tell the players apart.

## 4. Exact start and terminal conditions (P1)

- **Reset:** the existing `GameRoom` with story checkpoint `prologue` instead of `goddess`, two heroes, a seeded runtime (`runtime.ts`), no prefix and no fixture. The start state is exactly `beginPrologue`'s, described in §1. Pin the start hash at seeds 0 and 1 in a test, as S2-A does.
- **Success:** the authoritative `world.story.stage` is at or past `WOODS` (`stageReached`), checked by the evaluator, never by an agent's claim.
- **Terminal reasons:** the existing set (`success`, `tick_limit`, `decision_limit`, `model_call_limit`, `token_limit`, `spend_limit`, `wall_clock_limit`, `error`, `manual_stop`).
- **Proposed limits (owner decision):** 10,800 ticks (180 game-seconds, about 4–7× the scripted estimate in §8), 800 decisions and 250 model calls per hero, 1,000,000 tokens per hero, a $0.60 episode spend cap, 3,600 s wall clock, and the 30 s per-call timeout.

## 5. Actions the agents must perform (P1)

Every action uses the existing vocabulary. No new action type is needed.

| Action | Used for |
| --- | --- |
| `move` | Walking around the shop, the yard, the road and the trail |
| `interact` (E) | The shop door, the shop's exit, "← FOREST", and the trail exit; optionally Alden and the crates/barrel |
| `advance_dialogue` | 33 lines |
| `wait` | Waiting while the partner acts |
| `message` | Optional partner coordination |

`attack`, `defend`, `ability` and `use_item` stay legal, as they do everywhere, but P1 never needs them.

## 6. Coco and Sieg involvement

- **Sieg is required.** Only Sieg entering the shop starts the story, and three fork lines are his alone.
- **Coco is optional for success.** She starts inside, beside Alden, and the game directs her to leave and lead the way west. That direction appears in the dialogue, and in her hidden HUD line.
- I propose reporting per-hero contribution as a **metric, not a success condition**: which hero triggered each milestone, each hero's decisions, distance walked and dialogue presses. Changing the success rule to require Coco would be an artificial requirement, so I have not proposed it.

## 7. Required adapter changes

None of these changes the game, its rules, its story or its server. All are in `packages/agent/**` and its tests.

1. **`reset` start checkpoint.** `environment.ts` hardcodes `"goddess"` (line 288). Make the checkpoint come from the scenario: `GameRoom` already accepts `"prologue"`, so no server change is needed. Every existing scenario keeps `goddess`, and its start hashes must stay unchanged (tested).
2. **Perception for the Prologue scenes.** This is the largest gap. `sceneProps` in `perception.ts` lists props only for the shrine areas. In `MAIN_HOUSE`, `HOUSE_INTERIOR`, `HOUSE_UPPER`, `PROLOGUE_TRAIL` and `PROLOGUE_WOODS`, an agent today sees terrain, its partner and enemies only. It does not see the shop door, the exits, the road signs, Alden, the cart, the crates or the woods crate. These have to be added **exactly as the client draws them**, following its `sealedExit` rules: no label for the cart or the clearing, and the trail exit hidden until the cart is found. Two cases need an owner ruling, because the client draws art there but no text:
   - the shop's front door, which is unlabelled because it is part of the house art;
   - the cart sprite.

   I propose neutral object names ("door", "tipped cart") as the as-drawn equivalent, as with the Hedge Maze's drawn objects.
3. **Area names.** The fallback would produce "Prologue Trail", "Prologue Woods" and so on. Use the names the client shows ("Main house", "Mossling Woods" and so on); verify each against the client.
4. **Talking to Alden.** Check that his idle lines (`aldenIdleLines`) reach the observation the way the client shows them, or document that they are omitted.
5. **Scenario and evaluator.** Add a new scenario id (for example `P1`) in `suite.ts` and `evaluator.ts`, with the success predicate and limits from §4, a definition hash pinned by a test (as `situationA.ts` does), and an entry in the suite change log. S2-A's definition, hash and traces are untouched.
6. **Briefing.** No new prompt text is required: the general prompt and the manual stay as they are. Whether P1 gets an episode briefing at all, and its wording, is the owner's decision. My recommendation is none, or a single neutral line ("This episode starts at the beginning of the Prologue"). Do not reuse the Hedge Maze tutorial briefing: it describes skills the Prologue teaches later.
7. **Tests** (all offline):
   - start-state hash and its determinism across seeds;
   - the leak scan of every observation over a full baseline run (no flags, stage names, HUD lines, ids or hashes);
   - legal actions;
   - each terminal reason;
   - existing scenarios unchanged.

**HUD decision (owner).** The standing rule hides HUD goal lines from every player. I recommend keeping that rule for P1. The journal, dialogue and signs are enough to infer each step, and the Prologue's HUD lines are step-by-step directions. Showing them would also make the information rules differ between situations.

## 8. Scripted baseline feasibility

**Feasible.** A deterministic two-hero baseline can complete P1 using only the public interface, once the props in §7.2 are observable. It reuses `navigate.ts` (search over the screen grid) and the existing dialogue handling.

The route:
1. Sieg walks to the shop door and presses E.
2. Both heroes read the scene.
3. A hero exits, walks south to the road, reads the fork, walks west and presses E at "← FOREST".
4. On the trail, a hero walks toward the visible cart, reads the scene and presses E at "FOLLOW THE TRACKS".
5. Coco follows her partner.

Like `baseline-quest`, it knows the story order, so it is **solution-aware** and must be disclosed as such. A quest-free floor (`baseline-explore`) can also run.

Estimates. These are **not measured** and depend on the §7 changes:

| | Estimate | Basis |
| --- | --- | --- |
| Walking | about 2,100 px, or about 11 s at 190 px/s | Map points in `maps.ts` and `prologueForest.json` |
| Game time | about 1,500–2,700 ticks (25–45 s) | Walking, plus scene walk-ins (up to 12 s each) and transitions |
| Decisions | about 150–300 in total | 33 dialogue presses, 4–6 E presses, moves split into actions of at most 60 ticks, and waits to keep pace (as in `ROUTE_LOG.md`) |
| Model calls, wall time, cost | 0 calls, under 2 min, $0 | |

## 9. Estimated model-run length and cost (not measured)

Assumptions:
- **Dialogue.** A batch stops whenever dialogue is on screen (`batch.ts`), so each line costs about 1–2 calls: the reader, and often its partner. The basis is pilot 2: S1 with 23 opening lines used 78 calls in total.
- **Navigation.** The unaided Hedge Maze trials used 170–390 calls.
- **Cost per call.** Measured $0.00057–$0.00084 on `gpt-6-luna` medium (pilots 11–15), against the budget's $0.00067–$0.00117 for Haiku 5.5. I use **$0.0006–$0.0012**.
- **Wall time.** Measured **6.4–7.9 s per call** across the episode (pilots 12, 13 and 15: 1,048 s, 3,068 s and 1,150 s). Hero calls do overlap, but game time waits for both heroes.

| | Model calls (both heroes) | Game time | Wall time | Cost per trial | Fits 3,600 s? |
| --- | --- | --- | --- | --- | --- |
| **P1** | 150–350 | 40–150 s | 16–46 min | $0.09–$0.42 | Yes |
| P2 | 400–900 | 120–400 s | 43–119 min | $0.24–$1.08 | Often no |
| P3 | 600–1,250 | 200–500 s | 65–165 min | $0.36–$1.50 | No |

For P1, 2 trials × 2 model players (`model-memory`, plus `model-obs-only` if approved) is about $0.4–$1.7 and 1–3 hours of wall time. The pilot ledger has $6.17 left. Prices must be re-checked on the run day.

## 10. Risks to rubric compliance and fairness

1. **Leakage through new perception code.** This is the largest risk (2c). Area names, scene ids such as `PROLOGUE_WOODS`, stage names and flag names must never reach an observation. Labels must follow the client's sealing exactly; for example, the cart must never be signposted. Mitigations: the leak-scan test over a full run, and a `game-rules-audit adapter` invocation and independent `rules-reviewer` review before any paid run.
2. **Post-hoc and development-informed.** The Prologue is added after the Hedge Maze pilots and is designed knowing the code. It is not held out unless the owner reserves it before any tuning. Recommendation: freeze P1 before any model sees it, and run it untuned. That would make it the suite's first genuinely held-out-from-tuning situation. (5a)
3. **Weak two-hero requirement in P1**: see §6. Report it plainly.
4. **Solution-aware baseline.** Same disclosure as on S2-A. (4b)
5. **Ceiling effect.** P1 may be easy for a model. That is still a valid, interpretable result, but it would separate the players less than the maze does. P2 separates them more, at higher cost. (4b)
6. **Hidden HUD.** Without the HUD, a stall at the first step is possible: Sieg must think to enter the shop, guided only by the journal step "Visit Alden's magic shop". This is a deliberate test of inference from legitimate information, and it must be described that way rather than as unfairness.
7. **Scope.** The README's scope statement currently excludes the Prologue (checklist 1b). Adding it changes the declared episode bounds; the README and EVALUATION.md must say so. Professor approval of the scope is still not recorded.
8. **Three situations.** P1, together with S2-A (and S2-B/C, which have no live trials), still needs two live trials per situation and a held-out case before the requirement can be called met.

## Decisions needed from the owner

1. The boundary: P1 (recommended), P2 or P3, and its id and name.
2. Limits: the §4 proposal, or others.
3. Whether the HUD goal lines stay hidden (recommended) or are shown for this situation.
4. Names for the drawn but unlabelled shop door and cart (§7.2).
5. The briefing: none (recommended), a neutral line, or the owner's own text.
6. Whether P1 is frozen and kept out of all tuning, so it can serve as a held-out case.
7. Approval to implement §7 and the baseline. Paid trials would be a separate approval later.
