> Current proposal: [Shrine-start revision 3](SHOWCASE_SHRINE_START.md). The maze-start design and authorization below are historical; revised paid execution is locked pending new exact-hash approval.

# Showcase: one continuous episode, Hedge Maze → Griffin → Goddess

> **Prompt-tuned continuous gameplay demonstration — excluded from official A/B/C evaluation results.**

Scenario `showcase-maze-griffin-complete-v1`, guidance `showcase-maze-griffin-v1`. Prepared 2026-11-07 by the Claude Code implementation agent at the owner's request. **Status (revision 2): design, model, limits and one attempt approved by the owner; guidance provisionally approved and frozen; paid execution still locked pending the owner's separate final authorization.** No paid call, push or merge has been made. Nothing in the official A/B/C evaluation was changed (see "What was not touched"). Section 10 records the owner's 2026-11-07 decisions and what changed for them; where an earlier section disagrees, section 10 is current.

## 1. Feasibility: yes, with no gameplay change

The engine already supports the whole route in one episode. The game keeps one world: the shared backpack, each hero's health, quest flags and the Griffin persist across the area transitions (Hedge Maze → its RETURN exit → Goddess Shrine → NORTH · GRIFFIN TRAIL → Griffin Enclosure → RETURN → shrine). The scripted full-quest route (`route/fullQuest.ts`) and B-return already crossed the same transitions.

Facts from the source and the free runs that shape the showcase:

- **Combat is the only wig route here.** The party never visits Mirror Pond, so it has no Vanity Mirror. The Shears alone start nothing at the nest (`apps/server/src/griffin.ts`). No rule had to change to force combat.
- **Health carries over.** Nothing heals between areas. In the free run the heroes left the maze with Sieg 60 and Coco 88 HP and fought the Griffin from there. A model may arrive more damaged. This is the main risk (section 8).
- **The Shears are not used up** on the combat route, so "Shears held at the end" plus "maze chest claimed" proves the maze step.
- **A peaceful wig cannot satisfy the predicate**: a groomed Griffin ignores all damage forever, so HP 0 with the wig claimed implies a combat defeat.

## 2. Changes made (all additive; no gameplay, rule, tuning, story or asset change)

| File | Change |
| --- | --- |
| `packages/agent/src/showcase.ts` (new) | Definition, pinned by hash; paid lock `SHOWCASE_PAID_APPROVED = false`; proposed paid scope; summary label `SHOWCASE` with `officialEvaluation: false` and the disclosure text |
| `packages/agent/src/suite.ts` | New `SHOWCASE_SITUATIONS` list (one entry), briefing and task line; `situation()` also searches it. `SITUATIONS` and `ABC_SITUATIONS` unchanged |
| `packages/agent/src/evaluator.ts` | New preset: `showcaseComplete` predicate, owner-approved limits, `showcaseMilestones`; no knockout failure (revision 2) |
| `packages/agent/src/environment.ts` | Records the showcase and Griffin milestones in the trace for this preset only |
| `packages/agent/src/harness.ts` | Owner-approved $2.00 cap and 7,200 s model default/ceiling; the showcase runs only `model-centralized` or its own baseline; paid runs refused while locked; summary label |
| `packages/agent/src/playerKinds.ts` | New player kind `baseline-showcase-route` |
| `packages/agent/src/policies/showcaseRoute.ts` (new) | Free validation baseline (section 5) |
| `packages/agent/src/policies/situationGuidance.ts` | New showcase-only entry `showcase-maze-griffin-v1`, provisionally approved text; status remains proposed until final authorization (section 4). Existing entries untouched |
| `scripts/midterm/live.ts`, `scripts/midterm/replay-video.ts` | Accept the showcase scenario; the launcher refuses paid showcase runs while locked |
| `scripts/midterm/replay-video.ts` (`6fc3102`) | **Pacing fix** (section 5): replays now schedule ticks on one game clock, so a speed-1 replay video runs in real time. Ticks, order and compared hashes are unchanged |
| `scripts/midterm/showcase.ts` (new) | Free checks: start hashes, guidance and prompt export |
| `packages/agent/test/showcase.test.ts` (new) | 8 tests (section 6) |

The planner (`centralized.ts`, id `f0592888`), `llm.ts`, perception, actions, navigation and both frozen baselines are byte-identical. The B/C run-path pin tests pass: `suite.ts`, `evaluator.ts`, `environment.ts`, `harness.ts` and `live.ts` are the files those tests already allow to grow additively.

## 3. Scenario

| | Value |
| --- | --- |
| Scenario id = preset | `showcase-maze-griffin-complete-v1` |
| Definition hash | `43f72cfe7a2e152527df2a91b2eaa18a281abf5a51bcee58dabcd9851757f5f9` (revision 2; revision 1 was `23701f01…`) |
| Start | S2-A's ordinary prefix (goddess checkpoint, opening scene, walk to the shrine's east exit, E). No fixture. Absolute tick 405 |
| Start hash, seed 0 | `fdc498771fe89a1ac96fb1ce8bd972c38ad96e84bdeb18b195292e42e20203ca`, **identical to S2-A's** (episode id `showcase-maze-griffin-complete-v1-0-fdc49877`) |
| Start hash, seed 1 | `febddd1a479ac6f2750c940ac2fa9f6e469d6a5bd2d4ec89bac9f32514f86519`, identical to S2-A's seed 1 |
| Start conditions | Both heroes 100 HP with all abilities; maze pristine (dry hedge, cow in the lane, wolf with the key, gate shut, chest unclaimed); Griffin 640/640 at its nest; no Mirror, Shears or wig; offering not made |
| Success (authoritative state) | Shears Chest claimed **and** Enchanted Shears held **and** Griffin HP 0 **and** wig claimed **and** the Griffin never took the tools **and** offering accepted **and** `chapter0.complete` |
| Knockouts | **Not a failure** (owner decision 2026-11-07). The game's own rule returns the hero to the area's starting point with full health; quest progress, backpack and Griffin are untouched; play continues. Each knockout is recorded (trace `showcase_knockout`, summary `showcaseReport`). The episode still ends on any limit, three consecutive policy failures, the planner's stall watchdog or a manual stop |
| Milestones (trace only) | `showcase:1-maze-complete`, `2-griffin-defeated`, `3-wig-acquired-after-defeat`, `4-offering-accepted`, `5-chapter0-complete`; plus the Griffin HP quarters and the ordinary story/inventory markers. A wig taken while HP > 0 would be marked `showcase:peaceful-wig (does not satisfy the showcase)` |
| Limits (owner-approved 2026-11-07) | 36,000 ticks (600 game-s); 4,000 decisions, 400 model calls and 8M tokens per hero; 30 s per call; 3 consecutive policy failures; 7,200 s wall clock (the default for showcase model runs); $2.00 per episode |

Obtaining the wig is never reported as success; the episode ends only at `chapter0.complete` (or a failure or limit).

## 4. Guidance `showcase-maze-griffin-v1` (revision 2: provisionally approved, frozen; status flag stays "proposed" until the final authorization)

| | Value |
| --- | --- |
| Guidance SHA-256 | `7f3203b954001d9e302b154cc77423cdb8fe36f63e4434c7a9ac7fc4a33d2166` (6,034 characters; revision 1 was `c0f7382e…`) |
| Full planner system prompt SHA-256 | `59e46825cefa03608f7481c681b625f6204e13c2156eb6f66cb1a6b7f18183c7` (revision 1 was `fecf10c7…`) |
| Policy name | `centralized-f0592888(<gateway>)·batch4·tutorial-2ec2f251·briefing-bf6cd3d3·task-368f4886·guidance-7f3203b9` |
| Prompt parts | the public manual (`4b091a66…`), the tutorial (`2ec2f251`, as in A), the showcase briefing (`bf6cd3d3`, revision 2: a knockout does not end the episode), the showcase task line (`368f4886`), then one guidance block |
| Full texts | `midterms/saadsatter/evidence/showcase/free-validation/guidance-showcase-maze-griffin-v1.txt` and `planner-system-prompt.txt` |

The guidance is a four-phase plan followed by the **unchanged, owner-approved `b-post-combined-v4` text** (the guidance that won B in Pilot-33). The plan:

1. **Hedge Maze.** Cooperate to obtain the Shears. Coco takes the environmental obstacles her fire, pull or flight can affect; Sieg takes enemies, gates and anything to be chased, struck, pushed or reached quickly. Phase 1 ends only when the backpack lists the Shears.
2. **Travel.** Leave by the maze's RETURN exit; at the shrine take the exit marked for the Griffin; ordinary exits only; no other areas; keep together; health carries over.
3. **Griffin combat.** Fight until the label shows it defeated; Coco at range, Sieg protects himself, keeps out of Coco's line and strikes in reach. While it is alive, do not go to the nest or use any item there. Keep both heroes alive.
4. **Wig and Goddess.** Only after the defeat, Coco claims the wig at the nest by flight; confirm it in the backpack; return; offer it; read and answer every dialogue until Chapter 0 is complete. "Holding the wig is not the end."

Every phase change is tied to something the screens show (area name, backpack, label, dialogue), never to elapsed time or an accepted order. The text names no coordinate, waypoint, hidden state or maze answer (no cow, wolf, key, hedge or Black Hole step); a test checks this. **This follows `CLAUDE.md`'s rule against answer keys in prompts**, which still applies to a demonstration. If the owner wants a more explicit maze walkthrough, that is decision C in section 9.

The frozen A/B/C prompts and guidance texts are unchanged (tests check the v4 and C3 hashes).

## 5. Historical revision-1 free end-to-end validation

This section preserves revision-1 results, including the earlier guidance/knockout policy. Current revision-2 verification is in section 10 and `free-validation-v2/`; it does not overwrite `free-validation/`. Implementation commit `c30d2fb`. Every run below was first made on the uncommitted change and then repeated from the clean commit for the evidence folder, with identical hashes.

### Scripted baseline `baseline-showcase-route-v1` (labelled baseline, never presented as a model)

It composes the frozen baselines without changing them: `baseline-maze-heuristic-v2` until its own backpack panel lists the Shears; then an observation-only walk to the exit whose drawn label reads `RETURN` (maze) or `GRIFFIN` (shrine), over its own remembered screens, exploring if the exit is unseen; then `baseline-griffin-heuristic-v1` from the enclosure on. Each hero has its own instance and memory. No coordinates, routes or engine state.

| Run | Seed | Result | Game time | Decisions (Sieg / Coco) | Invalid | Calls | End hash |
| --- | --- | --- | --- | --- | --- | --- | --- |
| headless 1 | 0 | **success** | 141.7 s (8,500 ticks) | 962 / 1,064 | 0 | 0 | `2678c3a0…0647` |
| headless 2 | 0 | **success**, identical | 141.7 s | 962 / 1,064 | 0 | 0 | `2678c3a0…0647` |
| headless | 1 | **success** | 141.7 s | 962 / 1,064 | 0 | 0 | `4dab6f58…` |
| live viewer, recorded, speed 1 | 0 | **success**, identical to headless | 141.7 s (158.7 s recording) | 962 / 1,064 | 0 | 0 | `2678c3a0…0647` |

Milestones in the seed-0 trace (game seconds): Shears + maze complete 31.5; Griffin awake 65.5; HP ≤480 74.9, ≤320 80.5, ≤160 83.2, **0 at 85.2**; wig claimed after defeat 127.9; offering accepted 138.7; **`chapter0.complete` 141.7**. Final HP: Sieg 34, Coco 62.

- **Replay:** `replay-video.ts --check-only` on the seed-0 trace matches the start hash, all 2,025 step results, the end (success, `2678c3a0…`) and 8,500 ticks.
- **Recording:** 1280×720 WebM, `saved`, ready and final frames confirmed, no warnings. The whole file decodes (`scripts/evidence/verify-video.ts`). The last frame shows `finished: success · 141.7 s game time · 0 model calls` and all five showcase milestones; the mid-run frame shows both heroes at the shrine with the quest line "Recover the Divine Wig ✓ Shears". The status strip and milestone line sit above and below the two game views and do not cover them.

### Replay video at normal speed, and a defect found and fixed

`replay-video.ts` re-rendered the baseline's trace to video with no model call. The first render matched the trace, but sampled frames showed it played about 10% fast: 141.7 game-s in about 132 s. Cause: the environment's paced loop (`runPaced`, `environment.ts`) waits between ticks only while both heroes have an action running, so the tick where one action ends and the next starts is not waited for. That is intended in a live run, where game time is frozen while a hero decides, but in a replay the roughly 2,000 skipped waits add up. The shared environment was not changed. The replay script now paces each tick on one absolute game clock (`6fc3102`). Re-rendered: `matchesTrace: true`, measured pacing 141.65 s wall for 141.65 game-s, and frames 75.9 s apart in the video are 76.5 game-s apart on the on-screen clock (equal within its 0.1 s display and frame timing). Earlier replay videos made with the old pacing (for example in `midterms/saadsatter/evidence/`) are slightly fast; their game content and replay checks are unaffected.

### Mock model run (launcher and prompt path; not a result)

`model-centralized` + `showcase-maze-griffin-v1` with the mock gateway (random legal actions, $0, scratch ledger): ended `error` (the planner's existing stall watchdog) at 240.3 game-s after 108 calls, 3 invalid actions. Its summary records the proposed guidance, the prompt hash `fecf10c7…` and the SHOWCASE label. Its trace replays exactly (1,070 results, 14,416 ticks).

### Paid lock

`npm run eval:live -- --scenario showcase-maze-griffin-complete-v1 … --gateway openai … --paid` stops with "locked for paid model runs until the owner approves the showcase". `validatePlan` refuses it too (tested).

## 6. Historical implementation tests

`packages/agent/test/showcase.test.ts`, 8 tests (all pass). Full suite at `c30d2fb`: **1,381 of 1,382 pass**; the one failure is `s2Shutdown.test.ts` "gives up on a video that never finalizes" (a 200 ms timing assertion), which fails the same way on the untouched `eeb2b59` (checked in a temporary checkout). `npm run typecheck` and `npm run build` pass. Tests: separation from the frozen lists and the label; proposed limits; start equal to S2-A at seeds 0 and 1 and identical on reset; guidance proposed, pinned and equal to plan + v4; no coordinates or maze answers in the plan; prompt = generic prompt + one block (hash pinned); paid lock and player restrictions; the baseline's full run (success, pinned end hash, five milestones in order, no peaceful marker) and, on copies of the final world, that removing any one required step (Griffin alive, wig unclaimed, tools taken, chest unclaimed, Shears gone, no `chapter0.complete`) fails the predicate.

## 7. Historical evidence

`midterms/saadsatter/evidence/showcase/free-validation/` (see its README): the free-check report, the guidance and full prompt texts, the recorded baseline run's trace, summary, run and recording metadata, replay and video checks, the mock run's summary and replay check, and a SHA-256 manifest. Videos stay in `evaluation-runs/live/` (Git-ignored, local only) and are identified by SHA-256.

## 8. Planned paid recording and its risks (not run)

**Proposed command** (refused until the owner approves; needs a clean commit, the shared ledger and the key):

```sh
npm run eval:live -- --scenario showcase-maze-griffin-complete-v1 --seed 0 --player model-centralized \
  --guidance showcase-maze-griffin-v1 --gateway openai --model gpt-6-luna --effort medium \
  --max-spend-usd 2.00 --wall-seconds 7200 --paid
```

**Two videos, one episode.** The live viewer shows the human game UI, including the HUD goal lines that the agents do not receive (an existing owner decision); that is what a player sees, not agent input. The environment is lockstep: game time stops while the planner thinks. The live recording therefore lasts about as long as the run's wall time (about 1–2 hours), mostly frozen frames. It is kept unedited as the raw continuous original. The 3–5 minute submission clip is then made with `replay-video.ts` from that run's trace at speed 1: it resubmits the recorded actions to the real engine, makes no model call, must match every step result and the end hash, and is titled "REPLAY of … (recorded actions, no model calls)". With the pacing fix its episode part lasts exactly the game time. Neither is sped up or cut.

**Estimates** (from Pilot-30 on A and Pilot-33 on B, same planner, model and effort):

| | Estimate | Basis |
| --- | --- | --- |
| Game time | 170–300 s (about 3–5 min); could fall just under 3 min if play is efficient. Not padded if so | Pilot-30 maze 89.5 s + travel 20–60 s + Pilot-33 fight to `chapter0.complete` 51 s + wig search |
| Model calls | about 450 (350–650) | Pilot-30 167 + Pilot-33 251 + travel and dialogue |
| Cost | about $1.10 ($0.85–1.60); the $2.00 cap binds near 800 calls | $0.0022–0.0027 per call |
| Wall time | about 4,400 s (3,300–6,500 s); limit 7,200 s | 8.7–11.7 s per call |
| Ledger | the pilot stage has **$2.13** left of $8 | `scripts/midterm/ledger.ts`, read-only |

**Risks**

1. **Recovery costs time and calls.** Knockouts are not terminal in the showcase. Heroes arrive with maze damage, can respawn under ordinary rules, and must regroup; repeated knockouts may still exhaust a limit or trigger the planner watchdog. The B failures show risk, not a measured showcase failure probability.
2. **Maze stall.** Before tuning, the planner got stuck at the cow (Pilot-28/29). The current planner (Pilot-30) solved it once. One success is not a reliability measure.
3. **Planner stall watchdog** ends the episode as `error` if no verified progress is made for too long (seen in mock runs).
4. **Known controller limits** (disclosed for B): the planner is not woken by a new beam warning, and its `fight` intention cannot target the Griffin, so the fight runs on ordinary attack/move/defend orders.
5. **Budget for retries.** One $2.00 run fits the pilot balance. A second attempt would need the owner to move money from contingency ($1.90) or final ($15), which the launcher does not use today.
6. **Wall-clock.** A slow API day could approach 7,200 s.

A failed or partial run is still preserved and reported as what it is. It is never labelled a success, and a later attempt never erases it.

## 9. Owner decisions (revision 1 questions)

Answered on 2026-11-07; see section 10.

## What was not touched

Frozen scenario definitions, start hashes and definition hashes (A, B, B-return, C); every guidance text and its hash; the planner; both baselines; declarations, result manifests and `EVALUATION.md`; Pilot-28 to Pilot-35 evidence. The full test suite result at the implementation commit is recorded in the evidence README.


## 10. Codex takeover and final review response (November 7, 2026)

The owner requested takeover after Claude Code reached its weekly limit. Codex continued **the same worktree and branch**, without reset, clean, stash or branch switch. Original HEAD was `6e528f7`; all seven pending files were copied to scratch and then preserved in attribution-bearing commit `c242906`. Claude's reviewer report and implementing-session audit remain **verbatim**, including their provenance headers. The reviewer report SHA-256 is `25a4e31b66e5bda873e1abfc6771e09a0e4d1cd3dbe4e01b2be5d70e5ba4c91a`; its bytes exactly match the Write payload in Claude session `9409e901`. Its ten findings, checklist, missing-coverage list and final uncertainty section are present. The incomplete part was the implementation response/documentation, not the report file write.

Codex completed the guard/recovery checks in `20d9d28` and performed a separately documented **same-session read-only equivalent rules audit**. Codex wrote the follow-up fixes, so this is not an independent review of those fixes. The original reviewer did not inspect the final follow-up commit.

### Current owner decisions and hashes

- One centralized planner, `gpt-6-luna`, medium, batch four, seed zero. One paid attempt, no automatic retry.
- Knockouts are recorded, not terminal; normal engine recovery is retained. No healing, teleport, item grant or state injection was added.
- Required objective remains the earned Shears/maze chest, combat defeat, claimed wig, accepted offering and actual `chapter0.complete`.
- $2.00 cap, 400 calls per hero and 7,200 s model wall-clock bound. Other game/decision/token limits remain as documented above.
- Guidance text is unchanged from Claude's health-aware revision 2: SHA-256 `7f3203b954001d9e302b154cc77423cdb8fe36f63e4434c7a9ac7fc4a33d2166`; full prompt `59e46825cefa03608f7481c681b625f6204e13c2156eb6f66cb1a6b7f18183c7`; definition `43f72cfe7a2e152527df2a91b2eaa18a281abf5a51bcee58dabcd9851757f5f9`.
- Design/guidance have the recorded provisional owner approval, but the exact hashes and reviewer caution about strong role/nest hints remain visible for final authorization. **Execution remains locked:** `SHOWCASE_PAID_APPROVED = false`; guidance status `proposed`, with no approved hash. Neither lock was flipped.

### Reviewer findings: disposition

| Finding | Severity | Follow-up |
| --- | --- | --- |
| 1: wrong effective wall default | Major | Completed Claude's default helper; both manifest and actual summary use 7,200 s for a showcase model run. A real free failing-gateway run tests those fields. Other model cases remain 3,600 s; free baseline stays 600 s. |
| 2: version-1 evidence presented as current | Major | Revision-1 folder and its original bytes remain historical. New `free-validation-v2/` contains current hashes, free baseline, mock prompt-path check, actual-knockout probe, exact replays and validation/provenance. Index and this document distinguish them. |
| 3: seed/count/retry scope | Minor | Paid showcase requires exactly `[0]`, correct provider/model/effort/batch/guidance; excess cap and resume/retry are refused before dispatch. CLI adds the exact seed/config/cap check before credentials. Tests mock the approval flag **only inside a test**, never in runtime source. |
| 4: strong demo guidance | Minor / owner decision | Text preserved and hashes disclosed; no coordinate/waypoint/maze-answer addition. This remains prompt-tuned demonstration guidance, not transfer evidence. Final execution authorization must cover this exact text; provisional approval is not a paid unlock. |
| 5: advance knockout knowledge | Minor | Existing public manual, Health and recovery, explicitly says zero HP returns a hero to the current spawn at 100 HP. The reviewer stated otherwise after searching; report is not edited. The briefing discloses the same rule; it is not a hidden-state observation. |
| 6: outdated comments/status | Minor | Pending cap/default comments corrected; current section controls. Historical v1 measurements stay labelled historical. |
| 7: new baseline admitted on A/B/C | Minor | `baseline-showcase-route` is restricted to the showcase. The C player-kind admission test now expects rejection for this new demonstration-only player; C definition, policy and recorded results are unchanged. |
| 8: A/B/C isolation uncertainty | Info | Reviewed the actual diff: only new showcase-gated branches in environment/evaluator/suite. Twelve frozen run-path files are byte-identical to `eeb2b59`; server/shared/manual/art/declarations/official trace paths have an empty diff. All nine official traces replay exactly at `20d9d28`. |
| 9: replay pacing / last tick | Info | A fresh baseline trace was recorded as a speed-1 replay. All step hashes match; metadata reports 8,499 paced ticks = 141.65 s and 141.65 wall-s, versus 8,500 total ticks. The final tick accounting difference is disclosed, not hidden. |
| 10: one planner | Info | Confirmed and disclosed: one joint planner controls both heroes. The scripted comparator has independent per-hero observation memories; it is not another LLM. |

### Current free verification and recovery

The baseline at `20d9d28` succeeds in 8,500 ticks (141.7 game-s), decisions 962/1,064, zero invalid actions/model calls, end hash `2678c3a03c7d38e0ac1cd7e9088398d41b6e74d529fb8712e85782658ca30647`. Its new trace exactly replays all 2,025 step results.

The **certification probe**, not an official baseline/model result, deliberately exposes Coco to ordinary Griffin attacks through legal actions. It records two knockouts (one each hero) and still succeeds in 9,285 ticks (154.8 saved game-s). Around Coco's knockout, HP goes from 10 to 100 in the same area; the backpack, claimed rewards, full story-flag list and completed maze burned/cow/wolf/gate progress are unchanged. Griffin HP stays 640 while its phase naturally advances. All four later milestones follow recovery. The probe trace replays all 2,085 results to end hash `09c07331bf8c0c27ee3d447bec14e81432476579013ab2fb94708e0e2aacf1f6`. No player observation/contained legal list includes evaluator showcase metadata. The separate Hedge-Maze-in-area knockout and a full planner-after-knockout trace remain additional coverage, not claimed tests; the exercised engine recovery and retained maze progress satisfy the current recovery check without changing mechanics.

Current free mock check ends `error` via the planner watchdog (235.5 game-s, 144 simulated calls, $0), not a successful model showcase. It exercises the current prompt path and is labelled mock-only. The current free baseline replay video is likewise a **baseline replay**, not the final model showcase or the required submission recording.

### Recording honesty

Live `speed: 1` is a configuration label: the live acting loop can skip waits at action boundaries, so acting portions may run faster than wall time; the live discrepancy was not quantified here. No shared live/game clock was changed. The normal-speed clip must use the game-clock-paced, exact-action replay and be labelled **REPLAY of recorded model actions; no model calls**, alongside the original unedited model capture. The viewer shows human HUD hints that are excluded from agent input. Startup, pauses and final hold make full file duration differ from game duration. Earlier A/B/C videos and manifests remain untouched; this timing caveat does not change their game hashes or outcomes.

### Ledger and paid command (not executed)

Read-only canonical inventory: 35 entries, no open reservations, no lock, $5.872516 committed total, $5.869595 committed to pilot; remaining **pilot $2.130405, total $19.127484**. A $2 reservation succeeds on a scratch copy, leaving $0.130405 pilot there. The canonical file hash is unchanged and no real reservation was made. Balances must be checked again at dispatch; the key/provider path is untested by these free checks.

From `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval`, **only after separate final owner authorization and a reviewed unlock commit**:

```sh
npm run eval:live -- --scenario showcase-maze-griffin-complete-v1 --seed 0 --player model-centralized \
  --guidance showcase-maze-griffin-v1 --gateway openai --model gpt-6-luna --effort medium --max-batch 4 \
  --max-spend-usd 2.00 --wall-seconds 7200 --paid
```

This command is currently refused by the paid lock before credentials/provider access (subprocess regression check). It is a proposed command, not permission or a completed run. No retry, push, merge, course PR change or submission was performed. Residual risks are model navigation/combat stalls, recovery consuming the call/time/spend limits, untested provider availability and the known recorder-message test failure; no completion probability is claimed.

### Completed validation inventory

At `20d9d28`: typecheck and build pass; 53/53 targeted tests pass. The permitted broad suite reports 1,355 pass and one pre-existing `s2Shutdown.test.ts:59` recorder-timeout wording failure in 139 files. Separate S1–S3 scripted checks report six pass and one skip. Held-out/full-route cases were excluded. The baseline replay video fully decodes without errors (152.84 s decoded duration); its inspected terminal frame shows success and all required milestones. Current logs, trace hashes and provenance are in [free-validation-v2](../../midterms/saadsatter/evidence/showcase/free-validation-v2/README.md). No additional gameplay edits followed these checks.
