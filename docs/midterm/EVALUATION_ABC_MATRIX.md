# Declared A/B/C evaluation: pre-tuned, post-tuned and cheap baseline

Declared 2026-11-06 as `oath-ember-abc-2026-11-06-r1`. [Full specification](DECLARED_EVALUATION_SUITE.md). Design declared; no new Griffin checkpoint implemented or run.
Machine-readable counterpart: [matrix.json](evaluation-abc/matrix.json).
Separate approval proposal: [Griffin feasibility](GRIFFIN_EVALUATION_FEASIBILITY.md).
Pilot-30 preservation/audit and registration were verified first and remain intact.

| Situation | Pre-tuned model | Post-tuned model | Cheap baseline |
| --- | --- | --- | --- |
| **A — Hedge Maze**: frozen S2-local seed 0; obtain Enchanted Shears | **Pilot-30 success**, one completed pilot: 89.5 game-s, 167 calls, $0.443258; [unchanged record](evaluation-abc/A-pretuned-pilot30.json) | Pending; [A-only guidance proposal](SITUATION_A_POST_TUNING_PROPOSAL.md), not implemented | Pending; selected unchanged `baseline-quest` |
| **B — Griffin Trial, Unprepared**: enclosure, no Mirror/Shears; defeat Griffin and acquire Divine Wig; survive | Pending | Pending documented B-derived guidance | Pending; selected unchanged `baseline-quest` |
| **C — Griffin Trial, Prepared**: near-matched enclosure start, Mirror + Shears; same strict goal; proposed holdout | Pending; freeze policy before C outcomes | Pending; transfer only, no C-specific walkthrough or outcome tuning | Pending; `baseline-quest`, frozen before C |

“Pre-tuned” means before explicit situation-specific solution prompting, not
before controller development. Pilot-30 is the preserved `model-centralized`
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
Pilot-30 is allocated once as historical A/pre/1; original pilot status remains unchanged. The existing baseline is now selected. Checkpoint certification, runtime integration and all new paid execution remain approval-gated. No paid call, merge or push was performed for this update.

Pilot-30's original live video remains linked from its [preserved evidence
README](../../midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/README.md).
No recording/evidence file or release asset was modified.
