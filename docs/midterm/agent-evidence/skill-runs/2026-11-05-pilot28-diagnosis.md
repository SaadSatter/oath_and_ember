# Pilot-28: centralized planner diagnosis

| Field | Value |
| --- | --- |
| Date | 2026-11-05, America/New_York |
| Session | `01a1aed2-3232-7011-bb41-5fccdea13a5c` |
| Session URL | None. Local session; no shareable URL was created. |
| Role | Read-only diagnosis; no implementation or paid evaluation |
| Source worktree | `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval` |
| Source revision | `678b86c7c2cb706fc88b42fe9daf6132e925cd57`, clean at inspection |
| Run directory | `evaluation-runs/live/S2-local-seed0-model-centralized-openai-2026-11-06T02-37-35-986Z` in the source worktree |
| Trace SHA256 prefix | `67f068f3d2297391`; complete hash chain verified by replay tool |
| game-rules-audit skill SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| session-evidence skill SHA256 | `df8200c4e4afc378360e26453041435f1b946df754e43f44d42f006ef39ac248` |

The current chat checkout has older documentation and no pilot-28. Required initialization documents were located and read in the evaluation worktree: MIDTERM_GUIDELINES, RECURRING_INSTRUCTIONS, REQUIREMENTS_CHECKLIST, EVIDENCE_INDEX, PHASE4_HANDOFF, MODEL_CENTRALIZED, MODEL_NAVIGATOR, AGENT_INTERFACE, SERVER_CHANGES, BASELINE_PLAN, MODEL_BUDGET, ROUTE_LOG, EVALUATION_SUITE, CLAUDE.md and the player manual. Relevant prior navigator diagnosis and centralized offline evidence were reviewed. Applicable requirements are authoritative outcomes, bounded intentions and honest accounting, preservation of frozen scenarios, and trace/video provenance. Centralized control is an owner-requested exception to independent hero policies, explicitly disclosed in MODEL_CENTRALIZED.md. No new approval is needed for diagnosis. Implementation and another paid run remain unapproved.

## Result and time convention

Pilot-28 did not obtain the key or Enchanted Shears. It ended by manual stop, with no success claim. Its 3,473 trace records include all observations, 648 policy notes, 78 raw model replies, 79 attempted calls, 643 actions and 641 results. Five replies were rejected; the final call was aborted by the manual stop.

All times below are **episode elapsed game seconds**, `(tick - 405) / 60`, matching the viewer and summary. Observation `seconds` is absolute world time, 6.75 seconds ahead. The disputed 25.9-second event is tick 1955, episode 25.833, absolute 32.583. The episode ends at tick 7921, elapsed 125.267, rounded to 125.3.

## The E press did not catch a wolf

Trace seq 1273 is Sieg's sole interact action, tick 1955. Sieg is at `(22.47,23.54)`, beside the grazing-bay clue. His visible entries are the cow at `(26,25)`, its static label, and `BLACK HOLE → grazing bay` at `(22.2,22.2)`. There is no wolf or inventory-panel `nearbyTarget`.

**Exact target: none.** In `packages/agent/src/actions.ts:210`, interact with no nearby inventory target becomes an ordinary world E press. It does not select the cow or the clue as an inventory interaction. Seq 1274 reports an accepted two-tick press with **`You pressed E; nothing responded.`** Accepted input is not successful capture. Seq 1285's model reply correctly acknowledges that Sieg's E did nothing.

The actual wolf inventory target would be `hedge-runner-key`, displayed as `Forest wolf · E to take key`, rewarding `hedge_gate_key`; its server handler reports `Collected Hedge Gate Key.` (`apps/server/src/hedgeMaze.ts:29`). None of those outcomes occurs. Every observed shared inventory retains only the eight initial item types. The terminal evaluator milestones include no key. No planner order uses `catch` anywhere in the run.

## Meaningful progress and persistent intentions

| Episode time | Progress, intention and evidence |
| --- | --- |
| 0–2.43 | Arrival dialogue clears; both move east. Coco's fireball removes the dry hedge. This is a verified completed subgoal, first retained at seq 130. |
| 3.43–12.72 | First Black Hole is aimed southeast at a mossling. Combat and discoveries cause many calls. Sieg is sent toward the grazing-bay clue; Coco fights and falls to low health. At 12.72 the planner explicitly holds Sieg by the clue. |
| 14.80–25.83 | Coco fires north from south of the cow, then fights/retreats as health falls to 28. Sieg returns to the clue. At 25.83 the planner orders the unsuccessful E press. |
| 25.87–26.80 | A reply combines `go_to` and `hold` for Sieg and is rejected (seq 1281). The next accepted reply orders only Coco to `(26.5,30.5)`. Sieg enters a default hold ending at tick 3757, episode 55.87. Coco casts north and is ordered to watch the cow for 10 seconds. |
| 26.80–41.83 | Sieg stays still. Coco waits 10 seconds, casts north again at 36.80, then waits another 5 seconds. No cow displacement. The planner keeps describing a resolving spell, cooldown and protecting Coco, rather than assigning Sieg exploration. |
| 41.83–47.70 | Coco actually repositions west: goals `(22.5,27.5)`, `(22.5,26.5)`, `(22.5,25.5)`, then a 4-second wait. |
| 47.70–48.23 | Eastward cast lands on the cow's west side. The cow moves from x=26 to x≈25.03. Planner recognizes motion at 48.23 and initially records its causal explanation as fact. |
| 48.23–57.73 | Both wait. Movement start/stop and wait expirations produce more calls. At 55.87 Sieg's 30-second hold expires and triggers plan 56; the model explicitly gives him another hold. It also downgrades the cow movement's cause to unknown. |
| 57.73–72.77 | East cast, 5-second wait, 10-second wait, north cast. Cow remains x≈25.03. Sieg still holds. Productive work is repeatedly deferred to a future cooldown or unassigned exploration. |
| 72.80–74.93 | Sieg finally receives work: `(22,30.5)` then `(23,27)`. The helper routes him to reachable nearby floor at `(24.46,28.47)`. On arrival, the next plan gives only Coco another wait, so Sieg defaults to holding again. |
| 74.93–93.13 | Coco watches/casts east/repositions near the clue/waits/casts south. Sieg is explicitly re-held at plan 65, resetting his hold deadline before its prior expiry. Neither explores beyond the cow. |
| 93.17–103.20 | Coco waits 5 seconds, another 5 seconds, casts north, then holds. Sieg remains stationary. |
| 103.20–107.97 | Brief renewed work: Sieg is sent back to `(17,33)`, then east to `(30,32)`, then `(27,29)`. Coco's `(22,19)` goal is unreachable on her map; the response is another 10-second wait. On Sieg's last arrival, `orders: []` leaves him in another default hold. |
| 107.97–125.27 | Sieg holds; Coco waits, casts south at 115.20, waits 10 seconds, casts east at 125.23. Manual stop occurs two ticks later with the final projectile still travelling. |

Sieg spends **106.0 of 125.267 game seconds** in wait actions; Coco spends **107.7 seconds** waiting. Some early waits are normal attack recovery. The later sustained waits are planner-selected/default holds and repeated spell/cooldown waits. Counts alone understate the problem: 222/286 Sieg actions and 267/357 Coco actions are waits, but their durations show both heroes idle for roughly 85% of the episode.

## Timeout and replanning diagnosis

The individual intention timeout works. `CENTRAL.holdSeconds` is 30 (`centralized.ts:40`); `ensureIntention` sets `untilTick = o.tick + 1800` (`:651`). `NavigatorPlayer.intentStep` compares the current tick with that deadline (`navigator.ts:881`); centralized `endedText` changes the message for a default hold. Trace seq 1961, plan 56, is the direct reproduction: **`this hero's hold ran out (30 s with nothing new)`**, episode 55.87. The resulting order is **another hold**.

There is no independent cumulative no-progress watchdog. `applyOrder` replaces a chosen wait with a fresh deadline (`centralized.ts:625`), and an explicit hold clears the intention so `ensureIntention` creates another 30-second hold. A short wait can expire repeatedly without ending cumulative inactivity. Sieg's hold at episode 74.93 had deadline 104.93; an explicit new hold at plan 65 replaces it with deadline 117.43, observed when his next decision starts the assignment at 87.93. A later walking assignment replaces it before expiry.

**Other hero calls alone do not reset the hold.** `planned()` resets damage/walking/pause counters, not `intent.untilTick` (`:612`). Omitted orders preserve running intentions. The renewal comes from new orders/default holds, not a blanket timer reset on every shared call. Thus “replan after 30 idle seconds” is implemented as an intention deadline, not as a guarantee of useful work after 30 idle seconds.

Cast-only orders often leave no intention, triggering an immediate second planning call two ticks later with `this hero has no intention`; the model then supplies the wait. Plan 64 demonstrates that cast plus follow-up wait fits one valid order, so those paired calls are avoidable. Five invalid replies also waste thinking time without game progress: three conflicting combat/navigation replies at 3.57, one at 17.68, and the hold/navigation conflict at 25.87.

## Every Black Hole cast

Preview points were reconstructed using the unchanged `aimPreview` and each hero's own sequential observation memory. Actual vortex positions came from read-only instrumentation of a second replay through the same authoritative engine. That replay also matched all 641 results and the terminal hash. Positions are tiles, rounded here to two decimals. Observation coordinates truncate cow x to 25.02; its exact engine x after the partial pull is **25.0276189597**.

| # | Cast time / direction | Coco position | Predicted landing | Actual vortex landing | Cow x before → after / outcome |
| --- | --- | --- | --- | --- | --- |
| 1 | 3.43 SE | 22.68,33.50 | 23.4,34.2, mossling | 23.41,34.23 | 26→26; combat cast, cow off Coco's screen and out of range |
| 2 | 14.80 N | 27.47,29.43 | 27.5,27.2, cow body | 27.48,27.19 | 26→26; vortex southeast of cow, not north; horizontal pull points east, already at east limit |
| 3 | 26.77 N | 26.52,30.53 | 26.5,27.2, cow body | 26.53,27.19 | 26→26; vortex south/east, eastward component cannot clear westward lane |
| 4 | 36.80 N | 26.52,30.43 | 26.5,27.2, cow body | 26.53,27.19 | 26→26; same ineffective geometry |
| 5 | 47.70 E | 22.50,25.63 | 23.8,25.6, cow body | 23.81,25.64 | 26→25.0276; genuine partial westward pull, stopped by Coco's body |
| 6 | 57.73 E | 22.60,25.63 | 22.8,25.6, cow body | 22.84,25.64 | 25.0276→same; Coco still occupies the cow's path |
| 7 | 72.77 N | 22.62,25.63 | 22.6,23.2, blocked tile | 22.62,23.19 | unchanged; actual cow distance ≈3.012 tiles, outside 3-tile pull radius |
| 8 | 82.80 E | 22.62,25.53 | 22.8,25.5, cow body | 22.84,25.54 | unchanged; Coco blocks further westward pull |
| 9 | 93.13 S | 22.62,23.55 | 22.6,26.8, blocked tile | 22.62,26.81 | unchanged; actual distance ≈3.012 tiles, outside radius |
| 10 | 103.17 N | 22.62,23.65 | 22.6,23.2, blocked tile | 22.62,23.19 | unchanged; outside radius |
| 11 | 115.20 S | 22.62,23.55 | 22.6,26.8, blocked tile | 22.62,26.81 | unchanged; outside radius |
| 12 | 125.23 E | 22.62,23.65 | 22.8,23.7, cow body | Not yet a vortex at manual stop | unchanged in recorded interval; do not infer its future effect |

The preview correctly predicts most landing points closely, but **a projectile fired toward a cow pulls toward its landing point**, not along the firing direction. Shots 2–4 therefore cannot achieve the intended westward displacement. Shots 7/9/10/11 are false-positive edge inclusions in `within_pull`: coarse stepping and truncated inputs put the estimated distance just inside the radius, while the real swept contact is just outside. A reported rounded distance of `3` is not a robust hit guarantee.

The decisive obstruction is Coco, not a mysterious failure of Black Hole. `pullMazeCow` (`apps/server/src/hedgeMaze.ts:168`) refuses a proposed cow position overlapping any living hero by less than `64 + HALF = 77` pixels on both axes. At the last successful displacement, tick 3299, cow x=800.8838067px, Coco x=723.2758958px, y=820.3907708px. The next ≈1.48px westward step would put x separation below 77px and is rejected. Coco later moves east to x=723.8838067px: exactly 77px from the stationary cow centre. Her subsequent northward reposition still overlaps the cow's vertical body, so she remains an obstruction for an in-range westward pull. Sieg could also obstruct later travel farther west, but Coco stops it first here. The aim preview models landing contacts and radial inclusion, not this prospective hero collision.

**The passage never clears.** The replay's cow `parked` flag stays false. More directly, its four-tile body ends at x≈27.0276; the post gap spans x=25.9375 to 27.6875. Only ≈0.660 tiles remain on the east side, less than a hero's 26/32=0.8125-tile width. This is evaluator-only verification, not a proposed hidden flag for the player. The planner's continued belief that the route is blocked is broadly correct. Its error is not recognizing a successful clearance; it is failing to diagnose a partial clearance, move heroes out of the pull corridor, or test a visibly viable route. Repeating unchanged casts and waiting cannot solve that.

## Objective and completed-subgoal memory

The objective is not lost from the system prompt: the task and episode briefing specify Enchanted Shears on every call. However, the mutable `plan` does temporarily drift to **Divine Wig** at 47.70 and 47.73 (seq 1772/1780), following the visible journal's broader quest. By 55.87 the planner returns to Shears, and from 72.80 it explicitly identifies the journal/task distinction. The end plan again names Shears. Objective retention is therefore partial at the planning layer, not a missing system objective.

`plan_memory` is just the latest model-written plan and lists, not a verified accomplishment ledger. `subgoals_done` is replaced wholesale whenever supplied (`centralized.ts:500`), with no outcome validation. The hedge opening is correctly recorded. Reaching/seeing the clue is a reasonable navigation milestone, not a puzzle completion. Statements such as “Coco fired Black Hole ... effect still in progress” are attempted actions stored as completed subgoals. At 48.23 the model records a causal claim about the cow pull; at 55.87 it backs off to “cause unknown,” even though the engine replay confirms that cast did cause the partial movement. The memory never records a key, gate opening, shears, or cleared passage; none occurred. It also does not retain a useful structured history of failed cast position/direction/result, so narration says “change approach” while orders repeat the same experiments.

## Wall-clock accounting

| Component | Duration / interpretation |
| --- | --- |
| Metered model latency, all 79 attempts | **768.976 s**, ~85.4% of episode wall time; includes the final aborted request |
| Trace call-start→call-end spans | **769.001 s**, agreeing within 25 ms with metering |
| Authoritative game execution | **7516/60 = 125.2667 s** at requested speed 1 |
| Residual within rounded 900.8 s episode | **≈6.56 s**, reset/recording readiness, pacing, serialization and host scheduling overhead; not independently attributable to recording alone |
| Initial trace run marker | wall 4.307 s; first observations at 4.310 s; supports startup/readiness being much of the residual |
| Recorder lifecycle | **908.2 s**, broader interval than episode wall time; includes initialization and finalization |
| Recorder shutdown | **4.977 s**: context close 0.199, saveAs 4.682, delete 0.012, browser close 0.083 s, small stage overhead |
| Host suspension | `live.json`: caffeinate enabled, suspensions `[]`, suspendedSeconds `0`; no recorded suspension explanation |

Mean call latency is 9.734 s, maximum 23.181 s, with no timeout. Game time freezes while the central planner thinks, so serial calls add almost directly to wall time. The 79 calls are 28 charged to Sieg and 51 to Coco; they are not separate independent planning agents. Only 78 return replies. The final abort is a consequence of manual stop, not the reason gameplay stalled. Known spend is $0.085837, charged $0.094339 with conservative unknown-usage accounting. No price lookup or paid request was made for this audit; these are saved run values.

The recorder's 4.977-second finalization is outside the episode measurement and must not be added to it to explain 900.8. Concurrent recording overhead during execution is folded into residual/runtime latency and cannot be measured separately without a control experiment. No such rerun was made.

## Three smallest changes to propose, not implement

1. **Track cumulative inactivity across renewed waits/holds.** Preserve a per-hero game-time no-progress age across equivalent wait/hold replacements; on reaching 30 seconds, explicitly report the cumulative idle duration and require a changed concrete assignment or a specific observed dependency. A shared call alone must not count as progress. Keep useful short waits legal. Regression: fresh 5/10-second waits and renewed holds cannot conceal 30 seconds of continuous inactivity; the other hero can receive work while one waits for recharge.
2. **Make the existing aim preview expose uncertainty and visible obstructions.** Add predicted pull displacement/direction and a warning when a visible hero's body occupies that path; mark radius-edge contacts uncertain rather than confidently in range. Use only already visible coordinates/extents and player-known mechanics, never `parked` or other engine flags. Regression: this trace's 47.70/57.73 casts warn about Coco, and its north/south radius-edge casts do not promise a hit. This addresses the actual stuck puzzle without changing gameplay.
3. **Tighten planner memory and follow-through in the prompt.** Keep the episode objective explicit above mutable plan memory; record confirmed outcomes separately from attempted cast position/direction/result; after unchanged results, order a changed position or a concrete exploration goal, and assign the other hero work. Encourage cast plus its intended follow-up wait in one order. Validate only one intention per hero. This is a small policy/prompt revision, with a new player/prompt identity and no scenario re-freeze.

## Verification and limits

Verified: full saved trace consumed; hash chain valid; original replay tool reports exact start, all 641 results, manual-stop end hash `b639c8c9547e10eab784b61838dcbab2c4ebe122dda96494ea9e6ed826aa3283`, and 7516 ticks. A scratch copy with read-only tick instrumentation also reports the same match. Aim reconstruction uses only sequential recorded observations. Scratch scripts and outputs are under `/tmp/p28-*`; they do not edit source, scenarios or run artifacts.

No implementation, npm test/typecheck/build, new paid call, held-out run, push or merge. Those broad build checks are unnecessary for this documentation-only diagnosis. No baseline fairness or whole-repository audit is claimed; this is an execution/clock/recording audit of one tuning run. Missing unrelated audit checks are out of scope. Current-source checkout status was clean at `678b86c`; pre-existing changes in the chat's older checkout were preserved.

Session-evidence extraction ran using the evaluation worktree's existing extractor into `/tmp/p28-session-facts.json`, confirming the session ID and local transcript. The normal session catalog/renderer is absent from this older writable checkout, so this report preserves the verified session supplement without changing the canonical evaluation worktree's indexes. The owner's personal team log is untouched. Video verification and secret-scan results are appended below after completion.

## Recording verification: decodes, final gameplay visible, terminal label missing

The original `scripts/evidence/verify-video.ts` fully decoded **recording.webm**, all the way through, with exit 0 and **no decode errors**. Actual encoded duration is **902.36 s**, 1280×720, 76,476,044 bytes. The final sampled frame at 902.26 s has 469 sampled color bins, confirming picture content. The final frame produced by full decode was visually inspected. A second scratch verifier decoded all frames to a 1×1 sink (to reduce PNG work), and sampled full-resolution frames at 5%, 50% and the end; it independently agrees on duration and valid content. Its sole warning concerns the scaled PNG's sample aspect ratio, not WebM corruption. The original unscaled verification has no warning.

**Qualified answer about the manual-stop state:** the video includes the final gameplay configuration at **125.3 game seconds**, Sieg HP 88, Coco HP 28, the partially moved cow, and Coco's accepted last east Black Hole. It does **not visibly show `finished: manual_stop`** in the inspected tail or final encoded frame: Sieg still reads “acting,” Coco still reads “deciding,” and the header shows 78 completed model calls. This is consistent with the last call being aborted after those 78 replies. The final 2.36 seconds were additionally decoded into 59 native frames and representative early/middle/last tail frames inspected. Therefore do not claim the terminal-status overlay is captured merely because metadata says `finalConfirmed: true`.

`recording.json` reports readyConfirmed/finalConfirmed true, saved, no warnings and completed cleanup. `recorder.ts:223` waits for DOM `finished:` and animation frames, but `live.ts:469` uses **holdMs: 0 on manual stop**. DOM confirmation does not guarantee that Playwright's recording encoder has included that final paint. The evidence supports a terminal-paint/recording-flush race as a likely explanation; this audit has not reproduced that lifecycle race independently. An eventual recording-only repair could retain a short post-stop tail and verify the encoded terminal label. It is separate from the three completion fixes above and was not implemented.

Scratch verification outputs: `/tmp/p28-video/video-check.json`, `/tmp/p28-video/full-decode-last.png`, `/tmp/p28-video/tail-01.png` through `tail-59.png`, and `/tmp/p28-video-fast/video-check.json`. These are diagnostic frame extracts, never gameplay-policy inputs or a substitute for the original normal-speed video.

## Prioritized audit findings

| Severity | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| High | Repeated renewed holds/waits; expiry at seq 1961 immediately yields another hold | Intention timeout enforces a deadline but not recovery from cumulative inactivity | Completion fix 1 |
| High | Exact replay cow/hero collision; coarse boundary inclusions in aim preview | Planner repeats geometrically ineffective casts and cannot explain the partial pull | Completion fix 2 |
| Medium | Mutable plan briefly pursues Wig; attempted casts stored as completed subgoals | Objective and outcome memory are insufficiently disciplined | Completion fix 3 |
| Medium | Decoded last frame lacks terminal overlay despite finalConfirmed true | Saved metadata overstates visible terminal-status capture | Qualify evidence; later add encoded-tail verification |

Audit checks: server outcome validation and real mechanics verified for the disputed E and casts; information boundary traced for aim reconstruction (observations only); deterministic replay and identical recorded start/end verified; failed/aborted call and timing accounting checked; centralized exception disclosed. No source diff was introduced; scenario and art preservation are unchanged by this audit. Whole-repository secret/information-boundary review, baseline comparisons, unrelated held-out material and broad build/test checks are outside scope. Only this report was written to the project.

Secret scanner: `python3 -I /Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval/scripts/evidence/scan_secrets.py docs/midterm/agent-evidence/skill-runs/2026-11-05-pilot28-diagnosis.md` → **1 text file, 0 findings**. Rechecked after the final report addition. Owner approval is required before implementing proposals or launching another paid run.
