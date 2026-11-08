# Submission readiness checklist — declared A/B/C suite

## Current status — 2026-11-06 declaration

[Declared suite](DECLARED_EVALUATION_SUITE.md), `oath-ember-abc-2026-11-06-r2`:
A Hedge Maze; B Griffin Unprepared; C Griffin Prepared. The owner supplied the
midterm guidelines; declaration/documentation is authorized, paid execution is not.

| Required item | Current status / remaining work |
| --- | --- |
| Declared three distinct situations/tasks | **Declared design complete**; B/C runtime not implemented/certified. A was already a tuning case, disclosed. |
| EVALUATION.md with suite, comparison, evidence, CI and limitations | Written in `midterms/saadsatter/EVALUATION.md`; original report archived byte-for-byte. Not a completed experiment or personal reflection. |
| Pre/post and cheap baseline conditions | Defined; existing unchanged baseline-quest selected; post-guidance hashes pending. |
| Two repeated live trials per situation | Owner decision (r5): one pre-tuned and one post-tuned model run per situation plus one baseline; six model + three baseline. A complete (Pilot-28, Pilot-30, baseline-quest); B/C unrun. Professor confirmation of this reading pending. |
| Legal frozen B/C starts | Pending approved certification, exact hero/encounter matching, hashes and preserved history diff; no fixture injection. |
| Strict defeat + wig / survival scoring | Declared; new evaluator/registration pending. Peaceful reward alone fails; automatic respawn requires knockout tracking. |
| C holdout | Reserved from model-outcome tuning. Seal both conditions before C; no C-specific walkthrough or outcome adaptation. No new C model result exists. |
| Five-operation information boundary | Existing adapter; new B/C integration requires tests and independent review. No gameplay/policy change in this declaration. |
| Memory vs observation-only comparison | Pending matched design/results; pre/post guidance is not a memory ablation. |
| Latest green deterministic CI | Pending. Prior documented local result 1263/1264, known s2Shutdown failure; typecheck/build passed. Do not claim this commit has new green CI. |
| Human observed playtest | **Notes included** in `midterms/saadsatter/PEER_NOTES.md`: friends, 2 November, about 45 min. The professor allows a non-classmate playtester (owner-reported). Session 2 (7 November, current build) was **observed without help** and reached Chapter 0 complete. Session 1 was assisted, on an earlier build. |
| Student-authored log/reflection | Owner must complete AGENT-TEAM.md and personal limitations using genuine decisions/playtest observations; no agent-authored first-person substitute. |
| 3–5 minute agent recording | **Done:** Pilot-39 showcase replay, 4 min 7 s (https://github.com/SaadSatter/oath_and_ember/blob/midterm/evaluation/docs/midterm/evidence/pilot-39-showcase-replay/replay.webm). Earlier note: full Pilot-30 live video preserved (~32.7min). Label excerpts/edits and retain original. Link from README and course PR. |
| Continuous showcase (excluded from A/B/C) | Pilot-39 **gameplay-complete** (offering accepted, 236.4 game-s); recorded `success: false`, `token_limit` during the finale dialogue, before `chapter0.complete`. Evidence preserved and replay-verified in `midterms/saadsatter/evidence/showcase/pilot-39-original/`. Reported in EVALUATION.md and README. **Submission video:** a 4-minute speed-1 trace replay (https://github.com/SaadSatter/oath_and_ember/blob/midterm/evaluation/docs/midterm/evidence/pilot-39-showcase-replay/replay.webm), labelled as a replay. The owner decided not to run v2. |
| README / Week 3 scope update | README updated; owner must post revision in Week 3 thread (not done by agent). |
| Course folder / one workflow / clean clone | Existing packaging script and course workflow template; rehearse final committed package and dependencies before submission. No course checkout overwritten. |
| Course PR and CourseWorks | Pending owner-approved push/PR, links to README/EVALUATION/log/playtest/video, PR URL on CourseWorks by Nov 7 11:59pm per supplied brief. No merge required; no force-push after deadline. |
| Later peer review | Three assigned recording notes in Week 3 replies before Nov 16; separate from pre-submission observed playtest. |

The rows below preserve the earlier checklist and its dates; their old
Hedge-Maze-only suite, budgets and pending baseline choices do not override the
current declaration. Old frozen runtime scenarios and original evidence remain intact.

## Historical checklist (2026-10-29 onward)

Prepared on 2026-10-29 by the Claude Code implementation agent, after the owner directed that the Hedge Maze (S2-local) be the primary evaluated episode. Statuses:
- **complete**: evidence exists and was checked in this session;
- **pending**: work remains that the owner or the agent can do;
- **blocked**: waiting on a decision or on someone outside this repository.

Rubric checks are those of [MIDTERM_GUIDELINES.md](MIDTERM_GUIDELINES.md). The earlier per-check status table is in [REQUIREMENTS_CHECKLIST.md](REQUIREMENTS_CHECKLIST.md). It is dated 2026-10-27 and is older than this list.

## Evidence and documentation

| Item | Status | Notes |
| --- | --- | --- |
| Hedge Maze evidence collected with a checksum manifest | complete | `midterms/saadsatter/evidence/`, generated by `scripts/midterm/collect_evidence.py`. `--verify` passes |
| Every published Hedge Maze number matches its `summary.json` | complete | The collector refuses to run if they differ |
| Trace hash chains verified | complete | All four packaged traces, pilot 11's committed trace and the ten inventoried historical traces |
| Replays verified against their traces | complete | The manifests of pilots 11, 12 and 13 name their trace's SHA-256 with `matchesTrace: true`. Pilot 12 was also re-checked with `replay-video.ts --check-only` in this session |
| Scripted baseline reproducibility | complete | Three offline runs plus the live run, all ending at `bf31311f…f936` |
| Live and replay recordings labelled | complete | `evidence/README.md`, `EVALUATION.md`, `README.md`, course PR draft |
| Baseline recording caveats documented | complete | The 43.1 s clock against the authoritative 49.8 s, the visible HUD hints, and `7022ea1+dirty`. The clock reading is owner-reported and was not re-measured |
| README, EVALUATION.md and the course PR draft describe the Hedge Maze scope | complete | The full quest is kept as the game context |
| Secret scan of the new evidence | complete | `scan_secrets.py`: 0 findings in 42 files |
| Video delivery (baseline live; pilots 12, 13 and 15) | **pending** | Not in git. Bundle with `collect_evidence.py --videos-out <dir>`, upload, link, then check that the link opens for someone outside the account |
| Choose the submitted recording (rubric 5c, 3–5 minutes) | **blocked: owner** | Only pilot 11's replay (234.6 s capture) is in range, and it shows the guided policy as a replay. Pilot 15's live video is about 19 min. The baseline video is not an LLM agent |
| Viewer final-clock mismatch (43.1 s shown, 49.8 s actual) | **pending: follow-up** | A separate fix to the viewer or recorder. Not changed here; `live.ts` was left alone as instructed |
| Limitations paragraph in the owner's voice | **blocked: owner** | The facts are listed under EVALUATION.md "Limitations" |
| AGENT-TEAM.md in the owner's voice | **blocked: owner** | The scaffold is unchanged by this work |
| Peer playtest notes (received and given) | **received: the human playtest notes serve as the peer notes**, because no class time was available for a classmate session (friends' session; the professor allows a non-classmate playtester); **given: not required** (owner decision, following the professor's clarification) | Due November 6 |
| Generated sprites' terms confirmed for publication | **blocked: owner** | README "Sources and terms" |
| Fresh-clone rehearsal and CI at the submitted commit | **pending** | The last rehearsal was at `c65dbe2`, before this documentation commit |
| Course PR opened and URL submitted on CourseWorks | **blocked: owner** | Not opened. No push or PR from this session |
| Situation A (S2-A, Full Hedge Maze) frozen as a label for S2-local | complete | [SITUATION_A.md](SITUATION_A.md): definition hash pinned by `situationA.test.ts`, baseline reproduced at seeds 0 and 1 (free) |
| Situations B (cow puzzle) and C (wolf and key) implemented and frozen | complete (no live trials) | [HEDGE_MAZE_SITUATIONS.md](HEDGE_MAZE_SITUATIONS.md). The baseline succeeds on B and reaches the tick limit on C (it cannot resume mid-maze; owner decision pending). The model trial matrix and budget are prepared, not run. The three-situation gap below now needs only the live trials |

## Rubric gaps and scope-approval risks

1. **Three situations.** The guidelines ask for at least three starting situations with two live trials each, or a reduced suite agreed with the instructor. The Hedge Maze comparison is one situation at seed 0. Three policies on one situation are not three situations. **No instructor agreement to a reduced suite is recorded.** (Affects 4b and 5a.)
2. **Held-out cases.** No held-out case (S4, F) and no final seed (100, 101) has been run for any player. (5a.)
3. **Post-hoc scope.** The suite was frozen on 2026-10-27 with S1–S4 and F. S2-local was added on 2026-10-28 and became the Hedge Maze in revision 2. Choosing it as the primary episode after pilots ran should be disclosed as such. The documents do so. (5a.)
4. **Professor approval.** The professor has not confirmed the suite. No approval of the Oath and Ember scope or of the Hedge Maze-only evaluation is stored in this repository. The owner-reported exception in [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md) covers the Bald Goddess checkpoint, not this narrowing. Nothing in this repository claims approval.
5. **Observation-only comparison.** `model-obs-only` has never been run. (5a: "compare bounded history with an observation-only player".)
6. **Unaided trials ended by hand.** Both `model-memory` trials are `manual_stop`. Neither reached an automatic limit. Pilot 15 is an interrupted trial. (3b is still met: limits are enforced in code and the reason is logged.)
7. **Unequal information.** `baseline-quest` is solution-aware and `model-guided` has a walkthrough. The quest baseline is a credible competitor (4b), but it knows the solution. The only scripted player without quest knowledge, `baseline-explore`, reaches the tick limit on S2-local (EVALUATION.md, scripted baselines). It is not in the Hedge Maze table or the evidence folder.
8. **Configuration drift.** The code changed between the two trials of each LLM policy (`llm.ts` hooks before pilot 12; the `model-memory` fix `a38d892` before pilot 15).
9. **Recording length and kind.** See the recording row above. (5c.)

## Owner decisions needed next

- Whether to ask the instructor for a reduced suite (the Hedge Maze plus which other cases) or to run more situations.
- Whether to authorize final or held-out runs, and on what budget (the ledger has $6.17 left in the pilot stage and $15 in the final stage).
- Which recording to submit, and where to host the videos.
- Whether to commit any video. The precedent is pilot 11's replay, committed at the owner's request; the others are not committed.

## P1 "Into the Forest" (added 2026-11-03)

| Item | Status | Notes |
| --- | --- | --- |
| P1 defined, frozen and tested (directed narrative situation from the Prologue's opening) | complete | [PROLOGUE_SITUATION.md](PROLOGUE_SITUATION.md). The definition hash is pinned by `prologueSituation.test.ts` |
| P1 scripted baseline (seeds 0 and 1) | complete | Success, 1,058 ticks, 161 decisions, 0 invalid. Evidence in `docs/midterm/evidence/p1-baseline/` |
| `game-rules-audit` on the P1 observation boundary | see the EVALUATION_SUITE change log | Required before any paid run |
| Independent `rules-reviewer` review of P1 | see the EVALUATION_SUITE change log | Required before any paid run |
| P1 model trials (`model-memory`, seeds 0 and 1; optionally `model-obs-only`) | **blocked: owner** | Paid. Estimated $0.09–$0.42 per episode; cap $0.60 |

P1 limits that remain:
- Success does not require Coco.
- P1 is not held out from development knowledge.
- With P1 the three-situation requirement is still not met: live trials and a held-out case are missing.

P1 review status (2026-11-03):
- `game-rules-audit` (self-check) and the independent `rules-reviewer` review are done; see the EVALUATION_SUITE change log.
- The baseline evidence is committed.
- Reviewer findings F1 (task line names the Goddess) and F2 (indoor camera bounds) block paid P1 runs until the owner decides.

P1 revision 2 (2026-11-03):
- Review findings F1, F2, F4 and F6 are fixed and F5 is confirmed (see the EVALUATION_SUITE change log).
- Revision 1 and its evidence are kept.
- Paid P1 runs remain blocked until revision 2's audit and independent review are recorded and the owner approves a run.

P1 revision 3 (2026-11-03):
- Final freeze before the first live trial, with the label `gap in garden fence`. Prompt pins added.
- One paid `model-memory` trial (seed 0, $0.15 cap) is approved, subject to the preflight gates.

P1 first live trial (2026-11-04 UTC): `model-memory`, seed 0, **success**, $0.111. Evidence: `docs/midterm/evidence/p1-v3-trial1-model-memory-seed0/`, with a trace-verified replay video. One trial only; a second P1 trial needs the owner's approval.
