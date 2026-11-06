# Situation B post-tuned candidate: `b-post-a-transfer-v1`

Prepared 2026-11-06 by the Claude Code implementation agent at the owner's request. No paid call, no push, no merge. **Status: proposed and frozen by hash; not approved. The paid run is not authorized by this document.**

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

Source: `packages/agent/src/policies/mazeHeuristic.ts` (`baseline-maze-heuristic-v2`, frozen at `1de3b61`, 2/2 successes on A). The guidance names no place, enemy, attack, item, ability, coordinate or sequence. A test checks this with a word list (no digits; no Griffin, nest, wig, beam, charge, Mirror, Shears, ability, pillar, cow, wolf, hedge, gate or key).

| Heading | Guidance line (short form) | A baseline mechanism | Shaped by Pilot-31? |
| --- | --- | --- | --- |
| Spatial | Plan over the combined map; walls, water and bodies block; body needs clearance | `open()` treats `#`, `~`, gaps and creature extents (+0.4 margin) as blocked; BFS over remembered cells | No |
| Spatial | Seen-earlier things may have moved | Per-area memory; the cow is re-located from the current screen every decision | No |
| Positioning | List candidate tiles around the target: open, not touching a body, not at range edge; prefer clear line, partner out of the line, short reach | The firing-position search: every open tile within 7 of the cow, skips the cow's extent, uses the preview, penalizes `obstructing_heroes` and distance, excludes `near_pull_boundary` | No |
| Positioning | Record tried position-and-aim combinations; do not repeat unless something changed | `attempts` set of position/direction signatures | No |
| Positioning | Do not stand on top of a target; step out first | Candidate tiles inside the cow's extent are skipped | **Yes**: added as its own line because of Coco overlapping the Griffin |
| Positioning | After acting, move off a path or area an effect is about to cross, before it lands | After a pull, `pending.retreat`: move sideways out of the cow's swept body for a bounded 180 ticks | **Yes**: generalised from the hero's own effect to any effect the screen shows coming |
| Search | Explore to the nearest unvisited `?` edge; prefer new tiles; go around when blocked | `explore()`: frontier score, visit-count penalty, blocked-edge memory, backtracking | No |
| Search | Note searched areas in the plan | `visits` map | No |
| Recovery | Treat each action as a test with an expected visible result, check after a bounded time | `pending` deadline, then `lastEffect` compares observed displacement | No |
| Recovery | Two tries with no result: change position, aim, timing or hero; then change approach | New configuration after "no observed cow displacement"; periodic switch away from cow work (`cowSearchDecisions % 100 < 65`) | No |
| Recovery | A recharging ability is not a reason to stand still | "Cooldown does not force indefinite waiting: explore/backtrack" | No |
| Recovery | When the world changes, forget earlier blocked results near it | `blocked.clear()` when a gate is seen open | No |

**Considered and left out:** a "health is a budget; give a hurt hero the safer role" line. It would address Pilot-31's knockout directly, but the A baseline has no such mechanism, so including it would be B-specific tuning beyond what was asked. The owner may add it as a separate, disclosed revision.

## 3. What is unchanged

| Item | Status |
| --- | --- |
| Controller code | Unchanged. `CENTRAL_ID f0592888` (pinned by the new test). No wake-up on beam warnings; `fight` targets enemy entries only |
| Model | Same as Pilot-31: OpenAI `gpt-6-luna`, effort medium, batch 4 |
| Starting checkpoint | Same as Pilot-31: `griffin-unprepared-v1`, seed 0, start hash `1a270d7b…0051` (confirmed by the mock smoke below) |
| Base prompt | Pilot-31's prompt (`cbabb78b…bb6a`), byte for byte, plus one appended guidance block. Pinned by test |
| Briefing / tutorial | Same as Pilot-31 (`briefing-5fa93722`, `tutorial-2ec2f251`) |
| Game rules, Griffin balance, manual | Unchanged; no file under `apps/`, `packages/shared/` or `manual/` was edited |
| Limits | 18,000 ticks, 1,600 decisions / 400 calls / 4M tokens per hero, $0.75 cap, 3,600 s wall |
| Old draft `griffin-b-post-v1` | Unchanged and still locked (`proposed`). Not used |

**One observation difference since Pilot-31 (needs the owner's decision).** Commit `4c9cf9f` (after Pilot-31's `6df4bc0`) added a `nest` object to every Griffin Enclosure observation (`perception.ts`, "Already-drawn straw nest"). A post-tuned run at the current commit would see that extra entry when the nest is on screen; Pilot-31 did not. The guidance does not mention it. Options: (a) accept and disclose it; (b) run at a commit where that line is gated off for `griffin-unprepared-v1` (an observation code change, which needs approval and re-testing). The agent made no change.

## 4. Frozen values

| Value | |
| --- | --- |
| Guidance id | `b-post-a-transfer-v1`, situations `["griffin-unprepared-v1"]` only |
| Guidance text SHA-256 | `60a0a01357e68e2f44f0ecd9d0d0ebb41bfaab04c5c3ec78cae62c760c265263` (2,537 characters) |
| Post-tuned planner prompt SHA-256 | `54605c1b010826448627189d92fc8dfedc9f853b14d45fe5ad21260ce21e5627` (both heroes) |
| Policy id | `centralized-f0592888(openai:gpt-6-luna@medium)·batch4·tutorial-2ec2f251·briefing-5fa93722·guidance-60a0a013` |
| Status | `proposed`. Paid runs refuse it until the owner approves: set `status: "approved"` and `approvedSha256` to the hash above (a reviewed code change) |

Tests: `packages/agent/test/bPostTransferGuidance.test.ts` (new, 4 tests) pins both hashes, the base prompt, the controller id, the scenario restriction, the paid-run lock and the word list.

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

## 6. Open owner decisions

1. Approve the guidance text exactly as frozen (hash above), or ask for changes (which produce a new hash and a new id).
2. The `nest` observation difference (§3): accept and disclose, or gate it off for this scenario.
3. Classification: like Pilot-31, this would run on `griffin-unprepared-v1`, not r6's declared `griffin-unprepared-return-v1`. Confirm it counts as B/post-tuned/1 on the same basis.
4. Final go-ahead for the paid run.
