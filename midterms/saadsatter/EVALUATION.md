# Evaluation: scripted baselines versus LLM players on the Bald Goddess episode

**Status at the packaged commit: tuning results only.**
- The scripted baselines have been run on the tuning scenarios.
- The LLM players have run single paid tuning pilots.
- **The final trials have not been run**: the held-out scenarios S4 and F, the final seeds 100 and 101, and two live trials per situation. They need the owner's approval and budget. Every result below is a tuning result and must not be read as the final comparison.

All costs are in US dollars, charged by the runner's own accounting from dated list prices (below). Game time is 60 ticks per second.

## Declared suite

The suite was declared before any tuning and frozen, provisionally, in commit `0c45f82` on 2026-10-27, pending the professor's confirmation (not yet given). The full declaration and its change log are in [EVALUATION_SUITE.md](docs/midterm/EVALUATION_SUITE.md); code in [suite.ts](packages/agent/src/suite.ts) and [evaluator.ts](packages/agent/src/evaluator.ts).

| Scenario | Role | Start | Success | Game-time limit |
| --- | --- | --- | --- | --- |
| S1 | tuning | the goddess checkpoint | the opening scene ends and the party is in a quest area | 90 s |
| S2 | tuning | the shrine, after the opening scene | the Enchanted Shears are in the shared backpack (Hedge Maze) | 300 s |
| S3 | tuning | the same start as S2 | the Vanity Mirror is in the shared backpack (Mirror Pond) | 300 s |
| S2-local, S3-local | tuning | the maze or pond entrance (added 2026-10-28) | as S2, S3 | see the suite |
| S4 | **held out** | the shrine holding both tools | `chapter0.complete` (Griffin, offering, finale) | 180 s |
| F | **held out** | the goddess checkpoint | `chapter0.complete` (the whole episode) | 480 s |

**Seeds:** tuning 0 and 1; final 100 and 101.

**Starts:** every start state is reached by real play (a prefix of the scripted route), never by fixtures. Baseline and model runs of a case share the same start hash.

**Revisions** (each in the change log, results before and after reported apart):
- revision 2 (2026-10-28) swapped S2 and S3;
- local starts were added (2026-10-28);
- model players receive the manual and a tutorial briefing.

## Players and what each knows

| Player | Kind | Information and compute |
| --- | --- | --- |
| `baseline-quest` | scripted, two cooperating heroes | The same observations and legal actions as the models, plus **hand-coded quest knowledge** (puzzle steps, partner phrases). Free. This is the main baseline. |
| `baseline-explore` | scripted | Walks toward unexplored screen blocks; no quest knowledge. Secondary baseline. |
| `model-history` | LLM, one per hero | Observation, legal actions, the manual, its own 400-character notes, last 8 actions and last turn's results. The main model player. |
| `model-obs-only` | LLM | The current observation only; the rubric's observation-only comparison. Not run yet. |
| `model-memory` | LLM | `model-history` plus a per-hero remembered map and verified events built from its own observations ([MODEL_MEMORY.md](docs/midterm/MODEL_MEMORY.md)). Added 2026-10-29 after pilot-10. |
| `model-guided` | LLM baseline | The model-guided baseline: `model-history` plus a static, written Hedge Maze guide in its prompt. Not information-equal to the other model players; reported apart ([GUIDED_MAZE_BASELINE.md](docs/midterm/GUIDED_MAZE_BASELINE.md)). |

Each hero's model has its own context and memory. The two heroes share nothing except the game world and in-game messages.

## Results

### Scripted baselines (tuning scenarios)

Run on 2026-10-29 with the README's commands, from a clean clone of the packaged folder at `c65dbe2` (Node 24.22.1). Free and deterministic: both seeds give identical trajectories, because no randomness is added (owner decision 2026-10-27).

| Scenario | Quest baseline (seeds 0, 1) | Exploration baseline (seeds 0, 1) |
| --- | --- | --- |
| S1 | 2/2 success, 4.8 s game time, 0 invalid | 2/2 success, 5.4 s, 0 invalid |
| S2 (Hedge Maze) | 2/2 success, 52.9 s, 0 invalid | 0/2: tick limit at 300 s, 0 invalid |
| S3 (Mirror Pond) | 2/2 success, 146.4 s, 0 invalid | 0/2: tick limit at 300 s, 0 invalid |

On the local starts (seed 0, from the frozen fingerprints), the quest baseline succeeds in 2,990 ticks (S2-local) and 4,544 ticks (S3-local). The exploration baseline reaches the tick limit on both.

### LLM players (paid tuning pilots, one trial each, seed 0)

OpenAI `gpt-6-luna` at medium effort unless noted.
- **Tokens:** input includes cached input.
- **Latency:** the median model call.
- **Invalid:** actions refused by validation, for Sieg and Coco.
- **"Stopped by hand":** the owner ended the run (`manual_stop`) once it was clearly stuck. These runs are failures, not successes.

| Pilot | Date (UTC) | Scenario | Player | Outcome | Game time | Calls (failed) | Tokens in / out | Median latency | Invalid S / C | Charged | Git |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
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

Ledger totals (all settled): 11 pilots plus 2 one-call smoke tests, **$1.59** charged of the $25 cap. The pilot stage has $6.41 left of $8, and the final stage $15 of $15.

**Reading these results:**
- Unaided model players finished S1 once.
- On the Hedge Maze they reached the key gate but never caught the key-carrying wolf: pilots 10 and 13.
- Only the model-guided baseline (`model-guided`) finished the maze (pilots 11 and 12).
- Each pilot's diagnosis led to interface fixes (movement reports, drawn labels, the cow's extent, partner messaging, persistent memory). Results from before and after each change are therefore not one experiment.
- With one trial per configuration, no rate or statistical claim is made.

**Dated prices** (the runner's tables):
- `gpt-6-luna`: $0.10 input, $0.50 output per million tokens, cache write ×1.25. Verified on 2026-10-28 against https://developers.openai.com/api/docs/models/gpt-6-luna. Costs carry a 1.1 safety uplift ([MODEL_BUDGET.md](docs/midterm/MODEL_BUDGET.md)).
- `claude-haiku-5-5`: $0.10 / $0.50. Verified on 2026-10-27 against https://platform.claude.com/docs/en/about-claude/pricing.

### Not yet run (required before submission)

- [ ] Final trials: S1–S4 and F, seeds 100 and 101, for the chosen model player and both baselines, with an owner approval per commit (`scripts/midterm/final-approve.ts`).
- [ ] Two live trials per tuning situation for the chosen model player.
- [ ] The observation-only comparison (`model-obs-only` on S1–S3).
- [ ] The baselines on the held-out cases (S4, F), in the final run.

## Traces

**Committed:**
- [pilot-11](docs/midterm/evidence/pilot-11-model-guided/) (`model-guided` success): trace, summary and the replay video;
- the full scripted route at seed 1: [docs/midterm/evidence/route/seed1/](docs/midterm/evidence/route/seed1/).

**Local and not committed:** the other pilots' traces (in the owner's `evaluation-runs/`), named in the pilot diagnoses ([PILOT10_DIAGNOSIS.md](docs/midterm/PILOT10_DIAGNOSIS.md) and the earlier pilot notes). Every trace is a hash-chained JSON-lines file that `verifyTrace` (`packages/agent/src/trace.ts`) checks.

## CI evidence

The workflow `.github/workflows/midterm-saadsatter.yml` runs [scripts/midterm/ci-checks.sh](scripts/midterm/ci-checks.sh) on Node 24: typecheck, deterministic tests, build. It needs no network access to model providers and no key.

| Check kind (3c) | Tests |
| --- | --- |
| Rule invariants | `apps/server/test/*` (for example `hedgeMaze.test.ts`, `mirrorPond.test.ts`, `slowTime.test.ts`), `packages/shared` tests |
| Legal and illegal actions | `packages/agent/test/environment.test.ts`, "action validation" and "player isolation and hidden information" |
| Terminal outcome | `scriptedFreeze.test.ts`, the quest baseline reaching success on S1–S3 with pinned fingerprints; `environment.test.ts`, "termination" |
| Observed regression | `pilot6Fixes.test.ts`: Slow Time was mistaken for a blocked move (found in pilot-6). `budget.test.ts`: failed calls must use up the call cap. `courseLayout.test.ts`: the project root was wrong in the course repository (found by this submission's clean-clone rehearsal) |
| Episode limits | `budget.test.ts` (call, token, spend, per-call timeout), `environment.test.ts` (tick and decision limits), `reliability.test.ts` |

**Excluded from CI:** the tests that build or play the held-out S4 and F starts (the full scripted route `fullQuest.test.ts`, `checkpointFreeze.test.ts`, `suite.test.ts`, `finalAccess.test.ts`, and the route case of `scriptedFreeze.test.ts`). The owner's rule keeps held-out content out of tuning sessions; whether CI may run them is an open owner decision. They still run with `npm test`.

**Runs for this version** (2026-10-29, clean clone of the packaged folder in a stand-in course repository, Node 24.22.1, machine load average 7–15):
- typecheck and build pass;
- the deterministic test step passed 1,023 of 1,025 tests. The 2 failures were timeouts (`courseLayout.test.ts`, then given a 30 s limit; `questBaseline.test.ts` determinism at 120 s). Both files passed, 11/11, when rerun alone;
- the frozen baseline pins failed once (output not captured) and passed 6/6, with the route case skipped, on rerun;
- the first rehearsal found the project-root defect now covered by `courseLayout.test.ts`.

The GitHub Actions run of this repository's workflow is linked from the pull request. The course workflow runs only once the course PR exists.

## Limitations

<!-- OWNER: the course requires this paragraph in your own voice, using the
peer playtest notes. The facts below are for you to draw on; replace this
whole section with your paragraph. -->

_To be written by the owner._ Facts on record for it:
- No final trial has been run; the results above are single tuning pilots.
- The only maze successes are the model-guided baseline's, which has a written maze guide.
- The suite is provisional until the professor confirms it.
- Peer playtest notes have not arrived ([PEER_NOTES.md](PEER_NOTES.md)).
- The owner's full playthrough has no recording.
- The recording is a trace-verified replay, not a live capture.
- The quest baseline holds hand-coded quest knowledge the models do not have.
- The generated sprites' terms need confirmation before publication ([README.md](README.md#sources-and-terms)).
