# Pilot-30 evidence audit: Situation A, post-tuned (owner correction)

Pilot-30 is the first model-driven episode that completed the Hedge Maze. This audit checks its evidence against the files and registers it as Situation A's **post-tuned** model result. Done by the Claude Code implementation agent on 2026-11-06 at the owner's request. No paid call, no new model episode, and no change to gameplay, scenarios, policies, pins or the original files.

- Evidence (committed, byte-for-byte): [`midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/`](../../midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/README.md)
- Original run folder (local, gitignored, unchanged): `evaluation-runs/live/S2-local-seed0-model-centralized-openai-2026-11-06T08-17-52-847Z/`
- Evaluation record: [`evaluation-abc/A-posttuned-pilot30.json`](evaluation-abc/A-posttuned-pilot30.json). Matrix: [EVALUATION_ABC_MATRIX.md](EVALUATION_ABC_MATRIX.md)

## 1. Verdict

**Verified.** Every reported number matches the authoritative files, the trace's hash chain holds, and an offline replay of the recorded actions through the real engine at `040685c` reproduces every step result and the end hash. Pilot-30 can be cited as **Situation A's post-tuned model result: one successful trial**, with the caveats in section 5. It is one trial, not the two the guidelines ask for per situation.

## 2. Reported values against the files

| Metric | Reported | Verified value | Source |
| --- | --- | --- | --- |
| Outcome | Success | `status: success`, `reason: success`, `success: true` | `summary.json`; trace `terminal` and `outcome` lines |
| Success condition | Shears obtained | Trace line 3821: Coco's `interact` → "Collected Enchanted Shears." / "Shared backpack: +1 Enchanted Shears."; milestones `holding:enchanted_shears` and `claimed:hedge-shears-chest` at absolute tick 5,774. The evaluator's success rule (S2-A: `enchanted_shears` held in the authoritative shared inventory) produced `terminal: success` | trace |
| Game time | 89.5 s | 5,369 ticks from the start tick 405 (ends at absolute 5,774) | `summary.json`, trace |
| Wall clock | 1,958.1 s | 1,958.1 s (last trace line at 1,958,107 ms) | `summary.json`, trace |
| Decisions | 647 | Sieg 401, Coco 246; 647 `step` lines | `summary.json`, trace |
| Invalid actions | 2 | 2 `invalid_action` lines, both `advance_dialogue` when no line was waiting (Coco tick 421, Sieg tick 436) | trace |
| Messages | 0 | 0 (this player never sends messages) | `summary.json` |
| Model calls | 167 | 167 `model_call` lines: Sieg 106, Coco 61; all `ok`; 0 failed, 0 timed out, 0 unknown usage | trace |
| Charged cost | $0.443258 | Sum of per-call `chargedUsd`: $0.443258 | trace |
| Start hash | `fdc498771fe89a1a…` | `fdc498771fe89a1ac96fb1ce8bd972c38ad96e84bdeb18b195292e42e20203ca` | trace `reset` |
| End hash | `6deca1132fc2e626…` | `6deca1132fc2e6268ff841a1b912c754127d31e740538bc662b1fd31bb9b0ec0` | trace `terminal` |
| Ledger entry | pilot-30 | `pilot-30`, stage `pilot`, run `model-centralized/S2-local/seed0/040685c`, reserved $0.75, charged $0.443259, `settled` | shared ledger (read only) |

## 3. Checks run in this session

| Check | Result |
| --- | --- |
| Trace hash chain (`verifyTrace`, `packages/agent/src/trace.ts`) | Pass. 3,823 lines, seq 0–3,822, SHA-256 `6aa22739…31fb` |
| Offline replay (`scripts/midterm/replay-video.ts --check-only`, no model calls) | **REPLAY MATCHES THE TRACE**: start hash, 644 step results, end (success, `6deca113…`) and 5,369 ticks |
| Situation A identity (`scripts/midterm/situation-a.ts`) | Definition hash `7efb771a…0eab` and seed-0 start hash `fdc49877…` match the frozen v2 values; `summary.json` carries `evaluation: {label: "S2-A", definitionHash: 7efb771a…}` |
| Copies | All 7 committed files are byte-identical to the originals (`cmp` and SHA-256; [verification.json](../../midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/verification.json)) |
| Video (`scripts/evidence/verify-video.ts`) | Full decode clean: 49,064 frames, 1,962.56 s, 1280×720 VP8, 25 fps. Frames at 2, 25, 50, 75, 97 and 99.9% have real content |
| Terminal overlay | The final frame's header reads "finished: success · 89.5 s game time · 167 model calls · $0.4433" (viewed) |
| HUD hints not given to the model | The human HUD goal lines visible in the video ("cast Black Hole (3) into the cow's left flank", "Open the shears chest with E", …) occur **0 times** in the trace's 674 observations or elsewhere in the trace |
| Secret scan (`scripts/evidence/scan_secrets.py`) | 7 text files, 0 findings |

## 4. Identity and configuration

| Item | Value | Status |
| --- | --- | --- |
| Situation | A = S2-A v2 = scenario `S2-local`, preset `S2-local-v2`, suite revision 2, seed 0, episode `S2-local-v2-0-fdc49877` | Verified |
| Player | `model-centralized` (one planner, two legal controllers) | Verified |
| Policy id | `centralized-f0592888(openai:gpt-6-luna@medium)·batch4·tutorial-2ec2f251·briefing-a97d9268`, both heroes | Verified (trace `run` line, `summary.json`) |
| Prompt hash | `0616c47baf03f2860f75a4a0867221998b2439f51b55fde33c56111ec8240c44`, both heroes | Recorded in `summary.json`; not recomputed |
| Config hash | `1cf1224550d1d3f8333d13d5e77190548368d9620b4669fb2095144fe1dd300f` | Recorded; not recomputed |
| Manual hash | `4b091a6630dd56f236f89f8e2213a6bb7cad4a31d4851d1883f95867d92bfa86` | Recorded in `run.json` |
| Model and effort | `gpt-6-luna`, medium, on all 167 calls (requested and returned model id) | Verified per call |
| Tokens | Input 3,678,281 (of which cache read 1,238,526 and cache write 2,439,254), output 171,240 (reasoning 133,504) | Verified: per-call sums equal `summary.json` |
| Latency | Mean 11,048 ms, max 20,515 ms per call | Verified |
| Limits | 18,000 ticks; per hero 1,600 decisions, 400 calls, 4,000,000 tokens; 30 s per call; $0.75 episode cap; 3,600 s wall clock | Recorded; S2-A's frozen limits, with a lower cap than the suite's $1.25 |
| Game and policy commit | `040685c`, clean (no `+dirty`), in `run.json`, `live.json`, `summary.json` and the ledger run id. It is the current `midterm/evaluation` commit, so the game and policy are recoverable from it | Verified |
| Prices | gpt-6-luna list prices verified 2026-10-28, 1.1 uplift (`priceSource`) | Recorded |

## 5. Caveats and missing evidence

1. **Not the actual bill.** `chargedUsd` is the runner's estimate from dated list prices with a 1.1 uplift. The provider's billed amount is only in the OpenAI dashboard and was not checked.
2. **The ledger differs by $0.000001** ($0.443259 against $0.443258 in the summary): rounding when the entry settled. The ledger's remaining balances ($4.030561 pilot, $21.02764 total) match `live.json` exactly.
3. **Prompt and config hashes were not recomputed** from source. They are as the runner recorded them. The policy id `f0592888` matches the id `9f16035` introduced and `040685c` documents.
4. **One extra game refusal.** The metrics count 3 "rejected by game", the summary 2 invalid actions. The third is a legal `interact` at the key gate before the key was held (tick 3,836, "Select the correct key."). The interface offered it, the game refused it, and the runner does not count it as an invalid action. Both counts are correct for what they measure.
5. **27 unusable replies.** 27 of the 167 calls (Sieg 23, Coco 4) gave replies the planner rejected (`reply_rejected`); each was charged and is included above. They are not failed calls.
6. **The video is not committed.** At 202 MB it exceeds GitHub's 100 MiB limit. Its SHA-256 (`f5100df9…4414`) is in `verification.json`. Delivered as the GitHub release asset [pilot-30-model-centralized-S2-local-seed0-live.webm](https://github.com/SaadSatter/oath_and_ember/releases/download/pilot-30-evidence/pilot-30-model-centralized-S2-local-seed0-live.webm) (release [`pilot-30-evidence`](https://github.com/SaadSatter/oath_and_ember/releases/tag/pilot-30-evidence), pre-release, public). Uploaded unchanged; a downloaded copy was hashed on 2026-11-06 and matches.
7. **The video shows human HUD hints** that the model never received (checked above). This is the existing documented viewer caveat ([evidence README](../../midterms/saadsatter/evidence/README.md)).
8. **The centralized player is not two independent agents.** One planner sees both heroes' screens and nothing else. This is the owner-approved departure in [MODEL_CENTRALIZED.md](MODEL_CENTRALIZED.md), and the result must be reported under that player kind.
9. **Not held out.** Situation A was used for development across many pilots (9–30), so this is a tuning-case result.

## 6. Corrected tuning classification

**Owner correction (2026-11-06): Pilot-30 is a post-tuned model-driven
completion.** The previous pre-tuned classification and the inference that it
was before solution tuning are withdrawn. A recorded prompt/policy hash or the
absence of a `guided` suffix does not by itself establish tuning history.

The trace, metrics, model/policy/prompt/config identifiers and original evidence
remain unchanged. The precise tuning intervention and before/after prompt or
controller diff have not been independently documented in this correction;
no explicit walkthrough, weight fine-tuning or other mechanism is invented.
The corrected active record is `evaluation-abc/A-posttuned-pilot30.json`.
The old condition metadata is retained under `evaluation-abc/history/`, and
the former path is a supersession pointer, not an additional trial.

> Historical note for sections 7–8: they described the earlier mistaken allocation when written. The owner correction in section 6 and declaration revision 2 supersede any pre-tuned/pre-solution-tuning claims below; the preservation measurements still stand.

## 7. Preservation recheck and revised evaluation planning (Codex, 2026-11-06)

The original audit above and original evidence are preserved. This additive
follow-up inspected preservation commit `0a89094` in a separate documentation
worktree; it did not modify the active evaluation checkout or any original run.

- Rehashed all seven archived run files: every hash equals `verification.json`
  and every archived file is byte-identical to its local original. The local
  video also matches its recorded SHA-256. No video was uploaded/downloaded or
  decoded again; full decode and terminal-overlay inspection remain the earlier
  audit's verified checks, not newly performed checks.
- Re-ran `verifyTrace`: 3,823 lines, valid chain. Recounted 647 steps, 674
  observations, 2 invalid actions, 27 unusable replies and 167 model calls.
  Input/output totals are 3,678,281 / 171,240. Per-call charged amounts sum to
  $0.443258321, rounded to the registered $0.443258. Start/end hashes match the
  existing A pre-tuned registration. No game replay or model call was run in
  this follow-up. The original replay result remains documented above.
- The registration already exists and is complete as a **single completed
  pre-solution-prompt-tuning pilot**; no duplicate record or second trial is
  fabricated. `evaluation-abc/A-posttuned-pilot30.json` is unchanged, including
  its historical suite/schema hash, pilot status, policy identity and caveats.
  Prompt/config hashes, provider billing and ledger were not independently
  recomputed in this follow-up. Whether the pilot counts toward final trial
  quotas remains an owner decision.

Only after that preservation recheck, planning was revised at the owner's
request: **A = Hedge Maze**, **B = Griffin Trial, Unprepared**, **C = Griffin
Trial, Prepared**. B/C are proposals, not existing registered/frozen episodes.
All rows plan pre-tuned, post-tuned and cheap-baseline conditions. C is proposed
held out from model-outcome tuning; no C-specific walkthrough is authorized.
See [revised matrix](EVALUATION_ABC_MATRIX.md) and the separate
[Griffin feasibility proposal](GRIFFIN_EVALUATION_FEASIBILITY.md). No new
Griffin configuration was implemented, reset, replayed or run. Original A's
scenario, hashes and Pilot-30 evidence remain unchanged.


## 8. Declared suite revision (2026-11-06)

The owner subsequently requested formal declaration against the pasted midterm guidelines. [Declared A/B/C r1](DECLARED_EVALUATION_SUITE.md) now selects unchanged baseline-quest, strict Griffin defeat + wig/no-knockout scoring, and two repetitions per condition. Pilot-30 is allocated once as historical A/pre/1, without changing its original registration, pilot status, suite/config hashes, evidence or the fact it predates this declaration. Runtime B/C checkpoint certification, prompt sealing, memory comparison and new evaluation remain pending. Current course report: `midterms/saadsatter/EVALUATION.md`; the previous report is archived byte-for-byte.


## 9. Active allocation after owner correction

Pilot-30 occupies **A/post-tuned/1**, historical completed pilot. A/pre-tuned has no registered trial. The 18-row design still has one observed and 17 unrun rows. Declaration revision 2 archives revision 1; run files, original video, scenario/policy/config hashes, outcome and metrics are unchanged. Exact tuning provenance remains to be documented before matched pre/post or repeat claims.
