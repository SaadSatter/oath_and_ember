# Bald Goddess midterm architecture proposal

22 October 2026 · **Proposal for approval only** · Target checkpoint Monday 26 October 2026

## Decision requested

Use the entire Bald Goddess shrine quest as the midterm episode, replacing the earlier bridge proposal. Build two independently prompted LLM players, SiegAgent and CocoAgent, on the existing authoritative game. They receive their own player-visible observations, the public mechanics manual, and only this task: **“Complete the Goddess's quest together.”**

Per the designer’s recording requirement, use no screenshots. I recommend player-visible structured observations plus a recorded normal-speed gameplay video, a centralized simulation scheduler, isolated policy processes, and a new observation-limited scripted baseline. Target 480 active simulation seconds; report actual wall-clock time separately. Do not claim full-quest completion, eight-minute feasibility, fair-baseline success, or model progress until the corresponding acceptance run exists.

The intended demonstration order in the supplied brief is an **implementation-team planning target**, not policy input or a required success predicate. Do not enforce that order in a policy, baseline, reward, legal-action list, or reset prompt. An alternative route allowed by the game remains a valid offering success; record the actually observed route privately for analysis.

This phase changes documentation only. No gameplay code, player policy, evaluation adapter, implementation-agent configuration or reusable review skill has been created. D1–D11 remain approved; this proposal does not reopen those decisions. The old bridge evaluation section in the rationale will need alignment with this scope after architecture approval.

## 1 Inspection and completion assessment

### What exists

- A normal Goddess Shrine start is available through `createApp({ startingScene: "GODDESS_SHRINE", prologue: false })`, already exposed by `npm run playtest`. `GameRoom.reset` and its ordinary lobby lifecycle produce normal abilities, full health, empty inventory, and unsolved quest state. Use that initializer, not writes to the world's fields.
- The newer **Bald Goddess** title checkpoint also exists in [shared checkpoints](../packages/shared/src/storyCheckpoints.ts) and [server checkpoint initialization](../apps/server/src/storyCheckpoints.ts). It positions the party at the shrine and runs a greeting, but synthesizes historical campaign flags. It is distinct from a clean story-free evaluation start. Proposed canonical evaluation uses the clean shrine start; use the existing checkpoint as a human-play comparison condition only if separately declared.
- [Branch travel](../apps/server/src/GameRoom.ts), [shrine points](../packages/shared/src/shrine.ts), and [map return links](../packages/shared/src/maps.ts) connect the shrine to the pond, maze and Griffin, with party-wide branch transitions and preserved inventory/quest state. Independent cameras do not provide independent concurrent branch simulation.
- Pond, maze and Griffin reward handlers and the final offering are implemented. No missing shrine-to-branch or return link was identified in this inspection. The absence of a southeast onward campaign exit is outside this episode and does not prevent a goddess offering.
- The ordinary rules allow a combat alternative for the Griffin reward. Obtaining both tools is not a universal server requirement for offering success. The intended demonstration route cannot be used as a hidden checklist that rejects another legal success.

### What the current evidence proves

On 22 October, the existing nine selected shrine, pond, maze, Griffin, inventory, campaign and checkpoint test suites passed: **78 tests**. Command:

```sh
npx vitest run apps/server/test/shrine.test.ts apps/server/test/hedgeMaze.test.ts apps/server/test/hedgeMazeWalkthrough.test.ts apps/server/test/mirrorPond.test.ts apps/server/test/mirrorPondWalkthrough.test.ts apps/server/test/griffin.test.ts apps/server/test/inventory.test.ts apps/server/test/campaignQuest.test.ts apps/server/test/storyCheckpoints.test.ts
```

These are component/integration checks, not a single fresh full-quest run. In particular:

| Existing evidence | Limitation for this evaluation |
| --- | --- |
| `apps/server/test/campaignQuest.test.ts` | Navigation uses direct positioning; offering coverage grants a wig. It verifies links/transactions, not normal full acquisition. |
| `apps/server/test/hedgeMazeWalkthrough.test.ts` | Uses intents for navigation but removes combat guards and plans from complete collision/state information. |
| `apps/server/test/mirrorPondWalkthrough.test.ts` | Uses actual intents but reads map geometry, station definitions and mechanism state. |
| `apps/server/test/griffin.test.ts` spawn-to-nest route | Supplies prior branch tools. Other cases validate custom grooming and single rewards. |
| `scripts/maze-playthrough.ts`, `scripts/pond-playthrough.ts` | Plan against privileged state, exact locations and puzzle definitions, then replay intents. They are engineering QA, not player-only baselines. |
| `scripts/griffin-playthrough.ts` | `seedPriorRewards` grants the tools; planning reads attack timers and positions. |
| `docs/quests/bald-goddess/recording-*/report.json` | Useful historical recordings, with fixture and version limitations; no current fresh unified proof. |

**Assessment:** the necessary quest systems and route connections are present, and no definite completion-blocking defect was established. A continuous current-version, empty-inventory, all-enemies-present run through normal actions is **not yet verified**. Compositional tests cannot honestly establish that stronger result. Make this the first implementation milestone and stop claims of full feasibility if it fails. A privileged engineering oracle may diagnose reachability, but it must be labelled separately from the fair baseline and must never provide policy knowledge.

### Required interactions and information classification

This table is for implementers/reviewers only and must not enter either player's context.

| Area | Actual interactions to support | Public information | Privileged information to withhold |
| --- | --- | --- | --- |
| Shrine | Approach, E/dialogue, read current text, travel via visible markers, open backpack, select owned item, offering | On-screen clue, signs, current notices, visible quest text and owned inventory | Expected offering item stored in handler, global completed flags, unreached dialogue and branch dependencies from specifications |
| Pond | Move, direction/facing, Flight, time/speed, Push, fireball, return and chest interaction | Visible terrain, mirror/shot response, torches and exposed labels, rendered angle if displayed, current HUD | Imported station solutions, collision rectangles, exact hidden mechanism clock, offscreen torch state, server-only reflection metadata |
| Maze | Move/fight/defend, cast fireball, pull with Black Hole, pursue/interact, key gate/chest, return | Current view, actors/telegraphs, visible notices, owned items and their descriptions | Full maze graph, offscreen enemies/wolf, pathfinding state, capture IDs, underlying completion flags |
| Griffin | Fly, fight/defend, pull/slow, tool delivery, wait/read feedback, collect reward, return | Current encounter rendering, displayed warnings, nest prompts, visible results | Attack phase timers, hidden aim/damage state, future grooming sequence, unseen reward flags |
| Final offering | Ordinary nearby inventory action | The game's accepted-offering message and visible completed status | Evaluator-only success latch exposed as policy input |

## 2 Reuse and proposed files

Existing implementation will be reused through normal intent entry points, not rewritten in a separate simulator.

| Existing file/module | Reuse and boundary |
| --- | --- |
| `apps/server/src/GameRoom.ts` | `add`, `select`, `ready`, `receiveInput`, `useItem`, `readStoryLine`, `chooseStoryLine`, `talkToNpc`, and `tick`. `transition`/world writes remain private engine consequences, never player actions. |
| `apps/server/src/app.ts` | Strict wire validation, acknowledgements, transport and snapshot mechanics. Proposed extraction/injection of clock/driver control is opt-in for evaluation; default human server remains real-time. |
| `apps/server/src/RoomManager.ts` | Normal room creation; clean shrine configuration. Do not secretly select the campaign checkpoint or preload tools. |
| `apps/server/src/{shrine,mirrorPond,hedgeMaze,griffin,inventory,blackHoles,enemySimulation}.ts` | Authoritative quest, item, combat and movement outcomes. These stay behind the engine boundary. |
| `packages/shared/src/{gameTypes,protocol,movement,constants,abilities,items,maps}.ts` | Engine-side types, validation, kinematics and public descriptions. Do not give policy workers runtime imports of map/state modules. Public item descriptions are exposed only as the UI exposes them. |
| `apps/client/src/main.ts` and entity/environment views | Render each player's actual viewpoint. Add only gated clock/capture hooks if needed; no privileged `__world` or debug export to policies. |
| `apps/client/src/ui/{inventory,quests,questLog,dialogueBox,storyDialogue}.ts` | Use actual UI interaction/visible text and focus rules. Do not serialize `questLog(World)` directly as a privileged observation shortcut. |
| `apps/client/src/rendering/{viewport,ResponsiveRenderer}.ts` | Preserve the normal camera, pixel budget and presentation. No full-map reveal or camera teleport for evaluation. |
| `manual/Oath_and_Ember_Player_Manual.md` | Public mechanics context; distribute a frozen, hash-recorded copy without following its local links or adding the rationale. |
| Current QA/test files | Regression coverage and engineering diagnostics only. Do not import their solvers into the fair baseline. |

Proposed new modules, **not yet created**:

```text
packages/evaluation/src/
  contract.ts              five-operation types and strict action validation
  engineHost.ts            private room, transport and sole simulation ownership
  runtimeClock.ts          deterministic evaluation clock and production defaults
  scheduler.ts             joint decisions, button edges and action plans
  episode.ts               reset lifecycle, budgets, cancellation, outcome
  observations.ts          allowlisted visible-scene/UI packets and token mapping
  video.ts                 both-view recording, normal-speed replay and timing audit
  visibilityAudit.ts       provenance assertions and leakage canaries
  messages.ts              bounded role-to-role messages and delivery
  trace.ts                 append-only records, hashes and private/public split
  replay.ts                action replay and normalized state verification
  scenarios.ts             scenario manifest loader; no policy access
  baseline/                two observation-only scripted policy workers
agents/players/
  SiegAgent.ts             role-scoped history, memory and model decision loop
  CocoAgent.ts             separate role-scoped history, memory and loop
  modelGateway.ts          provider adapter, strict output, budgets, usage records
scripts/evaluation/
  run-shrine.ts            trusted run coordinator; no quest solver
  replay-shrine.ts         offline trace reproduction
  verify-fresh-quest.ts    engineering reachability gate, labelled privileged QA
  audit-boundary.ts        isolation and content checks
```

Tests would live in `packages/evaluation/test/`, `agents/players/test/`, and relevant existing server/client suites. Dependency boundaries are enforced by process permissions and tests, not merely file placement. Proposed private artifacts under `evaluation-runs/<run_id>/`; policy processes receive neither that directory nor the repository. Large captures should be stored as trace artifacts with checksums, not automatically committed as source.

## 3 Five-operation contract

Only five external environment operations are exposed. `reset` and full `outcome` are coordinator operations; a role worker can only observe itself, request its legal vocabulary, and submit its own action.

```ts
reset(seed: number): Promise<{ episode_id: string }>
observe(player_id: "SIEG" | "COCO"): Promise<PlayerObservation>
legal_actions(player_id: "SIEG" | "COCO"): Promise<LegalActionSet>
step(player_id: "SIEG" | "COCO", action: ActionEnvelope): Promise<StepResult>
outcome(): Promise<EpisodeOutcome>
```

- Bind each connection/capability to a role; a caller-supplied `player_id` cannot grant access to the other worker.
- `reset` destroys the old episode through its lifecycle and creates a fresh normal shrine room. No `Object.assign` position changes, reward injection, latch clearing or special completion methods.
- `observe` is idempotent at a committed observation boundary and does not advance time. It never reads another role's private memory.
- `legal_actions` describes controls actually available to that role/UI. It is not an oracle that names unreached interactables or says which item would solve an encounter. Attempted actions can fail normally.
- `step` **queues a role decision**; it does not individually tick the world. It resolves after the joint scheduler commits the relevant interval. The coordinator submits both concurrently to avoid a sequential await deadlock. Stale observation IDs are rejected, logged and charged to submission limits.
- `outcome` is read-only. Detailed authoritative outcome/progress is private to the evaluator. Policies receive only a terminal notification and player-visible reason; they cannot poll hidden quest flags through this operation.

### Proposed observation schema

```ts
interface PlayerObservation {
  episode_id: string;            // opaque; never the seed/scenario name
  observation_id: string;
  player: "SIEG" | "COCO";
  active_seconds: number;        // evaluator timer visible to both
  viewport: { width: number; height: number };
  visible: Array<{
    token: string;               // ephemeral visible-object handle, not a server ID
    appearance: string;         // only a publicly recognizable description
    bounds: { x: number; y: number; w: number; h: number }; // screen-space extent
    visible_state?: string;     // visible pose, warning or terrain appearance only
  }>;
  ui: Array<{
    token: string;               // short-lived, role/observation-bound handle
    kind: "text" | "button" | "choice" | "owned_item";
    text: string;                // currently rendered text only
    enabled?: boolean;
    bounds?: { x: number; y: number; w: number; h: number }; // screen pixels
  }>;
  messages: Array<{ id: string; from: "SIEG" | "COCO"; text: string }>;
  feedback: Array<{ action_id: string; status: string; public_text?: string }>;
}
```

**Structured observations only; no screenshots are captured or supplied to either policy.** A trusted presentation adapter describes the currently visible scene and rendered UI in text/JSON. It uses the same camera, culling, visual occlusion, depth and public presentation state as the human client. Clipping to the viewport alone is insufficient: an actor behind opaque scenery must not become observable through a geometry export. Every exposed description/property needs documented visual provenance. If provenance cannot be established, omit the field and treat missing essential perception as a blocker rather than falling back to privileged world state.

Scene observations can include recognizable visible characters, obstacles, terrain, projectiles, warnings and screen-relative extents. Labels must be grounded in public presentation, not hidden class names or puzzle roles: do not turn an unlabelled object into “the required solution target.” Report visible changes without hidden completion flags. Inventory details appear only when that player opens/selects them; journal text only when displayed; dialogue includes only the current rendered line, not its source script. Visible HP bars remain approximate bars rather than exact offscreen/partner HP exports. Cooldowns use displayed precision.

No world coordinates, complete collision map, unvisited areas, global puzzle lists, hidden actor IDs, attack clocks or future dialogue. Screen-relative geometry describes the actual viewport without revealing world coordinates. A player's discovered-area memory is built from prior visible observations, not preloaded from the map. Cross-player information comes only from a visible partner or bounded messages. No cropped images, contact sheets or still-image substitutes are added to traces.

This symbolic presentation is a declared accessibility-style observation interface, not pixel-level perception: both LLM players and the scripted baseline receive exactly the same derived facts. Review its precision and classification advantages explicitly. Record video separately for human inspection; do not feed recorded video or its future frames back to either policy. Audio is not silently translated into privileged semantic cues; declare the evaluation audio condition equally for all contestants.

### Proposed action schema

```ts
interface ActionEnvelope {
  observation_id: string;
  action_id: string;
  plan: Array<
    | { type: "controls"; held: PublicKey[]; ticks: number }
    | { type: "press"; key: PublicKey }
    | { type: "ui"; token: string }
    | { type: "wait"; ticks: number }
  >;
  message?: string;
}
// PublicKey is an explicit allowlist of movement/action/panel/dialogue keys.
// No debugger, console, browser navigation, file access or arbitrary JavaScript.
```

Proposed limits: at most eight segments and 240 simulation ticks (4 s) per plan; `press` generates one down/release edge through normal input. Permit shorter movement/rotation controls down to one tick. Ability presses, held defense, pushing and attack-release behavior retain their existing meaning. Refresh held input through validated intent at the engine cadence so the 250 ms freshness lease cannot accidentally truncate a declared hold. Refresh packets do not grant extra physics steps or count as new agent decisions.

Facing is produced through existing directional input, with its ordinary movement/collision consequences. There is no `set_facing`, teleport, `rotate_mirror_to(angle)`, `collect_wig`, `solve`, or `travel_to(map)` action. Travel requires normal proximity and interaction. `ui` tokens map to currently displayed buttons/choices/item selection in a private presentation bridge, then normal acknowledged server requests; no source IDs or remote object targeting are supplied to the worker. If a token becomes stale after a transition, it fails normally.

## 4 Joint-action scheduler and time

1. Freeze evaluation simulation at a committed boundary and render both viewpoints for that same authoritative state.
2. Give each worker only its own packet. Launch required model decisions concurrently. A worker may retain a still-running bounded plan; its next decision can occur earlier than its partner's without gaining extra simulation time.
3. Validate schemas, role ownership, limits and UI tokens. Reserve model-call/token capacity before dispatch. Invalid output gets a bounded repair attempt with only its own validation feedback; record it and charge the budget.
4. Queue valid plans by observation ID. Resolve absent/failed decisions through a declared neutral-action fallback, never through a hidden puzzle solver. Repeated provider failure or watchdog expiry terminates explicitly.
5. Apply due role inputs in a declared stable order, then call `GameRoom.tick()` **once per simulation tick**, with both roles' held intent already installed. Rotate or record order priority across scenarios; do not make model response arrival determine in-world precedence.
6. Advance at 60 Hz in controlled batches. Check terminal conditions each tick. At most every 30 ticks (0.5 s), or sooner at plan expiry, check rendered/current UI events for an interrupt. Use visible events to request an early decision, not hidden quest-state changes.
7. Cancel stale remaining controls on a map transition, focus change or terminal outcome, through neutral intent; capture the new view. Revalidate any pending UI action. Never carry a preplanned sequence into an unseen map.
8. Deliver bounded messages at the next committed boundary. Capture both local feedback streams and repeat.

A long model response freezes the **evaluation clock**, not ordinary human servers. No game time is deducted for model latency; all actual time is reported separately. Menu, dialogue, grooming and combat waits that advance game ticks count toward active time. The evaluator must not skip these because the desired outcome is known. Allow read-only inspection at a frozen observation without making UI actions free in-game actions.

Current blockers to this design are the real-time interval in `app.ts`, `Date.now()` input freshness/session handling in `GameRoom`, and real-time animation/typewriter clocks. Introduce a narrowly scoped opt-in evaluation driver and injected runtime clock, defaulting to present behavior for humans. In evaluation, freshness time, server ticks and renderer capture time must agree. Do not monkey-patch `room.tick`, mutate a global clock, or let browser input pumps/another timer advance the room independently. A regression must show the production default still uses its normal wall-clock accumulator.

Seed determinism also requires controlling/recording relevant ID generation and any tie-breaking affected by IDs, initial clock and renderer timing. Current `seed` is not a game feature. Use seeds to initialize evaluation clock/identity sources and declared presentation/input-delay scenarios through approved lifecycle options, never to edit puzzle state. UUIDs that do not affect behavior can be normalized for trace comparison, but do not assume they are irrelevant without testing order/tie-breaks. Replay of recorded actions must match authoritative state hashes; identical seed does not guarantee identical fresh LLM output.

## 5 Independent policies and communication

SiegAgent and CocoAgent run in distinct workers or containers, with separate transcript stores, memory files, model calls, tool capabilities and context summaries. They do not inherit the Codex implementation conversation. Neither receives repository files, the rationale, this proposal, review reports, QA solvers, evaluator logs, scenario manifests, seed values, expected item dependencies or a route order.

Initial context consists of the frozen public mechanics manual, generic objective, own hero identity, interface instructions and budget rules. Do not fetch links embedded in the manual. Hash the exact initial contexts and scan for accidental route/solution/fixture text before the first model call. Later memory may contain only the worker's own observations, actions, public feedback and delivered messages. A memory summarizer is role-local and logged; it cannot merge histories. All summarizer/repair calls count toward total model usage.

The implementation team's Codex tools and repository access must not be available to the evaluated players. Process isolation, an allowlisted model gateway and a capability-scoped environment client enforce this boundary. A prompt saying “do not look at source” is insufficient. Raw `state:sync` and `game:snapshot` currently serialize `World`; these can feed trusted rendering but cannot cross the policy interface.

Proposed message rule: one optional UTF-8 message of at most 256 characters per decision, maximum 64 sent per role per episode. Messages cost no extra hidden game action; they ride the same action envelope, are delivered on the next scheduler boundary, and are logged verbatim. No shared blackboard, private coordinator advice, or access to the partner's reasoning. The coordinator validates length/ownership and relays; it does not rewrite messages into a cooperative plan. A discovered strategy communicated by a player is allowed. Seed/solution information supplied by the evaluator is not.

## 6 Episode initialization, budgets and outcomes

Canonical reset: normal story-free shrine room, two connected roles through add/select/ready, normal starting abilities, empty backpack, no quest claims/unlocks/completions, fresh branch state on first entry. Assert these postconditions privately; do not satisfy a failed assertion by patching state. Return opaque player capabilities. The clean initializer avoids preexisting campaign flags that would contaminate completion metrics.

Proposed caps, requiring approval:

| Limit | Proposed value and accounting |
| --- | --- |
| Active simulation time | 480 s / 28,800 ticks at 60 Hz; count exactly the ticks actually advanced. |
| Player submissions | 2,000 total, 1,000 per role, including invalid submissions; internal held-input refresh does not count. |
| Model calls | 1,200 total, 600 per role, including output repair and memory-summary calls. Failed attempts count. |
| Tokens | 8 million input plus 1 million output tokens total, separate per-role reservations prevent one worker consuming all capacity. |
| Wall-clock watchdog | 90 minutes, plus manual cancellation at any time. Treat this as an operational cap, not a promise of completion speed. |
| Provider failure | One bounded repair/retry; repeated unavailable/error condition terminates with a recorded error rather than silently switching to scripted play. |

Terminal reasons: `success`, `time_limit`, `action_limit`, `model_call_budget`, `token_budget`, `unrecoverable_error`, `wall_clock_limit`, `manual_cancel`. Distinguish infrastructure failure from a normal unsuccessful attempt. Check cancellation before every tick batch and around model requests. Cancel in-flight calls where supported; record any later returned/billed usage without advancing the terminated episode.

Success is the authoritative `shrineComplete(world)` / accepted offering record from the normal transaction, never inventory possession alone or a client claim. The outcome checker can read hidden state because it is evaluation machinery; its results remain outside policy inputs. If success occurs on the last allowed tick, success takes precedence; if a budget is exhausted before a decision dispatch/step is allowed, terminate without another action. Log the exact precedence and terminal tick.

Damage, ordinary respawns, missed spells, hazard recovery and retries use the current rules. Do not refill health, restore tools, revive enemies, rewind clocks or reset puzzles between decisions. The episode is over at the accepted offering; subsequent campaign ending scenes are not required. Leaving the shrine quest area through an ordinary available return is not automatically illegal: time continues, with no extra campaign objective or hidden forced return.

## 7 Fair baseline and predeclared evaluation

### Baseline

Build two deterministic, observation-limited scripted controllers using the exact same packets, UI tokens, action validator, camera condition, message bounds, scheduler and episode limits. Start with generic exploration, local movement recovery, reading current UI, combat responses to visible enemies, and explicit message coordination. Any navigation map must be built from the allowed visible-scene descriptions and retained local history. Use visible labels/owned item descriptions to attempt interactions; aim/rotate from visible consequences, not imported solution angles or station IDs.

Do not reuse route waypoints, branch order, known enemy IDs, full collision geometry, wolf coordinates, phase clocks or reward seeding from the existing scripts. An intent-only oracle is not made fair by sending its privileged plan through `step`. Dependency/process tests must reject privileged imports and filesystem access.

A useful observation-only full-quest script is a substantial task, especially with visual reflection and reactive pursuit. Begin with a clearly labelled generic heuristic baseline and report its failure rate if it cannot solve the quest. Do not call a hidden-state script the credible baseline to meet a deadline. Maintain a separate privileged reachability oracle only for engineering diagnosis, clearly excluded from the comparative results and never used to bootstrap player context.

### Predeclare scenarios before tuning

All scenarios retain normal shrine spawning, empty inventory, unsolved mechanisms and gameplay rules. Proposed variations are evaluation presentation and normal input-delivery delay, not privileged puzzle edits:

| Scenario | Declared condition | Split |
| --- | --- | --- |
| A Ordinary desktop | 1280 × 800 per player; no added delivery delay | Development seeds 1101/1102; held-out seeds 8101–8103 |
| B Narrower view | 960 × 720 per player; same default camera rules; no added delay | Development seeds 1201/1202; held-out seeds 8201–8203 |
| C Modest input delay | 1280 × 800; seeded per-role input delay of 0–6 simulation ticks, FIFO and delivered as ordinary intent | Development seeds 1301/1302; held-out seeds 8301–8303 |

These are nine held-out episodes across three conditions, not nine randomized maps. Seed values are proposed reproducibility identifiers; the current game does not have a seeded level generator. The held-out manifest is sealed before tuning; developers may know its declared format, but no development run may inspect its actual traces/results. Validate scenario machinery on separate development seeds. Freeze policy code, prompts, model configuration, baseline and preprocessing hashes before one held-out campaign. Report every result and do not select only successful seeds. Any change after looking at held-out results requires a new version and a new held-out set.

If runtime budget cannot support nine episodes, reduce and preregister the count **before** inspecting held-out results. A live demonstration and the formal held-out campaign are separate artifacts; do not retune from the held-out set to improve the demonstration.

## 8 Traces and reproduction

Private run layout:

```text
evaluation-runs/<run_id>/
  manifest.json             revision + dirty patch hash, dependencies, seed/scenario,
                            prompts/manual/model/config versions and all caps
  events.jsonl              ordered reset/observe/legal/step/validation/message/terminal events
  observations/{sieg,coco}/  exact visible-scene/UI JSON packets and content hashes
  calls/{sieg,coco}/         request/response IDs, role, latency, token usage and cost basis
  actions.jsonl             model actions, effective validated intents and delivery ticks
  video/                    normal-speed Sieg/Coco recordings, synchronized combined MP4,
                            frame-to-tick manifest and uncut live-capture provenance
  private/state-hashes.jsonl normalized authoritative replay hashes and private progress metrics
  outcome.json              success/failure reason, terminal tick, actual wall/active time
  review/                   audit findings and provenance
```

Record rejected actions, no-ops, stale tokens, UI acknowledgement errors, model failures and retries. Logs store exact model inputs and outputs needed to reproduce decisions, without requiring or claiming access to private chain-of-thought. Record the action explanation only if the declared policy output asks for a short public explanation. Never log API credentials. Cost includes all billed/failed/retried calls; when provider price or usage is unavailable, record `unknown` rather than zero and retain the pricing provenance/version if later computed.

The player-visible progress record is the exact HUD/journal/notice history, not a private checklist repackaged as an observation. Private analysis may measure branch visits and reward acquisition, but may not shape the next policy action. This separation applies to terminal error messages too.

Replay executes effective validated actions through the same engine, clock and scenario schedule. Compare state hashes and structured public-observation hashes; document any platform-dependent rendering variance separately in the video audit. Preserve the dirty-tree patch or a clean committed evaluation revision, because the current working tree has unrelated in-progress gameplay edits. Pin a clean revision before sealed evaluation; no claim that today's moving checkout is a reproducible release.

### Required normal-speed gameplay video

The demonstration artifact is a **recorded video at 1× normal gameplay speed**, not screenshots or a 2×/accelerated montage. Record both original player views and provide a synchronized side-by-side MP4 with legible HUD, dialogue, actions and partner messages. Preserve game audio where available. Include the beginning from the ordinary empty-inventory start and the terminal result, including unsuccessful attempts; no undisclosed cuts, skipped hazards or sped-up travel.

The evaluation may freeze simulation while models think. Keep two clearly labelled timing records:

- **Uncut live capture:** retains all wall-clock model waiting periods and records the active-time counter alongside actual elapsed wall time. Gameplay itself is never accelerated. A wait interval is a paused simulation, not a player action.
- **Normal-speed gameplay replay:** replay the exact logged effective actions through the same seeded authoritative engine at 60 simulation ticks per real second, rendering/capturing at 60 fps where feasible (30 fps is acceptable if frames retain the same 1× timeline). No replanning or replacement solver. Verify state hashes against the live run before labelling it a faithful replay. Keep player-visible dialogue/typewriter timing; do not reveal a full line earlier than in the original observation sequence.

The replay must be labelled as a replay of the autonomous run, not a continuous wall-clock live model demonstration. An episode lasting 480 active seconds yields approximately eight minutes of replay, plus any disclosed pre/post-roll; earlier termination produces a shorter video. Model latency remains fully visible in the uncut live capture and metrics. Retain a frame timestamp-to-simulation-tick manifest and test that 60 seconds of active simulation plays in 60 seconds of video. Do not create screenshot deliverables or remove thinking pauses from a recording without disclosing the replay method.

## 9 Model volume, wall-clock and cost risks

No provider/model or paid API budget has been selected in this proposal, and no live model calls have been made. Use measured pilot latency and usage before committing to the final run count. These are planning calculations, not provider performance claims:

| Mean policy plan duration | Approximate joint decision boundaries in 480 s | Calls if both agents decide each boundary |
| --- | ---: | ---: |
| 0.5 s | 960 | 1,920, exceeding proposed call cap |
| 1 s | 480 | 960 |
| 2 s | 240 | 480 |
| 4 s | 120 | 240 |

At a 2 s mean horizon and 2–8 s latency for the slower parallel call in each round, inference alone is roughly **8–32 minutes wall time per episode**, before rendering, observation transport, summaries, retries and interruptions. Tight aiming/combat can substantially increase calls. A four-second plan is efficient for clear movement but may overshoot a mirror, target, enemy windup or doorway; event interrupts and short controls are needed rather than a route-specific macro.

For 480 calls averaging 5,000 input and 400 output tokens, an illustrative text-equivalent budget is 2.4 million input and 192,000 output tokens. No image/video inputs are sent to the models. Measure actual text usage and cumulative memory costs. Cost formula: `input_tokens / 1e6 * input_price + output_tokens / 1e6 * output_price + applicable tool charges`, including retries. No unsupported dollar estimate is supplied. Role-local summaries and provider-supported prompt caching can reduce input, but must preserve independence and be logged.

Choose a text-capable model/provider, secure credentials and a spend ceiling after approval; keep the model adapter provider-neutral. The architecture must function with scripted workers and recorded decisions before spending on live calls. Approximately eight minutes refers to simulated active time, not an eight-minute wall-clock demonstration.

## 10 Implementation-team evidence and reviews

Maintain implementation-agent configuration separately from the game-playing policies. Proposed configuration location: `.codex/agents/oath-rule-reviewer.toml`, following the applicable subagent-creation instructions when implementation is approved. Its job is read-only review of source, tests and private traces; it is never a playable hero or a source of advice during evaluation. No configuration is created during this proposal phase.

Proposed reusable skill: `.agents/skills/oath-rule-information-boundary/SKILL.md`, with a checklist covering ordinary-rule preservation, field provenance, no source/solution exposure, baseline equality, independent memory, shared-clock correctness, terminal accounting and reproducible evidence. Create it with the skill-authoring workflow only after approval.

Invoke that skill in **two distinct sessions**: Session A after the contract/observation implementation, Session B after the policy/baseline/trace implementation, preferably through separately created review chats as explicitly authorized. Record skill version/hash, invocation evidence, scope, findings and resolutions. Two calls in the current chat do not satisfy “two sessions.” A third read-only reviewer checks the frozen implementation and evaluation artifacts without editing or sharing context with either player. Critical leaks or invalid comparisons block a success claim.

A preliminary independent read-only subagent reviewed the current repository during proposal preparation. Its findings are preserved at [the preimplementation boundary review](../docs/midterm/reviews/2026-10-22-preimplementation-boundary-review.md). This is not a review of an adapter that does not exist, and it does not substitute for the later two-session skill evidence. The personal agent-team log and approval of design decisions remain yours to maintain.

## 11 Blockers and approval choices

| Priority | Issue | Proposed treatment |
| --- | --- | --- |
| P0 | No fresh unified full-quest proof | First gate: ordinary empty-state continuous reachability evidence, full enemies and normal transactions, current version. Diagnose/report blockers; obtain approval before changing gameplay. |
| P0 | Current snapshots contain global hidden state | Renderer is trusted; policies see only audited visible-scene/UI JSON packets. No raw snapshots, source assets, DOM hidden attributes or debug exports. |
| P0 | Existing visible HUD includes solution-like instructions | Decide before implementation: preserve **ordinary current in-game hints** as discoverable information, or approve an evaluation presentation without those hints for both players and the fair baseline. Do not silently censor one contestant or claim the unchanged HUD is solution-free. |
| P0 | Current solvers are privileged | Keep them as engineering QA. Build and audit a separate observation-only baseline; report honest failure if necessary. |
| P0 | Wall-time simulation and renderer clocks conflict with inference pauses | Opt-in shared clock/driver; defaults unchanged; no independent browser/server ticking. |
| P1 | Seed has no current environment contract | Add seeded evaluation runtime sources and declared delay/presentation scenarios without mutating quest initial state. Verify replay before claiming reproducibility. |
| P1 | Live model provider, credentials and budget unspecified | Select after approval and a bounded pilot. No unauthorized spend or hidden fallback to scripted actions. |
| P1 | Latest code and manual/specifications differ | Freeze public manual; verify only control facts, flag remaining inconsistencies. Do not give rationale/specifications to policies as a substitute. |
| P1 | Eight-minute completion and fair-baseline capability unknown | Treat 480 s as a cap/target, not an accomplished result. Keep all failed episodes. |
| P1 | Prompt leakage versus existing asset names/DOM metadata | Tokens are opaque; observation extraction copies only rendered text. Test malicious access and hidden marker leakage. |

The most important content choice is the HUD. “Discover through the game” permits reading its authored clue, while “no puzzle solution” can be read more strictly than the current UI supports. My recommendation is to preserve genuine current in-game text, prohibit added developer solutions, and explicitly describe the experiment as **in-game-hint-assisted discovery**. If strict solution-free discovery is required, approve the alternate evaluation presentation before collecting results; ordinary human multiplayer stays untouched, but that alternate condition must be clearly disclosed.

## 12 Milestones to the October 26 checkpoint

| Date | Deliverable and gate |
| --- | --- |
| Thu Oct 22 | Approve this architecture, clean start, HUD information policy, budgets, baseline scope and proposed scenario split. Pin the revision after existing gameplay work settles. No implementation before approval. |
| Fri Oct 23 | Reachability gate; engine/clock isolation; reset/outcome and joint scheduler; full boundary/action contract tests. Capture a fresh complete quest engineering run or report the precise blocker. |
| Sat Oct 24 | Structured visible-scene observations, normal-speed video recording, UI tokens and bounded communication; two independent policy workers; trace/replay. Session A skill review and fixes. Small paid pilot only with selected provider and budget. |
| Sun Oct 25 | Observation-only baseline; predeclare/freeze scenario manifest and policies; Session B skill review plus independent read-only implementation review. Full human-regression checks, leakage tests and bounded live progress run. |
| Mon Oct 26 | Run/report the frozen held-out evaluation and a separate live demonstration within available wall-clock/spend budgets. Deliver traces, outcome tables, limitations and review resolutions; no tuning on held-out cases. |

This is a proposed schedule, not a claim of guaranteed delivery or full quest success. If P0 reachability, timing or leakage gates fail, the checkpoint report should present that result and the blocker rather than a scripted success disguised as autonomous play.

## 13 Acceptance matrix

| Requirement | Evidence to collect after approval |
| --- | --- |
| Full quest from ordinary fresh state | One continuous current-version engine trace from empty inventory to accepted offering, no quest/position/health patches after reset, all guards active. Separate engineering reachability from player-only success. |
| Independent memories | Distinct histories/storage/capabilities; unique marker in one worker never appears in the other before an explicit permitted message. |
| No future initial knowledge | Hash/freeze contexts; prompt/observation canaries; block code/spec/QA/rationale imports and URLs; no seeded route or privileged memory prefill. |
| Communication | Boundary-delivered text with limits, role isolation, action/usage accounting and exact replay. |
| Real-engine validation | Reject outcome injection and stale tokens; test cooldowns, reach, sight, role, held/release edges and ordinary failures. |
| Fair baseline | Same five operations/observations/actions/caps; deny map/state access; inspect dependencies and logs; no inherited privileged solver. |
| Terminal correctness | Boundary tests for each reason, success-at-limit precedence, pending calls, repeated requests and cancellation with no later ticks. |
| Complete reproducible traces | Every observation/legal set/action/result/message/call accounted for; hashes, revision and scenario pinned; replay verifies normalized authoritative state. |
| Human gameplay unchanged | Default driver, transport, combat, inventory, puzzles and UI regression checks; `npm run typecheck`, `npm test`, `npm run build`; two-human-client smoke test. Report any existing failure separately. |
| Normal-speed video | Synchronized both-view MP4, uncut live provenance, frame/tick timing validation and state-verified 1× action replay; no screenshot deliverables or accelerated gameplay. |
| Genuine live model progress | Both roles use separate live contexts and no solver fallback. Show fresh observations, model decisions and legal engine effects beyond simply moving/opening a menu. Preserve unsuccessful attempts; only call full completion if the offering succeeds. |

### Approval checklist

Approval should cover: (1) clean story-free shrine episode; (2) the HUD information choice; (3) structured visible-scene/UI observations, normal-speed video and role isolation; (4) joint-clock scheduler and normal-control plans; (5) 480 s and operational budgets; (6) separate observation-only baseline and held-out manifest; (7) the implementation/review milestones. The demonstrated route remains private to implementers and is never an agent instruction.
