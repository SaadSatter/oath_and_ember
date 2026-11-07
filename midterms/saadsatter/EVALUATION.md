# Evaluation — Oath and Ember

Declared suite: **`oath-ember-abc-2026-11-06-r9-pilot33`**. Implementation, launch commands and evidence are available directly in `oath_and_ember-eval`. This is a partial evaluation: C model runs and the C baseline remain unrun.

## Declared cases

| Situation | Start | Authoritative success | Status |
| --- | --- | --- | --- |
| A — Hedge Maze (`S2-local`, seed 0) | Frozen maze-entrance checkpoint; normal shared inventory | Enchanted Shears acquired | Frozen A unchanged; historical model pilots and heuristic baseline available |
| B — Griffin Trial, Unprepared — Goddess Return (`griffin-unprepared-return-v1`, seed 0; declaration r8) | Fresh 640-HP Griffin; both heroes full health/normal abilities; no Mirror, Shears or wig; legal opening/north-travel history | Griffin HP zero, wig acquired, normal goddess offering and actual `chapter0.complete`; no knockout | Legal checkpoint and rule-aware baseline verified; post-tuned Pilot-33 success preserved |
| C — Griffin Trial, Prepared (`griffin-prepared-v1`) | Proposed near-matched encounter with Mirror and Shears, no wig | Strict combat defeat and wig acquisition, no knockout; no return requirement | Not registered/certified or run; held out from model-outcome tuning |

B's return objective is the owner's latest amendment. B/C therefore differ in task scope as well as inventory; do not present them as a controlled inventory-only comparison. Prepared peaceful grooming can give a wig while Griffin HP remains positive and does not satisfy C's retained strict defeat predicate. No C-specific walkthrough or outcome tuning has been performed.

The separately reviewed **`griffin-unprepared-v1`** is preserved exactly as implemented in this checkout: enclosure-only combat and wig acquisition, with its original start, hash, boundary and review. It is not an alias of the return variant. Its earlier pre-run owner decisions remain in their original records; they do not authorize paid calls for the new return case.

## Conditions and primary trial allocation

Preserve the evaluation checkout's owner-approved **one primary run per condition per case**: nine primary cells (six model, three baseline). A/B each additionally have a second identical heuristic reproduction, reported as supplementary evidence rather than another primary cell. Six primary outcomes are available and three C cells remain unrun. This is not two independent repetitions of each model condition; a reduced/mixed-condition design must not be described as stronger evidence than it is.

| Situation | Pre-tuned model | Post-tuned model | Cheap baseline |
| --- | --- | --- | --- |
| A | 0/1 success: Pilot-28 manually stopped at cow | 1/1 success: Pilot-30 | 1/1 primary success; one matching supplementary reproduction |
| B | 0/1 success: Pilot-31 knocked out (run on `griffin-unprepared-v1`, see below) | 1/1 primary success: Pilot-33 v4; earlier Pilot-32 v1 failure retained | 1/1 primary success; one matching supplementary reproduction |
| C | 0/1 run | 0/1 run | 0/1 run |

“0/1 run” means no outcome, not a measured failure. Do not pool unlike tasks or treat deterministic repeated trajectories as independent statistical evidence.

## Recorded outcomes

| Run | Result | Game time | Wall time | Model calls | Invalid actions | Estimated API cost |
| --- | --- | --- | --- | --- | --- | --- |
| A pre-tuned — Pilot-28 | Manual stop; cow passage not cleared; no Shears | 125.267 s | 900.8 s | 79 attempted | See original diagnosis; not inferred | $0.094339 conservative charge; $0.085837 known usage |
| A post-tuned — Pilot-30 | Shears acquired | 89.5 s | 1958.1 s | 167 | 2 | $0.443258 runner estimate |
| A heuristic v2, primary / reproduction | Both Shears successes | 31.5 s each | 6.7 /6.4 s | 0 | 0 | $0 |
| B pre-tuned — Pilot-31 | Knocked out (Sieg) with the Griffin at 152/640; no wig | 50.1 s | 1486.5 s | 117 attempted, 0 failed | 1 | $0.265961 runner estimate |
| B Griffin heuristic v1, primary / reproduction | Both combat defeat + wig + goddess offering + Chapter 0 completion; no knockout | 89.8 s each | 6.7 /6.6 s | 0 | 0 | $0 |
| B post-tuned — Pilot-33 (v4) | Griffin defeated, wig acquired/offered, Chapter 0 complete; no knockout | 51.0 s | 2184.4 s | 251 | 1 | $0.554417 |
| Earlier B post-tuned attempt — Pilot-32 (v1) | Knocked out; retained failure, not erased by Pilot-33 | 47.5 s | 1048.5 s | 98 | 1 | $0.206005 |

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

## Recorded baseline videos (owner runs, November 6)

These are new live recordings at configured speed **1**, from clean commit `4c9cf9f`. Both runs succeeded with zero model calls, zero invalid actions and $0 API cost; their end hashes match the archived deterministic baseline results.

| Baseline | Video | Recording metadata | Outcome | Game time | Episode wall time |
| --- | --- | --- | --- | --- | --- |
| A — Hedge Maze | [Watch recording](../../evaluation-runs/live/S2-local-seed0-baseline-maze-heuristic-2026-11-06T20-12-22-947Z/recording.webm) | [Metadata](../../evaluation-runs/live/S2-local-seed0-baseline-maze-heuristic-2026-11-06T20-12-22-947Z/recording.json) · [Summary](../../evaluation-runs/live/S2-local-seed0-baseline-maze-heuristic-2026-11-06T20-12-22-947Z/S2-local-seed0/summary.json) | Success | 31.5 s | 103.8 s |
| B — Griffin and goddess return | [Watch recording](../../evaluation-runs/live/griffin-unprepared-return-v1-seed0-baseline-griffin-heuristic-2026-11-06T20-15-12-709Z/recording.webm) | [Metadata](../../evaluation-runs/live/griffin-unprepared-return-v1-seed0-baseline-griffin-heuristic-2026-11-06T20-15-12-709Z/recording.json) · [Summary](../../evaluation-runs/live/griffin-unprepared-return-v1-seed0-baseline-griffin-heuristic-2026-11-06T20-15-12-709Z/griffin-unprepared-return-v1-seed0/summary.json) | Success | 89.8 s | 236.2 s |

Videos are local files in `evaluation-runs/live/`, excluded from Git; the links work in this evaluation checkout. They are not yet public submission links. [Preserved metadata and SHA-256 manifest](../../docs/midterm/evidence/baseline-live-recordings/manifest.json) identifies the original files without changing them. The recorder reports successful save, readiness and final confirmation with no warnings; those metadata fields are not an independent visual verification of the terminal frame. File hashes/byte counts and summary outcomes were checked; full decode was not performed for this linking update.

Episode wall time differs from game time and from recording-session wall time; recording startup/finalization is not model latency. These recordings supplement the declared primary trials rather than replacing historical measurements.

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

## Verification and limitations

Typecheck and build pass in `oath_and_ember-eval`. Integration targeted suite: **78/78 tests in six files**, covering both heuristic policies, the live Griffin CLI, native reviewed Griffin scenario, frozen A and scripted behavior pins. Held-out refusal remains tested. No full-suite test run was launched concurrently with the other workstream. No paid calls, push or merge occurred.

C remains held out from model-outcome tuning. Freeze any final policies and C checkpoint before C outcomes. Model memory comparison, remaining model/C trials, fresh green full CI, a short normal-speed submission recording, human playtest and student-authored reflection remain separate requirements; no completed course hand-in is claimed. Both heuristics are incomplete and development-informed; success on these cases does not prove general puzzle/combat competence.
