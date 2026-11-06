# Declared evaluation suite — Oath and Ember A/B/C

**Declaration:** `oath-ember-abc-2026-11-06-r1`, 2026-11-06, at the owner's
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
| A — Hedge Maze / existing `S2-local` | Frozen v2 seed 0, tick 405, both heroes at maze entrance | Authoritative shared `enchanted_shears` count > 0 | Implemented/frozen; Pilot-30 historical pre-tuned result available |
| B — Griffin Trial, Unprepared / `griffin-unprepared-v1` | Fresh 640-HP Griffin enclosure, both heroes grounded with normal abilities; no Mirror, Shears or wig | Griffin HP == 0 AND shared `griffin_wig` count > 0; neither hero knocked out | Design declared; legal prefix/hash/runtime registration pending |
| C — Griffin Trial, Prepared / `griffin-prepared-v1` | Same encounter and matched hero conditions as closely as legal histories permit; Mirror=1, Shears=1, wig=0 | Same strict predicate as B | Design declared; checkpoint pending; reserved from model-outcome tuning |

B/C end at the wig, not at goddess delivery or Chapter 0 completion. They fail
if a hero is knocked out or the party leaves the enclosure before success.
These evaluator conditions still need implementation/certification; no gameplay
rule is changed. A's original rules, travel allowance and limits stay intact.

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

- **Pre-tuned:** existing `model-centralized`, `gpt-6-luna` medium, batch 4,
  game/controller source `040685c`, the public manual and normal case objective;
  no explicit situation-specific solution prompt. Pre-tuned does not mean no
  earlier controller development. Pilot-30 is development-informed.
- **Post-tuned:** same model/controller/interface/limits, with documented prompt
  guidance, a distinct guidance/prompt/policy hash and visible prompt diff.
  Guidance is not weight fine-tuning. No controller change may be hidden inside
  the pre/post contrast. Guidance text/hash must be sealed before these trials.
- **Cheap baseline:** select the existing, unchanged **`baseline-quest` at
  `040685c`**, with implementation file SHA-256 values in the declaration JSON.
  It is deterministic, uses no model/API and costs $0 in provider charges.
  It is solution-aware and uses independent per-hero scripts/messages, whereas
  the centralized model has joint access to both permitted screens. Disclose
  that information/architecture asymmetry; it is not an uninformed competitor.

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

Declare **two repetitions per condition per situation**: 12 model episodes and
six free baseline episodes. This exceeds the written minimum of two live trials
per situation while also covering the owner's pre/post conditions. Pre/post
are different policies, not two repetitions of one policy.

Pilot-30 is allocated once as A/pre-tuned/1 **historical completed pilot**.
Its original registration, pilot ledger stage, hashes and status remain unchanged;
it is not retroactively a preregistered final run. The other 17 rows are unrun
(11 model, six baseline). See [declared-results.json](evaluation-abc/declared-results.json).
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
