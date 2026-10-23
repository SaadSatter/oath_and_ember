# Bald Goddess agent interface (Session 1)

Status: **first milestone implemented.** A two-player five-operation interface over the real game server, a scripted baseline that completes a bounded episode, and an LLM adapter for Claude and OpenAI. **No model-driven run has happened yet**, because no API credentials were available in the implementation session. **Full quest completion has not been shown** by any policy.

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

**Labels.** In-world labels drawn by the client are reproduced as text. In the default `names-only` mode, instruction labels are cut to their names; for example, "FIREBALL · dry hedge" becomes "dry amber hedge". `--labels full` reproduces them exactly as drawn.

**StepResult:** `accepted`, `error`, `ticks` elapsed, `interrupted` reason, `feedback`, `done`.

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

Each hero's runner loop holds only its own policy, observation, legal actions and last result. The heroes share nothing except the game world and the `message` action. The LLM player keeps its own short notes and its last 8 actions. Each model call is a fresh request with no shared transcript.

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

The `--model` default for `--policy anthropic` is `claude-opus-5-5`. With a $1 cap, an Opus run will stop early on spend. The pilot command names Haiku, as in the approved provider option.

## Implemented vs. not yet

| Item | State |
| --- | --- |
| Five operations over the real `GameRoom` | Done, tested |
| Separate per-hero observations, no hidden state | Done, tested by leak checks in all four quest areas |
| Legal actions and validation (schema, legality, ownership, stale dialogue) | Done, tested |
| Shared-clock two-player scheduler | Done, tested |
| Termination: success, tick, decision, model-call, token, spend, wall clock, error, manual | Done; all but spend/error/wall clock have direct tests (wall clock is tested through `stop`) |
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

1. **Some in-world object names still hint.** Even in names-only mode, the griffin's floating label shows its phase and HP, as the client draws it. The nest's panel name is reduced to "Griffin nest", but the goddess's dialogue tells players where to search. Please confirm that names-only is the presentation you want.
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
