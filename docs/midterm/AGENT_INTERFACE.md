# Bald Goddess agent interface (Session 1)

Status: **first milestone implemented.** A two-player five-operation interface over the real game server, a scripted baseline that completes a bounded episode, and an LLM adapter for Claude and OpenAI. **No model-driven run has happened yet**, because no API credentials were available in the implementation session. **Full quest completion has not been shown** by any policy.

## Phase 2 changes (2026-10-27)

Owner decisions of 2026-10-27, implemented on `midterm/evaluation`. Where an older statement below disagrees, this section wins.

- **Signs and in-world labels as drawn.** The default label mode is now `as-drawn`, which reproduces every sign and in-world label the client draws on that hero's screen. `names-only` is kept only for comparison.
- **HUD goal lines stay hidden.** They spell out puzzle solutions, so they are an explicit evaluation restriction for every agent, baseline and model alike. With that restriction, agents see **less** than a human player. No claim of perfect human-observation parity is made.
- **Health as the bar shows it.** Partner and enemy health is reported as the 36 px bar the client draws, in eighths (`health bar about 5/8`), never as numbers. Whether a monster is passive is not drawn, so it is not reported. An attack in progress is reported because its animation is a visible telegraph.
- **Seeded hero ids and raw hashes.** Evaluation rooms use `evaluationRuntime(seed)` (`runtime.ts`): a game-time clock and ids from sha256(seed, index). Hero ids are fixed by the seed, and state hashes now cover the raw state, ids included. Hashes recorded before 2026-10-27 (e.g. `b287dfc9…` in `docs/midterm/evidence/session1/`) used renamed ids and are not comparable.
- **The griffin's label** (kept by owner decision, 2026-10-27). `GriffinView` prints the label `GRIFFIN <hp>/320 · <PHASE>` above the griffin. Agents receive that text because a human sees it. Once the griffin has flown away (`groomingStage` DONE) it is no longer listed, matching the client.
- **Central model budget** (`packages/agent/src/budget.ts`). The runner owns one `ModelBudget` per episode, and a player reaches a model only through a `MeteredGateway` bound to that budget and its own hero.
  - Every attempted call counts toward the per-hero call cap: success, error, timeout, refusal or abort. The cap is exact.
  - SDK retries are off (`maxRetries: 0`).
  - Per-call timeout: 30 s by default, configurable (`--call-timeout-seconds`).
  - Per-hero token cap.
  - One spend cap for the whole episode, covering both heroes. The worst-case cost is reserved before each call. A call with no reported cost is charged its full reservation.
  - Usage the provider does not report is recorded as unknown (`tokens: null`), not as zero.
  - A model whose price is unknown is refused, because the spend cap could not be enforced.
- **Time limits.**
  - The 480 s episode limit is **game time** (`maxTicks` = 28,800 ticks, reason `tick_limit`).
  - A separate real-world limit (`--wall-seconds`, reason `wall_clock_limit`) also aborts calls in flight.
- **Outcome fields added:** `failedModelCalls`, `unknownUsageCalls`, `spendUsd { known, charged }` and `modelLimits`. Every call attempt is a `model_call` trace record with status, latency, tokens, cost, reservation and model id. The reply text is a separate `model_reply` record.
- **`use_item`** takes only `item` (the earlier type's `target` field did not exist in the validator).
- **Prices** in `llm.ts` are the PR #7 values, marked unverified. They must be checked against the official pricing page and dated before any paid run.

## Reliability pass (owner approval 2026-10-27, after the first real-LLM S1 run)

Diagnosis of the first paid S1 run (`evaluation-runs/live/S1-seed0-model-history-anthropic-2026-10-28T00-52-06-030Z`, code `4193424`; kept unchanged): 90 batch actions were skipped but still shown to the model as "recent actions"; 10 `advance_dialogue` presses came back "That line had already moved on" because both heroes pressed the same shared line; 8 replies could not be parsed, and one of them held a valid envelope after junk text; skipped actions, stale presses and parse failures were not counted separately. The five operations, observation boundaries, game rules, scenarios and success conditions are unchanged. Replaying the scripted quest baseline on S1 seed 0 gives the same start hash, end hash and tick count (290) as the run recorded at `6bee662+dirty`.

1. **Action history** (`runner.ts`, `policies/policy.ts`, `policies/llm.ts`). Every proposed action now ends with one status: `executed` (accepted and run), `rejected` (refused by validation or by the game), `stale` (a dialogue press for a line that had already moved on; nothing happened) or `skipped` (never submitted, because the batch stopped, the episode ended, or it was over the 4-action limit). The runner hands the policy a `TurnReport` with each submitted step and its status, the skipped actions with their reasons, and the stop reason. The history player's input now has `completed_actions` (last 8 **executed** actions only), `recent_rejected_actions` (last 4 rejected or stale, with the error, kept apart) and `last_turn` (every proposed action with its status). Proposed actions are no longer logged at decision time. The trace adds `status` to each `step` line and a `skipped_actions` line.
2. **Reply handling.** `AnthropicGateway` sends the player's reply schema as `output_config.format` (`json_schema`). This needs no model or effort change; the allowlist is untouched, and `structured = false` turns it off. The schema (`replySchema()`) describes only the public action format and uses no constraint the API rejects. `parseReply()` validates the envelope conservatively. It accepts one envelope, alone, repeated identically, or surrounded by extra text (marked `recovered`). It refuses: no envelope, several different envelopes, action objects outside the envelope, unknown fields, `action` with `actions`, an empty list, or an entry that is not an object with a `type`. A reply that stopped at `max_tokens` is refused even if it parses. **An unusable reply is never turned into an action:** nothing is submitted, the trace gets a `reply_rejected` line, and the player's next `last_turn` says what was wrong. (Before, a placeholder `unparseable_reply` action was submitted and refused.) Each call record and `model_reply` line carries `meta`: the stop reason, each content block's type and length (never thinking text), and whether output was constrained. Over-limit actions are returned as `dropped` and reported as skipped.
3. **Dialogue each hero saw** (`perception.ts`, `environment.ts`). New observation field `dialogueLog`: the last 12 lines that hero's own dialogue box displayed, oldest first, with the tick. The environment records the line after every tick, every instant action and reset, so lines that appear and move on while a hero waits or acts are kept. It uses the client's own `storyView`: a partner's private line appears as that hero's screen showed it (its `elsewhere` text, or nothing for a blank box), a hero outside a scene who is not watching gets nothing, and lines not yet displayed never appear.
4. **Abstract actions in the prompt.** The system prompt says the legal list is rebuilt every turn from the hero's situation and proximity (e.g. `use_item` only next to an object), that an unlisted action is unavailable now, and that the manual's keyboard controls are not commands: each control maps to an abstract action, and only when that action is listed.
5. **Metrics** (`harness.ts`, `metricsVersion: 2`). Each summary has `metrics.{sieg,coco}`: `modelCalls`, `modelDecisions`, `parseFailures`, `recoveredReplies`, `proposedActions`, `submittedActions`, `executedActions`, `staleSubmissions`, `gameplayRejections`, `skippedActions`. `results.md` gets a second table with them. Legacy fields remain, with two meaning changes because parse failures are no longer submitted: `decisions` (step submissions) and `invalidActions` (environment refusals) no longer include parse failures, and `actions` no longer has an `unparseable_reply` entry. Stale presses were never counted in `invalidActions` and still are not. `aggregate()` leaves summaries saved before version 2 out of the new sums (`metricsEpisodes` says how many were included).
6. **Shared dialogue guidance** (prompt only). One press from either hero moves a shared line on for both (`readLine` in `apps/server/src/prologue.ts`), and a second simultaneous press comes back stale. The prompt suggests agreeing by message who moves shared lines on, for example whoever is speaking, or one hero for the scene, while the other waits. There is no controller, shared memory or new channel. The stale feedback now says the line was advanced first and that nothing happened. `batchStop` reports "dialogue line had already moved on" instead of "invalid action".

Tests: `packages/agent/test/reliability.test.ts` (41 tests: simultaneous dialogue submissions, dialogue seen while waiting, private-line boundary, skipped/rejected history, unusable replies, envelope cases, structured-output request and metadata with a stubbed client, schema features, prompt text, summary compatibility). Some use a labelled synthetic cutscene set on the room, as `modelPlayers.test.ts` does. No evaluation result uses it.

## S2 reliability pass (owner approval 2026-10-28, after the first real OpenAI S2 run)

Diagnosed from the S2 seed 0 OpenAI run (`evaluation-runs/live/S2-seed0-model-history-openai-2026-10-28T05-45-18-865Z`, not committed). Audited before implementation: `docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-s2-feedback.md`. No game rule, mechanic, map or tuning changed; every change is in `packages/agent` and `scripts/midterm`.

1. **Attack presses that do nothing.** `StepResult.attack` is set on every attack: `"performed"` when the server made a swing or cast during the action (a new `combat` record together with J's cooldown), `"none"` otherwise. `accepted` still only means the input was taken. A `"none"` attack adds one feedback line: "Your sword did not swing: J was still recovering from your last swing, so the press did nothing." (Coco: "No fireball was cast: …"), or just "Your sword did not swing." when J was not recovering (for example in the first ticks after the goddess reset, when the game ignores J). No remaining time is given: the HUD draws no J timer (audit finding 1). In the S2 run, 94% of Sieg's and 85% of Coco's accepted presses were made while J showed "recovering".
2. **Visible world changes** (`packages/agent/src/worldEvents.ts`). Two watchers, checked every tick against that hero's own camera with the same rule `perceive` uses for `visible` (`onScreen`), only for a hero in the same area: "The dry hedge at (19, 34) disappeared." at the moment its shrubs stop being drawn (neutral wording with no cause; it was "burned away" until the independent review's finding 8); and one line per action for a cow the hero watched move, for example "The cow moved w, from (26, 25) to (23.8, 25)." Lines describe only what is drawn; they never state a cause, puzzle progress or the hidden `parked` flag. A change that happened off-screen is never reported later. Audible cues that the client plays scene-wide (burn, cow-parked sound) are not reported (owner default: visible only).
3. **OpenAI schema per action type** (`splitActionTypes` in `policies/openai.ts`, from `actionFields` in `types.ts`). Strict mode requires every property, so with one shared action object the model filled `ticks` on attacks (79 of the run's 81 invalid actions). Each action type now has its own closed object listing only its fields. The action set, `legal_actions` and `validate()` are unchanged (an attack with `ticks` is still refused); the Anthropic schema is unchanged. The split throws unless it finds exactly one action object, so a change to the reply schema cannot silently bring back the shared object.
4. **Whitespace runaway.** OpenAI's output cap is 2,000 tokens (was 4,000; largest complete reply in the run: 1,247). A reply cut off at the cap is never repaired. For OpenAI only (`readTruncated`): complete JSON followed only by blank characters is read as written and counted as recovered (`recoveredReplies` now also counts these); complete but unusable JSON gets its real parse reason; a reply that broke off inside the JSON after a long blank run is refused with a reason that says so. An Anthropic reply cut off at its limit is always refused, as before.
5. **Prompt guidance** ("Playing efficiently" in `systemPrompt`): batch clear sequences, J recovery, recharge waits, not repeating an action that did nothing or an unanswered message, compact JSON. No scenario content and no new action types; wait durations unchanged.

Effects on records: baseline actions and game-state hashes are unchanged (S1–S3 seed 0, both baselines, compared before and after). Traces gain the `attack` field on attack results and the new feedback lines; because an observation's `feedback` holds the last 8 lines, older lines leave that window sooner. A batch still stops on any feedback, so the new lines also stop batches. Tests: `s2Feedback.test.ts`, `s2Adapter.test.ts`, `s2Shutdown.test.ts`.

## S2 episode briefing (owner approval 2026-10-28, after pilot-5)

A scenario may carry a fixed episode briefing (`Situation.briefing`, `packages/agent/src/suite.ts`). Only S2 has one (`S2_BRIEFING`). `LLMPlayer` appends it as a separate block (`briefingBlock`) after the unchanged general prompt (`systemPrompt`), so both heroes get the same text, and either provider receives the same system string. The policy name gains `·briefing-<first 8 hex of its SHA-256>`. The observation, legal actions, game rules and map transitions are unchanged; there is no invisible wall or teleport. Scripted baselines get no prompt. Tests: `packages/agent/test/s2Briefing.test.ts`. Change log and reasons: `EVALUATION_SUITE.md`.

Two related, pre-existing facts are recorded but not changed:
- **Bridge Ruins resets.** Every entry to Bridge Ruins re-creates its bridge puzzle at stage 1, and the way back to the shrine needs it completed again (`GameRoom.transition`; the exit check in `GameRoom.ts`).
- **One area, three names.** The agent-side area name "Bridge Ruins" (`perception.ts`) differs from the drawn sign "Puzzle Map 2" and from the room checkpoint "The Bridge That Hates Cooperation".

## Pilot-6 fixes (owner approval 2026-10-28)

Diagnosed from pilot-6 (`evaluation-runs/live/S2-seed0-model-history-openai-2026-10-28T17-52-53-702Z`, not committed). Audited before implementation: `docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-pilot6-fixes.md`. No game rule, mechanic, map, tuning, scenario, start state or success condition changed; nothing under `apps/` or `packages/shared/` was edited.

1. **Movement outcome** (`movementReport.ts`, `environment.ts`, `types.ts`). A finished `move` that stayed in the same area has `StepResult.movement`: `outcome` (`full`, `partial` or `none`), `movedTiles` (progress along the requested direction), `requestedTiles` (how far the same input would have carried the hero on open ground for the ticks that ran), and `from`/`to`. The open-ground distance replays the shared kinematics (`stepMovement`) each tick on a copy of the hero, with no obstacles and no map edge; the room is never touched. *(As first implemented in `bdfcf7c`, the replay used the Slow Time state from before the tick, which misreported moves at Slow Time's start and end, and it counted every tick, including ticks the server did not move the hero by this input. Both were corrected by the review fixes below.)* `full` means at least 90% of that distance; `none` means under 0.02 tiles (less than a pixel). `accepted` keeps its meaning (the input was taken). A `partial` or `none` move adds one feedback line, for example "You moved s only 1.59 of 2.97 tiles, from (5, 34) to (5, 35.59). Something stopped you." It never names what stopped the hero. A `full` move adds no line, so a batch of clear moves is not stopped, while a short one stops the batch (feedback rule). The history player keeps `movement` in `completed_actions`; `last_turn` already carries the whole result. Other actions (including push) report no movement.
2. **The cow and its sign** (`perception.ts`). `HedgeMazeView` draws the cow sprite where the cow is and the text "Harmless cow · blocks the lane" as a separate label fixed at (26, 27.7) that never moves or hides. Perception now matches: a `creature` named "cow" at its live position, and an `object` with the sign text at (26, 27.7) (names-only: "lane sign"). The sign has no screen-grid character, because it floats over open floor in the lane. No `parked` state, cause or completion is reported.
3. **Position** (`perception.ts`, prompt legend). `self.x`/`self.y` are truncated (not rounded) to two decimals, so their whole-number part is always the cell `@` is drawn in (pilot-6: Sieg at x≈25.96 was told 26 while drawn in column 25). The general prompt says so, that a ".", "#" or "~" cell shows what lies at its centre (an obstacle can cover part of a "." cell or leave part of a "#" cell open) while a hero, creature, enemy, object, exit or projectile drawn in a cell replaces that character and hides the ground under it, and that a hero's body is a square about 0.8 tiles wide (2 × `HALF` = 26 px). Other coordinates keep one decimal. **Scripted players:** the route and both baselines round `self` back to one decimal (`asTuned`, `policies/navigate.ts`), a policy-side choice that keeps their frozen behaviour. Without it, the 2-decimal value changed the route (12,412 → 12,385 ticks, and so the S4 start state) and the quest baseline's S2 and S3 runs.
4. **S2 briefing, second revision** (`suite.ts`). See the change log in `EVALUATION_SUITE.md`. Still S2 only.
5. **Communication line** in the general prompt, for both heroes, both providers and every scenario: "Tell your partner when your plan changes or when you observe an important change in the world."

**Lane-cleared sound (investigated, not changed).** When the cow becomes parked, every client whose own hero is in Hedge Maze plays the cue "Cow parked / lane cleared" (`SoundEvents.ts:527`): the generic `ok` chime at gain 0.2, with no position, so it does not fade with distance (`GameAudio.ts` attenuation is 1 for cues without x/y). It is silent when the player has muted effects or during a story scene. While the cow slides, "Black Hole pulls harmless cow" plays at the cow's position and fades to nothing about 1,000 px (31 tiles) away. The agent interface reports no sounds (owner default: visible only). The visible line "The cow moved …" covers the slide only when it is on the hero's screen. The chime is the only signal of the hidden parked transition, so a human gets a cue agents do not. In pilot-6 the cow was never parked, so the chime never played. Any change needs a separate owner decision.

Tests: `packages/agent/test/pilot6Fixes.test.ts` (16 tests); `s2Briefing.test.ts` updated for the new briefing text.

### Review fixes (owner approval 2026-10-28)

Fixes for findings 1–6 of the rules review (`docs/midterm/agent-evidence/reviews/2026-10-28-pilot6-fixes-rules-review.md`), audited first: `docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-pilot6-review-fixes.md`. No game rule, mechanic, map, scenario, start state or success condition changed; nothing under `apps/` or `packages/shared/` was edited.

1. **What each tick of a move did** (`environment.ts` `sortMoveTick`, `movementReport.ts`). After every tick the environment sorts each moving hero's tick by engine state:
   - **applied**: the server moved the hero with this move's input (`p.movementInput` holds the frame sent: same `seq`, same direction; `GameRoom.ts` records the movement it used);
   - **not applied**: the server used other input or none (a scene or lock, stale input, a tick the server skipped, the story walking the hero);
   - **moved by the game**: something other than the hero's walking placed them (a `movementEpoch` change: respawn, flight landing, reconnect; or the partner's Slow Time carry, read from the server's carry record before and after the tick).

   Only applied ticks are compared with open ground. Their open-ground step replays `stepMovement` on a copy of the hero taken before the tick, with the same input and the Slow Time state **after** the tick, because Slow Time starts and ends before movement within a tick (`GameRoom.ts:891–916`, movement at 1004). On open ground this matches the server's own step for that tick; it is not a separate speed formula, and it is only as exact as that statement: obstacles are what the comparison measures.
   `MovementReport` gains `ticks: { applied, notApplied, movedByGame }` and the outcome `not_applied` (no tick used the input). A collision line is written only when the applied ticks fell short. Separate neutral lines say "For N of M ticks your hero did not take your movement input." and "For N of M ticks the game moved your hero instead of your own walking."; neither names a cause. `from`/`to` remain where the hero stood when the action began and ended.
   Fixed: a 10- or 30-tick open-ground move that starts on the tick Slow Time begins was reported `partial` with "Something stopped you" (confirmed in the review follow-up); it is now `full`.
2. **Position truncation is exact** (`perception.ts` `truncate2`). The rounding guard (`+1e-9`) is removed. A property test showed that positions real walking reaches sit just below x.x5 boundaries often enough that, with the guard, 61 of 60,540 such positions gave the scripted players (`asTuned`) a different one-decimal value from the old `round1`. Without it, none do. As a consequence, a stored double just below a hundredth now reads one hundredth lower (0.29, stored as 0.28999…, reads 0.28); the whole-number part is unchanged and still equals the `@` cell. Remaining theoretical window for `asTuned`: the double just below a decimal x.x5 boundary (within about 1e-14 tile, e.g. 1.45), documented in `asTuned.test.ts`.
3. **Prompt legend** for marked cells, as in item 3 above.
4. **Docs**: the claim that movement was counted "exactly as the server counts" it is withdrawn (above).

Tests: `pilot6ReviewFixes.test.ts` (Slow Time starting with the move, Slow Time ending during it, a genuine collision under Slow Time, Super Speed with and without Slow Time, a damage-interrupted move, ticks the server skipped, ticks the story walked the hero, a tick in which the server's reconnect handler placed the hero, an area transition during a move); `asTuned.test.ts` (random, walking-step and boundary property tests, the documented window, no mutation); `scriptedFreeze.test.ts` (the route on seed 1 and both baselines on S1–S3 seed 0: actions, state hashes, outcome, ticks and end hash, pinned to the values recorded at `7bd0c7e`). Not covered by a test: the Slow Time carry path (the code reads the server's carry record; a carry was not reproduced in a test).

## Independent-review fixes (owner approval 2026-10-28)

Fixes for findings 1–5 of the independent review (`docs/midterm/agent-evidence/reviews/2026-10-28-pilot6-independent-review.md`, session 37, committed unchanged in `fb844ae`), audited first: `docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-independent-review-fixes.md`. No game rule, mechanic, map, checkpoint, scenario or success condition changed; nothing under `apps/` or `packages/shared/` was edited.

1. **Short moves** (`movementReport.ts`). Outcomes are decided on unrounded distances, as shares of the open-ground distance: `full` at 90% progress or more, `none` when the hero travelled under 5% of it, `partial` otherwise. A new `blocked` field (true for `partial` or `none` when open ground was available) gates the collision line. Before, `none` used an absolute 0.02-tile cut, so a 1-tick slowed move (0.0198 tiles) on open ground was "blocked". `movedTiles`/`requestedTiles` are rounded to two decimals; `from`/`to` are truncated like `self`, so `to − from` can differ from `movedTiles` by up to 0.01 (documented in `types.ts`).
2. **Lethal hits** (`environment.ts` `watchRoom`, `KNOCKED_OUT`). The engine handles a lethal hit inside the public `GameRoom.damage`: HP back to 100, the hero placed at the area's spawn and `movementEpoch` advanced, in one call, so no snapshot ever shows 0 HP. The environment wraps that method on its own room: it calls the original unchanged and records a hero whose epoch changed during the call (only the respawn does that). The hero's running action, whatever it is, then gets one line: "Your health ran out. You are back at this area's starting point with full health." It restates the manual's rule (`Player_Manual.md:108`) and what the screen shows; it gives no source or amount. **The action is not interrupted**: it continues from the spawn point, as a held key does for a human. Interrupting it was implemented first and changed the frozen scripted runs (the scripted route on seed 1 and the exploration baseline on S2 and S3 meet lethal hits), so the non-interrupting form was chosen to keep them identical; whether to interrupt is an owner decision. The respawn tick of a move stays a game-moved tick, never walking.
3. **Listed coordinates** (`perception.ts` `MOVING_KINDS`). Partners, enemies, creatures, projectiles and effects are listed truncated to two decimals like `self`, so their whole part is the cell their mark is drawn in (e.g. a partner at 25.96 is listed 25.96, drawn in column 25; before, 26). Fixed objects and exits keep one decimal. The listing rule is unchanged: the same things are listed (checked against the pre-change code). `asTuned` rounds the moving kinds back to one decimal for the scripted players.
4. **Carry** (`environment.ts` `watchRoom`). Reset fails loudly if the server's Slow Time carry record is missing, instead of silently treating carries as walking. A committed test reproduces a carry.
5. **Story walks** (`environment.ts` `sortMoveTick`). A story walk keeps the frame's `seq` and its unit vector can equal an axis-aligned move; reproduced with a labelled fixture walk mark (all 10 walked ticks were counted as the hero's own). Ticks on which the public `World.story.walks` record says the story walks the hero (`walks[id]` present and its start reached, the same condition `storyWalkInput` uses) are now counted as not taken.

**Evidence corrections.** The session-evidence extractor no longer lists the example submission URL quoted in `MIDTERM_GUIDELINES.md` (`game-dev-f26/pull/123`) as a pull request; the PR line of records 23, 24, 25, 27, 28, 30, 33 and 37 was corrected in place (that line only). The `explore/S2` and `explore/S3` freeze pins are one trajectory (both start from the same post-opening state and the exploration baseline has no briefing); they are not two independent results.

Tests: `independentReviewFixes.test.ts` (short moves for both heroes with and without Slow Time, short blocked moves, a lethal hit during a move and during a wait with a determinism check, listed coordinates at 25.96, 25.996, 25.5 and 26.01, the unchanged listing, `asTuned` for moving kinds, a Slow Time carry, a same-direction story walk); `scriptedFreeze.test.ts` unchanged and passing.

## Action batching (owner decision 2026-10-27)

A player may answer one decision with up to **4 actions** (`MAX_BATCH`, `packages/agent/src/batch.ts`):

- The five operations are unchanged. The runner submits the actions one at a time through the ordinary `step()`, so each is validated against the legal actions at that moment, exactly as a single action would be.
- Between two actions of a batch the runner calls `observe()` and traces that observation (`inBatch: true`). It does not call the model.
- **The batch stops** after a step when any of the following happens (`batchStop`):
  1. the step was invalid;
  2. the episode ended;
  3. the environment reports an interruption (a new area, a new dialogue line, damage);
  4. the step produced any feedback;
  5. dialogue is on the hero's screen;
  6. the hero's area, HP, backpack or journal changed;
  7. a new message arrived from the partner.

  A `batch_stop` trace line records the reason, how many actions ran, and how many were offered.
- The next decision receives every step of the batch with its result, and the reason it stopped early (`last_turn` in the model's input).
- **Accounting.** One model call per batch. Every step counts as a decision. The full preset allows 1,000 model calls and 4,000 decisions per hero (provisional, 2026-10-27).
- **Equivalence** (`packages/agent/test/batch.test.ts`). The same action sequence, run unbatched or in batches of 4 (with the actions a stopped batch did not run offered again), ends in the same raw world with the same steps and results. Only the number of decisions differs. The test's run includes stopped batches and full batches of 4.
- `LLMPlayer(..., maxBatch)` defaults to 4. Pass 1 for the unbatched player; its prompt then asks for a single `"action"`.

Owner decisions this work follows (2026-10-23):

- Agents do not see the scene-specific HUD goal lines, which spell out solutions.
- The LLM adapter supports both Anthropic and OpenAI, switchable.
- The interface is headless, in `packages/agent`.
- Episode: from the `goddess` checkpoint until `chapter0.complete`.
- Full-episode limits: 480 s, 400 decisions per hero.
- Milestone 1: finish the opening scene and leave the shrine within 90 s.
- LLM pilot limits: ≤ 40 model calls per hero and a $1 total spend cap.

## Files

| Path | Role | Who may see it |
| --- | --- | --- |
| `packages/agent/src/types.ts` | Public schema: actions, observations, results, outcome | Players (shape only) |
| `packages/agent/src/environment.ts` | `AgentEnvironment`: the five operations and the shared-clock scheduler | Trusted |
| `packages/agent/src/perception.ts` | Builds one hero's observation from the authoritative room | Trusted (only its output reaches players) |
| `packages/agent/src/actions.ts` | Legal actions, validation, translation into ordinary game inputs | Trusted |
| `packages/agent/src/evaluator.ts` | Episode definitions, success checks, private milestones, state hash | Evaluator only |
| `packages/agent/src/runner.ts` | Runs one independent decision loop per hero | Trusted |
| `packages/agent/src/trace.ts` | Hash-chained JSONL trace writer and verifier | Evaluator only |
| `packages/agent/src/policies/baseline.ts` | Scripted exploration baseline (observation-only) | Player |
| `packages/agent/src/policies/llm.ts` | LLM player, Anthropic and OpenAI gateways, spend cap | Player (plus trusted accounting) |
| `packages/agent/test/environment.test.ts` | 33 deterministic tests | n/a |
| `scripts/midterm/smoke.ts` | The 8-step harness from the brief | n/a |
| `scripts/midterm/run-episode.ts` | Runs a full baseline or model episode and writes a trace | n/a |
| `docs/midterm/evidence/session1/` | Recorded traces and summaries | Evaluator |
| `package.json` | Adds `@anthropic-ai/sdk` | n/a |

**No game code was changed.** Nothing under `apps/` or `packages/shared/` was edited. Gameplay, puzzles, combat, items and story are untouched.

## How it reuses the engine

- **reset:** builds a `GameRoom` exactly as `RoomManager.create("goddess")` does: `new GameRoom(code, false, "MAIN_HOUSE", true, "goddess")`. It then adds two players, selects OATH/EMBER and readies both. The story checkpoint places both heroes at the Goddess Shrine with story stage `GODDESS`.
- **Timed actions** (move, wait, attack, defend, abilities, world E) become one `InputFrame` per tick passed to `room.receiveInput`, followed by one `room.tick()`. This is the same intent path the browser uses, and the server still validates position, cooldowns, collisions and damage.
- **Panel actions** call the same room methods the Socket.IO handlers call: `useItem`, `readStoryLine`, `chooseStoryLine`. They pass the same arguments the browser client sends, including the dialogue line the hero was looking at.
- **Dialogue text, journal and backpack** come from the client's own pure functions: `storyView` (`apps/client/src/ui/storyDialogue.ts`), `questLog` (`ui/questLog.ts`) and the inventory panel's nearby-target rule.
- **Success** is read from authoritative state: `story.flags` contains `chapter0.complete` (`FINALE.complete`).

## Interface schema

```ts
reset(seed: number): Promise<EpisodeState>
observe(player: "sieg" | "coco"): Promise<Observation>
legal_actions(player): Promise<ActionSpec[]>
step(player, action: GameAction): Promise<StepResult>
outcome(): Promise<GameOutcome>
```

**Actions** (`GameAction`). Durations are 1–60 ticks, at 60 ticks per second.

| Action | Fields | Becomes |
| --- | --- | --- |
| `move` | `direction` (n, ne, e, …), `ticks` | Movement held for that many ticks |
| `wait` | `ticks` | Neutral input |
| `attack` | optional `direction` | J tap: sword or fireball |
| `defend` | `ticks` | K held |
| `ability` | `ability`, optional `direction`, `ticks` (push only) | Sieg: push (1, held), super_speed (2). Coco: slow_time (1), flight (2), black_hole (3) |
| `interact` | none | The client's E: uses the nearby panel object if there is one, otherwise E in the world (travel markers, pickups) |
| `use_item` | optional `item` | The backpack panel's action on the nearby object |
| `advance_dialogue` | none | E on a dialogue line this hero may move on |
| `choose_dialogue` | `option` | A numbered story response |
| `message` | `text` (≤ 200 characters; 64 per hero per episode) | Delivered only to the partner's observation |

`legal_actions` lists only the action types available right now, with allowed parameter values:
- Abilities that are recharging are left out, as the HUD greys them out.
- `use_item` appears only when the backpack panel would name a nearby object.
- During a story scene only dialogue, `wait` and `message` are offered.

Nothing in the list indicates which action helps.

**Observation** fields:
- `self`: tile position, facing, HP and status
- `abilities`: the ability bar with ready / active / recharging states
- `screen`: a 20×12 character grid of the hero's own 640×360 camera view
- `visible`: on-screen partner, enemies with health bars, creatures, objects, exits and projectiles
- `dialogue`: the line the client shows this hero, and whether they can move it on
- `journal`, `inventory`
- `discovered`: areas visited, and a coarse outline of explored parts of this area
- `feedback`: this hero's own recent results
- `messages`: from the partner

**Never included:** puzzle flags, timers, hidden enemy or griffin state, other areas' contents, story flags, future dialogue, ids, or the HUD goal sentence.

**Labels.** In-world labels drawn by the client are reproduced as text, exactly as drawn (`as-drawn`, the default since 2026-10-27). `--labels names-only` cuts instruction labels to their names; for example, "FIREBALL · dry hedge" becomes "dry amber hedge".

**StepResult:** `accepted`, `error`, `ticks` elapsed, `interrupted` reason, `attack` (attacks only: `performed` or `none`), `feedback`, `done`.

**GameOutcome:**
- `status`: ongoing / success / terminated
- `reason`: success, tick_limit, decision_limit, model_call_limit, token_limit, spend_limit, wall_clock_limit, error or manual_stop
- ticks, per-hero decisions, invalid actions, model calls, tokens, and the limits in force

## Scheduling and fairness

The scheduler works on decision points:
- Each hero's timed action runs for its own duration. The simulation advances one tick at a time for both heroes, and only while neither hero is deciding.
- A hero's action ends early when they change area, a new dialogue line appears for them, or they take damage. They then decide again while game time is paused.
- Model latency therefore never costs game time, and the slower thinker never gets less game time than the faster one.
- Two submissions never advance the clock twice. Both heroes moving 30 ticks advances the game 30 ticks (tested).
- When both heroes are deciding, their actions are applied together in a fixed order (Sieg, then Coco). This makes runs reproducible regardless of which model replies first.
- Dialogue presses are tied to the line the hero saw. Two presses on one line move it on once, as with two browser clients.

Each hero's runner loop holds only its own policy, observation, legal actions and last result. The heroes share nothing except the game world and the `message` action. The LLM player keeps its own short notes, its last 8 executed actions and its last 4 refused or stale ones (reliability pass, above). Each model call is a fresh request with no shared transcript.

## How to run

```sh
# The 8-step smoke harness (reset → observe → legal → step → observe → outcome → trace)
node --import tsx scripts/midterm/smoke.ts --seed 7 --out evaluation-runs/smoke

# Scripted baseline, bounded milestone episode
node --import tsx scripts/midterm/run-episode.ts --policy baseline --seed 1

# Scripted baseline, full quest (expected to fail; it does not know the quest)
node --import tsx scripts/midterm/run-episode.ts --policy baseline --preset full --seed 1

# Claude (set ANTHROPIC_API_KEY first). The pilot uses the cheaper model approved for the pilot.
node --import tsx scripts/midterm/run-episode.ts --policy anthropic --model claude-haiku-5-5 \
  --max-spend-usd 1 --seed 1

# OpenAI (set OPENAI_API_KEY). Prices must be given with their source; none are guessed.
node --import tsx scripts/midterm/run-episode.ts --policy openai --model <model-id> \
  --input-usd-per-million <n> --output-usd-per-million <n> --pricing-source <url> --max-spend-usd 1

# Tests
npx vitest run packages/agent
```

Each run writes the following to its output folder:
- `trace.jsonl`: every observation and legal set, chosen action, validation result, step result with ticks and wall-clock wait, model call with tokens/latency/cost/raw reply, message, private milestone and terminal event, each hash-chained to the previous line
- `summary.json`

The `--model` default for `--policy anthropic` is `claude-haiku-5-5` (changed from Opus on 2026-10-27). `--max-spend-usd` is required for any model run and is the total for the whole episode. **No paid run is approved yet.**

## Implemented vs. not yet

| Item | State |
| --- | --- |
| Five operations over the real `GameRoom` | Done, tested |
| Separate per-hero observations, no hidden state | Done, tested by leak checks in all four quest areas |
| Legal actions and validation (schema, legality, ownership, stale dialogue) | Done, tested |
| Shared-clock two-player scheduler | Done, tested |
| Termination: success, tick, decision, model-call, token, spend, wall clock, error, manual | Done; model-call, token, spend, error, timeout and wall-clock limits have direct runner tests (`packages/agent/test/budget.test.ts`, 2026-10-27) |
| Hash-chained traces | Done, verified on every run |
| Scripted baseline completes bounded milestone | **Done:** seed 1, 323 ticks (5.4 s game time), 0 invalid actions |
| Baseline on the full quest | Runs; **fails as expected**. It reaches the Griffin Enclosure, collects nothing and stops at the decision limit after 10,744 ticks |
| LLM adapter (Anthropic SDK, OpenAI HTTP) | Implemented; tested offline with a fake model. **No live call made** (no credentials in the session) |
| Model-driven run | **Not yet run.** Needs an API key; command above |
| Full quest completion by any policy | **Not shown** |
| Real-time / video presentation | Not in this milestone (headless) |

## Test results (this session)

- `npm run typecheck`: passed.
- `npm test`: **563 passed, 1 failed** across 75 files. The failure is `apps/client/test/playerView.test.ts`, "shows the directional sprint atlas only during an accepted moving speed boost" (expected frame 25, got 26). It also fails on the base branch before any of this work (530 passed, 1 failed), so it is not caused by this change.
- `npx vitest run packages/agent`: 33/33 passed.
- `npm run build`: passed (exit 0).

## Reproducibility

- The engine has no random number generator. Given the same seed and the same actions, `reset` produces the same start hash, and play produces the same state hashes and observations (tested).
- The baseline milestone run reproduced its final state hash `b287dfc9…` across separate runs. The full-quest baseline reproduced `7585ee94…`.
- **Remaining nondeterminism:**
  - The server names players, projectiles and black holes with `randomUUID()`. These are replaced by order of appearance before hashing and never shown to players.
  - One server check, Slow Time activation (`GameRoom.ts`), requires the latest input to be less than 250 ms old by `Date.now()`. Input freshness for movement is tick-based. The interface sends input immediately before each tick, so the check holds unless a single tick stalls for more than 250 ms.
  - LLM replies are not deterministic.
- The seed currently selects the room code and any policy randomness. It does not change the quest's start state.

## Sample trace (baseline, milestone, seed 1; abridged)

```jsonl
{"seq":0,"type":"reset","tick":0,"data":{"episode":"milestone-1-2b2ab2d9","seed":1,"startHash":"2b2ab2d94203…"}}
{"seq":8,"type":"step","tick":0,"player":"sieg","data":{"action":{"type":"move","direction":"n","ticks":30},"result":{"accepted":true,"ticks":30,"feedback":[],"done":false}}}
{"seq":9,"type":"step","tick":0,"player":"coco","data":{"action":{"type":"move","direction":"n","ticks":30},"result":{"accepted":true,"ticks":30,"feedback":[],"done":false}}}
{"seq":18,"type":"step","tick":30,"player":"sieg","data":{"action":{"type":"message","text":"I'm heading for the exit marked \"south path\"."},"result":{"accepted":true,"ticks":0,"feedback":["Message sent."]}}}
{"seq":225,"type":"milestone","tick":106,"data":{"milestone":"goddess-meet-finished"}}
{"seq":296,"type":"step","tick":316,"player":"sieg","data":{"action":{"type":"move","direction":"nw","ticks":27},"result":{"accepted":true,"ticks":7,"interrupted":"You arrived at Griffin Enclosure."}}}
{"seq":298,"type":"outcome","tick":323,"data":{"status":"success","reason":"success","ticks":323}}
```

Full files: `docs/midterm/evidence/session1/`.

## Known limitations and items for owner review

1. *(Resolved 2026-10-27: labels as drawn; HUD goal lines hidden; see "Phase 2 changes".)* The griffin's floating label shows its exact HP and phase name because the client draws it that way.
2. **The scene sign texts are reproduced**, for example "WEST · MIRROR POND · E · Travel". These are signposts, not solutions, but they name the three areas.
3. **Instant actions take no game time.** Dialogue, messages and backpack use resolve at once. A 23-line scene can be read at a single tick. Panel actions also wait for the partner when both heroes are deciding at the same moment.
4. **The screen grid is a 32-pixel tile approximation** of the 640×360 camera. Thin walls and diagonal art are coarsened, and depth, animation and particle effects are summarised as text.
5. **No villager `talk` action.** The four quest areas have no villagers. NPC conversation exists only in the village scenes.
6. **The full-episode model-call limit** is set equal to the decision limit (400 per hero), because the owner only fixed the pilot's 40. Please confirm.
7. **The baseline is deliberately weak.** It reads dialogue, explores and tries exits. It is not a quest solver, and its milestone success is not quest completion.
8. **Anthropic refusal fallbacks** (`fallbacks: "default"`) are not enabled. A refusal is recorded as a policy error.

## Session evidence

- Implementation session: Claude Code session `3d2319ad-79d1-4d3d-a243-e5cd03a8b685` (2026-10-23). The owner adds the shareable link.
- Branch `midterm/agent-interface`, based on `midterm/agent-team` (PR #6, which holds `CLAUDE.md`).
