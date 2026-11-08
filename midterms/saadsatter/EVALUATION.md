# Evaluation — Oath and Ember

Declared suite: **`oath-ember-abc-2026-11-06-r11-c3-hint`** (active; r9 and r10 archived in `docs/midterm/evaluation-abc/history/`). Implementation, launch commands and evidence are available directly in `oath_and_ember-eval`. All nine primary cells (A, B and C × pre-tuned, post-tuned, cheap baseline) now have a recorded outcome; see the disclosures for each case.

## Declared cases

| Situation | Start | Authoritative success | Status |
| --- | --- | --- | --- |
| A — Hedge Maze (`S2-local`, seed 0) | Frozen maze-entrance checkpoint; normal shared inventory | Enchanted Shears acquired | Frozen A unchanged; historical model pilots and heuristic baseline available |
| B — Griffin Trial, Unprepared — Goddess Return (`griffin-unprepared-return-v1`, seed 0; declaration r8) | Fresh 640-HP Griffin; both heroes full health/normal abilities; no Mirror, Shears or wig; legal opening/north-travel history | Griffin HP zero, wig acquired, normal goddess offering and actual `chapter0.complete`; no knockout | Legal checkpoint and rule-aware baseline verified; post-tuned Pilot-33 success preserved |
| C — Griffin Trial, Prepared — Goddess Return (`griffin-prepared-return-v1`, seed 0; declarations r10/r11) | B-return's start (tick 540) with the Vanity Mirror and Enchanted Shears injected into the shared backpack (owner decision); start `28777a85…` | Wig claimed by any normal route (Griffin defeat not required), offered to the goddess, and actual `chapter0.complete`; no knockout; leaving the enclosure allowed | All three cells run; see "Situation C results" |

B's return objective is the owner's latest amendment. B/C therefore differ in task scope as well as inventory; do not present them as a controlled inventory-only comparison. Prepared peaceful grooming can give a wig while Griffin HP remains positive and does not satisfy C's retained strict defeat predicate. No C-specific walkthrough or outcome tuning has been performed.

The separately reviewed **`griffin-unprepared-v1`** is preserved exactly as implemented in this checkout: enclosure-only combat and wig acquisition, with its original start, hash, boundary and review. It is not an alias of the return variant. Its earlier pre-run owner decisions remain in their original records; they do not authorize paid calls for the new return case.

## Conditions and primary trial allocation

Preserve the evaluation checkout's owner-approved **one primary run per condition per case**: nine primary cells (six model, three baseline). A/B each additionally have a second identical heuristic reproduction, reported as supplementary evidence rather than another primary cell. All nine primary outcomes are recorded. This is not two independent repetitions of each model condition; a reduced/mixed-condition design must not be described as stronger evidence than it is.

| Situation | Pre-tuned model | Post-tuned model | Cheap baseline |
| --- | --- | --- | --- |
| A | 0/1 success: Pilot-28 manually stopped at cow | 1/1 success: Pilot-30 | 1/1 primary success; one matching supplementary reproduction |
| B | 0/1 success: Pilot-31 knocked out (run on `griffin-unprepared-v1`, see below) | 1/1 primary success: Pilot-33 v4; earlier Pilot-32 v1 failure retained | 1/1 primary success; one matching supplementary reproduction |
| C | 1/1 success: Pilot-34 (peaceful route) | 1/1 success: Pilot-35, v4 + inventory/nest hint (outcome-informed, C-specific; r11) | 1/1 success: recorded C2 run (combat route) |

“0/1 run” means no outcome, not a measured failure. Do not pool unlike tasks or treat deterministic repeated trajectories as independent statistical evidence.

## Recorded outcomes

| Run | Result | Game time | Wall time | Model calls | Invalid actions | Estimated API cost | Tokens in / out | Call latency mean / max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A pre-tuned — Pilot-28 | Manual stop; cow passage not cleared; no Shears | 125.267 s | 900.8 s | 79 attempted | See original diagnosis; not inferred | $0.094339 conservative charge; $0.085837 known usage | 864,786 / 61,002 | 9.7 s / 23.2 s |
| A post-tuned — Pilot-30 | Shears acquired | 89.5 s | 1958.1 s | 167 | 2 | $0.443258 runner estimate | 3,678,281 / 171,240 | 11.0 s / 20.5 s |
| A heuristic v2, primary / reproduction | Both Shears successes | 31.5 s each | 6.7 /6.4 s | 0 | 0 | $0 | 0 | none (no model) |
| B pre-tuned — Pilot-31 | Knocked out (Sieg) with the Griffin at 152/640; no wig | 50.1 s | 1486.5 s | 117 attempted, 0 failed | 1 | $0.265961 runner estimate | 2,271,965 / 116,199 | 11.9 s / 24.2 s |
| B Griffin heuristic v1, primary / reproduction | Both combat defeat + wig + goddess offering + Chapter 0 completion; no knockout | 89.8 s each | 6.7 /6.6 s | 0 | 0 | $0 | 0 | none (no model) |
| B post-tuned — Pilot-33 (v4) | Griffin defeated, wig acquired/offered, Chapter 0 complete; no knockout | 51.0 s | 2184.4 s | 251 | 1 | $0.554417 | 4,871,133 / 157,250 | 8.5 s / 28.1 s |
| Earlier B post-tuned attempt — Pilot-32 (v1) | Knocked out; retained failure, not erased by Pilot-33 | 47.5 s | 1048.5 s | 98 | 1 | $0.206005 | 1,641,372 / 103,909 | 10.1 s / 18.2 s |
| C pre-tuned — Pilot-34 | Peaceful: tools delivered while alive, Griffin groomed (HP 418, never defeated); wig claimed, offered, Chapter 0 complete; no knockout | 133.3 s | 2479.7 s | 278 | 2 | $0.586742 | 5,449,743 / 179,558 | 8.4 s / 21.1 s |
| C post-tuned — Pilot-35 (v4 + hint) | Peaceful: tools delivered before any damage (HP 640); wig claimed, offered, Chapter 0 complete; no knockout | 56.3 s | 958.5 s | 163 | 1 | $0.287029 | 3,024,600 / 71,352 | 5.5 s / 20.5 s |
| C Griffin heuristic v1 (C2) | Combat: Griffin defeated (HP 0), then wig, offering, Chapter 0 complete; no knockout; tools unused while alive | 89.8 s | 103.3 s | 0 | 0 | $0 | 0 | none (no model) |

The owner designated Pilot-28 pre-tuned and Pilot-30 post-tuned. Pilot-28's owner-recalled approximately 128 seconds is retained as recollection; recorded elapsed time is 125.267 seconds. Both are historical development pilots, not retroactively preregistered final runs. Their comparison includes controller/planner changes and does not isolate prompt-only tuning. Pilot-30 used `gpt-6-luna` medium at `040685c`; exact intervention provenance is not independently complete. Provider charges above are saved runner estimates, not a current price lookup or invoice. Input/cache/output/reasoning totals and all available identifiers remain in the original records.

**Declarations r7 and r8 (2026-11-06).** r7 briefly made `griffin-unprepared-v1` the B scenario; by owner decision r8 returns B to `griffin-unprepared-return-v1`, where the B post-tuned run and the B baseline are. B pre-tuned (Pilot-31) stays on `griffin-unprepared-v1`, so B pre and post differ in scenario, prompt framing and observations as well as guidance: not a prompt-only contrast. The B post-tuned prompt was written after reading Pilot-31: B pre/post is tuning on B. See [B_POST_TUNING_TRANSFER.md](../../docs/midterm/B_POST_TUNING_TRANSFER.md).

**B pre-tuned (Pilot-31) disclosure (written under r6).** It ran at `6df4bc0` on the enclosure-only `griffin-unprepared-v1` start (tick 439, start `1a270d7b…`), not the r6 return checkpoint (tick 540, start `45b1a6aa…`). Its prompt carried the v1 briefing, which names the wig as the goal; the return variant has no briefing and requires the goddess offering too. The owner counts it as B/pre-tuned/1 without revising the declaration, because the heroes were knocked out in the enclosure before the Griffin was defeated, which fails both predicates. It is not a trial of the r6 checkpoint, and the B pre-tuned and baseline cells do not share a start state. Policy: Pilot-30's generic planner, no guidance, `gpt-6-luna` medium, prompt hash `cbabb78b…`. Trace chain and offline replay verified; [record](../../docs/midterm/evaluation-abc/B-pretuned-pilot31.json), [evidence](evidence/traces/pilot-31-model-centralized-griffin-unprepared-v1-seed0/README.md).

Original pre/post evidence, hashes and metrics are unchanged. The A baseline policy is `baseline-maze-heuristic-v2` (`1de3b61`); B is `baseline-griffin-heuristic-v1` (`fbc3627`). Archived runs retain those original source commits. Integration tests in this checkout verify availability separately; they are not relabelled as those original trials.

## Baseline knowledge and interface fairness

Both new baselines are deterministic and have no model gateway. Each hero has its own observation/map/action-result memory; no filesystem, engine state, source map, route constants or successful trace is supplied to a playing policy. The centralized model sees both permitted hero screens, an architecture/information asymmetry that is disclosed.

A knows public puzzle mechanics: fire on combustible vegetation, organic pulling, chase abilities and keys opening gates. It searches pull positions, checks effects, backtracks, crosses newly opened gates and explores unvisited space beyond them. There is no fixed maze/chest solution route. B knows general combat, spacing, recovery, flight over observed water/gaps, organic-target pull/damage and normal inventory/dialogue interactions. It receives no Griffin-grounding rule, fixed nest coordinate or return route. The visible straw nest was already drawn in the client and is now listed under normal viewport filtering for all players; offscreen visibility is tested.

B uses normal observed RETURN exits, shrine exploration and offering interaction with the owned wig. Accepted inputs are not treated as confirmed effects. The evaluator checks actual game state/events. Lethal-hit respawn is an immediate failure even when the game restores HP to 100. Gameplay/respawn rules are unchanged.

The older solution-aware `baseline-quest`, its code, successful A references and measured old-enclosure failure evidence are preserved. It remains C's declared comparator pending certification. It is not silently relabelled as either new heuristic. Four A v1 development failures and its two measured failures are retained; v2 successes do not erase them. B's prefix-construction failure and intermediate reward/return failures are also preserved.

## Evidence and reproducibility

- Machine declaration/results: `docs/midterm/evaluation-abc/declaration.json`, `declared-results.json`, `matrix.json`.
- A heuristic: `docs/midterm/evidence/maze-heuristic-v2/manifest.json`; earlier failures in `maze-heuristic-v1/`.
- B heuristic: `docs/midterm/evidence/griffin-heuristic-v1/manifest.json`; legal definition `evaluation-abc/B-unprepared-return-definition.json`.
- Model records: `evaluation-abc/A-pretuned-pilot28.json`, `A-posttuned-pilot30.json`; original Pilot-30 files and video link under `midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/`.
- Native reviewed enclosure case: `docs/midterm/SITUATION_B_GRIFFIN.md` and its existing session-49 review/evidence.
- Previous native report/declaration: `evaluation-abc/history/pre-baseline-integration/`. Incoming 18-row worktree plan: `history/parallel-worktree/`, historical and superseded by this native nine-cell plan.

Paths above are repository-relative; after course packaging they are inside the submission folder. Raw trace hashes/chains, start/end hashes, policy/config identifiers, confirmed milestones and summaries are in the manifests. Gzip traces decode with `gzip -dc trace.jsonl.gz`. Traces contain evaluator-only evidence and are never supplied to players.

From the evaluation checkout, run either command separately:

```sh
cd /Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval
npm run eval:live -- --scenario S2-local --seed 0 --player baseline-maze-heuristic
# Or:
npm run eval:live -- --scenario griffin-unprepared-return-v1 --seed 0 --player baseline-griffin-heuristic
```

The live viewer records at normal speed by default. Its printed output folder contains `recording.webm` and `recording.json`. Archived heuristic trials were accelerated offline and have no video; these commands start new free baseline runs. Pilot-30 has a separate saved model-run recording. No new recording is claimed by the no-viewer integration smoke tests; the later owner-recorded videos are linked below.

Input tokens include cached input. Costs are runner estimates from list prices verified on 2026-10-28, with a 1.1 safety uplift; they are not provider invoices. Limits for every model run: at most 400 model calls per hero, a token cap per hero, a per-episode spend cap and a wall-clock limit, all enforced in code, with the terminal reason logged in each `summary.json`.

## Recorded baseline videos (owner runs, November 6)

These are new live recordings at configured speed **1**, from clean commit `4c9cf9f`. Both runs succeeded with zero model calls, zero invalid actions and $0 API cost; their end hashes match the archived deterministic baseline results.

| Baseline | Video | Recording metadata | Outcome | Game time | Episode wall time |
| --- | --- | --- | --- | --- | --- |
| A — Hedge Maze | [Watch recording](../../evaluation-runs/live/S2-local-seed0-baseline-maze-heuristic-2026-11-06T20-12-22-947Z/recording.webm) | [Metadata](../../evaluation-runs/live/S2-local-seed0-baseline-maze-heuristic-2026-11-06T20-12-22-947Z/recording.json) · [Summary](../../evaluation-runs/live/S2-local-seed0-baseline-maze-heuristic-2026-11-06T20-12-22-947Z/S2-local-seed0/summary.json) | Success | 31.5 s | 103.8 s |
| B — Griffin and goddess return | [Watch recording](../../evaluation-runs/live/griffin-unprepared-return-v1-seed0-baseline-griffin-heuristic-2026-11-06T20-15-12-709Z/recording.webm) | [Metadata](../../evaluation-runs/live/griffin-unprepared-return-v1-seed0-baseline-griffin-heuristic-2026-11-06T20-15-12-709Z/recording.json) · [Summary](../../evaluation-runs/live/griffin-unprepared-return-v1-seed0-baseline-griffin-heuristic-2026-11-06T20-15-12-709Z/griffin-unprepared-return-v1-seed0/summary.json) | Success | 89.8 s | 236.2 s |

Videos are local files in `evaluation-runs/live/`, excluded from Git; the links work in this evaluation checkout. They are not yet public submission links. [Preserved metadata and SHA-256 manifest](../../docs/midterm/evidence/baseline-live-recordings/manifest.json) identifies the original files without changing them. The recorder reports successful save, readiness and final confirmation with no warnings; those metadata fields are not an independent visual verification of the terminal frame. File hashes/byte counts and summary outcomes were checked; full decode was not performed for this linking update.

Episode wall time differs from game time and from recording-session wall time; recording startup/finalization is not model latency. These recordings supplement the declared primary trials rather than replacing historical measurements.

## Continuous showcase — Pilot-39, gameplay-complete (excluded from A/B/C)

A separate, prompt-tuned demonstration of the whole connected quest in one episode, from the normal Goddess Shrine checkpoint: opening quest, Hedge Maze, Griffin combat, wig, offering. One `model-centralized` planner on `gpt-6-luna` (medium effort, batch 4), seed 0, source `39a142b`, guidance `showcase-maze-griffin-v1`. It is **not** part of the declared A/B/C comparison and is not pooled with it.

**Result: gameplay-complete; recorded `success: false`, terminal reason `token_limit`.** In 236.4 game-seconds the two AI players:

- received the quest;
- obtained the Enchanted Shears (139.7 s);
- returned to the shrine and entered the Griffin Enclosure;
- defeated the Griffin in combat (214.0 s);
- claimed the wig (233.7 s);
- returned, and had the offering accepted by the Goddess (236.4 s).

61 ticks later, Coco's planner reached the owner-approved limit of 8,000,000 tokens per hero, during the finale dialogue. `chapter0.complete`, the scenario's declared success condition, was therefore not recorded. Only the finale dialogue remained. We report the run as gameplay-complete and do not relabel the raw result.

542 model calls, 2 invalid actions, one knockout (Coco, recovered by the game's normal respawn). Estimated cost $1.556206. Every step was verified by an exact replay of the trace (1,428 step results). [Preserved evidence](evidence/showcase/pilot-39-original/README.md). **[4-minute video](https://github.com/SaadSatter/oath_and_ember/blob/midterm/evaluation/docs/midterm/evidence/pilot-39-showcase-replay/replay.webm)**: a speed-1 **replay** of the recorded actions, verified step by step against the trace, with no model calls ([details](../../docs/midterm/evidence/pilot-39-showcase-replay/README.md)). The viewer shows human HUD hints that the AI players never received. The live capture is local only (595 MB, about 99 minutes of wall time, because model latency is included).

Context: earlier showcase attempts Pilot-37 (Griffin-trail detour) and Pilot-38 (cow puzzle) were manually stopped. This is one tuned run, not evidence of reliability. A later prompt revision (`showcase-maze-griffin-v2`) is documented in `docs/midterm/SHOWCASE_PROMPT_V2_PROPOSAL.md`.

## Pilot-33 — preserved Situation B post-tuned completion

The owner designates Pilot-33 as **B/post-tuned/1**. It used `gpt-6-luna` medium, `model-centralized`, commit `1f0ca45`, approved guidance **`b-post-combined-v4`** (`1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34`). This is the return scenario, with the same checkpoint as the B heuristic baseline.

- [Preserved evidence and run details](evidence/traces/pilot-33-model-centralized-griffin-unprepared-return-v1-seed0/README.md)
- [Complete trace, including raw model responses and policy notes](evidence/traces/pilot-33-model-centralized-griffin-unprepared-return-v1-seed0/trace.jsonl)
- [Summary](evidence/traces/pilot-33-model-centralized-griffin-unprepared-return-v1-seed0/summary.json) · [Run configuration](evidence/traces/pilot-33-model-centralized-griffin-unprepared-return-v1-seed0/run.json) · [Results](evidence/traces/pilot-33-model-centralized-griffin-unprepared-return-v1-seed0/results.json)
- [Watch original recording](../../evaluation-runs/live/griffin-unprepared-return-v1-seed0-model-centralized-openai-2026-11-06T23-57-08-007Z/recording.webm) · [Recording metadata](evidence/traces/pilot-33-model-centralized-griffin-unprepared-return-v1-seed0/live-recording.json)
- [Preservation/hash manifest](evidence/traces/pilot-33-model-centralized-griffin-unprepared-return-v1-seed0/manifest.json) · [Registered result](../../docs/midterm/evaluation-abc/B-posttuned-pilot33.json)

The video is **local-only**, 188,269,515 bytes; it has not been uploaded or committed. Its metadata reports successful save, 1280×720, speed 1 and final confirmation. [Full decode and terminal-frame verification](evidence/traces/pilot-33-model-centralized-griffin-unprepared-return-v1-seed0/verification.json) passed: encoded duration 2188.88 s, final frame visibly shows `finished: success` and Chapter 0 completion. A 1x1 PNG-sink aspect-ratio warning is distinguished from decode errors. Recording-session wall time (2201.3 s) differs from episode wall time (2184.4 s); neither is game time (3057 ticks = 50.95 s, displayed 51.0). Model thinking pauses game time.

Confirmed trace milestones: Griffin defeated at 38.183 game-s, wig acquired at 41.267 s, offering accepted at 47.417 s and `chapter0.complete` at 50.95 s. The trace chain and offline replay match the original start, all 443 results, end hash and tick count. Five unusable replies were still charged; there were no failed/timed-out/unknown-usage calls. Token totals: 4,871,133 input (cache included) and 157,250 output; mean/max call latency 8492/28053 ms. Raw evidence preserves the exact identifiers, limits and price source; cost is a dated runner estimate, not a provider invoice.

**Selection and failed-attempt disclosure:** declaration r8 originally pinned v1 guidance, used by failed Pilot-32. The owner's instruction registers successful Pilot-33/v4 as primary **after its outcome**; r9 preserves r8 and its planned result metadata under `evaluation-abc/history/pre-pilot33-registration/`. [Pilot-32's failure record](../../docs/midterm/evaluation-abc/B-posttuned-pilot32.json) and all original evidence remain unchanged. Recorded B post-tuning attempts therefore include **one failure (v1) and one success (v4)**, not two repetitions of one policy. V4 was developed after Pilot-32, so the later success cannot erase that failure or establish a controlled causal estimate. Pilot-31 pre-tuned also used a different checkpoint/task/observation framing; the existing comparison caveats still apply.

No new paid call, gameplay/policy change or scenario modification occurred during preservation. C remains unrun and held out.

### Interpretation of Situation B

The pre-tuned and post-tuned trials used different recorded checkpoints, but both evaluated the same core challenge: defeating the unprepared Griffin using the heroes' normal abilities, without the Mirror or Enchanted Shears. The pre-tuned run ended in a knockout during combat, before the additional goddess-return objective could become relevant. Therefore, its failure is directly relevant to the combat task tested by the post-tuned run.

The primary gameplay difference under investigation was the model's guidance. However, because the checkpoints and full terminal objectives were not identical, the comparison should be interpreted as evidence of improved performance following prompt tuning, rather than a strictly controlled prompt-only experiment.

## Design choices

| Choice | What we did | Alternative it replaced, and why |
| --- | --- | --- |
| Evaluation suite | Three situations, each testing a different capability of the game: **A (Hedge Maze) for puzzle solving**: environmental obstacles, the cow, the wolf and key gate; **B (Griffin, unprepared) for combat**: a 640-HP boss with telegraphed attacks, then the return to the goddess; **C (Griffin, prepared) for inventory reasoning**: the same encounter with the Mirror and Shears already in the backpack, where reading item descriptions opens a peaceful route. | The earlier evaluation focused on the Hedge Maze alone ([history](EVALUATION_HISTORY_BEFORE_ABC_DECLARATION.md)): one kind of task, which could not show whether the players handled combat or item use. |
| Model player | One centralized planner that sees both heroes' permitted screens and orders both heroes; each hero still acts only through its own legal controls. | Two independent model players (one per hero) with messages and per-hero memory, used in earlier pilots. They were slower, cost more and coordinated poorly; see Limitations. |
| Baselines | Rule-aware deterministic heuristics with per-hero map memory and zero model calls (`baseline-maze-heuristic-v2` for A, `baseline-griffin-heuristic-v1` for B and C). | The earlier `baseline-quest`, a solution-aware scripted route. That is a walkthrough, not a competitor that has to read the screen. |
| Conditions | Pre-tuned model, post-tuned model (general guidance text) and the baseline, on the same start states. | Model only. Without a pre/post pair and a baseline, a success could not be attributed to tuning or compared with a non-model player. |
| Interface | Five operations (reset, observe, legal_actions, step, outcome) over the real authoritative game server. | A separate simulator. It would have needed a second copy of the rules, which could drift from the game. |

## CI evidence

The course workflow [`.github/workflows/midterm-saadsatter.yml`](../../.github/workflows/midterm-saadsatter.yml) runs `bash scripts/midterm/ci-checks.sh` from this folder on every pull request touching it: `npm ci`, typecheck, the deterministic tests and the build. It makes no network calls to model providers and uses no API key. [Workflow runs on this branch](https://github.com/columbia-university-ai-games/game-dev-f26/actions/workflows/midterm-saadsatter.yml?query=branch%3Asaadsatter%2Fmidterm-oath-and-ember). Green run for the submission content: [run 42431927855](https://github.com/columbia-university-ai-games/game-dev-f26/actions/runs/42431927855). It had 139 test files, 1,356 tests passed and 1 skipped, plus 6 of the 7 frozen-baseline outcome tests (the one held-out route case is excluded).

| Check kind | Where it is tested |
| --- | --- |
| Rule invariants | `apps/server/test/` (43 files, 26 of them over real Socket.IO connections): the authoritative server's movement, combat, puzzles, Griffin and story rules |
| Legal and illegal actions | `packages/agent/test/environment.test.ts`, "action validation": illegal or malformed actions are refused, and the world is unchanged |
| Terminal outcome | `packages/agent/test/scriptedFreeze.test.ts`, "baseline on S1–S3": frozen baselines reach success with pinned end hashes |
| Observed regression | `packages/agent/test/pilot6Fixes.test.ts` (the Slow Time false collision seen in Pilot-6) and `budget.test.ts` (failed model calls counted against the budget) |
| Episode limits | `packages/agent/test/budget.test.ts`, `environment.test.ts` "termination" and `reliability.test.ts`: tick, decision, call, token, spend and wall-clock limits end the episode with an explicit reason |
| Hidden information | `environment.test.ts` (observations and legal actions never contain hidden state), `perception.test.ts` (observations report what the client draws, such as health bars in eighths, not hidden numbers) and `griffinObservationParity.test.ts` (replayed observations match the recorded ones byte for byte) |

What CI excludes, and why:

- The tests that build or play the held-out scenarios (the scripted full route, `suite.test.ts`, `finalAccess.test.ts`).
- The npm Ctrl-C launcher test, skipped on GitHub's Linux runner only, where npm's signal relay differs; it runs locally.
- Two checks that compare files against older commits in the development repository. They check only the current files here, because the course copy has no project git history.

## Verification

Typecheck and build pass in `oath_and_ember-eval`. Integration targeted suite: **78/78 tests in six files**, covering both heuristic policies, the live Griffin CLI, native reviewed Griffin scenario, frozen A and scripted behavior pins. Held-out refusal remains tested. No full-suite test run was launched concurrently with the other workstream. No paid calls, push or merge occurred.

## Limitations

The evaluation revealed several limitations in using LLM-driven agents to play a cooperative, partially observable game.

**Multi-agent coordination and complexity.** Although Coco and Sieg have complementary abilities, coordinating two heroes introduced substantial complexity. The agents sometimes issued conflicting instructions, repeated completed tasks, or failed to communicate important discoveries. Their separate positions and observations also made it difficult to maintain a consistent understanding of the world. Running two model-driven controllers increased token consumption substantially, approaching twice the cost of a single-controller setup when both required comparable model calls. This made the system slower and more expensive without guaranteeing better cooperation. So for these reasons I went with a single controller.

**Spatial reasoning and navigation.** The agents struggled to navigate the game's interconnected maps, particularly when obstacles, narrow passages, or previously explored areas were involved. They sometimes revisited locations, overlooked accessible routes, or continued attempting actions that were no longer useful. Limited visibility and imperfect spatial memory made long-horizon exploration difficult, even when the agents understood the immediate objective.

**Dependence on prompt tuning and situational guidance.** Early evaluations demonstrated that general gameplay instructions were often insufficient for completing multi-step objectives reliably. Performance improved after refining prompts and providing focused, situation-specific hints about objectives, relevant abilities, and task priorities. These hints did not provide exact solutions, coordinates, or action sequences, but they helped agents concentrate on relevant information and avoid unproductive exploration. Consequently, the results reflect the effectiveness of the complete prompted agent system rather than the model's unaided ability to discover and solve every puzzle.

**Human playtesting.** In contrast with the AI players, a human player completed the game without any help. On 7 November 2026, a friend played the full current build for about an hour with no hints or assistance and reached "Chapter 0 complete". They hesitated on some puzzles but solved each one alone, and reported only cosmetic issues such as lag. This is one unassisted session, recorded from the developer's account; an earlier session on 2 November was assisted. See [PEER_NOTES.md](PEER_NOTES.md).

Overall, these limitations suggest that reliable LLM gameplay requires more than knowledge of the game's rules. Effective cooperation depends on maintaining spatial memory, communicating progress, recovering from unsuccessful actions, and providing sufficiently focused objectives while preserving the challenge of solving the game itself.


### Excluded C exploratory baseline (unrun)

**Owner classification (2026-11-06): C-specific exploratory baseline, excluded from the official evaluation** (it is tuned to C's item text). `baseline-inventory-heuristic-v1` is a zero-model inventory-aware baseline for the prepared-return C case. It uses observed item/target descriptions and the unchanged B combat/return fallback. [Implementation and offline verification](../../docs/midterm/SITUATION_C_HEURISTIC_BASELINE.md). No C episode was run; this note does not amend the active scenario declaration or report a result.

### Approved C2 recorded baseline

Owner-approved `baseline-griffin-heuristic-v1` ran on `griffin-prepared-return-v1`, seed 0, at `19e5d87`: **success**, 89.8 game seconds / 103.3 wall seconds, zero counted invalid actions, zero model calls, $0. It defeated the Griffin, claimed the wig, offered it and reached actual `chapter0.complete`, without knockout. It did not use the tools while the Griffin was alive; no prepared-item benefit is demonstrated.

[Watch recording](../../evaluation-runs/live/c2-approved-recorded-2026-11-06/recording.webm) · [Preserved trace, summary, hashes and verification](evidence/traces/c2-approved-recorded-2026-11-06/README.md) · [Summary](evidence/traces/c2-approved-recorded-2026-11-06/summary.json). Full video decode and deterministic replay passed; final frame shows success and Chapter 0 completion. This was recorded at `19e5d87`, before r10's activation at `f9edeb7` and before C1. It is the official C2 cell; see "Situation C results" for this ordering deviation.

## Situation C results (declarations r10 and r11)

Scenario `griffin-prepared-return-v1`, seed 0, start `28777a85eebd55998461e7bbfff9ca36fd0bb0d68ba5d9888bc676acf84414d7` (tick 540) for all three runs. Design and owner decisions: [SITUATION_C_PREPARED.md](../../docs/midterm/SITUATION_C_PREPARED.md). The route metrics below come from each summary's `situationCReport`. They are descriptive only; success is the wig claimed, offered and `chapter0.complete`, with no knockout.

| | C1 pre-tuned (Pilot-34) | C3 post-tuned (Pilot-35) | C2 baseline |
| --- | --- | --- | --- |
| Player / guidance | `model-centralized`, gpt-6-luna medium, batch 4; no guidance | same + `c-post-v4-inventory-hint-v1` (v4 + hint) | `baseline-griffin-heuristic-v1` (unchanged B baseline) |
| Prompt hash | `6dc64411…` | `d50dc062…` (= C1 + one block) | none |
| Commit / declaration | `f9edeb7` / r10 | `24a3ba1` / r11 | `19e5d87` / r10 proposed (see deviations) |
| **Outcome** | **Success** | **Success** | **Success** |
| Route | Peaceful (grooming) | Peaceful (grooming) | Combat (Griffin defeated) |
| Griffin HP at tool delivery / wig claim / end | 418 / 418 / 418 | 640 / 640 / 640 | 0 (after defeat) / 0 / 0 |
| Griffin defeated | No | No | Yes |
| Tools delivered while the Griffin was alive | Yes (Mirror and Shears) | Yes (Shears, then Mirror) | No |
| Wig / offering / Chapter 0 complete | Yes / yes / yes | Yes / yes / yes | Yes / yes / yes |
| Game time / wall time | 133.3 s / 2,479.7 s | 56.3 s / 958.5 s | 89.8 s / 103.3 s |
| Decisions (Sieg / Coco) | 378 / 359 | 159 / 200 | 481 / 646 |
| Invalid actions | 2 | 1 | 0 |
| Model calls (failed / timed out) | 278 (0 / 0) | 163 (0 / 0) | 0 |
| Tokens in / out (cache read, write) | 5,449,743 / 179,558 (2,065,866; 3,383,043) | 3,024,600 / 71,352 (1,328,724; 1,695,387) | 0 |
| Mean / max latency | 8.35 s / 21.1 s | 5.46 s / 20.5 s | none |
| Cost (runner estimate) / ledger entry | $0.586742 / `pilot-34` | $0.287029 / `pilot-35` | $0 |
| End hash | `a5090db2…` | `8342ec05…` | `0e419e63…` |
| Replay at `24a3ba1` | Matches (734 results, 7,997 ticks) | Matches (357 results, 3,379 ticks) | Matches (1,126 results, 5,389 ticks) |
| Evidence | [pilot-34](evidence/traces/pilot-34-model-centralized-griffin-prepared-return-v1-seed0/manifest.json) | [pilot-35](evidence/traces/pilot-35-model-centralized-griffin-prepared-return-v1-seed0/manifest.json) | [c2-approved-recorded](evidence/traces/c2-approved-recorded-2026-11-06/manifest.json) |

Paid C total: **$0.873771** of the $1.50 combined cap (ledger: pilot stage $2.1304 left after Pilot-35). Videos are local-only (`evaluation-runs/live/…/recording.webm`), and their SHA-256 hashes are in each manifest.

**How to read C:**
- **Both model runs succeeded without fighting.** They delivered the prepared tools, the Griffin groomed itself, and they collected the wig and returned it. The baseline won by combat and demonstrates no use of the prepared items.
- **C3 is outcome-informed, C-specific supplementary tuning**, not an independent B-to-C transfer test. The owner added the inventory hint after C1's peaceful success was known (r11). C1 had already found the peaceful route without it.
- **The C1 to C3 difference is one guidance block** (the frozen v4 text plus the hint). C3 was faster (56.3 vs 133.3 game-s), cheaper and used fewer calls. With one run per cell, this cannot be attributed to the hint, to v4, or to run-to-run model variation. **It is not a statistical result.**
- **B vs C is not an inventory-only contrast.** The success rules differ (B requires a defeat), as does the prompt framing (B-return uses a task line; C uses the tutorial and a briefing).

**Deviations:**
- **C2 ordering and commit:** C2 ran at `19e5d87`, before r10's activation and before C1, whereas the declared order was C1 → C3 → C2. Between `19e5d87` and the run commits, only paid-lock, guidance and documentation files changed; game, baseline, observation, evaluator and scenario code are identical. C2 is deterministic: its end hash equals three earlier free runs, and it replays exactly at `24a3ba1`.
- **C3 configuration:** C3's configuration changed after C1 (r11). The r10 C3 (v4 only, prompt `a0c6939a…`) was never run.

### Interpretation of Situation C

Situation C tested whether the agents could recognize and use the tools already available in their shared inventory. Both model configurations independently reached the peaceful grooming outcome through normal gameplay. The pre-tuned agent discovered this route without the additional C-specific hint.

The post-tuned guidance emphasized existing game rules, inventory descriptions, and relevant abilities. It did not disclose the solution, provide coordinates, or prescribe an action sequence. The guidance was added after the earlier run, so the comparison measures a refinement to the agent's task framing rather than independent generalization to an unseen situation.

The post-tuned run completed the objective with fewer calls, less game time, and lower estimated cost. These are observed improvements, although a single run per condition does not establish their statistical reliability.

Results registry: [declared-results.json](../../docs/midterm/evaluation-abc/declared-results.json). Only the C rows were filled; the A/B rows are unchanged, and the previous file is archived in `history/r11/`.
