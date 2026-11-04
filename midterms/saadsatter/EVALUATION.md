# Evaluation: scripted, walkthrough-guided and unaided LLM players on the Hedge Maze

**Primary evaluated episode: S2-local, the Hedge Maze**, one bounded cooperative puzzle from Oath and Ember's Bald Goddess quest. The full quest is implemented and playable (goddess checkpoint to `chapter0.complete`). The detailed agent evaluation focuses on this one puzzle.

**Evaluation question.** How do a scripted policy, walkthrough-guided LLM agents and unaided memory-based LLM agents differ in their ability to coordinate and complete a bounded cooperative game puzzle?

**Status: tuning-stage evidence, not a final comparison.**
- Every run is seed 0 of a tuning scenario.
- There are two LLM trials per LLM policy.
- No held-out case and no final seed has been run.
- The gaps against the course's suite requirements are listed in [Rubric gaps](#rubric-gaps-and-scope-risks), and the submission status in [SUBMISSION_CHECKLIST.md](docs/midterm/SUBMISSION_CHECKLIST.md).

All costs are in US dollars, charged by the runner's own accounting from dated list prices (below). Game time is 60 ticks per second.

## The Hedge Maze episode

| | |
| --- | --- |
| Scenario | `S2-local`, suite revision 2, preset `S2-local-v2` ([EVALUATION_SUITE.md](docs/midterm/EVALUATION_SUITE.md), [LOCAL_STARTS.md](docs/midterm/LOCAL_STARTS.md)) |
| Start | Both heroes entering the Hedge Maze by ordinary play (the opening scene, then a normal walk in, before the arrival dialogue): tick 405, start hash `2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e`. Every run below starts from this exact state |
| Success | The Enchanted Shears are in the shared backpack (checked by the evaluator, never claimed by an agent) |
| Limits, enforced in code | 18,000 ticks (300 game-seconds); 1,600 decisions, 400 model calls and 4,000,000 tokens per hero; a 30 s timeout per model call; an episode spend cap ($0.30 for pilots 11–12, $0.60 for pilots 13 and 15); a wall-clock limit of 3,600 s for model runs (600 s for the live baseline) |
| Terminal reasons | `success`, `tick_limit`, decision/call/token/spend limits, `wall_clock_limit`, `error` (three failed calls in a row), and `manual_stop` (the owner's stop signal, logged as such) |

**What the puzzle tests.**
- *Two independently controlled agents.* Each hero has its own context and memory. The heroes share only the game world and in-game messages.
- *Navigation and combat.* A walled maze with guards and a wolf.
- *Character-specific abilities.* Coco's Fireball (burns the dry hedge), Black Hole (pulls the cow out of the lane) and Slow Time (slows the wolf), and Sieg's Super Speed (catches the wolf).
- *Environmental puzzle solving.* The dry hedge, the cow blocking the lane, the wolf carrying the gate key, the key gate, the Shears chest.
- *Cooperative communication.* Abilities must be timed across the two heroes using in-game messages.
- *Shared quest progress.* The key and the Shears land in one shared backpack.

Mirror Pond (S3) and the Griffin (part of S4) remain implemented content. They appear below only as exploratory pilots and scripted results, not in the Hedge Maze comparison.

### Situation A (S2-A), the frozen form of this episode

On 2026-10-29 this episode was frozen as **S2-A — Full Hedge Maze**, version 1. It is the first situation of a proposed three-situation Hedge Maze suite; the other two are proposals only, so **the three-situation requirement is not met** ([SITUATION_A.md](docs/midterm/SITUATION_A.md)).
- S2-A is a label for S2-local, not a new scenario. It has the same start, success, limits and prompts, and the historical traces still replay.
- The runs in the table below are historical tuning pilots on that same start. They are not S2-A trials and were not re-run.
- Seed 1 differs from seed 0 only in room code and hero ids, so it is a repeated trial, not a second situation.
- The planned primary comparison is `baseline-quest` against unaided `model-memory`; `model-guided` stays supplementary. No new model run has been made.

## Policies and what each one knows

The three policies do **not** have equal information. The comparison separates scripted reference performance, guided execution of a supplied solution, and unaided problem solving.

| Policy | Kind | Information beyond the shared observation | Cost |
| --- | --- | --- | --- |
| `baseline-quest` | Deterministic scripted reference, two scripted heroes | **Solution-aware**: hand-coded quest knowledge (puzzle steps, partner phrases), using the same observations, legal actions and messages as the models. Not an LLM | Free, 0 model calls |
| `model-guided` | LLM per hero (OpenAI `gpt-6-luna`, medium effort) | A static, role-specific **walkthrough of the Hedge Maze** in every system prompt (walkthrough id `975e5580671c`, [GUIDED_MAZE_BASELINE.md](docs/midterm/GUIDED_MAZE_BASELINE.md)), plus the manual, a tutorial briefing (`2ec2f251`), an episode briefing (`a97d9268`), 400-character notes and recent history. Its runs show an LLM **executing a supplied solution**, not discovering one | Paid |
| `model-memory` | LLM per hero (OpenAI `gpt-6-luna`, medium effort) | **No solution.** The manual, the same briefings, notes and recent history, plus a per-hero remembered map and verified events built only from its own observations ([MODEL_MEMORY.md](docs/midterm/MODEL_MEMORY.md)) | Paid |

Every policy uses the same five-operation interface (`reset`, `observe`, `legal_actions`, `step`, `outcome`). No policy sees the HUD's goal lines, server state, source code or its partner's memory. The model players choose and submit their own actions (up to 4 per call).

## Hedge Maze results

Seed 0, scenario S2-local (revision 2), start hash `2b9eddd4…`.
- **Calls:** model calls attempted, with failed calls in brackets.
- **Tokens:** input includes cached input.
- **Latency:** the median model call, from the trace.
- **Invalid:** actions refused by validation, for Sieg and Coco.

| Run | Policy | Outcome | Game time | Decisions | Invalid S / C | Messages | Calls (failed) | Tokens in / out | Median latency | Charged | Git | Recording |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| live, 2026-10-29 | `baseline-quest` | **success** | 49.8 s | 340 | 0 / 0 | 6 | 0 | — | — | $0 | `7022ea1+dirty` | live |
| repro 1–3, 2026-10-29 | `baseline-quest` | **success** ×3, identical end hash | 49.8 s | 340 | 0 / 0 | 6 | 0 | — | — | $0 | `7022ea1+dirty` | none |
| pilot 11 | `model-guided` | **success** | 38.6 s | 177 | 0 / 0 | 19 | 147 (0) | 1,437,229 / 50,545 | 4.5 s | $0.083545 | `74adda8` | replay |
| pilot 12 | `model-guided` | **success** | 44.0 s | 194 | 0 / 0 | 21 | 164 (0) | 1,597,895 / 53,073 | 4.5 s | $0.088321 | `dc00de2` | replay |
| pilot 13 | `model-memory` | not completed: reached the key gate (no key), then stopped by the owner (`manual_stop`) | 76.1 s | 434 | 0 / 0 | 76 | 386 (1) | 3,810,043 / 203,553 | 6.3 s | $0.323391 | `88587ce` | replay |
| pilot 15 | `model-memory` | not completed: **interrupted** by the owner at the cow puzzle (`manual_stop`). An exploratory trial, not a terminal failure | 33.5 s | 199 | 0 / 1 | 20 | 173 (1) | 1,635,432 / 71,356 | 6.1 s | $0.123454 | `7022ea1` | live |

**Summary by policy:**
- `baseline-quest`: 4 of 4 runs succeed with identical trajectories.
- `model-guided`: 2 of 2 succeed.
- `model-memory`: 0 of 2 complete. Neither attempt reached an automatic limit, because both were stopped by hand.

Every number above is checked against that run's `summary.json` by `scripts/midterm/collect_evidence.py`. Files, checksums and recordings are in [evidence/](evidence/README.md).

**Game time versus wall time.** Game time advances only while both heroes have an action running, so model latency never changes the game. Wall time is much longer for model runs:
- pilot 11: 806 s of wall time;
- pilot 12: 1,048 s;
- pilot 13: 3,068 s;
- pilot 15: 1,150 s;
- the offline baseline: about 2 s (68 s with the live viewer).

**Reproducibility.** The scripted baseline adds no randomness, so the same start gives the same run (owner decision 2026-10-27). The live viewer run and three offline runs on 2026-10-29 all end at `bf31311f6c56638bc7e5a6a45b9eaa621fa5042963c6e7c477e2ce74e729f936` after 2,990 ticks. Model runs from the same start differ, because model replies vary.

**How the runs were stopped.**
- Pilots 11 and 12 ended on the success predicate.
- Pilot 13 was stopped by the owner after both heroes had been refused at the key gate and were searching for the key-carrying wolf. The game's gate prompt ("Select the correct key.") is in the trace at tick 2,536.
- Pilot 15 was stopped by the owner at 33.5 game-seconds. Both heroes were then at the cow, exchanging messages about Push and Black Hole.
- A manual stop is logged as `manual_stop`. It is neither a success nor a limit-based failure.

**Configuration differences inside a policy.** The code changed between pilots, so the two trials of a policy are not identical configurations.
- Pilot 12 (`dc00de2`) ran after the shared LLM player (`llm.ts`) gained the hooks for `model-memory`. The walkthrough text was unchanged.
- Pilot 15 (`7022ea1`) ran after a `model-memory` fix (`a38d892`: the exit-character event bug, repeat tracking, notes on what lies ahead of blocked moves).

**Reading the results.** Under these conditions, with two trials per LLM policy and no rate or statistical claim:
- The scripted reference shows the puzzle can be solved through the interface alone in about 50 game-seconds with zero invalid actions.
- An LLM pair given a walkthrough completed it twice, slightly faster in game time than the script. That shows the interface and the two-agent coordination work for an LLM. It does not show that the LLM can solve the puzzle.
- Unaided LLM pairs with memory did not complete it. One got through the hedge and the cow to the key gate. The other was interrupted at the cow.

The gap between guided and unaided play is the main finding. The cause is not isolated, and a much larger gap in information access lies between them.

**Dated prices** (the runner's tables):
- `gpt-6-luna`: $0.10 input, $0.50 output per million tokens, cache write ×1.25. Verified on 2026-10-28 against https://developers.openai.com/api/docs/models/gpt-6-luna. Costs carry a 1.1 safety uplift ([MODEL_BUDGET.md](docs/midterm/MODEL_BUDGET.md)).
- `claude-haiku-5-5` (pilot 2 only): $0.10 / $0.50. Verified on 2026-10-27 against https://platform.claude.com/docs/en/about-claude/pricing.

## P1 "Into the Forest": a directed narrative situation (frozen 2026-11-03, not yet run by a model)

P1 is a second situation, different in kind from the Hedge Maze: directed narrative and navigation in the Prologue, with no puzzle and no combat.
- **Start:** the game's own opening. Sieg is on the road outside Alden's shop; Coco is inside with Alden.
- **Success:** the authoritative story reaches the Mossling Woods. That happens when a hero presses E at the Forest Trail's exit after the cart has been found.
- **Limits:** 180 game-seconds and 250 model calls per hero, with S2-A's decision and token limits; $0.60 per episode; 3,600 s wall clock.
- **Information:** HUD goal lines hidden, and no briefing, tutorial or walkthrough. The players have only the dialogue, the quest journal, what the world shows, and the manual.
- **Limitation:** success does not require Coco. Sieg alone can complete it, so P1 does not test cooperation.

| Run | Policy | Outcome | Game time | Decisions | Invalid S / C | Messages | Calls | Charged | Git |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seeds 0 and 1, 2026-11-03 | `baseline-quest` (route-aware) | **success** ×2, identical play | 17.6 s | 161 | 0 / 0 | 0 | 0 | $0 | see [evidence](docs/midterm/evidence/p1-baseline/) |

No model player has run P1. The expected cost is about $0.09–$0.42 per model episode (estimate). P1 is now revision 2: the independent review's fixes give model players an episode-neutral task line, the client's indoor camera, and an exact listing of the fence opening. Revision 1 is kept for provenance; it was never run by a model. The definition, observation contract, prompt freeze and reproduction commands are in [PROLOGUE_SITUATION.md](docs/midterm/PROLOGUE_SITUATION.md).

## Rubric gaps and scope risks

These are stated plainly rather than worked around. None of them is fixed by narrowing the scope to the Hedge Maze.

1. **One situation instead of three.** The guidelines normally ask for at least three starting situations with two live trials each, or a reduced suite agreed with the instructor. The Hedge Maze comparison is one situation, seed 0. Three policies on one scenario are not three situations. No instructor agreement to a reduced suite is recorded.
2. **No held-out case has been run.** S4 and F (held out) and final seeds 100 and 101 have no runs for any player. Rubric 5a treats a missing held-out case as a weakness.
3. **The suite was revised after tuning began.** The suite was frozen on 2026-10-27 with S1–S4 and F. S2-local was added on 2026-10-28 and redefined as the Hedge Maze in revision 2 (2026-10-28). `model-guided` and `model-memory` were added on 2026-10-29. Making S2-local the primary episode now is a post-hoc choice, made after pilot results existed.
4. **Professor approval of the narrower scope is not recorded.** The suite itself is still "provisional, professor confirmation pending" ([EVALUATION_SUITE.md](docs/midterm/EVALUATION_SUITE.md)).
5. **No observation-only comparison.** `model-obs-only` has never been run. The guidelines ask partial-observation games to compare bounded history with an observation-only player.
6. **Both unaided trials ended by hand.** Neither reached an automatic limit, so neither is a limit-based failure. Pilot 15 is an interrupted trial.
7. **The recording.** Rubric 5c asks for three to five minutes of an agent playing.
   - The only recording in that range is pilot 11's replay (234.6 s capture), which is a replay of the guided policy.
   - Pilot 15's live recording runs about 19 minutes.
   - The baseline's live recording is not an LLM agent.
   - Most videos are not yet delivered ([evidence/README.md](evidence/README.md#recordings-and-delivery)).
8. **Unequal information.** The baseline is solution-aware and `model-guided` has a walkthrough. Only `model-memory` is unaided, so the only unaided-versus-scripted contrast is between unequal players.
9. **P1 adds a different situation, but not the missing trials.** P1 (the Prologue) is frozen and has a scripted baseline result. It has no model trial, it is not held out from development knowledge, and it does not require Coco. With P1 the suite still lacks two live trials per situation and a held-out case, so the three-situation requirement is not met.

## Full Bald Goddess suite and pilot history

### Declared suite

The suite was declared before any tuning and frozen, provisionally, in commit `0c45f82` on 2026-10-27, pending the professor's confirmation (not yet given). The full declaration and its change log are in [EVALUATION_SUITE.md](docs/midterm/EVALUATION_SUITE.md); code in [suite.ts](packages/agent/src/suite.ts) and [evaluator.ts](packages/agent/src/evaluator.ts).

| Scenario | Role | Start | Success | Game-time limit |
| --- | --- | --- | --- | --- |
| S1 | tuning | the goddess checkpoint | the opening scene ends and the party is in a quest area | 90 s |
| S2 | tuning | the shrine, after the opening scene | the Enchanted Shears are in the shared backpack (Hedge Maze) | 300 s |
| S3 | tuning | the same start as S2 | the Vanity Mirror is in the shared backpack (Mirror Pond) | 300 s |
| S2-local, S3-local | tuning | the maze or pond entrance (added 2026-10-28) | as S2, S3 | as S2, S3 |
| S4 | **held out** | the shrine holding both tools | `chapter0.complete` (Griffin, offering, finale) | 180 s |
| F | **held out** | the goddess checkpoint | `chapter0.complete` (the whole episode) | 480 s |

**Seeds:** tuning 0 and 1; final 100 and 101.

**Starts:** every start state is reached by real play (a prefix of the scripted route), never by fixtures. Baseline and model runs of a case share the same start hash.

**Revisions** (each in the change log, results before and after reported apart):
- revision 2 (2026-10-28) swapped S2 and S3;
- local starts were added (2026-10-28);
- model players receive the manual and a tutorial briefing.

### Other players

| Player | Kind | Information and compute |
| --- | --- | --- |
| `baseline-explore` | scripted | Walks toward unexplored screen blocks; no quest knowledge. Secondary baseline. |
| `model-history` | LLM, one per hero | Observation, legal actions, the manual, its own 400-character notes, last 8 actions and last turn's results. The original main model player; `model-memory` extends it. |
| `model-obs-only` | LLM | The current observation only; the rubric's observation-only comparison. **Never run.** |

### Scripted baselines on the tuning scenarios

Run on 2026-10-29 with the README's commands, from a clean clone of the packaged folder at `c65dbe2` (Node 24.22.1). Free and deterministic: both seeds give identical trajectories, because no randomness is added (owner decision 2026-10-27).

| Scenario | Quest baseline (seeds 0, 1) | Exploration baseline (seeds 0, 1) |
| --- | --- | --- |
| S1 | 2/2 success, 4.8 s game time, 0 invalid | 2/2 success, 5.4 s, 0 invalid |
| S2 (Hedge Maze) | 2/2 success, 52.9 s, 0 invalid | 0/2: tick limit at 300 s, 0 invalid |
| S3 (Mirror Pond) | 2/2 success, 146.4 s, 0 invalid | 0/2: tick limit at 300 s, 0 invalid |

On the local starts (seed 0, from the frozen fingerprints), the quest baseline succeeds in 2,990 ticks (S2-local) and 4,544 ticks (S3-local). The exploration baseline reaches the tick limit on both.

### All paid pilots (one trial each, seed 0)

OpenAI `gpt-6-luna` at medium effort unless noted. Pilot ids are the spend ledger's entry ids; entries 1 and 3 are one-call smoke tests. Columns as in the Hedge Maze table. "Stopped by hand" (`manual_stop`) means the owner ended the run; it is not a success.

| Pilot | Date (UTC) | Scenario | Player | Outcome | Game time | Calls (failed) | Tokens in / out | Median latency | Invalid S / C | Charged | Git |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 16 | Oct 29 | S3-local (Mirror Pond) | `model-guided` (pond walkthrough) | stopped by hand | 42.2 s | 162 (1) | 1,813,346 / 59,578 | — | 0 / 0 | $0.105216 | `7022ea1` |
| 15 | Oct 29 | S2-local | `model-memory` | interrupted by hand at the cow | 33.5 s | 173 (1) | 1,635,432 / 71,356 | 6.1 s | 0 / 1 | $0.123454 | `7022ea1` |
| 14 | Oct 29 | S2-local | `model-memory` | stopped by hand at 1.6 s; pilot 15 launched from the same commit a minute later | 1.6 s | 23 (1) | 190,662 / 5,277 | — | 0 / 0 | $0.019568 | `7022ea1` |
| 13 | Oct 29 | S2-local | `model-memory` | stopped by hand at the key gate | 76.1 s | 386 (1) | 3,810,043 / 203,553 | 6.3 s | 0 / 0 | $0.323391 | `88587ce` |
| 12 | Oct 29 | S2-local | `model-guided` | **success** | 44.0 s | 164 (0) | 1,597,895 / 53,073 | 4.5 s | 0 / 0 | $0.088321 | `dc00de2` |
| 11 | Oct 29 | S2-local | `model-guided` | **success** | 38.6 s | 147 (0) | 1,437,229 / 50,545 | 4.5 s | 0 / 0 | $0.083545 | `74adda8` |
| 10 | Oct 29 | S2-local | `model-history` | stopped by hand at the key gate | 44.8 s | 221 (2) | 1,819,757 / 91,140 | 4.7 s | 0 / 0 | $0.145520 | `d31d76a` |
| 9 | Oct 29 | S2-local | `model-history` | `error`: 3 failed calls in a row (2 timeouts, 1 transport failure) | 67.9 s | 359 (3) | 2,908,318 / 174,946 | 5.7 s | 0 / 0 | $0.249535 | `cd13ed7` |
| 8 | Oct 29 | S2-local, rev. 1 (pond) | `model-history` | stopped by hand | 54.9 s | 274 (1) | 1,805,445 / 118,823 | 5.5 s | 1 / 0 | $0.172970 | `b8ae7f0` |
| 7 | Oct 28 | S2-local, rev. 1 (pond) | `model-history` | stopped by hand | 11.3 s | 88 (1) | 534,718 / 42,807 | 6.5 s | 0 / 0 | $0.058202 | `fd8c115` |
| 6 | Oct 28 | S2, rev. 1 (pond) | `model-history` | stopped by hand | 52.1 s | 182 (2) | 1,021,981 / 74,688 | 5.4 s | 0 / 0 | $0.103570 | `7bd0c7e` |
| 5 | Oct 28 | S2, rev. 1 (pond) | `model-history` | stopped by hand | 9.9 s | 35 (1) | 175,397 / 8,712 | 4.3 s | 0 / 0 | $0.018613 | `96fa097` |
| 4 | Oct 28 | S2, rev. 1 (pond) | `model-history` | stopped by hand | 50.3 s | 592 (2) | 3,038,575 / 236,226 | 3.3 s | 48 / 33 | $0.311090 | `4abf87f` |
| 2 | Oct 28 | S1 | `model-history`, Anthropic `claude-haiku-5-5` medium | **success** | 6.0 s | 78 (0) | 506,839 / 21,198 | 2.0 s | 4 / 4 | $0.031502 | `4193424` |

Ledger totals (all 16 entries settled): 14 pilots plus 2 one-call smoke tests, **$1.84** charged ($1.836032) of the $25 cap. The pilot stage has $6.17 left of $8, and the final stage $15 of $15.

**Earlier unaided results.**
- Unaided model players finished S1 once (pilot 2).
- On the Hedge Maze, `model-history` reached the key gate but never caught the key-carrying wolf (pilot 10).
- Each pilot's diagnosis led to interface fixes (movement reports, drawn labels, the cow's extent, partner messaging, persistent memory). Results from before and after each change are therefore not one experiment.
- Revision 1 and revision 2 results are never pooled.

## Traces

- **Hedge Maze evidence:** [evidence/](evidence/README.md). It holds the traces and summaries of the baseline (live and three reproducibility runs) and of pilots 12, 13 and 15, with a checksum manifest. Pilot 11 is in [docs/midterm/evidence/pilot-11-model-guided/](docs/midterm/evidence/pilot-11-model-guided/README.md).
- **The full scripted route** at seed 1: [docs/midterm/evidence/route/seed1/](docs/midterm/evidence/route/seed1/).
- **Other pilots:** their traces stay in the owner's local `evaluation-runs/`, which is not committed. Their SHA-256 checksums are inventoried in [the manifest](evidence/manifests/evidence-manifest.md).

Every trace is a hash-chained JSON-lines file. `verifyTrace` (`packages/agent/src/trace.ts`) checks it, and `collect_evidence.py --verify` re-checks the packaged ones.

## CI evidence

The workflow `.github/workflows/midterm-saadsatter.yml` runs [scripts/midterm/ci-checks.sh](scripts/midterm/ci-checks.sh) on Node 24: typecheck, deterministic tests, build. It needs no network access to model providers and no key.

| Check kind (3c) | Tests |
| --- | --- |
| Rule invariants | `apps/server/test/*` (for example `hedgeMaze.test.ts`, `mirrorPond.test.ts`, `slowTime.test.ts`), `packages/shared` tests |
| Legal and illegal actions | `packages/agent/test/environment.test.ts`, "action validation" and "player isolation and hidden information" |
| Terminal outcome | `scriptedFreeze.test.ts`, the quest baseline reaching success on S1–S3 with pinned fingerprints (its "quest/S3" pin is the Hedge Maze end state `bf31311f…`); `environment.test.ts`, "termination" |
| Observed regression | `pilot6Fixes.test.ts`: Slow Time was mistaken for a blocked move (found in pilot-6). `budget.test.ts`: failed calls must use up the call cap. `courseLayout.test.ts`: the project root was wrong in the course repository (found by this submission's clean-clone rehearsal) |
| Episode limits | `budget.test.ts` (call, token, spend, per-call timeout), `environment.test.ts` (tick and decision limits), `reliability.test.ts` |

**Excluded from CI:** the tests that build or play the held-out S4 and F starts (the full scripted route `fullQuest.test.ts`, `checkpointFreeze.test.ts`, `suite.test.ts`, `finalAccess.test.ts`, and the route case of `scriptedFreeze.test.ts`). The owner's rule keeps held-out content out of tuning sessions; whether CI may run them is an open owner decision. They still run with `npm test`.

**Runs for this version** (2026-10-29, clean clone of the packaged folder at `c65dbe2` in a stand-in course repository, Node 24.22.1, machine load average 7–15). These results predate the Hedge Maze documentation commit and have not been repeated for it.
- Typecheck and build passed.
- The deterministic test step passed 1,023 of 1,025 tests. The 2 failures were timeouts: `courseLayout.test.ts`, which was then given a 30 s limit, and the `questBaseline.test.ts` determinism test at 120 s. Both files passed, 11/11, when rerun alone.
- The frozen baseline pins failed once (output not captured). They passed 6/6, with the route case skipped, on rerun.
- The first rehearsal found the project-root defect now covered by `courseLayout.test.ts`.

The GitHub Actions run of this repository's workflow is linked from the pull request. The course workflow runs only once the course PR exists.

## Limitations

<!-- OWNER: the course requires this paragraph in your own voice, using the
peer playtest notes. The facts below are for you to draw on; replace this
whole section with your paragraph. -->

_To be written by the owner._ Facts on record for it:
- The primary evaluation is one scenario (Hedge Maze, S2-local) at one seed, with two trials per LLM policy. No held-out case or final seed has been run.
- S2-local was made the primary episode after pilot results existed. The suite is provisional until the professor confirms it, and the narrower scope has no recorded approval.
- The only LLM completions are by `model-guided`, which has a written maze walkthrough. The unaided `model-memory` trials did not complete. Both were stopped by hand, and pilot 15 was an interrupted trial.
- The scripted baseline holds hand-coded quest knowledge the models do not have.
- The code changed between the two trials of each LLM policy.
- `model-obs-only` was never run.
- Peer playtest notes have not arrived ([PEER_NOTES.md](PEER_NOTES.md)).
- The owner's full playthrough has no recording.
- Recordings: pilots 11–13 are trace-verified replays, not live captures. The baseline's live video shows a final clock of 43.1 s, against the authoritative 49.8 s, and shows HUD goal hints that no agent receives. It was recorded at `7022ea1+dirty`.
- The generated sprites' terms need confirmation before publication ([README.md](README.md#sources-and-terms)).
- P1 (the Prologue, frozen 2026-11-03) has only a scripted baseline result. Its success does not require Coco, and it was designed with full knowledge of the code.
