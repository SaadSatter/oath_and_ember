# Griffin evaluation feasibility — basis for declared suite

> **Revision 5 (2026-11-06):** the owner changed the allocation to one pre-tuned, one post-tuned and one baseline run per situation. Statements below about two trials per cell describe declaration r1. Current design: [DECLARED_EVALUATION_SUITE.md](DECLARED_EVALUATION_SUITE.md).

2026-11-06. **Update:** [declared design r1](DECLARED_EVALUATION_SUITE.md) now retains strict defeat/no-knockout scoring, selects unchanged baseline-quest and allocates two repetitions per cell. Runtime checkpoints/certification remain unimplemented; earlier options below are feasibility discussion, not permission to change the declared goal. Documentation/source review only, based on preservation commit
`0a89094`. **No new Griffin configuration was implemented, reset, replayed or
run.** No gameplay, policy, frozen scenario, paid runner or Pilot-30 evidence
was changed. Pilot-30 preservation/re-registration recheck was completed first
([audit §7](PILOT30_AUDIT.md#7-preservation-recheck-and-revised-evaluation-planning-codex-2026-11-06)).

## Proposed tasks (supersede earlier B/C planning only)

| Situation | Start | Requested success |
| --- | --- | --- |
| A — Hedge Maze | Existing frozen S2-local seed 0 | Shared Enchanted Shears acquired. Pilot-30 is the existing single successful pre-solution-prompt-tuning model trial; preserve all original evidence. |
| B — Griffin Trial, Unprepared | Both heroes at fresh Griffin enclosure; no Mirror, Shears or wig; ordinary abilities | Defeat Griffin AND acquire Divine Wig; both heroes survive. |
| C — Griffin Trial, Prepared | Same encounter/hero conditions as closely as legal history permits; shared Mirror + Shears, no wig | Same strict defeat AND wig acquisition and survival condition. Proposed model-outcome holdout. |

B/C are new proposals. No scenario IDs, ticks, limits or state/definition hashes
are frozen by this document. The older S2-B/S2-C remain historical frozen maze
scenarios. The unmerged `ABC-C-wig-obtained-v1` checkpoint remains an archived
prior proposal, not the new prepared Griffin trial and not a source of its hash.

## 1. Legal reachability and reproducibility

**Unprepared:** the ordinary goddess opening permits north travel to the
Griffin Enclosure without earning either tool. Both heroes travel normally.
Stop after entry before movement into the encounter, with grounded heroes,
normal abilities, a fresh 640-HP griffin and no reward claimed. This path already
forms the beginning of the earlier legal combat checkpoint described below.

**Prepared:** the existing `suite.ts` `withMirrorAndShears` prefix earns both
items by ordinary maze/pond play, returning to the shrine. Ordinary north travel
then reaches the same fresh enclosure. This is the beginning of existing S4's
scope, but new C must have its own identity and a shorter/different terminal
condition. Neither S4 nor its frozen prefix/hash may be modified or relabelled.
Do not inject items, teleport, wipe flags or reset HP/cooldowns to match B.

After approval, certify and freeze per-hero legal action prefixes, source
commit, action SHA, full start hash and both public observations. Verify repeated
resets with fresh memories/accounting and two attempts from the same frozen
start. Match hero positions/facing, HP, all abilities/cooldowns, grounded state,
Griffin HP/phase/clock/position, pillars, target state and pending dialogue.
The entrance is outside normal nest aggro range, so a common dormant start and
legal waits for cooldowns are plausible; they have **not** been certified here.
Normal ability readiness, rather than a cooldown reset, is the target.

There is an unavoidable matching caveat: prepared heroes have a different
legal quest history. Maze/pond flags, inventory claim history, absolute tick
and potentially journal/dialogue history differ, not just two bag counts.
Find legal routes minimizing health/cooldown differences, preserve every
consequence, and publish a trusted world/public-observation diff. If relevant
combat starts cannot be matched, disclose this as a near-matched starting-state
comparison, not a pure one-variable causal experiment. Do not manufacture
exact equality by fixture edits or intentionally dying to restore HP.

## 2. Can the unprepared Griffin be beaten?

**Yes, there is prior legal engineering evidence; the new B is not yet certified.**
The earlier owner-authorized `0c8ef31` checkpoint work on
`codex/evaluation-suite-abc` earned a wig by actual combat without either tool:
opening → north enclosure → ordinary fireballs and guarding → 640 HP reduced
to zero → Coco flies to nest and collects wig. The subsequent frozen maze start
had one wig, neither tool, Sieg 100 HP and Coco 54.5 HP (HUD 55). See that
commit's `docs/midterm/evidence/wig-obtained-certification/summary.json`,
`initial-observations.json`, `wigCheckpointActions.json`, and same-session audit.
That was engineering feasibility, not a model result, not a new B/C trial, and
was **not rerun** in this review. Its final alive state alone is not a fresh
zero-respawn certification for the proposed combat episode.

Source corroboration: `damageGriffin()` accepts ordinary projectile damage
without checking either item. `GameRoom` resolves Coco's fireball hits and
Sieg's sword hits when grounded/in reach. `ensureGriffin()` awards the wig on
ordinary nest interaction after defeat, even with no tools. Flight is a normal
Coco ability; no item unlocks it. This supports feasibility without adding a
solution branch, boost or special controller. New B's exact checkpoint, limits
and survival witness still require approved offline certification.

**Survival needs an explicit definition.** The engine automatically respawns a
hero at 100 HP on a lethal hit; checking positive final HP is insufficient.
Recommended trial rule: neither hero is knocked out during the episode. The
adapter already observes lethal-hit respawns via the original damage call and
reports `KNOCKED_OUT`; a future evaluator can retain that fact and fail the
trial without changing game rules. Ordinary damage is allowed. Existing
positive-HP observations do not by themselves prove this stronger condition.

## 3. Material item effects — a success-definition conflict

The Mirror and Shears work through the ordinary nest target:

- Mirror delivery while Griffin is alive starts **GROOMING** and clears its
  active beam. Mirror without Shears leaves it cycling its hair inspection.
- Shears delivery permits the **CUT** phase. The tools are consumed once at
  CUT; the Griffin departs and leaves a wig for ordinary pickup.
- Both can be delivered by a plain `interact` at the nest, or individually
  with normal `use_item` actions and their owned item IDs.

This is a substantial change in encounter affordances, but it is a **peaceful
resolution**, not a combat defeat. `damageGriffin()` ignores damage while in
GROOMING and after wig claim. Peaceful completion can leave Griffin HP positive;
`puzzles.griffin.complete` is set when the wig is awarded on either route.
It must not be treated as proof that HP reached zero.

Therefore the requested strict predicate excludes the main benefit of the
prepared items. Prepared heroes can still fight first and collect the wig
normally; both tools need not materially aid that fight. Offering the Mirror
first may commit the episode to a non-combat reward path that cannot satisfy
strict defeat. Do not silently call that a combat success.

**Declared decision:** retain strict `griffin.hp == 0 AND
wig acquired AND no knockout` in B/C (the task currently requested), rather than silently adopting a broader “resolve encounter and obtain wig” goal allowing the peaceful
prepared route. The latter better tests the item advantage, but is a different
success definition and is not adopted here. Under this declaration, explain why the game's peaceful reward does not pass the strict evaluation.

## 4. Five-operation adapter and current centralized player

No new operation is needed. `reset/observe/legal_actions/step/outcome` expose
normal movement, attack/defend, abilities including Flight, `interact`,
`use_item`, and dialogue actions. Observations show Griffin position and its
rendered HP/phase label; the shared backpack exposes owned tools; the nearby
nest appears through the normal inventory target. Item success/failure and
wig acquisition are returned as ordinary feedback/backpack changes. Target
reach, collision, role, ownership and consumption are server validated.

Relevant source: `perception.ts` `griffinLabel`/Griffin props/backpack;
`actions.ts` item enum; `GameRoom` attacks; `apps/server/src/griffin.ts` nest
interaction. Existing route code proves a five-operation peaceful path with
both tools; that is source/prior engineering evidence, **not a new C run**.

Controller limitation to disclose: the centralized `fight` intention and cheap
combat helper select `kind: enemy`, whereas Griffin is drawn as a `creature`.
The convenience intention is therefore not a Griffin combat solver. Ordinary
attack/move/defend/ability actions remain available to the planner. No adapter
blocker to legal actions is identified, but no B/C model performance claim is
made and no controller/policy fix is implemented here. New paid scopes remain
blocked by current scenario/final-player allowlists pending explicit approval.

## 5. Existing scripted baseline (not run on new B/C)

`QuestBaseline` has an enclosure script, not a generic combat solution. Sieg
waits for Coco's shore message; Coco flies to the nest and interacts repeatedly.
Neither script attacks the Griffin or chooses a combat strategy.

| Requested condition | Source-based forecast, not a measured trial |
| --- | --- |
| B: unprepared, strict defeat + wig | Cannot complete via current enclosure script: no tool delivery or outgoing damage, no wig; Coco eventually reports script failure and idles, Sieg keeps waiting. |
| C: prepared, strict defeat + wig | Takes the peaceful grooming route, obtains wig and returns; HP-zero defeat condition is not met. Would fail strict scoring despite obtaining the reward. |
| C, if goal explicitly changed to wig acquisition only | Existing peaceful script is suitable in principle; exact new C reset/limits/survival compatibility remains unverified. |

No baseline was modified or run. Declaration r1 selects the existing unchanged **baseline-quest** comparator. Do not register old full-quest/maze baselines as these cells.
If using `baseline-quest`, label its hand-coded solution knowledge and score its
failures honestly. A different low-cost observation-based combat policy would
need separate approval and a frozen implementation; its success cannot be
promised. Do not tune it against held-out C outcomes.

## 6. Success, registration, freeze and names

The evaluator can already read shared `griffin_wig` ownership, and existing
milestones emit `holding:griffin_wig`. No current registered enclosure-only
preset ends on the new requested goal: S4 and F end at `chapter0.complete`.
After approval add a new evaluator predicate for actual HP-zero defeat plus
wig acquisition, retaining a no-knockout failure fact if survival is strict.
Stop at wig acquisition; goddess delivery/Chapter 0 is outside these tasks.
Do not use target interaction acceptance, a cast attempt or the broad
`griffin.complete` flag as sufficient success.

Suggested future IDs: `griffin-unprepared-v1` and `griffin-prepared-v1` (names
only, not registered). Bind both to a new manifest revision, legal prefix SHA,
start/world/observation hashes, bounds and terminal reasons; register C as held
out in the existing final-access mechanism. Keep A's v2 definition/start hash
and original Pilot-30 policy/config/evidence unchanged. Preserve old suite
hashes in historical results; do not replace A's recorded suiteHash with a
future unapproved one. New B/C hashes must stay null until actually certified.

The old S2-B/S2-C maze definitions, S4/F scopes and unmerged prior C checkpoint
have different semantics and hashes. They must not be reused as these Griffin
conditions. The active new plan supersedes their *planning labels* only, not
their code, frozen states or historical results. Inventory preparation does
not justify changing mechanics or cloning an altered world snapshot.

## 7. Pre/post/baseline matrix and C holdout protection

All three tasks plan (1) pre-tuned model, no explicit task-specific solution
block; (2) post-tuned model with documented guidance; (3) cheap baseline TBD.
Pre/post means prompting, not weight fine-tuning. Preserve Pilot-30 as the
single successful A post-tuned result, before explicit solution prompting but
after substantial controller development. Other cells are unrun.

For C's proposed holdout, **freeze both pre/post policies before any C model
outcomes**. Post-tuned C means transfer of guidance developed only on A/B,
not prepared-Griffin tuning or a C walkthrough. A's maze guidance stays scoped
to A. B-derived combat/general tool-assessment guidance may transfer if fixed
before C; no prepared nest sequence, route or C-specific instruction is supplied.
The unchanged common public manual and normal item/target descriptions remain
available and their hashes must be recorded. No tuning feedback from either C
condition is allowed between trials or after examining the first C condition.
An adapted prompt or baseline based on C outcomes contaminates the holdout.

Pre-register model/effort, source commit, controller, manual, base and guidance
hashes, limits, cost ceilings, trial order and failures. Keep policies/engine
identical across pre/post except the declared prompt block. If controller code
changes after Pilot-30, disclose the confound instead of calling it a prompt-only
comparison. Instructor trial-count confirmation remains needed: written course
rules require two live trials per situation, while the owner additionally asks
for pre/post/baseline cells. Declaration r1 selects two trials per cell (12 model episodes
plus six cheap baseline episodes), without authorizing execution; one pre + one post is
not two repetitions of the same policy. Whether Pilot-30 counts toward A's quota
is still recorded as pending, not retroactively changed.

## Declaration / implementation boundary

The owner authorized formal design declaration: strict defeat + wig/no-knockout,
unchanged baseline-quest and two repetitions per condition are selected in
[declaration r2](DECLARED_EVALUATION_SUITE.md). This is no longer merely a choice
among proposed suite rows. Runtime B/C checkpoints, matching certification,
survival/boundary enforcement, exact prompt seals, paid/final registration and
all new runs still require implementation/certification approval. A broader
peaceful-resolution success rule or changed baseline would require an explicit
new declaration revision. No C-specific tuning or walkthrough is authorized.
