# Evaluation suite (declared before tuning)

**Status: frozen, provisional.**
- The owner approved this suite on 2026-10-27, pending the professor's confirmation. **The professor has not confirmed it.** Do not describe it as professor-approved until that confirmation is recorded in the change log below.
- The commit that adds this file is the freeze point. No prompt has been tuned and no scenario-specific baseline heuristic has been written before it.
- Any later change to a scenario, seed, limit or player goes in the change log, with a date and a reason. Results from before and after a change are reported separately.

The code definitions are `packages/agent/src/suite.ts` (scenarios, seeds, start states) and `packages/agent/src/evaluator.ts` (goals and limits). The suite is tested in `packages/agent/test/suite.test.ts`.

## Scenarios

Each scenario's start state is reached by **real play**. At reset, a prefix of the verified scripted route (`packages/agent/src/route/`) runs through the environment's own five operations. No fixture, teleport or item injection is used.

After the prefix:
- decisions, invalid actions and each hero's memory are cleared;
- the episode's game time starts at that tick;
- the trace's `reset` line records the prefix's name and the start-state hash.

> **Suite revision 2 (2026-10-28):** S2 and S3 are swapped. S2 is now Hedge Maze (Enchanted Shears) and S3 Mirror Pond (Vanity Mirror); S2-local and S3-local likewise. The table below is the **revision 1** declaration, kept as written. Revision 1 S2/S3 survive unchanged as S2-v1/S3-v1 (and S2-local-v1/S3-local-v1). Records without `suiteRevision` use revision 1 ids. See the change log and [SUITE_REVISION2.md](SUITE_REVISION2.md).

| Id | Role | Start | Success (read from the authoritative state) | Game time | Model calls / decisions per hero | Route reference |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | tuning | the `goddess` checkpoint (tick 0) | the opening scene is finished and the party is in a quest area (Mirror Pond, Hedge Maze or Griffin Enclosure) | 90 s | 60 / 240 | 426 ticks |
| S2 | tuning | shrine after the opening scene (tick 221; prefix: opening scene) | the Vanity Mirror is in the shared backpack | 300 s | 400 / 1,600 | about 5,300 ticks (travel and pond) |
| S3 | tuning | the same start as S2 (identical start hash) | the Enchanted Shears are in the shared backpack | 300 s | 400 / 1,600 | about 4,500 ticks (travel and maze) |
| S4 | **held out** | shrine holding the Vanity Mirror and the Enchanted Shears (tick 9,979; prefix: opening, Hedge Maze, Mirror Pond) | `chapter0.complete` | 180 s | 300 / 1,200 | 2,433 ticks |
| F | **held out** | the `goddess` checkpoint (tick 0) | `chapter0.complete` | 480 s | 1,000 / 4,000 | 12,412 ticks |

Notes on the limits:
- **Game time** is simulated time (60 ticks = 1 s), measured from the scenario's start. It is roughly 3–4 times the scripted route's time for that part.
- **Model calls** are attempted calls, failed and timed-out ones included. The F cap is the owner's provisional 1,000 calls.
- **Decisions** are steps: with batching, up to 4 per model call.
- **Tokens:** 1, 4, 4, 3 and 8 million per hero (reported tokens) for S1, S2, S3, S4 and F.

**Common limits** (central `ModelBudget` in the runner):
- 30 s per-call timeout, configurable;
- SDK retries off;
- one total spend cap per episode;
- a 3,600 s real-world ceiling;
- 3 consecutive policy failures end the episode with `error`.

**Held-out rule.** S4 and F are not run by a model or by the quest-aware baseline until the final evaluation. Prompt tuning and baseline development use S1–S3 with the tuning seeds only. The scripted route has passed through all of S4 and F. That route is development evidence that the quest can be finished, not a player.

## Seeds

| Use | Seeds |
| --- | --- |
| Tuning (S1–S3 only) | 0, 1 |
| Final trials (all scenarios) | 100, 101 |

The game has no randomness. A seed fixes the room code and the seeded evaluation ids (`runtime.ts`), and so the order of id-based tie-breaks. The scripted route behaves identically for seeds 1–8. **Different seeds are therefore reported as reproducibility trials, not as different game situations**, unless a run shows that they produce different gameplay. Variation between trials of a model comes from the model.

Baseline and model runs of a scenario and seed must have the same start-state hash; the hash is recorded in each trace.

## Players

| Player | What it is | Status |
| --- | --- | --- |
| `model-history` | `LLMPlayer`, one per hero, batches of up to 4 actions, its own notes (400 characters) and its last 8 actions; messages only through `message`. Model: Haiku class, exact id and price to be verified | adapter done; no paid calls yet |
| `baseline-quest` | Quest-aware scripted baseline, one per hero, using only its own observation and messages; its quest knowledge is hand-coded and disclosed | planned (`docs/midterm/BASELINE_PLAN.md`) |
| `baseline-explore` | The exploration baseline from PR #7, kept as a weaker comparison | exists |
| `model-obs-only` | The same model without notes or recent actions, on S1–S3. The rubric expects bounded history to be compared with an observation-only player for partial-observation games | **proposed, needs owner approval**; if approved, add it here through the change log before any tuning |

All players get the same observations and legal actions, under the same information restriction: signs and labels as drawn, HUD goal lines hidden from everyone, health shown as bars.

**Trials.** 2 live trials per scenario on the final seeds for each model player. The scripted baselines are deterministic, so their 2 trials are expected to be identical, and that is reported as such.

## Recorded per episode

- scenario, seed, player, provider, model id as returned, game version (git short hash), start-state hash and prefix;
- outcome and terminal reason, game ticks, real seconds;
- decisions, invalid actions and batch stops;
- model calls: attempted, failed and timed out;
- latency (mean and max, over every attempt);
- input, output and cached tokens, with unknown usage marked as unknown;
- estimated cost, at prices verified and dated on the run day.

## Change log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-10-27 | Initial declaration (owner-approved, provisional; professor confirmation pending) | — |
| 2026-10-28 | **S2 episode briefing for model players** (owner-approved). Both model heroes now receive a fixed S2-only block after the general prompt (`S2_BRIEFING`, `packages/agent/src/suite.ts`). It says: the episode is Mirror Pond; Bridge Ruins (the area the shrine's "START / RETURN · E · Puzzle Map 2" sign leads back to) is already completed and out of scope, so do not return there; the goddess's offering is the overall quest goal, not this episode's objective; solve it with normal observations, actions and messages. It gives no direction, position, item or step. Briefed policies are named `…·briefing-<id>`. Scripted baselines receive no prompt and are unchanged. Scenarios, seeds, start states, limits and goals are unchanged. | In pilot-5 (S2 seed 0, OpenAI) the party took the shrine's way back to Bridge Ruins 2.3 game seconds in. Players had only been told "Complete the Goddess's quest together." and could not tell which part of the quest S2 evaluates. Entering Bridge Ruins re-creates its bridge puzzle, which must be solved again to return. **S2 model results before this change (pilot-4, pilot-5) and after it are reported separately.** Audit: `agent-evidence/skill-runs/2026-10-28-suite-s2-briefing.md`. |
| 2026-10-28 | **S2 briefing revised** (owner's text, verbatim). It now also states the objective: "Your objective is to obtain the **Vanity Mirror** and add it to the shared quest inventory." That is S2's success condition, the one the evaluator checks; the item is named, not how to get it. The other points are unchanged apart from wording. The policy-name id changes, so runs with this revision (`·briefing-da2b791e`) are told apart from the first version (`·briefing-` plus that version's id). | The owner decided the open question from the briefing audit (`agent-evidence/skill-runs/2026-10-28-suite-s2-briefing.md`, question 1). No paid run used the first version. |
| 2026-10-28 | **S2 briefing second revision and pilot-6 interface fixes** (owner-approved content; the briefing's wording is the implementation agent's draft, pending the owner's final wording). Briefing: only the shrine's "START / RETURN · E · Puzzle Map 2" sign leads to Bridge Ruins, which stays out of scope; every other area's RETURN exit leads back to the shrine and may be used; visiting another area such as Hedge Maze is not a failure and its objectives may be completed, but only the Vanity Mirror completes the episode. Runs with it are `·briefing-1051906a`. For every scenario and both providers: move results report how far the hero went against open ground (`movement`), the Hedge Maze cow is listed as "cow" with its sign fixed where the client draws it, `self` is truncated to two decimals, and the general prompt gains a screen legend for position and footprint and the line "Tell your partner when your plan changes or when you observe an important change in the world." Scenarios, seeds, start states, limits and success conditions are unchanged. The scripted route and both baselines round `self` back to one decimal internally, so their actions, the S2–S4 start states and the baseline results are unchanged (checked before and after: route seed 1, both baselines on S1–S3 seed 0). | In pilot-6 (S2 seed 0, OpenAI, `·briefing-da2b791e`) both players treated the Hedge Maze's own RETURN exit as forbidden; blocked moves came back looking successful (Coco made 8 moves of 0.0 tiles in a row); the cow kept the label "blocks the lane" after it moved; and Sieg's position read 26.0 while he was drawn in column 25. **S2 model results before this change (pilot-4 to pilot-6) and after it are reported separately; S1 and S3 model results likewise, because the general prompt and observation changed.** Audit: `agent-evidence/skill-runs/2026-10-28-adapter-pilot6-fixes.md`. |
| 2026-10-28 | **Movement report and position fixes after the rules review** (owner-approved, findings 1–6). A move's `movement` now compares only the ticks on which the server moved the hero by that move's input, at the Slow Time state movement actually used; ticks the server did not take the input, or moved the hero itself, are counted separately with their own neutral lines and outcome `not_applied`. `self` truncation no longer has a rounding guard. Prompt legend wording for marked cells. Scenarios, seeds, start states, limits, briefing and success conditions are unchanged; the scripted route and both baselines are pinned unchanged by `scriptedFreeze.test.ts`. | A move starting with Slow Time was falsely reported as blocked (review finding 1, confirmed); server-overridden ticks were counted as walking (finding 2); the guard changed scripted players' rounding on positions reached by walking (property test). **S1–S3 model results from before this change are reported separately.** Audit: `agent-evidence/skill-runs/2026-10-28-adapter-pilot6-review-fixes.md`. |
| 2026-10-28 | **Observation fixes after the independent review** (owner-approved, findings 1–5). Short moves are judged against open ground on unrounded distances; a lethal hit adds a neutral defeat-and-respawn line to the hero's running action (not an interruption); partners, enemies, creatures, projectiles and effects are listed truncated to two decimals like `self`; story-walk ticks are not counted as the hero's walking. Scenarios, seeds, start states, limits, briefing and success conditions are unchanged; scripted behaviour is pinned unchanged (`scriptedFreeze.test.ts`). **Note:** the `explore/S2` and `explore/S3` baseline runs are one trajectory and must not be counted as two independent results. | Independent review (session 37, `fb844ae`): a false collision line on short slowed moves, silent lethal respawns, listed coordinates disagreeing with their drawn cell, and a same-direction story walk counted as walking (reproduced). **S1–S3 model results from before this change are reported separately.** Audit: `agent-evidence/skill-runs/2026-10-28-adapter-independent-review-fixes.md`. |
| 2026-10-28 | **Pilot-7 observation and prompt fixes** (owner-approved; implementation `5ab4693`, record `PILOT7_FIXES.md`). Mirror Pond spike columns are drawn and listed at their full four-tile height (current phase only). The pond's painted text is listed as kind `label` with no screen character. An E press that changes nothing reports "You pressed E; nothing responded." The system prompt gains general communication rules. The shared exploration S2/S3 baseline pin was re-pinned (old values kept in the record). Scenarios, seeds, limits and goals are unchanged. | Pilot-7: a single-cell spike drawing and `o`-marked painted text misled both heroes. **Model results before and after `5ab4693` are reported separately.** |


## 2026-10-28 change log: approved additive local starts

Owner-approved S2-local and S3-local were added in `115c542`. Original scenarios and frozen route/checkpoints remain unchanged. These tuning variants end preparation at ordinary area entry, preserve arrival dialogue and the authoritative world, and reuse parent success predicates/limits with separate identities and results. Do not pool them with travel-inclusive scenarios. Protocol, hashes and restricted test selection: [LOCAL_STARTS.md](LOCAL_STARTS.md). No further local variant is implemented or authorized.


## 2026-10-28 change log: suite revision 2

| Date | Change | Reason |
| --- | --- | --- |
| 2026-10-28 | **Suite revision 2** (owner request). S2 = Hedge Maze, success with the Enchanted Shears; S3 = Mirror Pond, success with the Vanity Mirror; S2-local/S3-local swapped the same way. S1, S4 (held out) and F are unchanged. Starts, limits, caps and predicates are those of the revision 1 definition for the same area. In S2, S3, S2-local and S3-local, model players receive the tutorial-completion briefing (`·tutorial-2ec2f251`; first draft `4242ec52`, never run) as its own block after the verbatim player manual. S2 and S3 each carry an episode briefing: S3 is the approved Mirror Pond text relabelled; the owner approved the S2 Hedge Maze text the same day. Owner decisions the same day: no revision 2 pins yet; `-v1` ids for scripted reproduction only (model runs refused); Flight's duration and cancellation stated in the tutorial briefing; S2-local cost re-estimated (`MODEL_BUDGET.md`). Revision 1 definitions are kept unchanged as S2-v1, S3-v1, S2-local-v1 and S3-local-v1 (same presets, so old episode ids and goals reproduce). Scripted freeze pins are unchanged and run on the v1 ids; no revision 2 pin yet (needs approval). Records gain `suiteRevision` and `scenario`. | Owner: evaluate players who have completed the tutorial, with Hedge Maze as S2 and Mirror Pond as S3. **Revision 1 and revision 2 results are never pooled or compared directly. Every earlier record (pilot-4 to pilot-7, phase-4 summaries) uses revision 1 ids.** Record: [SUITE_REVISION2.md](SUITE_REVISION2.md). Audit: `agent-evidence/skill-runs/2026-10-28-suite-revision2-tutorial.md`. |
| 2026-10-29 | **Pilot-9 observation, Push feedback and prompt fixes** (owner-approved; implementation `a3b19ad`, record `PILOT9_FIXES.md`). In the Hedge Maze, the cow's caption and the "BLACK HOLE → grazing bay" text are labels with no grid mark; the cow is drawn across its 4×4 body (`C`) with its extent. Push with a direction reports movement like a move, and every Push says whether anything moved. The general prompt gains communication rules (trust your latest observation, report significant changes, no repeats, concise messages). Scenarios, seeds, limits, goals and briefings are unchanged; all 14 permitted scripted trajectories are unchanged (no re-pin). | Pilot-9 (revision 2 S2-local): a caption listed as an object was pushed 22 times and later mistaken for the blocker; an arrow drawn `o` on a hedge cell; the cow drawn as hedge; repeated messages. **Model results before and after `a3b19ad` are reported separately.** |


## 2026-10-29 change log: opt-in instruction-guided Maze treatment

Owner explicitly approved a separate `model-guided` player for current revision 2 S2-local, with a static source-verified, role-specific solution walkthrough. Implementation `3b7115b`; [protocol/evidence](GUIDED_MAZE_BASELINE.md). This is intentionally not an information-equal comparison with unaided model-history. Existing scenario definitions, seeds, success predicates, limits, frozen pins and ordinary prompts are unchanged. No guided model result exists yet; no paid or held-out run is authorized here.


## 2026-10-29 change log: opt-in persistent memory player

`model-memory`: `model-history` plus per-hero memory built only from that hero's own observations and results ([MODEL_MEMORY.md](MODEL_MEMORY.md)). Restricted to S1–S3 tuning runs; not approved for final runs. Its results are a separate player kind and are not pooled with `model-history`. Scenarios, seeds, success predicates, limits, frozen pins, existing prompts and observations are unchanged. No model-memory result exists yet.


## 2026-10-29 change log: S2-A evaluation label (Situation A)

`S2-A — Full Hedge Maze` is the evaluation label for current revision 2 S2-local, version 1, and the first situation of a proposed three-situation Hedge Maze suite. It is a label, not a new scenario. S2-local's id, preset, start state (seed 0 `2b9eddd4…`, seed 1 `ebea7d5c…`), success predicate, limits, briefings and observations are unchanged, and historical S2-local traces still replay (tested). Run summaries gain the additive fields `evaluation` (label and definition hash `4b3c9bb3…`), `promptHashes` and `configHash`. Seed 1 differs from seed 0 only in room code and hero ids, so it is a repeated trial, not a distinct situation. Situations B and C are proposed, not implemented. No paid or held-out run. Record: [SITUATION_A.md](SITUATION_A.md).


## 2026-10-29 change log: Hedge Maze Situations B and C

Owner request. Two new tuning scenarios, `S2-B` (cow puzzle; start at tick 1197) and `S2-C` (wolf and key; start at tick 1962). With S2-A (= S2-local) they form three distinct starting tasks in the Hedge Maze. All three are **development-informed, not held out**.
- **Starts:** each is reached by S2-A's normal entry, then a prefix of the committed live `baseline-quest` trace replayed through `step()`. No fixture is used. One of Coco's moves is shortened, for B only.
- **Unchanged rules:** S2-A's success predicate, limits and cap.
- **Briefing:** one shared briefing (draft wording, pending the owner's), plus the tutorial block.

S2-A, S1–S4, F, all existing start hashes, frozen pins and prompts are unchanged.

`baseline-quest`, unchanged, completes B. It ends C at the tick limit: its fixed maze script cannot resume mid-maze. C's completability is shown by replaying the rest of the recorded run. `model-guided` is not available on B or C.

No paid or held-out run. Record: [HEDGE_MAZE_SITUATIONS.md](HEDGE_MAZE_SITUATIONS.md).


## 2026-11-03 change log: P1 "Into the Forest" (the Prologue)

Owner approval (2026-11-03) of the proposal in [PROLOGUE_SITUATION_PROPOSAL.md](PROLOGUE_SITUATION_PROPOSAL.md). P1 is a new tuning-seed scenario, `P1`. It is a directed narrative and navigation situation, distinct from the Hedge Maze.

- **Start:** the game's own `prologue` checkpoint, with no prefix and no fixture. Story stage `ARRIVAL`: Sieg is outside the shop, Coco inside with Alden.
- **Success:** the authoritative story stage reaches `WOODS`. The game sets it when a hero presses E at the Forest Trail's exit after the cart has been found.
- **Limits:**
  - owner-approved: 10,800 ticks (180 s), 250 model calls per hero, a 3,600 s wall clock and $0.60 per episode;
  - retained unchanged: S2-A's 1,600 decisions and 4,000,000 tokens per hero, the 30 s call timeout and 3 consecutive failures.
- **Information:** HUD goal lines hidden; no briefing, tutorial block or walkthrough.
  - New observations apply in the Prologue's scenes and stages only: map labels as the client draws them, `door`, `tipped cart`, `garden gate (open)`, Alden with `E Talk`, and Alden's and the trail's local dialogue as feedback.
- **Frozen:** the definition hash is `baa6b04b…73ac`, pinned by `prologueSituation.test.ts`. The hash includes every model player's full system-prompt hash.
  - P1 is excluded from prompt tuning. Any later change is a new P1 revision, reported separately.
  - P1 is not formally held out: it was designed with full knowledge of the code, and the baseline's route was developed on it.
- **Cooperation:** success does not require Coco (checked in the code and by test). Nothing was added to require it.
- **Unchanged:** S2-A (`4b3c9bb3…`), S2-B, S2-C, S1–S4 and F, every existing start hash, frozen pin, prompt and observation outside the Prologue.

`baseline-quest` (with a disclosed Prologue route) succeeds at seeds 0 and 1: 1,058 ticks, 161 decisions, 0 invalid actions. No model run, no paid call, no held-out run. Record: [PROLOGUE_SITUATION.md](PROLOGUE_SITUATION.md).

### 2026-11-03: P1 audit, independent review and evidence

- **Audit.** `game-rules-audit` (adapter, P1) ran in the implementation session, so it is a self-check: [report](agent-evidence/skill-runs/2026-11-03-adapter-p1-prologue.md). Its two Medium findings (a type error in the new test, and an S2-A test that pinned the exact list of situation ids) were fixed before commit `b62df73`.
- **Independent review.** `rules-reviewer` ran in a separate invocation on the tree later committed as `b62df73`: [review](agent-evidence/reviews/2026-11-03-p1-rules-review.md). It found nothing Critical or High.
  - **Resolved:** Medium F3, the missing baseline evidence, by `docs/midterm/evidence/p1-baseline/` (generated at clean `b62df73`).
  - **Open, awaiting the owner's decision:**
    - F1 (Medium): the shared system prompt's task line names the Goddess's quest, which is not P1's objective.
    - F2 (Medium): indoor scenes ignore the client's camera bounds, so Coco's start view omits "E · UPSTAIRS".
    - F4 (Low): the name `garden gate (open)` is not owner-approved.
    - F5 (Low): confirm the retained limits of 1,600 decisions and 4,000,000 tokens.
    - F6 (Low): the wall clock can be raised by a run.
    - F7 (Low): pinning the prompt hashes couples P1 to any prompt tuning on S1–S3.
  - Any fix to F1, F2 or F4 changes P1 and is a new P1 revision. **No paid P1 run should be made before the owner decides on F1 and F2.**
- **Tests at clean `b62df73`:** typecheck passes; tests 1,123 passed, 1 failed (`s2Shutdown.test.ts`, which also fails at base `16f1a6d`); build passes.


## 2026-11-03 change log: P1 revision 2 (review fixes)

Owner-approved remediation of the independent review's findings. **P1 is now revision 2.** Revision 1 (`baa6b04b…73ac`, commit `b62df73`) is kept verbatim as `P1_V1`, together with its evidence, and was never run by a model.

- **F1.** Model players on P1 get an episode-neutral task line, `NEUTRAL_TASK` (id `4079cad5`), through the situation's new `task` field. The original line ("Complete the Goddess's quest together.") stays byte for byte the default for every other situation, so S2-A, S2-B, S2-C, S1–S4, F and every historical prompt hash are unchanged (tested).
- **F2.** Indoor observations follow the client's house camera (`cameraBounds`): Coco's opening view now includes "E · UPSTAIRS". No other scene is affected.
- **F4.** `garden gate (open)` is removed. The opening is listed as `garden gateway`, with its exact collision gap as extent and no grid mark. The name comes from a source region id (`mapClassification.ts`); it is not on-screen text, and the owner has not yet approved it.
- **F6.** P1's wall clock may be lowered, never raised above 3,600 s (`WALL_CLOCK_CEILING_S`).
- **F5.** The owner confirmed 1,600 decisions and 4,000,000 tokens per hero.
- **F7.** The prompt-hash coupling is documented; the owner has not ruled on it.
- **Revision 2 itself:** preset `P1-v2` (episode ids `P1-v2-<seed>-<start>`), definition hash `7dfac8cd…a655`.
- **Unchanged:** start hashes, success predicate and every limit.
- **Baseline:** `baseline-quest` result unchanged (success, 1,058 ticks, 161 decisions, 0 invalid). Evidence: `docs/midterm/evidence/p1-v2-baseline/`.
- No paid call. Record: [PROLOGUE_SITUATION.md](PROLOGUE_SITUATION.md).
- **Revision 2 checks.**
  - [Self-check audit](agent-evidence/skill-runs/2026-11-03-adapter-p1-revision2.md): 3 Low, 2 Info.
  - [Independent review](agent-evidence/reviews/2026-11-03-p1-revision2-rules-review.md): 1 Medium (the revision 2 evidence, committed right after this commit), 8 Low, 3 Info.
  - Wording errors in `PROLOGUE_SITUATION.md` were corrected before commit.
  - Open for the owner: approval of the name `garden gateway`, the suggested test pins (tutorial id; S2-A full prompt hashes), and the legacy `run-episode.ts` wall clock (scripted only).
  - Verified: `playerKnowledge.ts` only gained lines, `tutorialId()` is still `2ec2f251`, and the revision 1 evidence is byte-unchanged.


## 2026-11-03 change log: P1 revision 3 (final freeze before the first live trial)

Owner-approved.
- **The only change:** the fence opening is listed as `gap in garden fence` (owner's wording) instead of `garden gateway`. Its coordinates, extent (the exact collision gap) and the grid (no mark) are unchanged. A focused test covers the listing.
- **Revision 3 itself:** preset `P1-v3` (episode ids `P1-v3-<seed>-<start>`), definition hash `05a2e744…61aa`.
- **Revision 2** (`7dfac8cd…a655`, commit `28a28de`) is kept verbatim as `P1_V2`, with its evidence. Neither revision 1 nor revision 2 was run by a model.
- **Prompt freeze.** `promptFreeze.test.ts` pins the tutorial briefing (id `2ec2f251`) and S2-A's full system prompts for `model-history`, `model-obs-only` and `model-memory`, directly and through the harness, at their values at `16f1a6d`, which were checked equal there and now.
- **Spend cap on the evaluate launcher.** `evaluate.ts` gains `--max-spend-usd`, the existing harness per-episode cap: it may lower a scenario's cap, never raise it. This allows the owner's $0.15 cap for the first P1 trial.
- **Unchanged:** prompts, start hashes, success predicate and limits. No paid call in this change.


## 2026-11-04 (UTC): first live P1 trial

One owner-approved paid trial on P1 revision 3:
- **What ran:** `model-memory`, seed 0, OpenAI `gpt-6-luna` at medium effort, with a $0.15 episode cap. The launch was `evaluate.ts --max-spend-usd 0.15` from a clean checkout of `b61035f`, after every preflight gate passed.
- **Result:** **success** at 1,574 ticks (26.2 s). Wall time 840.5 s; 177 calls (0 failed); 217 decisions; 0 invalid actions; $0.111395 charged (ledger `pilot-17`).
- **Recording:** a trace-verified replay video.
- **Not changed:** no prompt or configuration was changed afterwards, and no second trial was started.
- **Evidence:** [p1-v3-trial1-model-memory-seed0](evidence/p1-v3-trial1-model-memory-seed0/).


## 2026-11-04 change log: game change ffbdecb (cow posts, griffin HP, story lines)

Owner request: agents struggled to see that the Hedge Maze cow cannot be pulled along its lane, the griffin fight was short, and some story turns were unexplained. Implemented on `main` as `ffbdecb` and merged here as `ea654e8`; the owner then chose a new revision of the frozen evaluation values over reverting the merge.

- **Game.** Stone posts north and south of the cow with a 56 px opening (heroes fit, the cow does not); griffin 640 HP (was 320); new dialogue after the funeral (why ask Emberbrook), after the clues (why search Papa's things) and after the journal (why return to the grave), each ending in a quest line. The cow caption now reads "Harmless cow · too wide for the posts" and sits lower, at (26, 28.8); the agent's copy (`perception.ts`) and the griffin label (`GRIFFIN <hp>/640`) follow the client.
- **Scripted players.** The route, the quest baseline and the guided Maze walkthrough pass the posts at x = 26.5 instead of x = 27.5 (walkthrough `hedge-maze-walkthrough-v2`, id `8fdd1b2d7e65`; v1 was `975e5580671c`). Every scripted outcome is unchanged; runs that cross the maze are 16 ticks shorter.
- **Re-pinned frozen values.** Every start hash changed (the world records a hash of all story content). S1–S4 start hashes, the scripted-freeze fingerprints, S2-A (version 2), S2-B and S2-C (version 2, checkpoints re-derived from S2-A v2's reference run at the same cut ticks) and P1 (revision 4; play identical, only the two hashes moved). Each file records the old value or where it reproduces (`96625b5`).
- **Historical runs.** Version 1 traces (S2-A live baseline, pilots 11–15, the P1 live trial) were played on the earlier game. They replay step for step only at `96625b5`; their tests now check integrity and their recorded start instead. Results before and after this change are reported separately.
- **Wolf laps (`3ca9792`, same day).** Once a hero enters the wolf's loop, the wolf runs laps of it and turns back only when a hero blocks the way. Folded into S2-A/S2-B/S2-C version 2 before any run used them. Scripted outcomes unchanged; the chase takes longer (S2-A baseline 2,974 → 3,128 ticks; route 12,396 → 12,635; S4 start tick 9,963 → 10,202). S2-C's start and baseline and P1 are unchanged.
- **Not done.** No new live (paced, recorded) baseline run and no model run. The new reference traces are offline scripted runs generated on a worktree with uncommitted work in progress.

## 2026-11-05 change log: Hedge Maze wolf clue fix

Owner request, applied as a fix (no new situation version). The wolf clue moved beside the key gate and now says the wolf carries the key and Sieg catches it with E. No rule, start state, success predicate, limit or prompt changed; every pinned hash and the baseline reference are unchanged (tested). Hedge Maze observations differ only in the sign entry, so model runs before this fix saw the old sign. Details: [MODEL_NAVIGATOR.md §7](MODEL_NAVIGATOR.md#7-wolf-clue-fix-and-catch-2026-11-05).
