# Opt-in centralized model player: `model-centralized`

Owner request, 2026-11-05: simplify the S2-local Hedge Maze evaluation from two independent LLM agents that message each other to **one LLM decision-maker controlling two characters**, each through its own legal controller. This is deliberately not a multi-agent communication experiment. `model-navigator`, `model-memory`, `model-history`, `baseline-quest` and every other mode are unchanged. No paid call has been made with this player.

## 1. What changes, and what does not

| | Other model players | `model-centralized` |
| --- | --- | --- |
| Model calls | One per hero per decision | One per planning decision, answering for one or both heroes |
| What the model sees | Its own hero's screen and memory | Both heroes' screens, a combined map of what either saw, shared backpack and journal |
| Coordination | In-game messages | None needed; message actions are never sent |
| Execution | Model actions, or the navigator's walking helper | Each hero's own controller (the navigator's, reused) |
| Player kind | its own | `model-centralized`, tuning-only (S1–S3 and approved local variants), results reported separately |

**Assignment and project-rule note.** `CLAUDE.md` and `AGENTS.md` describe Sieg and Coco as separate agents with their own memory and message-only coordination. This player intentionally departs from that for this one mode, on the owner's explicit instruction. It is a separate player kind; it does not replace the two-agent players, and it must not be reported as one of them.

## 2. Design

Code: `packages/agent/src/policies/centralized.ts`.

- **`CentralPlanner`** (one per episode). One model request per planning decision. Its reply is
  `{"plan", "subgoals_done"?, "known_obstacles"?, "orders": [{"hero", "actions"?, one of "go_to" | "wait_until" | "fight" | "catch" | "hold"}]}`.
  An order replaces that hero's intention and runs its actions first. A hero with no order keeps its intention. A hero left with nothing holds (ordinary waits) for at most 30 game-seconds, then the planner is asked about it again.
- **`CentralizedController`** (one per hero). A subclass of the navigator player that reuses its controller unchanged: A* `go_to` over that hero's own remembered map, `wait_until`, `fight` (enemies only), `catch`, the Black Hole aim preview, event detection and edge-triggered movement lines. Every action it submits is an ordinary action that the game validates. It never sends messages. One addition: when the game does not offer `move` (during a scene or a waiting dialogue line), a walking hero waits instead of submitting a move the game would refuse, and keeps its goal. The first offline real-play test found the need for this: without it, each refused move triggered a new planner call. The pause is bounded. After 2 game-seconds the planner is asked, with the reason. The first mock recording run found the need for this bound: a dialogue line nobody was ordered to advance kept both heroes waiting until the wall-clock limit.
- **Navigator change: visibility only.** Thirty-three lines in `navigator.ts` changed from `private` to `protected` or `export`. No logic changed. The navigator's id is still `1f2e87d3` (tested), and its prompt, schema and behaviour are the same.

### One call for both heroes

The environment advances game time only after every hero that is deciding has submitted (the barrier in `environment.ts`). No game time passes during a planning call. When both heroes' actions end at the same tick, both controllers ask together. The planner waits one turn of the event loop for the second request and makes a single call for both. A hero that asks while a call is in flight waits for it. If that call gave it an order, it starts the order. Otherwise it asks again. An order for a hero that did not ask (it was mid-action) is started on that hero's next decision with no extra call (trace `source: "assigned"`), unless something urgent happened to that hero in the meantime: dialogue, damage, a refused action, a backpack, journal or area change.

### When the planner is asked (replanning)

Only on these events:

- **An intention completes or becomes impossible:** arrival, an unreachable goal, a catch ending, a fight ending, or a wait ending.
- **New discoveries:** something a hero had not seen before comes onto its screen, an enemy comes close, or a new kind of action becomes available (for example E).
- **Changes:** dialogue, a backpack or journal change, a new area, or a new game feedback line. A run of "X moved" lines counts as one "started moving" event and one "stopped moving" event.
- **Significant damage:** 20% of maximum HP lost since that hero's last plan, or HP falling to 40% or below. Smaller hits do not trigger a call. A fight keeps its own 25% rule.
- **A refused action, or an unusable reply.**
- **A bounded intention expiring:** a hold or `wait_until` running out, 20 walking moves on one `go_to` (the navigator uses 12), or a `fight` or `catch` deadline.

A hero waiting, or the other hero moving, is not an event. Partner-message events cannot occur.

### Shared memory and context size

Each user message contains:

- the reasons for each hero;
- the plan memory (plan text up to 600 characters, completed subgoals up to 12, known obstacles up to 10, and the last 16 events);
- the shared backpack and journal, sent once;
- one combined map per occupied area;
- `seen_earlier`, up to 40 things either hero saw that neither screen shows now;
- each hero's own state: position, HP, abilities, status, intention, screen, visible things, dialogue, the last 4 dialogue lines, the last 6 feedback lines, its last turn, the last 4 completed and 3 refused actions, blocked moves, repeats, the last 8 verified events, its legal actions without `message`, and the Black Hole aim preview while that ability is available.

The full transcript is not resent. The size is bounded by the caps above, not by episode length. In the offline mock smoke run, the average message was about 10,800 characters (about 2,700 tokens), plus the system prompt with the manual.

### Moving-target capture (the wolf)

The model names the target. The controller's `catch` intention does the rest: it moves toward the target, re-aims each time it is on screen, and heads for where it was last seen when it is not. When the target is close and the backpack panel shows a nearby target, it presses an ordinary E. It never attacks. `fight` refuses creatures. If only Coco's screen shows the target, or a hero saw it earlier in this area, Sieg's chase starts from that sighting. Nothing about the wolf, the cow, places or a solution is hard-coded anywhere in the player or its prompt.

### Information boundary

The planner's input is built only from the two heroes' own observations, their own `HeroMemory`, their legal actions and the controllers' own state. `centralized.ts` imports only types, the navigator, the hero memory, the prompt helpers, the batch limit and the budget types (an import check is tested). It reads no `World`, `GameRoom`, map file, puzzle flag, route, baseline or walkthrough. Each hero still navigates on its own memory only.

### Budget, ledger and trace

- **Calls and caps.** Both heroes keep their own `MeteredGateway` on the one episode `ModelBudget`. Each planner call is charged to one hero that asked: the one with fewer calls so far. Per-hero call caps (400 each), the token cap, the spend cap, the per-call timeout, the paid guard and the ledger are unchanged.
- **Trace lines.** Only the charged hero's decision carries the call's `usage` and `raw` reply, so the trace has exactly one `model_call` and one `model_reply` per call. `policy_note` lines add the centralized metadata: `source` (`planner`, `planner-shared`, `assigned`, `controller`), `planId`, `payer`, `members`, `events`, `orders`, and the intention, goal and status.
- **Failed calls.** A failed call decides nothing. The charged hero gets the error, which the runner counts as usual. The other hero gets a reply problem. Both keep their reasons and ask again.

## 3. Offline tests (2026-11-05)

`packages/agent/test/centralized.test.ts`, 17 tests. Fixture coordinates and names are test inputs, never in a prompt.

| Claim | Test |
| --- | --- |
| Reply format: one or both heroes; strict-schema nulls; refuses duplicates, two intentions, unknown fields | parser test |
| Never sends messages | message actions removed and reported; `message` not offered to the planner |
| OpenAI strict schema conversion accepts the schema | `openaiSchema(splitActionTypes(centralSchema()))` |
| No game content in the prompt; objective kept | word and number checks; the briefing's objective is in the system prompt of every call |
| No hidden-state imports | import check |
| Own tuning-only kind; navigator unchanged | `policyKind`, `validatePlan`, `NAV_ID` = `1f2e87d3` |
| One call for both heroes | two concurrent decisions → 1 call, charged once, both get orders |
| Goals persist; no replan for waiting or the partner moving | Sieg walks and Coco holds over 5 decisions with 0 calls; Coco's discovery → 1 call for Coco; Sieg's goal survives and he walks on |
| Significant damage only; bounded hold | −5 and −7 HP → no call; −21 → call; the hold runs out at 30 s → call |
| No move the game does not offer; bounded pause | waits while `move` is not legal, keeps the goal, asks after 2 s, walks again once `move` returns |
| Orders for a busy hero start without another call | `source: "assigned"` |
| Failed call | charged once, the other hero told, both ask again |
| Shared memory | plan, subgoals and obstacles persist; Coco's sighting appears in `seen_earlier` |
| Combined map | tiles either hero saw are shown; tiles neither saw are `?`; memories stay separate |
| Moving-target capture | Sieg's chase starts from Coco's sighting, follows the target, presses E only when close with the panel prompt, never attacks; the backpack change ends it and is reported |
| REAL PLAY S2-local seed 0 | both heroes walk on their own controllers; every controller move accepted by the game; no messages. **No hidden state:** every known tile on every planner map was on one of the heroes' own screens in the trace, every `seen_earlier` entry is in the named hero's own observations, and the message has no engine fields |
| REAL PLAY S2-C seed 0 | the planner sends Sieg to catch the wolf; the key comes from the game through Sieg's ordinary `interact`; no attack; the chase is controller moves |

## 4. Call-count expectation

`scripts/midterm/centralized-call-estimate.ts` replays the scripted baseline's own observations (S2-local seed 0 v2 live trace). It assumes a model that picks the baseline's walking goals, like the navigator estimate, and reproduces that estimate exactly (88).

| Player | Calls on the baseline route | Per game-second |
| --- | --- | --- |
| `model-navigator` (two models) | 88 (Sieg 43, Coco 45) | 1.94 |
| `model-centralized` | 74 (7 of them shared by both heroes) | 1.63 |

The baseline route has little idle time and only 6 messages, so the gain there is small (−16%). The larger expected gains come from what the route does not exercise but the real model runs did. In paid navigator run 1 (236 calls):

- 130 calls had "no walking goal" as their only reason. In this mode an idle hero holds for up to 30 s instead.
- 42 calls were caused by partner messages, and 19 replies only sent a message. Neither can happen here.

These are upper bounds on avoidable calls, not a prediction. Each call is larger, since it carries both heroes, but the manual-bearing system prompt is sent once per decision instead of once per hero. Only a paid run can measure the real rate.

## 5. Limitations

- **Not two independent agents.** This is one model with both heroes' views. Results are not comparable with the two-agent players as a test of coordination, and they are reported as a separate kind.
- **Stale partner state.** When one hero asks, the other's state is from its latest decision (up to about 1 s old); `observed_at_tick` says so.
- **Who is charged.** Each call is charged to one hero, so per-hero call counts measure who asked, not who benefited.
- **Hold re-asks.** A hero the planner leaves idle re-asks every 30 s, which adds a call per idle hero per 30 game-seconds.
- **Navigator weaknesses carried over.** The helper can be slowed by narrow gaps, and `catch` needs the backpack panel's nearby-target prompt before it presses E.
- **Offline only.** Only fixtures and the mock gateway have driven this player. Whether a real model plans well with it is untested.

## 6. Verification (2026-11-05, before any paid run)

- **`npm run typecheck`:** passed.
- **`npm run build`:** passed.
- **`npm test`:** 1,222 of 1,223 passed (128 files). The one known failure is `s2Shutdown.test.ts`, a recorder finalize-timeout case already recorded as failing before this work (MODEL_NAVIGATOR.md §3 and §6). No recorder code changed.
- **Baseline.** `baseline-quest` S2-local seed 0, headless through the live launcher: success; 395 decisions; 0 invalid; 6 messages; start hash `fdc49877…`, end hash `6644f2ca…`, the same as the pinned value (`scriptedFreeze.test.ts` also passes).
- **Free recording smoke test.** `eval:live --player model-centralized --gateway mock --wall-seconds 90`: ended at `wall_clock_limit` (as intended). 70.6 game-seconds, 455 decisions, 0 invalid actions, 0 messages, 70 planner calls (3 shared by both heroes), 348 controller moves, 28 orders started by a hero that did not ask. One `policy_error`: the mock call that was in flight when the wall-clock limit aborted it. The video (1280×720, 100 s) saved and decodes with picture content (`scripts/evidence/verify-video.ts`). It is a local scratch file, not committed. The mock plays randomly, so this checks the plumbing, not play quality.
- **No paid call, no push, no merge.**


## 7. Pilot-28 fixes (owner approved, 2026-11-05)

The first paid run, pilot-28, was owner-launched on `678b86c` with player ID `c497a631`. Its [diagnosis](agent-evidence/skill-runs/2026-11-05-pilot28-diagnosis.md) is historical tuning evidence, not a success. The changes below produce centralized player ID **`9ab2dec9`** and a new prompt hash. No scenario, frozen pin, baseline or other player's prompt changed. This supersedes the original memory and hold descriptions above for this revision only.

- `policies/centralProgress.ts` tracks each hero's game-time inactivity across all planner calls and renewed waits/holds. New observed floor/first visits, observed area changes, advancing dialogue, inventory gains, newly completed journal entries, directly observed blocked-to-open floor, enemy health-bar decreases, and creature displacement observed after that hero's ability attempt count as progress. Damage to the hero, cooldown changes, offscreen disappearance, autonomous creature motion without an ability attempt, and repeated walking on known floor do not. Observation alone cannot prove causation; effect records say so.
- After **30 game seconds** without progress, the controller interrupts the current assignment and asks for reconsideration with elapsed time, repeated assignments, action outcomes and known obstacles. Empty/hold/passive replacement plans are refused. A specific visible cooldown or watched actor/effect can receive one bounded dependency wait; renewal cannot extend its original deadline. A cooldown wait uses `wait_until: {seconds, ability: "<exact visible ability name>"}` and ends when that state becomes ready. A cast and its follow-up cooldown wait may share one order.
- Repeated equivalent orders ignore duration changes; an active assignment repeated twice without progress cannot satisfy overdue recovery. Two accepted equivalent presses at the same quarter-tile position/aim with no relevant observed effect in the six-second effect window prevent another identical attempt. Changed position/aim/assignment remains possible. Three rejected recovery replies stop further model dispatch; the unchanged runner reports the ensuing bounded policy failure as `error`. The policy does not invent fallback game actions.
- Attempts, acceptance, visible execution confirmation, observed effects, and subgoal completion are separate. `subgoals_done` now selects **IDs from completion-eligible `observed_evidence`**, not free text. Only the observed fact itself is retained, with its evidence record; neither input acceptance nor casting is completion evidence. Exploration/dialogue activity can reset inactivity but cannot certify a puzzle subgoal. The immutable `evaluation_objective` (task and episode briefing, with the briefing primary) is sent separately from the broader journal and mutable plan.
- `policies/pullPreview.ts` adds a centralized-only swept-contact preview. Visible creature extents, enemy bodies, observed blocked cells and public body dimensions determine the predicted landing point. Confident radial inclusions and uncertain radius-boundary candidates are separate. Visible heroes intersecting a target's possible swept body are named as obstructions. It never reads an engine object, puzzle flag, offscreen actor or route. The legacy navigator helper is unchanged.
- Recording investigation retained a three-second final paint tail on manual stop and fixed a display-only conversion: outcome trace ticks are already episode-relative, so the viewer must not subtract the prefix twice. This does not change game execution or the five-operation interface.

[Verification and limitations](agent-evidence/skill-runs/2026-11-05-adapter-pilot28-fixes.md), [portable verification metadata](evidence/pilot28-fixes/), and [session record](../agent-sessions/47-codex-pilot28-fixes.md). The free mock smoke verifies plumbing and recording, not model competence or quest completion. No paid run was made by this implementation session.

Limitations: the watchdog uses conservative generic proxies for progress rather than route knowledge. A model can still choose poor new assignments; it may now fail explicitly instead of waiting indefinitely. Pulls are estimates from rounded observations and full blocked cells; hidden/partial geometry, constrained movement axes and motion after the observation can change the actual outcome. Obstruction warnings describe a possible swept path, not guaranteed displacement. Observed changes after a press are correlation, not proof of causation. The quarter-tile equivalence and six-second effect window are documented policy bounds. Live completion and call/latency improvements remain unmeasured until a separately authorized paid run.

## 8. Cow-passage follow-up (owner request, 2026-11-06)

Player id `9ab2dec9` → **`f0592888`**: general observation-grounded rules for retrying blocked ways, `route_change` and `traversal` evidence, `unreachable_goals` in the planner input, snapshot traces, and the shared go_to fix. Runs under `f0592888` are not comparable with pilot-29. Details and verification: [COW_PASSAGE_FIXES.md](COW_PASSAGE_FIXES.md).
