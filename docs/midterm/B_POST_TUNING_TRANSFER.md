# Situation B post-tuned candidate: `b-post-a-transfer-v1`

Prepared 2026-11-06 by the Claude Code implementation agent at the owner's request. No paid call, no push, no merge. **Status: v1 approved by the owner (hash `60a0a013…`) and run once as Pilot-32 on the return scenario: `knocked_out` at 47.5 game-s ([record](evaluation-abc/B-posttuned-pilot32.json)). r8 pre-declared that run as B/post-tuned/1; its results row is not yet filled (owner). v2 and v3 are proposed and locked. v4 is **approved by the owner** ("Unlock V4", hash `12874542…`) as the supplementary B trial (§12–§14).**

## What the owner asked for

1. Inspect the B pre-tuned run and the B baseline, preserving their evidence.
2. Take general-purpose heuristics from the successful Situation A heuristic baseline (spatial reasoning, systematic positioning, search, feedback-based recovery).
3. Add them as prompt-only guidance to the existing B model controller.
4. Keep the Griffin's rules, observations, the controller code, the model and the starting checkpoint unchanged.
5. Freeze the new prompt and prepare exactly one B post-tuned run.

## Disclosure: this is tuning on B, not an independent transfer test

The B pre-tuned run (Pilot-31) had already been run when this guidance was written, and the implementation agent read its full trace first (timeline below). The text's lines come from the A baseline's mechanisms. But the agent chose *which* mechanisms to include, and how to word two of them, after seeing how Pilot-31 failed. The B pre/post contrast is therefore **deliberate tuning on B**, with one post-tuned run, and must be reported that way. It is not evidence of transfer from A to B. A later C transfer would still be possible under the declaration ("guidance developed on A/B only"), but only if this text is frozen before any C model outcome.

## 1. Inspection (evidence preserved)

Nothing under `midterms/saadsatter/evidence/`, `docs/midterm/evidence/` or `docs/midterm/evaluation-abc/` was changed. Pilot-31's `trace.jsonl` still hashes to `5d9cfec6…9afb`, as its record says.

**Pilot-31, B pre-tuned** ([record](evaluation-abc/B-pretuned-pilot31.json)): `griffin-unprepared-v1`, start `1a270d7b…0051`, `knocked_out` at 50.1 game-s with the Griffin at 152/640. Read from the trace:

| Game time (approx.) | What happened |
| --- | --- |
| 0–5 s | Arrival dialogue; both walk north; Coco flies over the water to scout |
| 5–6 s | Coco stands in the drawn beam warning line and is hit (100 → 74) |
| 7 s | Sieg is hit by a beam while walking on the shore (100 → 74) |
| 12–19 s | Coco ends up overlapping the Griffin's body (distance 0) for several seconds while attacks did not lower its health, and takes two more hits (→ 34) |
| 24–25 s | Both near a warned beam endpoint; Sieg hit (→ 48) |
| 39–46 s | Coco is hit in a beam (→ 8); Sieg, adjacent to the Griffin, is hit (42 → 16) |
| 50 s | Sieg (16 HP) is hit during HEADBUTT CHARGE while standing on its charge mark; knockout |

Action mix: Sieg 81 moves, 28 defends, 15 attacks; Coco 68 moves, 29 attacks, 26 waits, 3 Black Holes, 2 Flights. 117 calls, 6 unusable replies, 1 invalid action, $0.265961.

General patterns (not Griffin facts): heroes reacted to warnings only after the damage arrived; a hero stood on top of a target body; attacks were repeated from positions that showed no health change; the plan text repeated the goal rather than recording tried positions.

**B baseline** `baseline-griffin-heuristic-v1` ([doc](SITUATION_B_HEURISTIC_BASELINE.md), [manifest](evidence/griffin-heuristic-v1/manifest.json)): 2/2 successes in 89.8 game-s. Note that it ran on r6's `griffin-unprepared-return-v1` (start `45b1a6aa…`), not on Pilot-31's scenario. Inspected only; not re-run. Its fight logic was **not** used as a source for this guidance.

## 2. Source of each line

Source: `packages/agent/src/policies/mazeHeuristic.ts` (`baseline-maze-heuristic-v2`, frozen at `1de3b61`, 2/2 successes on A). The guidance names no particular place, enemy, attack, item, ability, coordinate or sequence; it does use the generic words "enemies", "a ranged attack" and "a recharging ability". A smoke test checks a word list (no digits; no Griffin, nest, wig, beam, headbutt, charge, Mirror, Shears, fireball, sword, Black Hole, Flight, Ward, Guard, Slow Time, Super Speed, pillar, cow, wolf, hedge, gate or key). A word list cannot catch a mechanic described in generic words, so it is not a leakage proof (review finding 7).

**Corrected after review round 1 (findings 1 and 2).** The first version of this table marked only two lines as shaped by Pilot-31. The reviewer showed that several more wordings go beyond what the A baseline does. The last column now says so. The guidance text itself is unchanged (owner instruction).

| Heading | Guidance line (short form) | A baseline mechanism | Shaped by Pilot-31? |
| --- | --- | --- | --- |
| Spatial | Plan over the combined map; walls, water and bodies block; body needs clearance | `open()` treats `#`, `~`, gaps and creature extents (+0.4 margin) as blocked; BFS over remembered cells | **Partly**: "enemies" added; A blocks creature extents only |
| Spatial | Seen-earlier things may have moved | Per-area memory; the cow is re-located from the current screen every decision | No |
| Positioning | List candidate tiles around the target: open, not touching a body, not at range edge; prefer clear line, partner out of the line, short reach | The firing-position search: every open tile within 7 of the cow, skips the cow's extent, uses the preview, penalizes `obstructing_heroes` and distance, excludes `near_pull_boundary` | **Partly**: A's search is for a pull only; "a ranged attack" listed first and "a clear straight line" are extensions (A does not check line of sight) |
| Positioning | Record tried position-and-aim combinations; do not repeat unless something changed | `attempts` set of position/direction signatures | No |
| Positioning | Do not stand on top of a target; step out first | Candidate tiles inside the cow's extent are skipped | **Yes**: added as its own line because of Coco overlapping the Griffin |
| Positioning | After acting, move off a path or area an effect is about to cross, before it lands | After a pull, `pending.retreat`: move sideways out of the cow's swept body for a bounded 180 ticks | **Yes, B-specific in effect**: A only clears its own pull's path. In B the only effects the screen warns about are the Griffin's attacks, so this works as a dodge rule (the old draft's "leave the line" tactic in generic words). The sentence "Do not wait for damage to show that a place was unsafe" has no A source; it answers Pilot-31's failure |
| Search | Explore to the nearest unvisited `?` edge; prefer new tiles; go around when blocked | `explore()`: frontier score, visit-count penalty, blocked-edge memory, backtracking | No |
| Search | Note searched areas in the plan | `visits` map | No |
| Recovery | Treat each action as a test with an expected visible result, check after a bounded time | `pending` deadline, then `lastEffect` compares observed displacement | **Partly**: A checks displacement only; "a target's shown health falls" (listed first) is added |
| Recovery | Two tries with no result: change position, aim, timing or hero; then change approach | New configuration after "no observed cow displacement"; periodic switch away from cow work (`cowSearchDecisions % 100 < 65`) | **Partly**: A never repeats a configuration, and has no timing or which-hero choice; "two tries", "timing" and "which hero" are added |
| Recovery | A recharging ability is not a reason to stand still | "Cooldown does not force indefinite waiting: explore/backtrack" | From A; **chosen with Pilot-31 in view** (Coco waited 26 times) |
| Recovery | When the world changes, forget earlier blocked results near it | `blocked.clear()` when a gate is seen open | No |

**Considered and left out:** a "health is a budget; give a hurt hero the safer role" line. It would address Pilot-31's knockout directly, but the A baseline has no such mechanism, so including it would be B-specific tuning beyond what was asked. The owner may add it as a separate, disclosed revision.

## 3. What is unchanged

| Item | Status |
| --- | --- |
| Planner and controller code | Byte-identical to Pilot-31's commit `6df4bc0`: 14 files (`centralized.ts`, `navigator.ts`, `navigate.ts`, `combat.ts`, `llm.ts`, `pullPreview.ts`, `centralProgress.ts`, `openai.ts`, `policy.ts`, `providers.ts`, `budget.ts`, `heroMemory.ts`, `actions.ts`, `runner.ts`) pinned by SHA-256 in the test. `CENTRAL_ID f0592888` is the same, but it hashes tuning constants only, so it is not the evidence for this row (review finding 3). Controller limits unchanged: no wake-up on beam warnings; `fight` targets enemy entries only |
| Model | Same as Pilot-31: OpenAI `gpt-6-luna`, effort medium, batch 4 |
| Starting checkpoint | Same as Pilot-31: `griffin-unprepared-v1`, seed 0, start hash `1a270d7b…0051` (confirmed by the mock smoke below) |
| Base prompt | Pilot-31's prompt (`cbabb78b…bb6a`), byte for byte, plus one appended guidance block. Pinned by test |
| Briefing / tutorial | Same as Pilot-31 (`briefing-5fa93722`, `tutorial-2ec2f251`) |
| Game rules, Griffin balance, manual | Unchanged; no file under `apps/`, `packages/shared/` or `manual/` was edited |
| Limits | 18,000 ticks, 1,600 decisions / 400 calls / 4M tokens per hero, $0.75 cap, 3,600 s wall |
| Old draft `griffin-b-post-v1` | Unchanged and still locked (`proposed`). Not used |

| Observations | Restored to Pilot-31's exactly (below) |

**Observation parity (owner decision 2026-11-06, option b).** Commit `4c9cf9f` (after Pilot-31's `6df4bc0`) added a `nest` object to every Griffin Enclosure observation. The owner approved the smallest change to drop it for `griffin-unprepared-v1` only. `perceive()` takes a new optional `omitNest` flag (`perception.ts`), and the environment sets it only when its preset is `griffin-unprepared-v1` (`environment.ts`). Every other scenario, including `griffin-unprepared-return-v1` and S4/F, still lists the nest.

Regression test `packages/agent/test/griffinObservationParity.test.ts`:
- **Replay of Pilot-31.** It replays Pilot-31's recorded actions through the ordinary `step()`, in the trace's own record order. All **293 of 293** recorded observations are byte-identical. All **284** step-result hashes match, and none of the observations lists a nest. With the default contract, the nest would have been listed in 56 of those 293 observations. Before the change, a prototype of the same replay found exactly 56 differences, each only that entry.
- **Other scenarios unchanged.** With a labelled unit fixture (Coco placed beside the nest by writing `World`, test only), `griffin-unprepared-v1` leaves the nest out and `griffin-unprepared-return-v1` lists it.

## 4. Frozen values

| Value | |
| --- | --- |
| Guidance id | `b-post-a-transfer-v1`, situations `["griffin-unprepared-v1"]` only |
| Guidance text SHA-256 | `60a0a01357e68e2f44f0ecd9d0d0ebb41bfaab04c5c3ec78cae62c760c265263` (2,537 characters) |
| Post-tuned planner prompt SHA-256 | `54605c1b010826448627189d92fc8dfedc9f853b14d45fe5ad21260ce21e5627` (both heroes) |
| Policy id | `centralized-f0592888(openai:gpt-6-luna@medium)·batch4·tutorial-2ec2f251·briefing-5fa93722·guidance-60a0a013` |
| Status | `proposed`. Paid runs refuse it until the owner approves: set `status: "approved"` and `approvedSha256` to the hash above (a reviewed code change) |

Tests: `packages/agent/test/bPostTransferGuidance.test.ts` (5 tests). It pins both hashes and the base prompt. It checks that pre and post planners have the same schema, batch, briefing, tutorial and task, and that post policy names are the pre names plus `·guidance-60a0a013`. It also pins the 14 code files above to their `6df4bc0` hashes, the old draft's hash `1c062840…`, the scenario restriction, the paid-run lock and the word list.

**Side effect (review finding 8).** The guidance adds about 2,600 characters to every planner call's input, so the run uses more input tokens per call than Pilot-31. It reaches the token and $0.75 limits slightly sooner, and latency may differ. Pilot-31 used $0.27 of its $0.75.

## 5. The one prepared run

After approval, from the evaluation checkout:

```sh
npm run eval:live -- --scenario griffin-unprepared-v1 --seed 0 --player model-centralized --guidance b-post-a-transfer-v1 --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid
```

This is Pilot-31's command plus `--guidance`. Run it once. Whatever the outcome, it is B/post-tuned/1; it is not replaced or repeated.

Free mock smoke of the same path (`--gateway mock --no-viewer`, scratch output, scratch ledger): `tick_limit` at 300 game-s, 154 calls, $0, start `1a270d7b…0051`; summary records guidance `b-post-a-transfer-v1` (`proposed`, `60a0a013…`) and prompt hash `54605c1b…` for both heroes. The canonical ledger was not touched (last entry still `pilot-31`).

Budget: pilot stage $4.2354 committed of $8.00 ($3.7646 left); the run reserves $0.75.

## Checks run (this session)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 1,315 of 1,316 pass. The one failure is `s2Shutdown.test.ts` "gives up on a video that never finalizes", the same known failure recorded before Pilot-31 (it also fails on `3ba50e6`); unrelated, not fixed |
| `npm run build` | pass (existing large-chunk warning) |
| New + Situation B tests | 29 of 29 pass |
| Secret scan, changed files | 5 files, 0 findings |
| Mock smoke | As in §5 |

## 6. Owner decisions received (2026-11-06, second message)

| Item | Decision |
| --- | --- |
| Prompt | Conditional approval of `b-post-a-transfer-v1` (`60a0a013…`); text not to be modified; independent `rules-reviewer` pass requested on `6276656` |
| Observations | Approved: smallest change to suppress the `nest` entry for `griffin-unprepared-v1` only, with a parity regression test. Done (§3) |
| Scenario | `griffin-unprepared-v1`, seed 0, approved as the official B pre/post comparison; declaration to be reconciled with Pilot-31's scenario, keeping the historical record. Done as declaration r7 ([DECLARED_EVALUATION_SUITE.md](DECLARED_EVALUATION_SUITE.md)) |
| Paid run | **Not authorized.** Review, free verification and preflight first; $0.75 cap, ledger safeguards and recording kept |

The guidance status in code stays `proposed` with no `approvedSha256`, so paid runs still refuse it. Setting `approved` is the last step, after the owner's final authorization.

## 7. Review round 1 (rules-reviewer on `6276656`)

Report, verbatim: [agent-evidence/reviews/2026-11-06-b-post-transfer-rules-review.md](agent-evidence/reviews/2026-11-06-b-post-transfer-rules-review.md). No hidden-state leak was found (finding 9). The guidance path changes only the prompt text and the recorded policy metadata (finding 8).

| Finding | Severity | Response |
| --- | --- | --- |
| 1 "Get off a warned area before it lands" is a B-specific dodge rule, not an A mechanism | Medium | **Owner decision.** The text was not changed (owner instruction). The provenance table now labels it B-specific in effect, and gives the "do not wait for damage" sentence no A source. The owner can keep it and report it as B-specific tuning, or ask for a new revision limited to the hero's own effect (a new id and hash) |
| 2 More wordings are B-shaped than the table said | Medium | **Doc corrected:** five more rows are marked Partly or "chosen with Pilot-31 in view". Text unchanged |
| 3 `CENTRAL_ID` does not prove the controller is unchanged | Medium | **Fixed:** verified that the planner and controller files are byte-identical to `6df4bc0`, now pinned by file hash in the test. Doc reworded |
| 4 The `nest` observation difference means the contrast is not prompt-only | Medium | **Fixed** by the approved suppression; parity is now tested (293/293 observations, 284/284 step hashes) |
| 5 B definition's `postTuned` text and `situation-b.ts` name the old draft | Low | `situation-b.ts` now validates and prints `b-post-a-transfer-v1`. The definition text was **not** changed, because that would change the pinned definition hash `bbbbc435…` that Pilot-31 recorded. Disclosed here and in the run record; the owner may ask for a versioned definition instead |
| 6 Doc and comment claim the text has no "ability"/"enemy"/"attack" | Low | **Fixed:** doc and code comment corrected. The text and the test's word list are unchanged |
| 7 Word-list test is weak | Low | Accepted; labelled a smoke check in the test and the doc |
| 8 Longer prompt uses tokens and spend sooner | Info | Recorded in §4 |
| 9, 10 | Info | No change |
| Missing coverage | | Added: pre/post planner field and policy-name equality, the code-file pins, the old-draft hash. Not added: an automated `live.ts` test that a paid `--guidance` run is refused before credentials are read. The free preflight below checks this by hand |

## 8. Approval and the return scenario (owner decisions, 2026-11-06, third round)

| Item | Decision |
| --- | --- |
| Guidance | Approved, text unchanged. In code: `status: "approved"`, `approvedSha256: 60a0a013…5263`; allowed on `griffin-unprepared-v1` and `griffin-unprepared-return-v1` |
| Scenario | The post-tuned run uses `griffin-unprepared-return-v1` and counts as **B/post-tuned/1** (declaration r8; r7 superseded, archived) |

Code changes for this (no gameplay change): `model-centralized` is allowed on `griffin-unprepared-return-v1` (`OBS_ONLY_SITUATIONS`, `harness.ts`), and that scenario gets the same 3,600 s wall-clock ceiling as v1 (`ABC_WALL_CLOCK_CEILING_S`).

**This is no longer the comparison set out in §1–§5.** The return scenario differs from Pilot-31's in:
- start (tick 540, `45b1a6aa…`);
- success (wig + goddess offering + `chapter0.complete`);
- prompt framing: its own task line, with no tutorial and no briefing. Its generic prompt is `7fbaaec7…`, and with the guidance it is **`17b89312d88c9da0f81bdea5344c58f149a046b9a86873d166821a74f4be96a6`**;
- observations: the straw-nest entry is listed. The parity fix applies to v1 only.

So B pre/post is not prompt-only, and the §3 "unchanged" table holds for v1 only. Policy id on this scenario: `centralized-f0592888(openai:gpt-6-luna@medium)·batch4·task-cdbee612·guidance-60a0a013`. This scenario's run summary has no `evaluation` label (v1 records label `B`); the declaration and results files record the cell instead.

Free headless mock check of the launch path (`--gateway mock --no-viewer`, scratch output and ledger): start `45b1a6aa…`, guidance recorded as `approved`, prompt `17b89312…` for both heroes, cap $0.75, wall limit 3,600 s. The random mock was knocked out at 131.6 game-s, $0. The recorded (viewer + video) preflight was stopped by the owner before it finished, so there is no result for it.

Run command (from the evaluation checkout, on a clean committed tree):

```sh
npm run eval:live -- --scenario griffin-unprepared-return-v1 --seed 0 --player model-centralized --guidance b-post-a-transfer-v1 --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid
```

### Final checks (after approval and r8, this session)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 1,319 of 1,320 pass. The one failure is the known `s2Shutdown.test.ts` recorder test (also failing on `3ba50e6`); unrelated, not fixed |
| `npm run build` | pass (existing large-chunk warning) |
| Griffin/B tests (guidance, parity, Situation B, heuristic, live Griffin, prologue) | 75 of 75 pass |
| Secret scan, `docs/agent-sessions` + `docs/midterm` | 263 files; 1 finding, the known fake canary key in `skill-runs/2026-10-27-recording.md` (unchanged, excluded as in earlier records); 0 elsewhere |

## 9. Owner-authored candidate `b-post-combat-v2` (2026-11-06)

The owner pasted "Combat Heuristics — Prompt-Only Tuning v2". It is stored **byte for byte** as guidance `b-post-combat-v2` in `situationGuidance.ts`; the agent did not edit it. Status `proposed`: paid runs refuse it until the owner approves its hash. v1 (`b-post-a-transfer-v1`) is unchanged and still approved; declaration r8 still names v1 for B post-tuned.

| Value | |
| --- | --- |
| Text SHA-256 | `38adcbce91a2fb7df74f5fab2f780c28cdcf09ad266660ca911c8ed5b3ab80db` (3,594 characters) |
| Prompt on `griffin-unprepared-return-v1` | `f8008bf17a00f1eda196ac782006245d272b8336f6d544d2f4f462bf007e2216` |
| Prompt on `griffin-unprepared-v1` | `af944697b98e159cc8d064e88eb6b2b67064a4b0e2c791440bcaef8997fb4262` |
| Tests | `packages/agent/test/bPostCombatV2Guidance.test.ts` (hashes, appended-block check, paid lock, v1 unchanged) |

Disclosure: written by the owner after Pilot-31 was known. Several lines answer its failures directly (leave a warned danger area, do not occupy the target's position, protect a low-health hero, shorter commitments), so a run with it is tuning on B. It is not derived from the A baseline.

## 10. Proposed combined candidate `b-post-combined-v3` (2026-11-06)

**Status: proposed, locked for paid runs, not approved.** r8 pre-declared the v1 run (Pilot-32) as B/post-tuned/1, and that run has happened. A v3 run cannot replace it without choosing a result by outcome. Before any v3 run the owner must record what a v3 run counts as: a supplementary trial, a new declared cell (in a new revision), or not counted (review round 2, finding 1).

Owner direction: consolidate v1's spatial/search heuristics and v2's combat heuristics into one hierarchy (survive → find position → attack → verify → repeat/adjust → avoid idle time → coordinate/health → verify success). Address one centralized planner coordinating both heroes, with no messaging and nothing the base prompt already says. Drafted by the implementation agent to that outline. v1 (`60a0a013…`, approved) and v2 (`38adcbce…`, proposed) are unchanged.

**Integrity.** This is owner-directed, post-hoc Situation B tuning, written after Pilot-31 (pre-tuned) and Pilot-32 (v1 post-tuned) were known. It is not an independent transfer experiment. Pilot-32 ran on `griffin-unprepared-return-v1`, a different scenario from Pilot-31's `griffin-unprepared-v1` (start, success predicate, prompt framing and observations all differ; see `evaluation-abc/B-posttuned-pilot32.json`). Both runs' evidence is preserved unchanged. No controller, navigation, action, observation, rule or scenario code changes with v3.

### Text (exact)

```text
Planner guidance for both heroes (general heuristics; not facts about any particular place, enemy or solution):
You plan for Sieg and Coco together. At each reply, go through these steps in order for each hero, and give each hero an order for the first step that applies to it.

1. Survive visible threats. If a hero's screen shows a warning of an effect about to reach that hero's position (a marked line, area or charging attack), move that hero off it or have it defend before it lands. Do not keep a hero in a warned area to finish an attack. While threats are close, prefer short actions over long walks or long waits.

2. Find a reachable, effective attack position. Plan over the combined map: walls, water and the listed extents of enemies and creatures block movement, and a hero's body needs open ground around it. Consider a few open tiles from which the hero's attack can plausibly reach the target in a straight line, not at the edge of its range, not overlapping any body, and with the other hero out of that line. Prefer one that is safe and short to reach. Do not stay on top of the target unless attacks from there visibly work.

3. Attack when there is a plausible chance to connect: the target is visible, in reach, in the right direction and not blocked. Otherwise move toward the chosen position instead of attacking.

4. Verify damage from what is shown, such as the target's health or label, allowing a short time for a projectile or effect to arrive before judging.

5. Repeat what works and adjust what does not. Keep in known_obstacles which position, direction and timing combinations showed damage and which showed none, and return to a position that worked when it is safe. When attacks keep showing no effect, name one likely cause (distance, direction, obstruction, timing or the target's state), change only that, and check again. If several changes fail, try a different attack or another part of the objective.

6. Avoid unproductive time. Wait only for a specific expected change; defend only against a concrete, imminent threat. A hero that cannot attack usefully now (for example while its ability recharges) should reposition, get clear or scout. Do not move without a positioning purpose. When what the objective needs next is on neither screen, explore systematically: head for the nearest unvisited edge of the map ("?" next to seen open ground), note searched areas in the plan, and back off and go around when a way is blocked. When the world changes (a way opens, a body moves), drop earlier blocked results near it and test again.

7. Coordinate both heroes and protect their health. Give the two heroes complementary orders, and do not leave both exposed to the same visible threat. When a hero's health is low, give it a safer role and let the healthier hero take the riskier task; keep both heroes alive when the task requires it.

8. Verify every required success condition from observations before treating the objective as done. Surviving, attacking or reaching one milestone is not the whole objective; follow the task to its end.
```

| Value | |
| --- | --- |
| Text SHA-256 | `c94a7bb5281c0db5630dc5af4320b98feb6291950bd965bffbdd1c2ec3886ee3` (3,082 characters) |
| Prompt on `griffin-unprepared-return-v1` | `42cfa29a803bbf056bf9a39f52b9d81cff27c44d82be2e138a297c2283351487` |
| Prompt on `griffin-unprepared-v1` | `9927327ee87ca46784ad41fa05f08b8e4afb7c5eb955b815bdcd3da0b821a2d4` |
| Policy id on the return scenario | `centralized-f0592888(openai:gpt-6-luna@medium)·batch4·task-cdbee612·guidance-c94a7bb5` |
| Tests | `packages/agent/test/bPostCombinedV3Guidance.test.ts`: hashes; appended block only (same base prompt, schema, batch; name + `·guidance-c94a7bb5`); paid lock; v1/v2 unchanged; wording smoke checks |

### Coverage: v1, v2, v3

"—" means absent. "Base" means the base planner prompt already says it, so v3 leaves it out or only points at it.

| Instruction | v1 (A transfer) | v2 (owner combat) | v3 |
| --- | --- | --- | --- |
| Leave a warned danger area / defend before it lands | Yes (generic "effect about to cross") | Yes (priority 1) | Step 1. **New in v3:** the examples "a marked line, area or charging attack" ("charging" matches the Griffin's CHARGE labels; finding 5) |
| Shorter commitments near danger | — | Yes | Step 1 |
| Blocking terrain and bodies; body clearance (connectivity) | Yes | — | Step 2 |
| Seen-earlier things may have moved | Yes | — | Dropped: base prompt says `seen_earlier` "may have moved or gone" |
| Systematic candidate attack positions (open, in reach, not at range edge, clear line, partner out of line, short) | Yes | Partly (check reach/direction/obstruction) | Step 2 |
| Do not stand on the target | Yes (absolute) | Yes (when ineffective) | Step 2 (v2's conditional form) |
| Attack only with a plausible chance to connect | — | Yes | Step 3 |
| Verify damage from shown health; allow time to land | Partly | Yes | Step 4 (base already says accepted ≠ effect, so not restated). **New in v3:** "or label" |
| Memory of tried/working positions and aims (`known_obstacles`) | Yes | Yes ("remember positions") | Step 5 |
| Change one factor at a time; name a cause | Partly ("change one thing") | Yes | Step 5 |
| Return to an effective position | — | Yes | Step 5 |
| Switch approach after several failures | Yes | — | Step 5 |
| Waiting/defending need a concrete reason | — | Yes | Step 6 |
| Recharging ability is not a reason to stand still | Yes | Partly | Step 6 |
| No aimless movement | — | Yes | Step 6 |
| Frontier search, notes on searched areas, backtracking | Yes | — | Step 6 |
| Environment changes reset blocked results | Yes | — | Step 6 (short; the base prompt covers retrying after changes) |
| Complementary orders; not both exposed | — | Yes | Step 7 (as one planner) |
| Low-health hero takes the safer role | — (left out of v1) | Partly ("reduce unnecessary exposure… consider both heroes' survival") | Step 7. **New in v3:** "let the healthier hero take the riskier task" |
| Verify every success condition | — | Yes | Step 8 |
| "You are controlling a character" / teammate framing | — | Yes (wrong for this player) | Removed: one planner for both heroes |
| Coordinate through messages | — | Yes (wrong: no messages in this mode) | Removed |
| "Do not produce lengthy explanations" | — | Yes | Removed: base prompt sets the JSON reply and plan length |
| "Use only your current observations… do not assume hidden enemy mechanics" | — | Yes | Removed: the base prompt already limits the planner to what the screens show |
| "Decision discipline" (threat, intended effect, confirming evidence, fallback) | — | Yes | Removed as a block; its parts are steps 1, 4 and 5 |
| Overlap with the locked source-derived draft `griffin-b-post-v1` and the witness | — | — | **Yes, in generic words** (review round 2, finding 4): leave or defend a warned line (draft l.41), straight-line attack with the other hero out of the line (draft l.43), damage from the label (draft l.40), healthier hero takes the risk / not both exposed (draft l.42, l.44). No coordinates, aiming rule, shore position, nest step or flight-vs-sword fact. The header line's "not facts about any particular … enemy or solution" overstates its neutrality |

### Proposed run command (not authorized; refused while `proposed`)

```sh
npm run eval:live -- --scenario griffin-unprepared-return-v1 --seed 0 --player model-centralized --guidance b-post-combined-v3 --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid
```

Free mock validation of this path (`--gateway mock --no-viewer`, scratch output and ledger): start `45b1a6aa…`, guidance `b-post-combined-v3` (`proposed`, `c94a7bb5…`), prompt `42cfa29a…` for both heroes, cap $0.75, wall 3,600 s. The random mock ended with `error` at 103.5 game-s (the planner's stall guard on random replies, as in earlier mock rehearsals), $0.

## 11. Review round 2 (rules-reviewer on `94673c0`)

Report, verbatim: [agent-evidence/reviews/2026-11-06-b-post-combined-v3-rules-review.md](agent-evidence/reviews/2026-11-06-b-post-combined-v3-rules-review.md). **No hidden-state leak found; nothing outside the prompt changes; no unsupported actions or messaging.** The v3 text was **not** changed in response, because the owner asked to stop for approval; findings 2, 3, 8, 9 and 10 need a text revision (a new id and hash) if accepted.

| Finding | Severity | Response |
| --- | --- | --- |
| 1 Which cell a v3 run would count in | High | **Owner decision.** §10 status reworded; r8 and the results files not changed. Pilot-32's row in `declared-results.json` and `trialAllocation` are still not updated (owner) |
| 2 "Give each hero an order" contradicts "no order keeps its intention"; may trigger repeated-assignment refusals and a stall `error` | Medium | **Text change proposed** (owner): e.g. "give an order only to a hero whose situation calls for a change" |
| 3 Health (step 7) comes after attacking (step 3) under "first step that applies" | Medium | **Text change proposed** (owner): make health a constraint on every step, or move it next to step 1 |
| 4 v3 restates the old draft / witness structure in generic words | Medium | **Disclosed:** new coverage row in §10. Not a leak |
| 5 "charging" dropped from the word list; v3 says "charging attack" | Medium | **Disclosed:** test now asserts the phrase is present as an open exemption. Keep or remove is the owner's call (text change) |
| 6 Coverage table overstated v2 and missed new v3 wording | Medium | **Fixed:** rows marked "New in v3" |
| 7 Non-planner code not pinned to Pilot-32 | Medium | **Fixed:** `perception.ts`, `environment.ts`, `evaluator.ts`, `suite.ts`, `harness.ts` pinned to their `2791bce` hashes (byte-identical, checked), plus the return scenario's generic prompt `7fbaaec7…`. Root `package.json`, lockfile, `tsconfig`, `apps/`, `packages/shared/` and `manual/` have no changes since `2791bce` (checked with `git diff --stat`) |
| 8 Step 2: "not overlapping any body" vs "unless attacks from there visibly work" | Low | Text change proposed (owner): keep one form |
| 9 Some base-prompt repetition | Low | Text change proposed (owner), or accept |
| 10 `known_obstacles` used for working combinations; 10 × 160-char cap | Low | Disclosed; text change optional |
| 11 Defend-only orders count as passive in the watchdog | Low | Disclosed here; shared with v1/v2; no code change |
| 12 Docs said v1 post-tuned "not yet run" | Low | Fixed in this document's status line. The declaration still says so, pending finding 1 |
| 13 Missing "removed" rows | Low | Fixed |
| 14 Return scenario has no `B` label in summaries; definition still names the old draft | Info | As §8: the declaration and results files attach the cell |
| 15 No unsupported actions | Info | — |
| 16 Only the prompt changes; ~0.5k more characters than v1 | Info | Noted: more input tokens per call than v1, so the token and $0.75 limits come slightly sooner |
| Missing coverage | | Added: scenario restriction, non-B and `final` refusals, old-draft hash, 2791bce pins. Still not automated: a `live.ts` test that a paid launch with a locked guidance is refused before credentials (checked by hand earlier this session) |

**Prompt-only contrast.** A v3 run at the current commit would differ from Pilot-32 only in the guidance block (scenario, start, observations and code pinned identical). That is the only prompt-only pair available in B. Pilot-31 vs either run is not prompt-only.

## 12. Supplementary candidate `b-post-combined-v4` (2026-11-06)

**Status: proposed, locked for paid runs, not approved.** Owner-written, post-hoc Situation B tuning: the owner directed every change below after Pilot-31 and Pilot-32 were known, and the implementation agent drafted the wording. **Classification (owner decision):** Pilot-32 stays the official B/post-tuned/1 result of declaration r8. A v4 run would be a **supplementary B tuning trial**, not a replacement, and is reported beside Pilot-32, never instead of it. Declaration r8 and its results files are unchanged. v1, v2, v3 and the old draft are unchanged byte for byte (pinned by test).

### Owner's changes from v3

| # | Decision | Change |
| --- | --- | --- |
| 1 | No mandatory order every reply | The opening now says to check both heroes and "give a new order only to a hero whose current plan needs to change; a hero whose plan still fits its situation carries on without one" (review round 2, finding 2) |
| 2 | Health with survival | v3's step 7 health sentence moved into step 1 ("Protect both heroes first. Before any offensive order, check each hero's health and exposure…"), with "keep it doing useful work rather than defending without a threat" so that it doesn't encourage endless defending (finding 3). Step 7 keeps coordination only |
| 3 | Header | "not facts about any particular place, enemy or solution" replaced by "general-purpose combat and planning guidance, based on what the heroes' screens show" (finding 4) |
| 4 | Wording | "charging attack" replaced by "visible attack warning … (such as a marked line or area)" (finding 5). "recharges" in step 6 (ability readiness, the base prompt's own word) is unchanged |
| 5 | Everything else | Steps 2–6 and 8 are v3's text, word for word |

Not changed (not in the owner's list): step 2's two forms of the overlap rule (finding 8), base-prompt repetition (finding 9), `known_obstacles` use (finding 10). The overlap with the locked draft's structure (finding 4) still applies to v4 in generic words: dodge or defend a warned line/area, healthier hero takes the risk.

### Text (exact)

```text
Planner guidance for both heroes (general-purpose combat and planning guidance, based on what the heroes' screens show):
At each reply, check both heroes against these steps in order. Give a new order only to a hero whose current plan needs to change; a hero whose plan still fits its situation carries on without one.

1. Protect both heroes first. Before any offensive order, check each hero's health and exposure. If a hero's screen shows a visible attack warning for that hero's position (such as a marked line or area), move that hero off it or have it defend before it lands. Do not keep a hero in a warned area to finish an attack. When a hero's health is low, give it a safer role and let the healthier hero take the riskier task, but keep it doing useful work rather than defending without a threat. While threats are close, prefer short actions over long walks or long waits.

2. Find a reachable, effective attack position. Plan over the combined map: walls, water and the listed extents of enemies and creatures block movement, and a hero's body needs open ground around it. Consider a few open tiles from which the hero's attack can plausibly reach the target in a straight line, not at the edge of its range, not overlapping any body, and with the other hero out of that line. Prefer one that is safe and short to reach. Do not stay on top of the target unless attacks from there visibly work.

3. Attack when there is a plausible chance to connect: the target is visible, in reach, in the right direction and not blocked. Otherwise move toward the chosen position instead of attacking.

4. Verify damage from what is shown, such as the target's health or label, allowing a short time for a projectile or effect to arrive before judging.

5. Repeat what works and adjust what does not. Keep in known_obstacles which position, direction and timing combinations showed damage and which showed none, and return to a position that worked when it is safe. When attacks keep showing no effect, name one likely cause (distance, direction, obstruction, timing or the target's state), change only that, and check again. If several changes fail, try a different attack or another part of the objective.

6. Avoid unproductive time. Wait only for a specific expected change; defend only against a concrete, imminent threat. A hero that cannot attack usefully now (for example while its ability recharges) should reposition, get clear or scout. Do not move without a positioning purpose. When what the objective needs next is on neither screen, explore systematically: head for the nearest unvisited edge of the map ("?" next to seen open ground), note searched areas in the plan, and back off and go around when a way is blocked. When the world changes (a way opens, a body moves), drop earlier blocked results near it and test again.

7. Coordinate both heroes. Give the two heroes complementary orders, and do not leave both exposed to the same visible threat; keep both heroes alive when the task requires it.

8. Verify every required success condition from observations before treating the objective as done. Surviving, attacking or reaching one milestone is not the whole objective; follow the task to its end.
```

| Value | |
| --- | --- |
| Text SHA-256 | `1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34` (3,219 characters) |
| Prompt on `griffin-unprepared-return-v1` | `7ff08ba84c4ab14460d0f6707febdc19b8e417ced89d3127636ce7ed9f352144` |
| Prompt on `griffin-unprepared-v1` | `473bf220c464d4fca4c7d4267c23011eb2fbcb1a5a3c2001b238fc4a6da07973` |
| Policy id on the return scenario | `centralized-f0592888(openai:gpt-6-luna@medium)·batch4·task-cdbee612·guidance-12874542` |
| Tests | `packages/agent/test/bPostCombinedV4Guidance.test.ts` (5) |

### Differs from Pilot-32 only in guidance

- **Prompt:** the v4 prompt is the return scenario's base prompt `7fbaaec7…` plus the v4 block. Pilot-32's prompt `17b89312…` was the same base plus v1's block. Both are tested.
- **Code:** the reply schema and policy name are equal apart from the `·guidance-` suffix. `perception.ts`, `environment.ts`, `evaluator.ts`, `suite.ts`, `harness.ts`, `centralized.ts`, `navigator.ts` and `actions.ts` are pinned to their `2791bce` (Pilot-32) hashes. Nothing outside `packages/agent` has changed since `2791bce`.
- **Free mock episode** (`--gateway mock --no-viewer`, scratch output and ledger): scenario, seed, start tick and hash `45b1a6aa…`, prefix, episode limits, model limits, $0.75 cap and 3,600 s wall limit are all **identical** to Pilot-32's summary. Only the guidance, prompt and policy name differ. The random mock ran to `tick_limit` at 300 game-s, $0.

### Proposed command (refused while v4 is `proposed`)

```sh
npm run eval:live -- --scenario griffin-unprepared-return-v1 --seed 0 --player model-centralized --guidance b-post-combined-v4 --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid
```

## 13. Review round 3 (rules-reviewer on `af81ccc`)

Report, verbatim: [agent-evidence/reviews/2026-11-06-b-post-combined-v4-rules-review.md](agent-evidence/reviews/2026-11-06-b-post-combined-v4-rules-review.md). **No hidden-state leak, nothing outside the prompt changes, no unsupported actions or messaging. v1, v2, v3 and the draft are byte-identical.** Both v3 problems are resolved, but the reviewer found a new interaction (finding 1). The v4 text was not changed: the owner asked to stop for authorization.

| Finding | Severity | Response |
| --- | --- | --- |
| 1 "Carries on without one" vs the watchdog: an overdue hero (about 30 game-s without verified progress) given no order makes the **whole** reply refused, and three refusals end the run as `error` | Medium | **Verified in code** (`centralized.ts:570–585`, `:499`). **Owner decision:** a text change (new id) adding an exception such as "unless its progress shows it must be reconsidered", or accept and disclose. Disclosed here |
| 2 "current plan" vs the base prompt's per-hero "intention" | Medium | Owner decision (text change), e.g. "a hero whose intention is still running and still fits" |
| 3 The supplementary rule and Pilot-32's outcome are not in the declaration or results files; the B/post-tuned/1 row still reads `not-run` | Medium | **Owner decision**, as the reviewer says. Not changed by the agent (owner: do not modify r8's official result). The row's pinned `policyId`, `promptHash` and `guidanceHash` (v1) would not match a v4 run |
| 4 Overlap with the draft's dodge and healthier-hero structure remains | Low | Disclosed in §12's "Not changed" line |
| 5 Small overlaps (steps 1/6/7; "short actions" vs `go_to`) | Low | Owner's call |
| 6 Test gaps | Low | **Fixed:** the v1-scenario append check, `maxBatch`, the coordinate smoke check, and pins for `llm.ts`, `centralProgress.ts`, `navigate.ts`, `combat.ts`, `openai.ts`, `budget.ts`, `heroMemory.ts`, `runner.ts` and `scripts/midterm/live.ts` at their `2791bce` hashes (all byte-identical, checked). Not added: an automated paid-refusal `live.ts` test, or a unit test of the finding-1 refusal |
| 7 Stale status line | Low | Fixed |
| 8 Unlisted differences and n=1 | Info | Noted: `gitHash`, ledger entry and guidance metadata differ. v4's block is about 3,219 characters against v1's 2,537, so more input tokens per call and the token/$0.75 limits come slightly sooner. The mock used `--no-viewer`; the paid command keeps the viewer and recording on, as Pilot-32 did. One run per prompt with a non-deterministic model is not a controlled effect estimate |
| 9 Locked | Info | — |

## 14. v4 unlocked (owner, 2026-11-06)

The owner approved `b-post-combined-v4` for paid runs ("Unlock V4"). The text is unchanged (`1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34`); in code it now has `status: "approved"` and that `approvedSha256`. Approval covers both B scenarios, as listed. It is approved **as written**: the review-round-3 findings 1 and 2 (an overdue hero given no order makes the whole reply refused; "plan" vs "intention") are accepted risks, not fixed. A run that ends in `error` from three refused replies is reported as that, not retried.

Classification is unchanged: Pilot-32 is B/post-tuned/1 (r8). A v4 run is a supplementary B tuning trial, reported beside it. Declaration r8 and its results files were not modified. No paid run has been made by the agent.


## Pilot-33 preservation and owner result designation

Pilot-33 (`1f0ca45`, approved b-post-combined-v4) succeeded on `griffin-unprepared-return-v1`: 51.0 game-s, 2184.4 wall-s, 251 calls, 1 invalid action, $0.554417. The owner designates it B/post-tuned/1 after outcome; declaration r9-pilot33 records this amendment. R8's earlier v1 guidance and failed Pilot-32 ($0.206005, knocked_out) remain preserved, not replaced in their historical artifacts. Two post-tuning attempts span different guidance versions (one failure/one success), not repeated identical-policy trials. Six primary cells are observed; only three C cells remain unrun. See `midterms/saadsatter/EVALUATION.md` and `evaluation-abc/B-posttuned-pilot33.json`. No new paid call or policy/scenario change during preservation.
