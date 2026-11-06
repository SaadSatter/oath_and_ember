# Declared A/B/C evaluation: pre-tuned, post-tuned and cheap baseline

Declared 2026-11-06 as `oath-ember-abc-2026-11-06-r6-eval-integration`. [Full specification](DECLARED_EVALUATION_SUITE.md). B now has a legally reached unprepared return checkpoint; C is unchanged and unrun.
Machine-readable counterpart: [matrix.json](evaluation-abc/matrix.json).
Separate approval proposal: [Griffin feasibility](GRIFFIN_EVALUATION_FEASIBILITY.md).
Pilot-30 preservation/audit and registration were verified first and remain intact.

| Situation | Pre-tuned model | Post-tuned model | Cheap baseline |
| --- | --- | --- | --- |
| **A — Hedge Maze**: frozen S2-local seed 0; obtain Enchanted Shears | **Pilot-28 failure, manual stop at cow**, 125.3 game-s / 900.8 wall-s; one historical trial; [record](evaluation-abc/A-pretuned-pilot28.json) | **Pilot-30 post-tuned success**, one historical pilot: 89.5 game-s, 167 calls, $0.443258; [corrected record](evaluation-abc/A-posttuned-pilot30.json). Exact tuning diff still to document | **Heuristic v2 2/2**, 31.5 game-s, zero model calls |
| **B — Griffin Trial, Unprepared — Goddess Return** (`griffin-unprepared-return-v1`, r8): no Mirror/Shears; defeat Griffin, acquire wig, offer it and reach `chapter0.complete`; no knockout | **Pilot-31 failure, `knocked_out`** at 50.1 game-s (Griffin at 152/640), 117 calls, $0.265961; run on `griffin-unprepared-v1`, a different scenario, counted by owner decision; [record](evaluation-abc/B-pretuned-pilot31.json) | Approved and prepared, not run: guidance `b-post-a-transfer-v1` ([record](B_POST_TUNING_TRANSFER.md)) | **Rule-aware baseline 2/2 successes**, combat + goddess return in 89.8 game-s, zero model calls |
| **C — Griffin Trial, Prepared**: near-matched enclosure start, Mirror + Shears; same strict goal; proposed holdout | Pending; freeze policy before C outcomes | Pending; transfer only, no C-specific walkthrough or outcome tuning | Pending; `baseline-quest`, frozen before C |

The owner confirms Pilot-30 is **post-tuned**; the former pre-tuned label was wrong. Its precise tuning intervention is not independently documented, so do not assume a specific solution prompt or a prompt-only contrast. Pilot-28 is now the owner-designated A pre-tuned trial. Pilot-30 is the preserved `model-centralized`
result (one planner, two controllers), with original evidence and hashes.
Its single-trial/pilot status and whether it counts toward final quotas remain
unchanged. [Audit and preservation recheck](PILOT30_AUDIT.md).

New B/C designs and experiment limits are declared; their logical IDs are not runtime registrations and their checkpoint hashes remain pending. They replace the prior
*planning* rows “Partial Hedge Maze” and “Wig Already Obtained,” not the historical
frozen S2-B/S2-C or the unmerged older checkpoint's code/evidence. Do not reuse
those scenario hashes or register their results in these cells. A's historical
suiteHash remains as originally recorded; a new suite manifest is pending.

**Approval issue:** Mirror + Shears enable peaceful grooming and wig acquisition,
which does not reduce Griffin HP to zero. Under the requested strict defeat
predicate, that route is not success. The unchanged quest baseline has no
Griffin attack routine: source predicts failure on unprepared B and peaceful
reward without strict defeat on prepared C. These are forecasts, not new trials.
The declaration retains strict defeat. A change permitting peaceful resolution needs an explicit new declaration revision.

C can be a model-outcome holdout if both model conditions and the baseline are
frozen before any C model outcomes, with post-tuned guidance learned only on
A/B and no prepared-case walkthrough. No first-C feedback may guide the other
condition. Keep A's maze guidance scoped to A; B is no longer a maze suffix.
The normal common manual, observations and public item descriptions remain
available. Preserve and disclose earlier developer knowledge of Griffin mechanics.

Written guidelines require three distinct situations/tasks, two live trials
per situation, same-case baseline and heldout cases. The owner additionally
requests pre/post/baseline conditions. Declare two repetitions per cell: 12 model + six baseline episodes in total; do not silently
count one pre and one post as repeated trials of the same frozen policy.
Pilot-30 is allocated once as historical A/post/1; original pilot status remains unchanged. The existing baseline is now selected. Checkpoint certification, runtime integration and all new paid execution remain approval-gated. No paid call, merge or push was performed for this update.

Pilot-30's original live video remains linked from its [preserved evidence
README](../../midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/README.md).
No recording/evidence file or release asset was modified.

## Historical pre-tuned registration — Pilot-28 (declaration r3)

The owner designates Pilot-28 as **A/pre-tuned/1**. It failed to obtain Enchanted Shears and was manually stopped while the cow still blocked the passage. The [complete-trace diagnosis](agent-evidence/skill-runs/2026-11-05-pilot28-diagnosis.md) records **7,516 ticks / 125.267 game seconds (125.3 rounded)** and **900.8 wall seconds**; the owner recalled approximately 128 seconds. Use recorded elapsed time in results. The dry hedge was removed and the cow partially moved, but the key and Shears were not acquired.

Pilot-30 remains A/post-tuned/1, successful in 89.5 game seconds. Two historical model outcomes and two A heuristic baseline outcomes are allocated; 14 of 18 rows remain unrun (10 model, four baseline). Each A model condition still needs its second repetition. These pilots predate declaration and include planner/controller changes; they do not establish a prompt-only causal improvement or matched frozen-policy repeats. Missing Pilot-28 metrics remain null rather than inferred. No raw evidence, frozen configuration or paid run was changed. This revision supersedes earlier statements above that no pre-tuned A trial was registered.

## A comparator amendment (r4)

The owner requested a deterministic puzzle-rule heuristic with map memory and zero model calls. `baseline-maze-heuristic` replaces `baseline-quest` **for A only**; B/C selection and frozen situations are unchanged. See `docs/midterm/SITUATION_A_HEURISTIC_BASELINE.md` for algorithm, information boundary, four development failures and reproducible commands. Prior baseline-quest evidence remains historical, not relabelled. Both repetitions of the frozen new player are reported below, including failures. This supersedes A comparator selections earlier in this document.

## Historical A heuristic v1 outcomes

Frozen `baseline-maze-heuristic-v1` at `15edcd6`: **0/2 successes**, both `decision_limit`, 197.4 game seconds each, 0 invalid actions and 0 model calls/tokens/$0 API cost. Wall times 28.0 s /21.1 s. Both obtained the key and opened the gate but did not obtain Shears. Action/result fingerprints and start/end hashes are identical. Evidence: `docs/midterm/evidence/maze-heuristic-v1/manifest.json`. Four earlier development failures are disclosed separately. There are now four observed rows /14 unrun; B/C remain unrun. This supersedes earlier A baseline-pending counts.

## A baseline v2 amendment (r5)

Owner-requested follow-through after opening a gate: infer the crossing axis from observed walls and the hero's approach, cross the opening, prioritize unvisited far-side cells, and continue approaching visible interaction targets after an ineffective E press. Retrying requires a changed position. No chest coordinate, route waypoint or hidden gate flag is supplied. The active comparator is `baseline-maze-heuristic-v2`; prior v1 failures remain unchanged in `evaluation-abc/history/declared-results-r4.json` and `evidence/maze-heuristic-v1/`. Four v2 development attempts include three failures and one Shears success at 31.5 game seconds; these are development outcomes, not the frozen repetitions. V2 trial results follow after freeze. B/C and frozen A remain unchanged.

## Recorded active v2 outcomes

V2 frozen at `1de3b61`: **2/2 successes**, **31.5 game seconds / 1890 ticks** each; decisions 367 Sieg / 306 Coco; zero invalid actions, model calls/tokens or API cost. Wall times 6.7 s / 6.4 s. Both authoritative Shears milestones, trace hash chains and deterministic gameplay fingerprints verified. End hash `1287b39e69747d50c98005d23dd7c6ad5757975ca9e0555e329ac6d27a611b79`. Evidence: `docs/midterm/evidence/maze-heuristic-v2/manifest.json`. Both clean runs use the same policy and frozen A start. V1's 0/2 failures remain historical, not replaced in its archived evidence. Fourteen active-suite rows remain unrun; B/C unchanged.

Validation: typecheck and build passed; 64/64 targeted tests passed across maze heuristic, Situation A, central progress and scripted freeze tests. The original route baseline pins and frozen A remain unchanged. No full-suite concurrency, paid calls, held-out runs, game changes or recording claims.

## B scope/comparator amendment (r6)

B is now **unprepared Griffin combat plus goddess return**, using `griffin-unprepared-return-v1` and `baseline-griffin-heuristic-v1`. It requires Griffin HP zero, wig acquisition and actual `chapter0.complete`, with no knockout. C remains the prepared enclosure/wig task; their scopes now differ, so B/C are not an inventory-only contrast. The legal B checkpoint and observation-only combat/return baseline are implemented; no model or C run is authorized. Details and knowledge disclosure: `docs/midterm/SITUATION_B_HEURISTIC_BASELINE.md`. This supersedes earlier B-not-implemented, B-enclosure-only and B-baseline-quest statements. A and all historical evidence remain unchanged.

## Recorded B baseline results

B baseline frozen at `fbc3627`: **2/2 successes** in **89.8 game seconds / 5389 ticks** each. Decisions 481 Sieg / 646 Coco. Wall times 6.7 s /6.6 s. **0 invalid actions, 0 model calls/tokens, $0 API cost, no knockout**. Both authoritative traces record Griffin defeat, wig acquisition, offering acceptance and Chapter 0 completion, with valid hash chains and identical gameplay fingerprints/end hashes. End hash `a454145029bba5ad3a669aca2852a4db768536a943946be6720f43435d51275c`. Evidence: `docs/midterm/evidence/griffin-heuristic-v1/manifest.json`. A regression still succeeds with its pinned end hash `1287b39e…`; C has not been run.

Typecheck/build passed. Broad targeted verification: 77/77 tests in five files (B baseline, suite, environment, Situation A and scripted pins). After the final B-only private defeat milestone, 43/43 affected tests passed. No full-suite concurrency or paid/held-out player run. Initial prefix and metadata-test failures were fixed and rerun; development outcomes are retained. Baseline/player information remains observation-only. Twelve active rows remain unrun (10 model, two C baseline); A/B model trial requirements are not complete. Identical deterministic repeats do not establish statistical certainty.

## Evaluation-checkout integration

All A/B heuristic code, return-scenario registration, live launcher support and evidence are now present directly in `oath_and_ember-eval`. The reviewed `griffin-unprepared-v1` enclosure-only case is preserved; the active return variant is `griffin-unprepared-return-v1`. They have different starts/success predicates and must not be aliased or pooled. Prior model-run authorization for the old enclosure case does not authorize new paid calls here.

The evaluation checkout's owner-approved **one primary repetition per condition** is retained: nine primary cells, four observed (A pre/post models, A/B baseline), five unrun (B/C pre/post models and C baseline). A/B baseline run 1 is primary and run 2 is a supplementary deterministic reproduction; two identical trajectories are not independent statistical evidence. Archived worktree reports used 18 rows/two planned repetitions; that plan is historical and superseded here. Original evidence bytes and hashes retain their source commit provenance.

Use this checkout directly for live watching/recording:

```sh
cd /Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval
npm run eval:live -- --scenario S2-local --seed 0 --player baseline-maze-heuristic
# Or, as a separate run:
npm run eval:live -- --scenario griffin-unprepared-return-v1 --seed 0 --player baseline-griffin-heuristic
```

The original heuristic archives contain traces/summaries, not videos. A new live run records `recording.webm` and `recording.json` in its printed output folder. Source worktree history is archived under `evaluation-abc/history/parallel-worktree/`; prior native declaration/report under `history/pre-baseline-integration/`.
