# Declared A/B/C evaluation: pre-tuned, post-tuned and cheap baseline

Declared 2026-11-06 as `oath-ember-abc-2026-11-06-r5`. [Full specification](DECLARED_EVALUATION_SUITE.md). Design declared; no new Griffin checkpoint implemented or run.
Machine-readable counterpart: [matrix.json](evaluation-abc/matrix.json).
Separate approval proposal: [Griffin feasibility](GRIFFIN_EVALUATION_FEASIBILITY.md).
Pilot-30 preservation/audit and registration were verified first and remain intact.

| Situation | Pre-tuned model | Post-tuned model | Cheap baseline |
| --- | --- | --- | --- |
| **A — Hedge Maze**: frozen S2-local seed 0; obtain Enchanted Shears | **Pilot-28: no success**, stopped by the owner at the cow, 125.3 game-s; [record](evaluation-abc/A-pretuned-pilot28.json). Supplementary: [Pilot-29](evaluation-abc/A-supplementary-pilot29.json) | **Pilot-30 post-tuned success**, one historical pilot: 89.5 game-s, 167 calls, $0.443258; [record](evaluation-abc/A-posttuned-pilot30.json). Tuning: [A_PROMPT_TUNING.md](A_PROMPT_TUNING.md) | **Success**, `baseline-quest`, 52.1 game-s, $0; [record](evaluation-abc/A-baseline-quest.json) |
| **B — Griffin Trial, Unprepared**: enclosure, no Mirror/Shears; defeat Griffin and acquire Divine Wig; survive | Pending | Pending documented B-derived guidance | Pending; selected unchanged `baseline-quest` |
| **C — Griffin Trial, Prepared**: near-matched enclosure start, Mirror + Shears; same strict goal; proposed holdout | Pending; freeze policy before C outcomes | Pending; transfer only, no C-specific walkthrough or outcome tuning | Pending; `baseline-quest`, frozen before C |

The owner confirms Pilot-30 is **post-tuned**; the former pre-tuned label was wrong. Its tuning was planner prompt rules added after each failed pre-tuned run ([A_PROMPT_TUNING.md](A_PROMPT_TUNING.md)), with controller code changed in the same commits. Pilot-28 is the owner-designated A pre-tuned run; Pilot-29 is supplementary. Pilot-30 is the preserved `model-centralized`
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
requests pre/post/baseline conditions. Revision 5: one run per cell, six model and three baseline runs in total. One pre and one post run are two live model trials of different policies, not repeats of one frozen policy.
Pilot-30 is allocated once as historical A/post/1; original pilot status remains unchanged. The existing baseline is now selected. Checkpoint certification, runtime integration and all new paid execution remain approval-gated. No paid call, merge or push was performed for this update.

Pilot-30's original live video remains linked from its [preserved evidence
README](../../midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/README.md).
No recording/evidence file or release asset was modified.

## Revision 5 allocation (2026-11-06)

**Situation A is complete.** Pre-tuned: Pilot-28 (`678b86c`), stopped by the owner at 125.3 game-s while the cow still blocked the passage. Post-tuned: Pilot-30 (`040685c`), success in 89.5 game-s. Baseline: unchanged `baseline-quest`, success in 52.1 game-s (3,128 ticks, 395 decisions, 0 invalid actions, 6 messages, $0), end hash `6644f2ca…7f56`, run twice with identical actions and end hash ([record](evaluation-abc/A-baseline-quest.json)). **Pilot-29** (`327c34a`) is supplementary evidence of the intermediate tuning round, not a trial ([record](evaluation-abc/A-supplementary-pilot29.json)).

Pilot-28 was stopped by hand, not by an evaluation-defined terminal condition; whether it qualifies as the official pre-tuned attempt depends on the professor's rules. The pre/post difference is the planner prompt tuning in [A_PROMPT_TUNING.md](A_PROMPT_TUNING.md); controller code changed in the same commits. Remaining: B and C, four model runs and two baseline runs. Revision 4 records are archived under `evaluation-abc/history/`.
