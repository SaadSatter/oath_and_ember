# Evaluation — declared Hedge Maze and Griffin suite

**Oath and Ember · `saadsatter` · declaration `oath-ember-abc-2026-11-06-r2`.**
This report declares the three-case experiment and reports the evidence available
so far. **It is not a completed three-case comparison.** A is implemented/frozen;
B/C are declared designs awaiting legal checkpoint certification and integration.
No new model or baseline episode was run to write this report.

## Declared suite

| Situation | Initial condition | Authoritative success | Status |
| --- | --- | --- | --- |
| **A — Hedge Maze** | Existing S2-local v2, seed 0; both heroes at maze entrance | Enchanted Shears in shared inventory | Frozen; Pilot-30 post-tuned success preserved |
| **B — Griffin Trial, Unprepared** | Fresh enclosure, normal hero abilities; no Mirror/Shears/wig | Griffin HP zero AND wig acquired, with no hero knockout | Declared; checkpoint/runtime not implemented |
| **C — Griffin Trial, Prepared** | Same encounter/hero conditions as closely as legal histories allow; Mirror + Shears, no wig | Same strict condition as B | Declared; proposed model-outcome holdout; checkpoint pending |

These are three bounded tasks in the implemented Bald Goddess quest. They differ
in puzzle and relevant starting inventory, not an unused seed. Griffin trials
end at wig acquisition; they do not require goddess delivery or Chapter 0's
ending. Leaving the enclosure before success or any hero knockout fails B/C.
A's frozen rules are unchanged. The engine's automatic respawn means final
positive HP alone is insufficient to verify survival.

**Prepared tools permit peaceful grooming, but peaceful reward is not combat
defeat.** Under this declared strict goal, obtaining a wig while Griffin HP
remains positive fails. Prepared inventory tests decisions/goal adherence; no
claim is made that the tools buff combat. A broader peaceful-or-combat goal
would need an explicit new declaration revision.

The detailed specification, limits, information boundary, holdout rules and
matching caveats are in `docs/midterm/DECLARED_EVALUATION_SUITE.md`; machine
records are in `docs/midterm/evaluation-abc/declaration.json` and
`declared-results.json`. These paths are inside this folder after course packaging.
In the development repository they live at the repository root, alongside
`packages/` and `apps/`. New B/C logical names are not working CLI scenario IDs.
Their hashes remain null until approved legal reset certification.

## Conditions, baseline and repetitions

Each case has **pre-tuned model**, **post-tuned model** and **cheap baseline**
conditions, with **two repetitions per cell**: 12 model and six baseline episodes.
Pilot-30 is allocated once as historical A/post/1; the other 17 rows remain unrun.
This reuse does not retroactively make Pilot-30 a preregistered final trial.

- Model: `model-centralized`, `gpt-6-luna` medium, batch 4, game/controller
  observed post-tuned snapshot `040685c`. One planner sees both permitted hero observations and
  directs two legal controllers; it is not two independent LLM agents.
- Pre-tuned: intended comparator without situation-specific tuning; no A trial is registered in this condition. Its actual snapshot/provenance must be documented.
- Post-tuned: Pilot-30 is the owner-confirmed completion. Its preserved policy/prompt/config hashes identify the observed run, but the exact tuning intervention and before/after diff are not yet independently documented. Do not infer a particular guidance block or weight fine-tuning.
- Cheap comparator: existing unchanged `baseline-quest` at `040685c`, free of
  model/API calls. It has hand-coded solution knowledge and independent hero
  scripts/messages: an information and architecture asymmetry, not an uninformed
  comparison. Implementation file checksums are in the declaration.

The quest baseline is forecast from source to fail strict B/C: it never attacks
in the unprepared enclosure, and uses peaceful grooming when prepared. Those
are not measured new-case failures. Its successful A reference is separate from
the declared baseline trials and has not been silently registered in their place.

## Current comparison table

| Situation | Pre-tuned model | Post-tuned model | Cheap baseline |
| --- | --- | --- | --- |
| A | 0/2 run | **1 success / 1 observed trial**, historical post-tuned pilot; second repetition unrun | 0/2 declared trials run; historical free success exists |
| B | 0/2 run | 0/2 run | 0/2 run |
| C | 0/2 run | 0/2 run | 0/2 run |

“0/2 run” means no outcomes, not two failures or a 0% success rate. Do not combine
unequal tasks or earlier versions into an aggregate improvement claim.

### Pilot-30 — preserved A/post-tuned evidence

| Field | Recorded/verified value |
| --- | --- |
| Outcome | Success: shared Enchanted Shears acquired |
| Game time / decisions | 5,369 ticks / 89.5s; 647 decisions (401 Sieg, 246 Coco) |
| Wall time | 1,958.1s |
| Model calls | 167; 0 failed/timed out; 27 replies rejected as unusable, still charged |
| Invalid actions | 2; separately, one legal game refusal not counted invalid |
| Tokens | 3,678,281 input (cache included); 171,240 output, including 133,504 reasoning |
| Latency | Mean 11,048ms; maximum 20,515ms per call |
| Estimated charge | $0.443258; ledger settlement recorded $0.443259 (rounding difference) |
| Model / commit | `gpt-6-luna` medium / `040685c` |
| Policy | `centralized-f0592888(openai:gpt-6-luna@medium)·batch4·tutorial-2ec2f251·briefing-a97d9268` |
| Start hash | `fdc498771fe89a1ac96fb1ce8bd972c38ad96e84bdeb18b195292e42e20203ca` |
| End hash | `6deca1132fc2e6268ff841a1b912c754127d31e740538bc662b1fd31bb9b0ec0` |

[Preserved trace, summary, manifest and video link](evidence/traces/pilot-30-model-centralized-S2-local-seed0/README.md).
The archive's seven run files match their original local bytes and manifest
hashes; its 3,823-line trace chain verifies and totals match the unchanged
registration. The local video SHA also matches. Prior audit records the legal
replay, complete video decode and terminal overlay; those checks were not rerun
for this declaration. Full policy/prompt/config/manual hashes and caveats are
in `docs/midterm/PILOT30_AUDIT.md` and `evaluation-abc/A-posttuned-pilot30.json`.
The registration's original suite hash and pilot status are retained.

The runner's price source was dated 2026-10-28 with a 1.1 uplift; this is an
estimate, not the provider's actual bill. Prices must be checked again before
new paid calls. No current provider pricing or account balance is asserted here.

The owner corrected the earlier pre-tuned classification: Pilot-30 is **post-tuned**. The old metadata is archived, not counted as another trial. Preserved prompt hashes alone do not establish what tuning occurred. Until the tuning diff and pre-tuned snapshot are documented, a prompt-only or matched-repeat claim is unsupported.

## Fairness, holdout and history

C is reserved from model-outcome tuning. Freeze both pre/post policies, baseline,
manual/guidance/config hashes and B/C starts before any C model outcome. C's
post condition transfers A/B-developed guidance only; no C-specific walkthrough
or first-C-result adaptation is allowed. Fixed C order: pre/1, post/1, post/2,
pre/2, baseline/1, baseline/2. Keep every failure and interrupted attempt.

A has already informed many pilots, and this declaration occurs after Pilot-30.
It is not a held-out or historically preregistered result. Griffin mechanics
and solution-aware engineering routes were known to developers before this
revision; the holdout claim concerns model-outcome tuning, not unseen mechanics.
B/C legal histories may differ in prior flags/claims/journal as well as inventory;
freeze a near-matched relevant encounter and publish the residual differences.
No artificial item injection, healing, teleport or flag cleanup is permitted.

The older maze-only report and its failures/results are retained byte-for-byte
in [EVALUATION_HISTORY_BEFORE_ABC_DECLARATION.md](EVALUATION_HISTORY_BEFORE_ABC_DECLARATION.md). It is
historical evidence, not the current suite or a pooled comparison. Historical
S2-B/S2-C and S4/F retain their own definitions; new Griffin cases do not inherit
their labels, hashes, rewards or trial counts.

## Interface, limits and reproduction

The server owns truth. Players use only `reset(seed)`, `observe(player_id)`,
`legal_actions(player_id)`, `step(player_id, action)` and `outcome()`. Observations
are rendered screen facts, visible dialogue, backpack, journal and remembered
observations. No repository, answer key, hidden puzzle flags or engineering
traces are passed to players. Legal lists and engine validation enforce normal
roles, reach, collision, cooldowns, item ownership and dialogue turns.

Simulation is 60Hz; timed actions last at most 60 ticks and advance only when
both heroes have actions. Provider latency consumes wall time, not game time.
Declared run limits: 300 game seconds, 1,600 decisions/400 calls/4M tokens per
hero, 30s call timeout, three consecutive policy failures, $0.75 per model episode,
3600s model wall time / 600s baseline wall time. A's frozen definition is not
changed by the lower experiment spend cap. Failed/aborted calls count; unknown
usage stays unknown. B/C enforcement and extra failure categories remain pending.

From the project root (this folder after course packaging), setup/play/test
commands are in [README.md](README.md). Existing free A evaluation command:

```sh
node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S2-local --seeds 0
```

That command writes a new free run; it does not replay or replace Pilot-30.
There is deliberately no command pretending B/C are registered. New paid runs,
registration, checkpoint certification and final access need separate approval.
Records must include all outcome, latency, cost, configuration and trace fields
specified by the declaration, plus case/condition/repetition. No paid call was
made to prepare this document.

## CI evidence and remaining checks

The course workflow source is `ci/midterm-saadsatter.yml`; the packaging tool
installs it as `.github/workflows/midterm-saadsatter.yml` in the course repository.
It runs this folder's deterministic script without model keys. Source-repository
workflow: `.github/workflows/midterm-ci.yml`.

| Required check kind | Existing source evidence | Remaining for declared B/C |
| --- | --- | --- |
| Rule invariants | Server/shared rule tests, including Griffin rules | Exact frozen case invariants |
| Legal/illegal actions | `environment.test.ts`, server inventory tests | Both-tool interactions and rejected actions at new checkpoints |
| Terminal outcome | Existing frozen A baseline / full-route tests | Strict defeat + wig and survival success/failure |
| Observed regression | `pilot6Fixes.test.ts`, `budget.test.ts`, documented navigation regressions | Preserve real regressions; do not replace with mirrored implementation tests |
| Episode limits | Environment, budget and reliability tests | New case boundary/no-knockout failure enforcement |

The last source verification documented in `COW_PASSAGE_FIXES.md` reports
passing typecheck/build and **1,263/1,264 tests**, with a pre-existing
`s2Shutdown` recorder-message failure. This is prior local evidence, not a new
all-green workflow run or certification of this documentation commit. No suite
or build was rerun for this documentation-only declaration. Latest green CI and
fresh course-package rehearsal remain pending; report skipped held-out cases
and permitted engineering checks honestly.

## Recording, playtest and memory requirement

The complete Pilot-30 live recording is linked in its evidence README. It is
about 32.7 minutes, so it is **not by itself the required 3–5 minute submission
recording**. Produce a clearly labelled excerpt or another permitted recording,
retain the full original and explain any cuts/speed changes; show actions and
limits and avoid implying uninterrupted complete play if edited. Do not modify
the original video. Add the final short link to both README and course PR.

A documented observed human playtest by someone else (anonymous), with no help,
still needs verified notes or an honest owner explanation of omission. The
current `PEER_NOTES.md` is a scaffold, not completed evidence. November 16
silent-playtester replies are a separate post-submission obligation.

Because the game is partially observed, a matched bounded-memory versus
observation-only comparison remains pending. Pre/post solution guidance is not
that comparison; older independent-agent versus centralized results also have
architecture confounds. A clean ablation needs a declared, approved design and
additional results; this report does not claim that rubric item is satisfied.

## Limitations and owner reflection

The declared experiment is incomplete: only one historical model trial is
registered, B/C checkpoints and their strict terminal checks are not certified,
and no new held-out outcomes exist. The baseline has solution knowledge and a
different coordination architecture; A was used for development; legally
prepared starts cannot be assumed to differ only in inventory. Two repetitions
per condition will still be a small classroom sample. Current CI has a known
failure and no fresh green run. The short recording, observed human playtest,
matched memory comparison and final course submission remain outstanding.

These are factual limitations, not the student's personal reflection. The
owner must supply their own decisions/reflection in this section and the
[agent-team log](AGENT-TEAM.md), using playtest observations or explaining their
absence. No first-person experience, playtester, review, run or approval has
been invented. See `docs/midterm/SUBMISSION_CHECKLIST.md` for remaining hand-in
requirements, including the Week 3 scope update, course PR and CourseWorks URL.
