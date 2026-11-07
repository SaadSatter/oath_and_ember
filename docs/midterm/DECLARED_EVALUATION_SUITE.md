# Declared evaluation suite — Oath and Ember A/B/C

**Declaration:** `oath-ember-abc-2026-11-06-r8-b-return` (supersedes r7 and r6; both archived byte for byte in [evaluation-abc/history/](evaluation-abc/history/)), 2026-11-06, at the owner's
request against the supplied midterm guidelines. Machine-readable specification:
[evaluation-abc/declaration.json](evaluation-abc/declaration.json).
**This declares the experimental design; it does not claim that B/C runtime
checkpoints exist, that all trials are complete, or that paid execution is approved.**

## Bounded scope and cases

The implemented game is the Bald Goddess quest. The evaluation uses three
bounded tasks within it, not the whole quest as one long episode. Cases differ
in puzzle/encounter and relevant starting inventory, not unused seed values.

| Label / logical ID | Initial state | Success | Status |
| --- | --- | --- | --- |
| A — Hedge Maze / existing `S2-local` | Frozen v2 seed 0, tick 405, both heroes at maze entrance | Authoritative shared `enchanted_shears` count > 0 | Implemented/frozen; Pilot-30 historical post-tuned result available |
| B — Griffin Trial, Unprepared — Goddess Return / `griffin-unprepared-return-v1` (r8) | Fresh 640-HP Griffin enclosure, both heroes grounded with normal abilities; no Mirror, Shears or wig; tick 540, start `45b1a6aa…` | Griffin HP == 0 AND wig acquired AND `chapter0.complete`; neither hero knocked out | Baseline 2/2 successes; post-tuned approved and prepared, not run; pre-tuned (Pilot-31) ran on `griffin-unprepared-v1`, a different scenario |
| C — Griffin Trial, Prepared / `griffin-prepared-v1` | Same encounter and matched hero conditions as closely as legal histories permit; Mirror=1, Shears=1, wig=0 | Griffin HP == 0 AND wig acquired; no knockout (no return required) | Design declared; checkpoint pending; reserved from model-outcome tuning |

B requires goddess delivery and Chapter 0 completion; C ends at wig acquisition and retains its enclosure boundary. Both prohibit knockout. B's evaluator is implemented; C still needs certification. No gameplay rule is changed. A's original rules, travel allowance and limits stay intact.

**Strict defeat is intentional in this declaration.** The prepared tools enable
peaceful grooming, but a peaceful wig with positive Griffin HP does not pass.
Their availability therefore tests goal adherence and choice among affordances;
it is not asserted to improve combat strength. Both tasks receive the same
plain goal and survival/boundary rules, without a route or nest walkthrough.
Changing the goal to allow peaceful resolution requires a new declaration
revision, not silently scoring it as a defeat.

## Legal starts and freeze

Reach both starts through ordinary five-operation gameplay. B takes the shrine's
north route without either tool. C earns both tools through ordinary maze/pond
play before north travel. Never inject inventory, reset HP, teleport, edit flags,
or change mechanics. Target the same dormant Griffin, hero positions/facing,
full-health/readiness, grounded state and intact pillars using legal play only.
If those targets cannot be reached, report the blocker before any model trial.

Legal histories necessarily differ in prior quest flags, claims, absolute tick
and perhaps journal/dialogue history. Publish a trusted diff and preserve these
consequences. Call the comparison near-matched unless exact relevant matching
is demonstrated; do not claim only inventory differs throughout the world.

Before B/C execution, commit the legal action prefixes, source commit, limits,
initial observations, prefix SHA and complete start/definition hashes. Repeat
reset/advance/reset and certify legal success/failure and survival monitoring.
Use seed 0 for every repetition of each case; model inference can vary while
starts remain identical. Different seeds alone are not additional situations.
B/C hashes remain null until certification. Runtime freeze is a pending gate,
not something this document fabricates.

A stays frozen at definition
`7efb771a7b91d35422b719676f09c9b36063c5d95ede2de9e5dc681dd93e0eab`, start
`fdc498771fe89a1ac96fb1ce8bd972c38ad96e84bdeb18b195292e42e20203ca`.
Do not rename or overwrite historical S2-B/S2-C, S4/F, or the previously
certified unmerged wig-return checkpoint. New logical IDs are not yet CLI IDs.

## Players and information

- **Pre-tuned:** intended model comparator without situation-specific tuning.
  Pilot-28 at `678b86c` is registered as historical A/pre-tuned/1 by owner designation. Pilot-30 belongs to post-tuned.
- **Post-tuned:** Pilot-30 is owner-confirmed post-tuned, with observed source
  `040685c`, recorded model `gpt-6-luna` medium, batch 4 and preserved prompt/
  policy hashes. The exact tuning intervention/diff has not been independently
  established. Do not infer a specific solution prompt or weight fine-tuning.
  Document and freeze that intervention before calling a new run a matched
  repeat. A pure prompt-only contrast cannot yet be claimed.
- **Cheap baseline for A:** `baseline-maze-heuristic-v2` frozen at `1de3b61`: deterministic puzzle-rule search with observed map memory, alternative pull positions and backtracking; zero model calls, no solution route or hidden map. Both repetitions are recorded successes; v1 failures are preserved separately. **B/C** retain unchanged `baseline-quest` at `040685c`, pending certification. Each baseline hero has separate memory; the centralized model sees both screens. Prior route-scripted A wins remain historical and are not relabelled.

All actions use the same validated five operations, same scene start and limits
within a case. Players receive normal rendered observations, backpack, journal,
legal actions and shared public manual; no repository tools, private flags,
engineering traces, route constants or source access. The model's single planner
sees both heroes' permitted views; this is not two independent LLM agents.
Griffin is a visible creature, so the existing enemy-only `fight` helper is not
a Griffin solver. Ordinary low-level combat/item actions remain available.

The unchanged baseline is expected, from source, to fail the strict Griffin
goals: it does not attack in B and takes peaceful grooming in C. Those are
forecasts, not measured results. A failing cheap comparator is still reported;
no C-specific branch or alternate baseline may be substituted after outcomes
are seen. Any baseline change needs a new declared revision and retesting.

## Trial allocation and C holdout

**Classification correction:** revision 2 moves Pilot-30 from the mistaken pre-tuned cell to post-tuned. Revision 1 and original misclassified metadata remain archived; raw run evidence is untouched.

Declare **one primary repetition per condition per situation**: six model episodes and three baseline episodes, preserving the evaluation checkout's owner-approved plan. A/B baseline second repetitions are supplementary. This exceeds the written minimum of two live trials
per situation while also covering the owner's pre/post conditions. Pre/post
are different policies, not two repetitions of one policy.

Pilot-30 is allocated once as A/post-tuned/1 **historical completed pilot**.
Its original registration, pilot ledger stage, hashes and status remain unchanged;
it is not retroactively a preregistered final run. Two A heuristic baseline trials are also recorded. The other 14 rows are unrun
(10 model, four baseline). See [declared-results.json](evaluation-abc/declared-results.json).
A post-hoc declaration cannot establish that A was reserved before its earlier
tuning; disclose this limitation rather than rewriting history.

A/B may supply development feedback. Freeze both pre/post policies, baseline,
manual, model settings, guidance hashes, B/C start hashes and trial order before
**any** C model outcome. No C-specific solution walkthrough, prepared-case
strategy block or C outcome-driven prompt/controller change is allowed.
C's post-tuned condition means transfer of guidance developed on A/B only.
A's maze guidance stays A-only. The ordinary shared manual and item descriptions
remain available. Do not inspect a first C result and adapt the other condition.
Any such adaptation contaminates the holdout and requires a new held-out case.

Final C order: pre/1, post/1, post/2, pre/2, baseline/1, baseline/2. Do not replace
failures or pick the best trials. Log interrupted/aborted episodes, attempted
calls, invalid actions, unusable replies, unknown usage and costs. Preregister
A/B run order and all remaining hashes before execution as well.

## Limits and reporting

Declared run bounds: 18,000 ticks / 300 game seconds, 1,600 decisions, 400 calls
and 4M tokens per hero, 30-second call timeout, three consecutive policy failures,
3600s model wall time / 600s baseline wall time, $0.75 model episode spend cap.
A's frozen definition still permits its original $1.25 maximum; $0.75 is the
experiment's lower run cap, matching Pilot-30. New B/C enforcement is pending.
The maximum additional primary-model authorization would be 11 × $0.75 = $8.25;
this is a ceiling proposal, not a charge, available balance or paid approval.
Prices/availability must be checked again before future paid calls.

One scheduler owns game ticks at 60Hz; timed actions last at most 60 ticks.
Simulation waits for both heroes' actions, so provider latency consumes wall
time, not game time. Prefix game time is excluded; disclose reset/preparation
wall time separately. Terminal reasons include success and tick/decision/call/
token/spend/wall limits, policy errors and manual stop. New B/C no-knockout and
out-of-enclosure failure categories require evaluator integration, not game edits.

Store case/condition/repeat, outcome/reason, game/wall time, decisions, invalid
and game-refused actions, confirmed subgoals, calls/failed calls, latency,
input/output/cache/reasoning tokens, unknown usage, estimated/charged cost and
price date, trace/video paths and hashes, game commit, model/effort, policy,
manual/prompt/guidance/config and scenario/declaration hashes. Null means
unmeasured, never zero. Keep success by task; do not pool unequal workloads into
an unsupported claim of improvement or statistical significance.

## Required work that a declaration does not complete

The game is partially observed. A clean bounded-memory versus observation-only
comparison remains required/pending; pre/post solution guidance is not that
ablation. Existing observation-only and centralized policies also differ in
architecture, so a comparison must disclose the confound or implement an
approved matched ablation. No extra paid run is authorized here.

B/C legal reset/success/survival certification, paid/final registry gates,
short live recording, latest-green CI, independent review of new integration,
anonymous observed human playtest, owner-authored reflection/log, scope update
in the Week 3 thread, and course PR/URL submission remain tracked in
[SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md). Declaration is complete;
implementation, certification and the repeated experiment are not.

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

## Revision r7 (2026-11-06): B is `griffin-unprepared-v1`

Owner decision, recorded by the implementation agent. `griffin-unprepared-v1`, seed 0, is the official Situation B pre/post comparison. This is the scenario that Pilot-31 (B pre-tuned) actually ran on. r6 had declared `griffin-unprepared-return-v1` as B, so r6 counted Pilot-31 against a scenario it did not run on. r7 removes that mismatch.

- **Unchanged:** the scenario checkpoint, objective, success and failure predicates, limits and gameplay. Definition `bbbbc435…1374`, start `1a270d7b…0051`, tick 439, all as certified in [SITUATION_B_GRIFFIN.md](SITUATION_B_GRIFFIN.md).
- **Observation contract:** Pilot-31's. The straw-nest entry added in `4c9cf9f` is left out for this scenario only (owner-approved), as shown by the parity test `packages/agent/test/griffinObservationParity.test.ts`.
- **Post-tuned guidance:** `b-post-a-transfer-v1`, text `60a0a013…5263`, full prompt `54605c1b…5627` ([B_POST_TUNING_TRANSFER.md](B_POST_TUNING_TRANSFER.md)). One post-tuned run, not yet authorized.
- **Kept, not deleted:** `griffin-unprepared-return-v1` and its baseline results (2/2 successes) stay recorded as they were. They are on a different scenario from the r7 B model rows, and must not be pooled with them.
- **Open:** the B cheap-baseline cell on `griffin-unprepared-v1` has no allocated run. An unregistered free verification run of the frozen `baseline-griffin-heuristic-v1` on v1 succeeded (76.1 game-s, end `a66fbe08…`). It is information only until the owner allocates the cell.
- **Disclosure:** r7 was made after Pilot-31's outcome was known, and the post-tuned guidance was written after reading Pilot-31. The B pre/post contrast is tuning on B, not an independent transfer test.

Declaration SHA-256 (sorted compact JSON without the field): `b39116b3495dcdebd3eb2f84e1815fb6c7865b3bb7f021d92f32c106144bc442`.

## Revision r8 (2026-11-06): B is the return scenario again

Owner decision, recorded by the implementation agent. The B post-tuned run uses `griffin-unprepared-return-v1` and counts as **B/post-tuned/1**. B is again the return scenario, as in r6, and r7's choice of `griffin-unprepared-v1` (section above) is superseded. The r7 text stays above for the record.

- **Consequence: B pre and post are on different scenarios.** Pilot-31 (pre-tuned) ran on `griffin-unprepared-v1`. The two differ in start (tick 439 vs 540), success (wig vs wig + goddess offering + `chapter0.complete`), prompt framing (v1 tutorial + briefing vs the return task line with no tutorial or briefing) and observations (the return scenario lists the straw nest). The B pre/post difference is **not** a prompt-only contrast and must not be reported as a controlled prompt effect. Pilot-31's knockout fails both predicates, so it is a failure either way.
- **Baseline:** `baseline-griffin-heuristic-v1` (2/2 successes) is on the return scenario, the same as B post-tuned.
- **Post-tuned:** guidance `b-post-a-transfer-v1`, owner-approved (text `60a0a013…5263`), prompt on this scenario `17b89312d88c9da0f81bdea5344c58f149a046b9a86873d166821a74f4be96a6`. One run.
- **Disclosure:** post hoc (after Pilot-31), and the guidance was written after reading Pilot-31: tuning on B.

Declaration SHA-256 (sorted compact JSON without the field): `14525a1229a2c719c3064452e91e22245942821430cd222bc73642470c3fe8b2`.

## Pilot-33 preservation and owner result designation

Pilot-33 (`1f0ca45`, approved b-post-combined-v4) succeeded on `griffin-unprepared-return-v1`: 51.0 game-s, 2184.4 wall-s, 251 calls, 1 invalid action, $0.554417. The owner designates it B/post-tuned/1 after outcome; declaration r9-pilot33 records this amendment. R8's earlier v1 guidance and failed Pilot-32 ($0.206005, knocked_out) remain preserved, not replaced in their historical artifacts. Two post-tuning attempts span different guidance versions (one failure/one success), not repeated identical-policy trials. Six primary cells are observed; only three C cells remain unrun. See `midterms/saadsatter/EVALUATION.md` and `evaluation-abc/B-posttuned-pilot33.json`. No new paid call or policy/scenario change during preservation.

## Revision r10 (2026-11-06): Situation C activated

Owner final authorization, recorded by the implementation agent. The active declaration is `oath-ember-abc-2026-11-06-r10-c` ([declaration.json](evaluation-abc/declaration.json), self-hash `877001388470b6b153a6b5b2d3372f987aea83435ad233f6999bab215e0ef238`). It is the reviewed proposal ([proposed/declaration-r10-c.json](evaluation-abc/proposed/declaration-r10-c.json), `989046a9…`) with only these fields changed: id, status, supersedes, activation record and paid limits (tested). r9 is archived byte for byte in [history/r9/declaration.json](evaluation-abc/history/r9/declaration.json). The A/B rows, Pilot-28/30/31/32/33 records and B evidence are unchanged.

C is `griffin-prepared-return-v1` (seed 0, start `28777a85…`, tick 540): B-return's start with the Mirror and Shears injected. Success is the wig claimed by any route, offered to the goddess, and `chapter0.complete`, with no knockout. The design is in [SITUATION_C_PREPARED.md](SITUATION_C_PREPARED.md).

| Cell | Configuration | Prompt hash |
| --- | --- | --- |
| C1 | `model-centralized`, gpt-6-luna medium, batch 4, tutorial + the owner's briefing | `6dc64411b2373596f925360334680211657c266a3fe5487b4f687868740e3701` |
| C3 | C1 + `b-post-combined-v4` | `a0c6939af45f82a10ef80dfcbcd2c40c60ca82f01d91a55f330d624292fb9323` |
| C2 | `baseline-griffin-heuristic-v1`, unchanged | none |

**Paid authorization:** only `model-centralized` on `openai:gpt-6-luna@medium`, batch 4, seed 0, at most $0.75 per episode and $1.50 combined. One C1 run and one C3 run, in the order C1 → C3 → C2. The first valid result is recorded regardless of outcome, and there are no retries. This scope is enforced in code (`C_PAID_SCOPE`).

**Pre-activation checks:** price re-check on 2026-11-06 (the model page matches the runner's table); pilot ledger balance $3.004 with no open reservations; all C pins verified.
