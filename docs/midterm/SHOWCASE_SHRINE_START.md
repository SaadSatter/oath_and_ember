# Continuous showcase — shrine start, revision 3

Current handoff, November 7, 2026. This supersedes the maze-start proposal and its prior authorization. The owner requests new final hash approval before any unlock or paid call. Code source: `e5d2dfe58bff3e008bf7be29be2dc24766964b92`; implementation `6206065`, reviewer ordering fix `e5d2dfe`. Scenario id remains `showcase-maze-griffin-complete-v1`, definition version 3. A separate prompt-tuned demonstration, excluded from official A/B/C results.

## Start and required connected quest

The ordinary `goddess` title-screen checkpoint places both heroes at the Goddess Shrine at tick zero, with the greeting and quest request still unread. Showcase reset has **no prefix** and rejects attempts to add one. Its authoritative start equals S1's normal checkpoint: `9d565ae90d161cc9e79979e0b9b66b1c5499d5a22e5292ba10ca271bda12cb50` at seed 0. The checkpoint's upstream story history is the normal game's own state; no newly fabricated state, rewards or downstream quest flags are added.

Through legal observations/actions, the player must finish the Goddess greeting, enter the maze through the normal shrine exit, cooperate for the Shears, return to the shrine, use the Griffin trail, defeat the Griffin through combat, collect the Wig, return, offer it and finish dialogue to `chapter0.complete`. Ordinary engine knockout/respawn remains enabled. No engine, art, manual, perception, action validator or centralized planner change. Official A/B/C definitions, policies, guidance and traces remain unchanged.

Completion now requires authoritative final-state conditions **and ten strictly ordered first-occurrence milestone times**. An early Griffin-combat detour cannot be retrospectively accepted by revisiting it after the maze. History is evaluator-only, never player input. All required opening/travel/return/ending events must happen during this episode. The normal Goddess completion flag proves the last opening quest line was advanced through normal dialogue; the trace also preserves that line as actually observed.

## Frozen proposal hashes

| Identity | SHA-256 |
| --- | --- |
| Definition | `ec827f19555e5456d987f866c6f50414827f8875efd911859f351aeafe532831` |
| Guidance `showcase-maze-griffin-v1` | `32836d8f85b7228e3bc83f1b8aae7a7b9e8e602dc1e72aa3d15949cdb595b439` |
| Full planner prompt | `8ce07fb23b81781f7fb66456458538e046d9ba0b65ebc777d77bb42651951a7d` |

Showcase-only briefing/task/guidance now describe opening at the shrine, reading the quest and finding the ordinary maze exit before the existing phases. No maze solution, coordinate, hidden state or new puzzle answer was added. The B/C guidance texts remain unchanged. Prior hashes and starts remain archived in the earlier free-validation directories and require their recorded source versions for reproduction.

## Free validation

Clean-source scripted baseline: success at **10,166 ticks / 169.4 game seconds**, decisions 1,125/1,228, zero invalid actions, zero model calls, $0. End hash `c0e8e3551152d57d9bc861b83daccfab28df1620bad672125f7aac534ccee563`.

| Milestone | Game seconds |
| --- | ---: |
| Goddess greeting/quest completed | 24.77 |
| Both heroes entered maze | 27.77 |
| Shears acquired | 59.27 |
| Returned from maze | 66.77 |
| Entered Griffin Enclosure | 79.60 |
| Griffin defeated in combat | 112.95 |
| Wig collected | 155.70 |
| Returned with Wig | 158.63 |
| Offering accepted | 166.42 |
| Chapter 0 complete | 169.43 |

The showcase-only scripted baseline reads one displayed opening line for one game second using legal wait actions. This presentation choice changes neither cutscene rules nor model behavior. It observes only its own current/remembered screens; existing A/B/C baseline implementations are reused unchanged. No hidden engineering route is supplied to the baseline.

Recovery certification (not a baseline/model result) succeeds after two real knockouts in **10,951 ticks / 182.5 game seconds**. Full story flags, backpack, claims and completed maze progress survive normal recovery. The probe has disclosed privileged engineering target knowledge, confined to certification. Its trace replays all **2,412** results exactly; observations contain zero evaluator-metadata leaks. All nine official A/B/C traces replay exactly at the new code source. Protected paths and twelve frozen run-path identities are unchanged.

## Reviewer findings

The [original read-only subagent report](agent-evidence/reviews/2026-11-07-showcase-shrine-review.md) found one major ordering gap and stale comments. Both were fixed in `e5d2dfe`. The [focused follow-up](agent-evidence/reviews/2026-11-07-showcase-shrine-followup.md) confirms them addressed and finds no additional blocking issue in that diff. Both reports are preserved verbatim. The reviewer did not implement the code but was launched from this implementing session; this is not an independent top-level review. Video inspection, final test outputs and ledger inventory are verified by the implementing session, not attributed to the reviewer.

## Duration/cost estimates and remaining risks

Measured free baseline is 2m49.4s of game time. Model behavior is unmeasured for this revised start. Earlier model pilots and the former showcase estimate suggest roughly **190–350 game seconds**, **380–700 calls**, **$1.0–1.9**, and **3,500–7,200 wall seconds**. These are rough planning estimates, not a promise of success or a 3–5 minute clip. The new opening adds dialogue/navigation and a larger prompt; recovery, search stalls or provider latency can consume the cap. Budget enforcement may stop the attempt before completion. One run has no measured reliability estimate.

Existing live acting can skip waits at action boundaries; no shared clock was changed. Preserve the original unedited model capture and label any game-clock-paced exact replay as a replay with no model calls. The free baseline video is not a paid model recording. Provider availability and end-to-end real-model recovery remain untested. The existing recorder-timeout assertion is a separate known test issue.

## Paid guard, ledger and proposed command — do not execute

`SHOWCASE_PAID_APPROVED = false`; showcase guidance `proposed`, no approved hash. Prior maze-start approval does not authorize these revised hashes. Target remains one attempt only, no automatic retry: seed 0, model-centralized, OpenAI `gpt-6-luna` medium, maximum batch 4, $2.00 cap, 7,200 s wall limit, 400 calls per hero. Existing configuration, seed, cap, wall and no-resume restrictions remain.

Canonical ledger recheck: 36 entries, zero open reservations, no lock; **pilot $2.117789 / total $19.114868 remaining**. This is sufficient to reserve $2; no real reservation or model call was made. Balance must be checked again immediately before any future authorized launch. Credential availability is not tested here; the prior session reported none in its environment.

From `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval`, only after new explicit exact-hash owner approval and a reviewed local authorization commit:

```sh
npm run eval:live -- --scenario showcase-maze-griffin-complete-v1 --seed 0 \
  --player model-centralized --guidance showcase-maze-griffin-v1 \
  --gateway openai --model gpt-6-luna --effort medium --max-batch 4 \
  --max-spend-usd 2.00 --wall-seconds 7200 --paid
```

No paid retry, push, merge, course PR update or submission. No requested personal authorship content changed.

## Final validation and recording inspection

Typecheck/build pass. Targeted showcase/recovery/scope suites: **17/17 pass**. Broad permitted suite: **1,356 pass, one known pre-existing recorder-timeout message assertion failure**, 139 files; separate scripted S1–S3 group: **six pass, one skip**. Held-out/full-route tests were excluded. The broad suite exits nonzero because of that failure; it is not labelled green.

The saved free baseline recording replays all **2,352** step results and matches start/end/ticks. Metadata paces 10,165 ticks in 169.42 wall seconds (one final accounting tick separates this from the 10,166-tick episode). Full video decode succeeds with no decode errors. Decoded file duration is **182.12 s (3m02s)**; recorder wall metadata is 187 s, including startup/finalization overhead. Actual decoded frames at 11 s show the Goddess greeting, 32.9/33.35 s show the Quest request including “Recover the Divine Wig,”33.6 s shows the updated quest HUD and shrine departure, and the 99% frame shows finished success/all ten milestones. No screenshot substitutes for the recording; frames were inspected from the actual video. The initial startup hold is also disclosed.

The video is preserved byte-identically, local-only, at `evaluation-runs/live/showcase-shrine-free-e5d2dfe-seed0-replay/recording.webm`. It is explicitly labelled **REPLAY / baseline-showcase-route / recorded actions, no model calls**. It is not the final model recording.

[Current free evidence package](../../midterms/saadsatter/evidence/showcase/free-validation-v3/README.md) includes manifest, exact guidance/prompt texts, opening dialogue proof, compressed original traces, logs, official replay verification and video metadata/hash. [Same-session rules audit](agent-evidence/skill-runs/2026-11-07-showcase-shrine.md) separates its findings from the read-only reviewer reports. New exact-hash approval remains the next owner decision; no paid run has started.

Final ledger recheck observed a separately settled **pilot-36**, source `cee0713` (the older maze-start version), opened 2026-11-07T20:05:28.838Z, charged $0.012616. This entry appeared while this workstream performed free checks; no paid launcher/provider call was issued by this workstream. It is an older-version attempt, not a result for revised source `e5d2dfe`. No retry was made. Final available balance above includes it. The new exact-hash approval must refer to this revised shrine-start version explicitly.

## Final revision-3 authorization

Source: owner’s “I approve” reply to the exact revised hashes, bounds and one-attempt question following review package `bac3a5f`, in Codex session `01a1b479-dfba-79a0-9de7-9cca63bdc8bb`. This supersedes pending-authorization statements above. One revised shrine-start attempt is authorized, no automatic retry; the separate old maze-start pilot-36 remains preserved.

Pre-unlock: clean HEAD `bac3a5f`, all three proposed hashes matched. Canonical ledger36entries, zero open, unlocked; pilot$2.117789/total$19.114868 remaining. Minimal runtime change opens only the showcase approval flag and approves its exact guidance hash. No prompt text, definition object, game rules or A/B/C change. Definition status wording remains frozen historical metadata to preserve the approved definition hash. Existing scenario/config/seed/cap/wall/call/no-resume protections remain.

`OPENAI_API_KEY` is unavailable in the agent process. Validate the committed command through the missing-credential boundary without provider access. The revised paid attempt remains unstarted until a credential is supplied via the existing hidden prompt or environment; never through chat or command arguments.
