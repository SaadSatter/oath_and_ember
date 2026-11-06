# Situation B: Griffin Trial (Unprepared), `griffin-unprepared-v1`

Prepared 2026-11-06 by the Claude Code implementation agent, at the owner's request, under declaration `oath-ember-abc-2026-11-06` ([DECLARED_EVALUATION_SUITE.md](DECLARED_EVALUATION_SUITE.md)). No paid call, no model episode, no push or merge. Situation A, Pilot-28/29/30 evidence and every frozen scenario are unchanged.

**Status: certified offline. Ready for live approval once the owner settles the decisions at the end of this document.**

Code: [`griffinSituations.ts`](../../packages/agent/src/griffinSituations.ts) (frozen definition), [`route/griffinStart.ts`](../../packages/agent/src/route/griffinStart.ts) (start prefix), [`route/griffinWitness.ts`](../../packages/agent/src/route/griffinWitness.ts) (offline witness), [`policies/situationGuidance.ts`](../../packages/agent/src/policies/situationGuidance.ts) (post-tuned mechanism). Tests: [`griffinSituationB.test.ts`](../../packages/agent/test/griffinSituationB.test.ts). Free check: `node --import tsx scripts/midterm/situation-b.ts`. Evidence: [`evidence/situation-b-certification/`](evidence/situation-b-certification/summary.json).

## 1. Specification

| | Value |
| --- | --- |
| Scenario id = logical id | `griffin-unprepared-v1` (preset of the same name). New; no existing id was reused. It sits in its own `ABC_SITUATIONS` registry, so the frozen suite revision 2 list (`SITUATIONS`) is unchanged |
| Definition hash | `bbbbc43532324b80179ab8fdf122fe7f6d10446a52d9ac752a0efdeae7671374` (pinned by the test) |
| Seed, start tick | 0 for every repetition (declared). Absolute tick 439; episode time starts at 0 there |
| Start hash, seed 0 | `1a270d7b5e456d1be0e3250d37baae26a77b5ca3099b18433a9c8e5a25fb0051` (episode id `griffin-unprepared-v1-0-1a270d7b`) |
| Start hash, seed 1 | `7bfeb7f7b2e9e14c16a180481d2f4351e6d96d17aea94dda520dae3acae20bb1` (only the room code and hero ids differ; same prefix, same witness actions) |
| Prefix history | 171 Sieg + 56 Coco ordinary actions (move, wait, interact, dialogue), SHA-256 `2f6bc219…20b6` |
| Code commit | `96fd952` (implementation); evidence generated at that commit |

### How the actual game represents the steps

These are separate events in the code, so the predicate checks each one directly:

1. **Griffin defeat.** `damageGriffin()` (`apps/server/src/griffin.ts`) lowers `hp` from fireballs, sword hits and Black Hole. At 0 it sets phase `DEFEATED`. The Griffin then stops acting and its label reads `DEFEATED · E at nest for wig`. No wig yet.
2. **Wig.** A plain E from Coco at the nest after defeat (`interact` with no tool) calls `awardGriffinWig()`: `griffin_wig` +1 in the shared backpack, the nest is claimed, and `puzzles.griffin.complete = true`. Only Coco can do this ("Coco must fly to the nest").
3. **Peaceful route (not B).** Delivering the Mirror starts `GROOMING`, the Shears allow `CUT`, and the wig drops while HP stays above 0. That route also sets `puzzles.griffin.complete`, so that flag is **not** used.
4. **Quest/journal.** The journal step reads "Recover the Divine Wig". The item is the "Magnificent Griffin Wig". Its delivery to the goddess is outside B.

### Start (reached by real play)

`goddess` checkpoint → the scripted opening scene (the same prefix S2/S3/S2-local use) → Sieg walks west of the statue's wall and up to the shrine's north exit ("NORTH · GRIFFIN TRAIL") and presses E. The whole party travels. Preparation stops on arrival, before the arrival scene and before either hero moves inside. There are no fixtures, teleports, flag edits or item grants. Memory, messages, decisions and episode time are then reset by the existing environment reset.

Checked by the tests at reset:
- **Heroes:** Sieg (592, 1056) px and Coco (688, 1056) px, the enclosure's spawn, 100 HP each, every cooldown 0. Sieg has Sword, Guard, Push and Super Speed; Coco has Fireball, Ward, Slow Time, Flight and Black Hole. Both are ready.
- **Griffin:** exactly `newGriffin()`: 640/640 HP, phase `NEST` at the nest (640, 112), cooldown 2, all four pillars standing, no tool delivered, wig not claimed. The heroes start about 29 tiles from it, outside its 15-tile sight, so it is dormant.
- **Backpack:** the same eight held items as S2-A. No Vanity Mirror, Enchanted Shears or wig. The nest is not claimed.
- **Observations:** both heroes are in "Griffin Enclosure", with no dialogue and no messages. No ids, flags, raw Griffin HP field or hashes appear.

**Compatibility with C.** C can reuse this exact prefix tail: after `withMirrorAndShears` (maze + pond, as S4 does), the same north travel reaches the same spawn and the same fresh Griffin. The primary difference is the backpack. Legal histories will still differ in quest flags, claims, absolute tick and journal, as the declaration already discloses. C is not implemented here.

### Objective, success, termination

- **Success:** authoritative `griffin.hp == 0` **and** shared `griffin_wig` count > 0 (`griffinDefeatedAndWig`, `evaluator.ts`). Entering the arena, waking or damaging the Griffin, `DEFEATED` without the wig, `puzzles.griffin.complete`, or a wig with HP above 0 each fail the predicate (unit-tested). In the witness, HP reached 0 at tick 4273 and the episode ended only at the wig, tick 4368.
- **New failure reasons** (`types.ts`, checked every tick *before* success):
  - `knocked_out`: a hero's health ran out. The game respawns them at 100 HP, so final HP cannot show it; the environment sees it through the original damage call.
  - `left_area`: any hero is outside `GRIFFIN_ENCLOSURE`.
- **Other terminal reasons** as before: `tick_limit`, `decision_limit`, `model_call_limit`, `token_limit`, `spend_limit`, `wall_clock_limit`, `error`, `manual_stop`.
- **Limits** (the declared A/B/C run bounds, the same as S2-A): 18,000 ticks (300 game-s); 1,600 decisions, 400 model calls and 4M tokens per hero; 30 s per call; 3 consecutive policy failures; 3,600 s wall clock for models, 600 s for scripted players; **$0.75 per episode** (`EPISODE_CAP_USD`).

## 2. Legal reachability

The prefix is the existing opening plus 227 ordinary actions through `step()`. The tests and the script record every action it submits, check each is an ordinary player action type, and pin their SHA. Two resets at seed 0 give identical hashes, prefixes and observations. A second `reset()` of the same environment after play returns the identical start and observations, with no leaked messages, decisions or memory.

## 3. Agent access: what was checked, and the one gap fixed

Through the five operations an agent can: see the Griffin (`creature`, "griffin") with its drawn label `GRIFFIN hp/640 · PHASE`; see the pillars and the RETURN exit; use `move`, `attack` (with direction), `defend`, every ability including Flight and Black Hole, and `interact`; see damage, knockout and backpack/journal feedback; and see the nest in `inventory.nearbyTarget` when Coco is there. The witness used only these.

**Gap found and fixed (adapter only, `6deaef3`).** The client draws three attack warnings that the observation did not contain, only the phase word:
- the red warning line from the mouth to where the beam will stop (BEAM CHARGE);
- the beam itself (BEAM);
- the orange line and circle for the headbutt (HEADBUTT CHARGE).

Each is now an `effect` at the line's far end, or where the drawn line leaves that hero's screen ("continuing off your screen here"). The details give the direction the line runs. The client's own geometry is used (`griffinBeamEnd`, `griffinMouth`, `aimX/aimY`). No damage, timer or target is given. The change affects every observation in the Griffin Enclosure, **including the held-out S4 and F, which pass through it** (corrected after review finding 2). Their scripted pins (`scriptedFreeze.test.ts`, the route tests) still pass, because they pin actions and state hashes, not observation text. A future S4/F model run would see these entries.

**Not changed (frozen policy, disclosed):**
- The centralized `fight` intention only targets `enemy` entries, so it cannot fight the Griffin (a `creature`). The planner must use ordinary `attack`/`move`/`defend` actions, up to 4 per order.
- The planner is not woken by a new `effect`. It reacts to a beam warning only when a hero's action or intention ends, or on damage (a fifth of max HP, or low health).

Both may make B hard for the model. They are controller properties, not adapter defects, so they stay as they are.

## 4. Pre-tuned and post-tuned configurations

| | Pre-tuned | Post-tuned |
| --- | --- | --- |
| Player | `model-centralized` (one planner, two controllers) | same |
| Planner code | `CENTRAL_ID f0592888`, unchanged since Pilot-30 (`040685c`); no policy file changed between `040685c` and `5388b23` | same |
| Prompt | generic planner prompt + tutorial `2ec2f251` + B briefing `5fa93722` | the same, then one `=== Post-tuned guidance ===` block |
| Prompt hash (manual `4b091a66…`, batch 4) | `cbabb78b42b1227bafff0ef9e95b62ad5e03ba725691482e2e032384097bbb6a` | `8735fd86d0d374dde8ab78b06eec2bdc93b7643ecf19bbd5c080fdb214a16674` |
| Policy name | `centralized-f0592888(<gateway>)·batch4·tutorial-2ec2f251·briefing-5fa93722` | … `·guidance-1c062840` |
| Guidance | none | `griffin-b-post-v1`, SHA-256 `1c06284031aff876ca9fcf9d594bac6297b9bb636f18347266b9988cafbf3d36`, status **proposed** |
| Model config (proposed, as Pilot-30) | OpenAI `gpt-6-luna`, effort medium, batch 4 | same |

The test checks that without guidance the planner prompt is byte-identical to the generic one, and that S2-local still produces Pilot-30's recorded prompt hash `0616c47b…0c44`. So the earlier pre-tuned/post-tuned policy is not altered.

Mechanism rules (`validatePlan`):
- guidance works for `model-centralized` only, on its listed situations only (`griffin-unprepared-v1`), and never in final runs;
- a `proposed` guidance runs with the mock gateway only, so every paid run refuses it until the owner approves the text and its status is changed in a reviewed commit;
- run manifests and summaries record `guidance: {id, status, sha256, situations}`, and the `configHash` differs.

### Proposed post-tuned guidance (for owner review, not approved)

```text
Griffin combat guidance:
- The Griffin's floating label shows its health and what it is doing. While it flies, Sieg's sword cannot reach it; Coco's fireballs can.
- BEAM CHARGE is a warning. A thin red line (listed as "griffin beam warning line") shows where the beam will stop. Before BEAM starts, hold defend or leave the line: a defended hit does a quarter of its damage. Walls, pillars and bodies stop the beam.
- The Griffin aims at the nearer hero. Keep the hero who is not attacking farther away, holding defend, and keep the attacker defending through every charge and beam.
- A fireball flies straight in the direction thrown. From the shore below the Griffin's flight path, follow it side to side and throw north just before it passes overhead.
- Health does not come back during this episode. A hero who is low on health should stay back and defend rather than attack.
- When its label shows it defeated, Coco can fly to its nest with Flight and press E there to collect the wig.
```

It is drawn from the source and the witness, and is explicit combat guidance, as the post-tuned condition allows. It names no coordinate or action sequence. Whether it may transfer to C has to be decided before any C outcome.

The draft B briefing (`GRIFFIN_TRIAL_BRIEFING`, `suite.ts`) is meant to be shared verbatim with C. It states the goal (Griffin health to zero plus the wig; a wig with health left does not count) and the knockout and boundary failures. It names no item, tactic, place or route (tested). Its wording is the implementation agent's draft.

## 5. Offline combat witness

`route/griffinWitness.ts` is a **scripted, solution-aware certification controller**. It is not a baseline, not a player, and never shown to a model. It reads only each hero's observation and submits ordinary actions:
- Coco keeps to the north shore, follows the Griffin side to side, and throws north when it is about to pass overhead. She holds Ward when it is off screen or while it charges or fires.
- Sieg waits farther south holding Guard.
- At 0 HP, Coco casts Flight, flies to the nest and presses E.

| Seed 0 (repeated twice) | Result |
| --- | --- |
| Outcome | **success**, reason `success` |
| Game time | 3,929 ticks = 65.5 s (limit 18,000) |
| Decisions | Sieg 575, Coco 585 (limit 1,600 each) |
| Invalid actions | 0 |
| Knockouts | 0 (final HP Sieg 100, Coco 35) |
| Mirror / Shears | never held |
| Actions SHA / end hash | `17145c6e…ca01` / `f15f9a6e…73b6` |
| Wall time | under 1 s |
| Timeline | first sighting t1106; HP 560 at t1533 … 80 at t3901; 0 at t4274; Flight; wig at t4368 |

Every action and the hash-chained trace are in [`evidence/situation-b-certification/`](evidence/situation-b-certification/). The witness proves feasibility within the limits. It does not predict model performance.

**The unchanged `baseline-quest` cannot complete B:** at seed 0 it ends `knocked_out` at 636 ticks (10.6 s), after 38 + 61 decisions, 0 invalid actions, end `b6e239cd…8377`. Its enclosure script sends Coco to the nest, where the Griffin attacks her. It has no combat routine. This confirms the declaration's source forecast (it said "fails"; the measured reason is a knockout). The baseline was not changed.

## 6. Live recording and evidence (validated with the mock gateway only)

`npm run eval:live` now accepts `--scenario griffin-unprepared-v1` and `--guidance <id>`. Mock rehearsals at seed 0 recorded:
- pre-tuned: `error`, the planner's existing stall guard, 204 s;
- post-tuned: `knocked_out`, 108.6 s;
- post-tuned paced with the viewer and recorder: the same `knocked_out` and the same end hash `cfdd8940…` as unpaced. It wrote `recording.webm` (5.8 MB), `recording.json` (saved: true), `live.json`, `run.json`, `summary.json`, `results.json`/`.md`, a verified `trace.jsonl` and a scratch ledger entry.

Summaries carry the label `B` with the definition hash, the start/end hashes, policy names, prompt hashes, `configHash`, `gitHash`, the guidance record, the cap, calls, tokens and charged cost. The video frames were not inspected visually (no ffmpeg on this machine); the recorder reported a clean save.

Command templates (paid lines need the owner's authorization, a clean commit, the shared ledger and the key):

```sh
# pre-tuned
npm run eval:live -- --scenario griffin-unprepared-v1 --seed 0 --player model-centralized --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid
# post-tuned (refused until griffin-b-post-v1 is approved)
npm run eval:live -- --scenario griffin-unprepared-v1 --seed 0 --player model-centralized --guidance griffin-b-post-v1 --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid
# cheap baseline (free)
npm run eval:live -- --scenario griffin-unprepared-v1 --seed 0 --player baseline-quest
# free rehearsal of either model condition: use --gateway mock instead of the gateway/model/effort/cap/--paid flags
```

## 7. Estimated calls and spend

Basis: Pilot-30 (same player, model and effort) used 167 calls, $0.443 (about $0.0027 per call) and about 11.7 wall-s per call, for 89.5 game-s. Combat interrupts the planner more often than the maze: damage, new sightings and short batches. Expect 2–3 calls per game-second.

| | Estimate |
| --- | --- |
| A model trial lasting 60–150 game-s | about 120–450 calls |
| Cost | $0.32–$1.20 uncapped. **The $0.75 cap binds at about 280 calls**, likely before 150 game-s |
| Wall clock | the 3,600 s limit binds at about 300 calls |
| Per-hero call cap | 400 is unlikely to bind first |
| Ceiling for B's four declared model episodes (2 pre + 2 post) | 4 × $0.75 = **$3.00**, reserved per episode in the shared ledger |

`spend_limit` or `wall_clock_limit` are plausible terminal reasons for a long fight. They must be reported as budget limits, not as game failures. Prices must be rechecked before any paid call.

## 8. Remaining blockers and decisions for the owner

1. **Approve the five-operation observation addition** (`6deaef3`, the Griffin's drawn warnings). The brief authorized adapter fixes of this kind, but CLAUDE.md lists the observation set as owner-approved.
2. **Approve or edit the B briefing wording** (draft; to be shared with C).
3. **Approve or edit `griffin-b-post-v1`**, then change its status to `approved` in a reviewed commit. Until then post-tuned paid runs are refused.
4. **Decide whether B-derived guidance transfers to C**, before any C outcome.
5. **Confirm model, effort and cap** (`gpt-6-luna` medium, $0.75) and authorize the paid B runs and their order.
6. **Accept the disclosed controller limits** (no Griffin `fight` intention; no wake-up on a beam warning), or approve a controller change. Any change would need a new policy id and re-pinning.
7. **Registration.** The two free baseline cells for B can be filled from the deterministic result above (`knocked_out`, 10.6 s). Whether they count as the declared baseline trials, and updating `declaration.json`, `matrix.json` and `declared-results.json`, are left to the owner and the session editing those files. This branch does not touch them.
8. **Independent review** of `6deaef3` and `96fd952` by `rules-reviewer`, and a `game-rules-audit griffin` run, are still to do.

---

## Review round 1 (2026-11-06)

The owner provisionally approved exposing the Griffin's drawn beam warning, active beam and headbutt aim mark, provided they match what human players see and leak no hidden state. No paid call, policy change or gameplay change has been made since.

### Investigation: the two frozen-policy limitations

Both are **policy limitations, not interface defects**. The interface exposes what is needed: the Griffin, its label, the warnings and every legal action. The controller does not act on some of it.

1. **`fight` cannot target the Griffin.** The navigator's `fight` filters `kind === "enemy"` by design (`a3acf69`, 2026-11-05; `combat.ts` `planFightTarget`, `navigator.ts` fight step). The interface lists the Griffin as a `creature`, like the cow and Alden, with its drawn HP/phase label. The planner prompt tells the model that naming a creature ends `fight` at once, so the model is not misled. It must use `attack` (with direction), `move`, `defend` and abilities directly, up to 4 per order. Retargeting would not help much anyway: `planFight` never defends and stops after a 25% HP loss. **Proposed correction:** none for the pre-tuned run. If a helper is wanted, it must be a new controller version.
2. **Reaction to beam warnings.** The controller's wake-up events (`navigator.ts detectEvents`) do not include a new `effect` or a Griffin phase change, and no feedback line reports either. Measured with the real controller and a free scripted stand-in for the model (Coco on the shore holding; game unchanged): over 5 beam charges there were **0 planner calls inside any 1.2 s charge window**, and 3 of the 5 beams then hit Coco for 26 unguarded. So the planner cannot *react* to a warning during a hold, a wait or a batch. It must defend in advance or keep actions short. A second hazard: `wait_until` watching the flying Griffin ends at once, and repeating it burned 400 calls in 6.2 game-s; the call cap stopped it. **Smallest correction, if approved later:** one generic wake event, "new on your screen: <name> (effect)", when an effect appears that was absent at the hero's previous decision. It changes the controller id and its behaviour elsewhere (Black Hole effects), so the pre-tuned policy would no longer be Pilot-30's.

### Witness legitimacy

- **Legal and observation-only.** The witness acts only through `step()` with ordinary actions. It reads only each hero's observation; the director's `asTuned` only rounds positions. 0 invalid actions.
- **Solution knowledge from the source**, which a model does not have: the shore line it patrols, Sieg's waiting point, the nest point (20, 4.4), the fireball speed it leads with (not in the manual), and that the Griffin aims at the nearer hero (not in the manual). Every step is observable in play, but none is told to the model.
- **Timing.** Its 65.5 s does not need tick-precise control. Perturbed copies (scratch only; the committed witness is unchanged) still succeed with every action 2×, 3× and 5× longer (75.9, 82.0, 99.3 s), and without leading the shot at a tighter tolerance (64.2 s). It **fails** without guarding during the warnings (`knocked_out` at 31.6 s). The one capability it relies on is a guard inside each 1.2 s charge window, which is exactly what the frozen controller does not wake for (above).
- So the witness certifies **feasibility**, not an expected model time.

### Cheap baseline recommendation

Keep these as separate records:
- the **declared `baseline-quest` result**: `knocked_out` at 10.6 s, a quest script with no combat routine;
- the **certification witness**: solution-aware, not a competitor.

Recommended additional cheap baseline: a **generic observation-only combat heuristic** (proposed name `baseline-combat-v1`, not implemented). It would contain no Griffin coordinates, no nest point and no fireball constant. Rules:
- guard while any visible warning effect or a hostile's label shows a CHARGE/BEAM phase;
- otherwise the ranged hero lines up on one of the eight aim directions toward the nearest hostile with a health label and fires; the melee hero guards at a distance;
- after a hostile's label reads defeated, walk or fly to it and press E when the backpack panel names a target.

It costs $0 and uses the same five operations, and it would be a real competitor for B and C without any C-specific branch. **Needs:** a new declaration revision, since the declaration says a baseline change needs one; freezing before any B or C model outcome; and a disclosure that it was designed by a developer who knows the encounter. A random-legal floor (the mock gateway's policy) could be listed beside it, but not as the competitor.

### Responses to the independent review and the audit

Reviewer report (verbatim): [`agent-evidence/reviews/2026-11-06-situation-b-rules-review.md`](agent-evidence/reviews/2026-11-06-situation-b-rules-review.md). Implementer audit: [`agent-evidence/skill-runs/2026-11-06-griffin.md`](agent-evidence/skill-runs/2026-11-06-griffin.md).

| Finding | Severity | Response |
| --- | --- | --- |
| R1 guidance text is source-derived (targeting rule, witness tactic, no-heal, sword vs flight); the targeting statement is incomplete | High | **Returned to the owner.** It is latent: paid runs refuse the guidance. The text is unchanged, so the owner sees exactly what was proposed. Options are listed in the approval checklist. |
| R2 doc said no other scenario's observations changed; S4/F pass through the enclosure | Medium | Doc corrected (§3). S4/F scripted pins re-run: pass. Added to approval item 1. |
| R3 B's "pre-tuned" is Pilot-30's generic policy, which the declaration classes as A-post-tuned | Medium | Disclosed here. B pre-tuned = **Pilot-30's generic controller and prompt, not tuned on B**. It includes A-derived general rules. Owner acceptance is needed (checklist). |
| R4 approval was a mutable status string | Medium | **Fixed:** `approvedSha256` must equal the text's hash (`guidanceApproved`), in `validatePlan` and `live.ts`. Tested, including an edited text being re-locked. |
| R5 telegraph tests missed the headbutt mark, fully off-screen lines and the defeated/wig gates | Medium | **Fixed:** tests added (labelled fixtures). |
| R6 failure-before-success ordering not tested at environment level | Medium | **Fixed:** same-tick knockout + success → `knocked_out`; the same fixture without the hit → `success`; a knockout during the prefix is not judged; a lethal hit in S2-local ends nothing. |
| R7 `--wall-seconds` could exceed the declared 3,600 s for B | Low | **Fixed:** B ceiling 3,600 s (separate `ABC_WALL_CLOCK_CEILING_S`, so the existing P1 test's pinned map is untouched). Tested. |
| R8 `replay-video.ts` did not know B or its terminal reasons | Low | **Fixed:** includes `ABC_SITUATIONS`; `knocked_out`/`left_area` are game-decided ends. Not exercised on a real B trace yet. |
| R9 the beam entry is listed at any length; the client hides very short beams; clipping uses the centreline | Low | **Returned to the owner** (an observation change). Proposal: no entry while the drawn length is ≤ 20 px. |
| R10, R11 | Info | No change. The witness stays labelled as a joint, solution-aware certification controller. The `mock:` label check is left as is. |
| Audit 1 (no wake on warnings), 3 (watch burn) | Medium | Policy limitations, disclosed; smallest correction above, not implemented. |
| Audit 2 (fight excludes creatures) | Low | Policy limitation by design, disclosed. |
| Audit 4 (witness knockout counter) | Low | **Fixed:** a terminal `knocked_out` now counts. The pinned success values are unchanged. |
