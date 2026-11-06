# Situation B post-tuned candidate: `b-post-a-transfer-v1`

Prepared 2026-11-06 by the Claude Code implementation agent at the owner's request. No paid call, no push, no merge. **Status: frozen by hash; conditionally approved by the owner (text unchanged); still `proposed` in code, so paid runs refuse it. The paid run is not authorized.**

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
