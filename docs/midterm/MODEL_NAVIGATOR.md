# Opt-in fast model player: `model-navigator`

Owner request, 2026-11-05: finish the Hedge Maze (S2-local, seed 0) evaluation quickly. Verify and record the scripted baseline; add an opt-in, faster, genuinely model-driven two-agent player; test it offline; prepare (not run) a paid model run. No paid call has been made with this player.

## 1. Scripted baseline, verified (2026-11-05)

`baseline-quest`, S2-local seed 0, at `0f86844` (clean tree), through the live launcher with video. **Scripted, no model.**

| Field | Value |
| --- | --- |
| Success | yes: Enchanted Shears in the shared backpack (`holding:enchanted_shears`) |
| Game time | 2,723 ticks, 45.4 s of episode time (absolute end tick 3,128; summaries report 52.1 s because they include the 405-tick walk-in) |
| Wall time | 51.2 s episode; 57.6 s recording |
| Actions | 395 decisions (231 Sieg, 164 Coco), 0 invalid, 6 messages, 0 model calls |
| Hashes | start `fdc49877…03ca`, end `6644f2ca…7f56`, identical to the offline v2 reference |
| Trace | `midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-v2-live/trace.jsonl` |
| Video | `evaluation-runs/live/S2-local-seed0-baseline-quest-0f86844/recording.webm` (local, gitignored; SHA-256 `90a76f85…2bf8`) |

The baseline was not broken by the cow posts (`ffbdecb`) or the lapping wolf (`3ca9792`); those were already folded into its v2 values (`0f86844`). No baseline or scenario change was needed. Details: the evidence folder's README.

**Video check.** `scripts/evidence/verify-video.ts` decodes the whole file with ffmpeg (from PATH, or the one Playwright installs) and checks sampled frames for picture content. A first, browser-based version read every frame of these files as blank white although the files decode correctly; it was replaced. The owner's 2026-11-04 recordings decode correctly too.

## 2. What the navigator is

A model player with two independent heroes, like `model-memory`, plus a walking helper. Code: `packages/agent/src/policies/navigator.ts`.

- **Model.** Each hero's model sees everything `model-memory` sees (its notes, completed and refused actions, last turn, its own `HeroMemory`, its observation, legal actions) plus a `navigation` block: the current goal, its status, why it is being asked, and how far the helper walked. Its reply may carry, besides the usual `actions`, `"go_to": {"x", "y"}` (a tile in this area) or `"stop_navigation": true`. The system prompt is the `model-memory` prompt plus `NAVIGATOR_SECTION`, which explains these fields and gives general advice on abilities and messages. It has no game content, coordinates or puzzle steps (tested).
- **Walking helper.** When a goal is set and nothing has happened, the helper answers the decision itself with one ordinary `move` (at most 60 ticks), which the game validates like any other. It plans with A* (8-way, no corner cutting) over that hero's own remembered map (tiles its screen showed; never-seen tiles count as possibly open at a higher cost), its current screen (a creature's drawn body is blocked; creatures, enemies and the partner are costly to walk through), and the cells its own moves were stopped short by. It lines up with the row or column before a straight run, walks the longest straight run of the path, and re-plans every decision.
- **Stuck and unreachable.** A move that goes nowhere marks the cell ahead as costly for 20 s and re-plans; two in a row add a short side-step. The goal ends as unreachable when no path exists on the hero's map, after 6 stopped moves, or after 6 moves without getting closer than the previous plan. The model is then told why.
- **When the model is asked** (each listed in `navigation.why_you_are_asked`): no goal; arrival; unreachable goal; a new dialogue line; damage; something of a kind and name this hero had not seen before coming on screen; an enemy coming within 2.5 tiles; a new kind of action becoming available (E, an item, dialogue); a partner message with text this hero had not received before; a backpack or journal change; a new non-routine feedback line; a refused action or unusable reply; the game not taking a walking move; or 12 walking moves in a row.
- **Goals persist.** A model call does not cancel the goal. Only a new `go_to`, `stop_navigation`, arrival or an unreachable goal ends it. Answering a message keeps it (tested).
- **What the helper never does.** Attack, guard, press E, use abilities or items, advance dialogue, or send messages. It never changes or vetoes a model action, with one disclosed exception: a message identical (ignoring case and spacing) to one this hero sent in the last 10 game-seconds is not sent, and the model is told so next turn (`navigation.notices`).
- **What it cannot see.** It imports only types, the hero's own `HeroMemory`, the prompt helpers and `navigate.ts` (for `directionTo` and the walking speed). No `World`, `GameRoom`, environment, route, baseline, walkthrough, map geometry or partner state (tested by an import check). The speed constants it needs (super speed ×2, slowed time ×0.2) are copied.
- **Trace.** Every navigator decision writes a `policy_note` line (`source: "model"` or `"controller"`, events, goal, status, path length and unknown cells). The runner gained this optional field (`Decision.note`); other players never set it, so their traces are unchanged.
- **Limits.** Same as every model player: the scenario's tick, decision (1,600 per hero), model-call (400 per hero), token and spend limits, and the shared ledger. A helper decision counts as a decision, not a model call.
- **Scope.** Tuning runs on S1–S3 and their approved local variants only, never final (`validatePlan`), like `model-memory`. It is not part of S2-A's frozen player list, so its results are reported separately from the S2-A comparison.

Existing players are unchanged: their prompts and replies are pinned by `promptFreeze`/`modelMemory` tests, which pass. The mock gateway gained a branch that sends random goals only when the user message has a `navigation` block.

## 3. Offline tests (2026-11-05)

`packages/agent/test/navigator.test.ts`, 15 tests, all passing. Fixed goal coordinates appear only in test fixtures, never in a prompt.

| Claim | Test |
| --- | --- |
| Follows a long observed corridor without repeated model calls | REAL PLAY S2-local seed 0: Sieg walks 12 tiles east; between goal and arrival the only calls are the opening dialogue and three events (an exit within reach, new enemies, a new sign); no "walking moves" check-in |
| Recovers from an unreachable goal | REAL PLAY: a goal beyond the burnable hedge is searched for, declared unreachable within 20 calls, and the hero never passes the hedge |
| Handles the fenced cow | The committed S2-A v2 trace's Sieg observations, replayed into a fresh memory: at every one of them with the cow on screen, no planned path crosses the cow's body |
| Dynamic enemies | Enemy-close, new-thing and damage events; occupied cells cost more |
| Independent memories | REAL PLAY: tiles only Sieg saw stay unknown in Coco's memory; neither hero's prompt contains the other's notes; separate `HeroMemory` objects |
| Messages don't cancel goals | A partner message triggers a call; a reply with only a message keeps the goal, and walking resumes without another call; a repeated text is not news |
| No duplicate messages | A message repeated within 10 s is not sent, and the model is told |
| No hidden state or shortcuts | Import check; prompt section has no game words or coordinates; tuning-only, own player kind |

Whole repository: `npm run typecheck` passed; `npm run build` passed (existing chunk-size warning); `npm test` 1,180 of 1,181 passed. The one failure is `s2Shutdown.test.ts` (a recorder finalize-timeout message), which sessions 44 and `0f86844` already recorded as failing before this work; no recorder code changed.

Mock runs through the live launcher (offline, random goals; launcher checks only, not results): headless, 689 calls over 256 game-s ending at the call limit, 0 crashes; recorded with the viewer, the video saved and decodes.

## 4. Model-call frequency, old and new

Old players, measured from local traces of earlier unaided Hedge Maze runs (OpenAI `gpt-6-luna`, medium; game time counted from the episode start):

| Run | Player | Calls | Game s | Calls per game-s | Wall s per game-s |
| --- | --- | --- | --- | --- | --- |
| 2026-10-29T04-35 (pilot-10) | model-history | 221 | 38.0 | 5.81 | 28.9 |
| 2026-10-29T06-09 (pilot-13) | model-memory | 386 | 69.4 | 5.56 | 44.2 |
| 2026-10-29T14-31 (pilot-15) | model-memory | 173 | 26.8 | 6.47 | 43.0 |
| 2026-10-29T05-45 | model-guided (solution-informed) | 164 | 37.2 | 4.41 | 28.2 |

None of the unaided runs succeeded (all stopped by hand). Pilot-13's calls averaged 9,944 input and 446 output tokens, $0.00084 and 6.3 s each (median latency).

New player, estimated offline by `scripts/midterm/navigator-call-estimate.ts`: it replays each hero's observations from the scripted baseline through the navigator's own event detector and counts the decisions that would need the model (an event, or any action other than walking, batched by 4). For a player that picked the baseline's walking goals: **88 calls** (Sieg 43, Coco 45) for the 45.4 s episode, **1.94 per game-second**, about a third of the old rate. 168 of the baseline's 395 decisions would be the helper's. This is a lower bound for an ideal player on that route, not a prediction for a real model; the paid run measures the real rate.

## 5. Prepared paid run (needs the owner's approval)

```sh
npm run eval:live -- --scenario S2-local --seed 0 --player model-navigator \
  --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid --no-open
```

- **Model:** `gpt-6-luna` at medium effort, the only provider whose calls have succeeded here and the one all S2-local pilots used. Alternative: `--gateway anthropic --model claude-haiku-5-5 --effort medium`, but the owner's three Anthropic attempts on 2026-11-04 failed with `401 invalid x-api-key`, so the key must be fixed first.
- **Cap:** $0.75 for the episode (suite cap $1.25). Ledger before the run: $2.40 of $25 spent, all pilot; $5.60 of the $8 pilot stage left; nothing held.
- **Estimate:** about 10,500 input tokens per call (pilot-13's 9,944 plus the navigator section and block), about $0.0009 per call. Calls: 90 (ideal route) to 300 (expected, with mistakes); 800 is the hard limit. Cost $0.08–$0.30 expected, at most the cap. Wall time at 6–8 s per call: 10–40 minutes; the 3,600 s wall limit ends a run near 450–600 calls.
- **Risks:** the model may still not solve the maze (none of the unaided players has); events in combat-heavy stretches may cause bursts of calls; the helper can be slowed by narrow gaps; `wall_clock_limit` would be a latency result, not a game failure; the 2026-11-04 Anthropic key was invalid. A replay of the video, if needed, must be labelled as a replay.
