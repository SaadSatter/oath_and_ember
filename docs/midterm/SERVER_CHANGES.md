# Authoritative server changes for evaluation and recording

Status: **implemented 2026-10-27** (commit `7c9f025` on `midterm/evaluation`), after the owner approved all three changes and chose option B for §3. Production behaviour is the default. Results and deviations from this design are in "Implementation record" at the end.

No game rule, tuning value, map, story line or asset changes. Every change is opt-in. A server started the normal way (`npm start`, `npm run dev`, Render) behaves exactly as before.

## Why these changes are needed

| Problem | Where | Effect on evaluation |
| --- | --- | --- |
| Slow Time activates only if the hero's latest input is under 250 ms old by **wall clock** (`Date.now() - session.received < 250`) | `apps/server/src/GameRoom.ts:899` | Game time pauses while a model decides. With browsers attached and real-time pacing for video, a pause longer than 250 ms can silently block Slow Time. Results would then depend on model latency, not on play |
| Input freshness falls back to wall clock when an input has no `targetTick` | `GameRoom.ts:939` | Same dependency, in the tick path |
| Session expiry uses wall clock | `GameRoom.ts:334`, `:376`; `app.ts:319` | Harmless headless, but a long model pause with browsers attached could expire a session |
| Player, token, projectile and black-hole ids come from `randomUUID()` | `GameRoom.ts:241–242`, `:1112`, `:1137` | State hashes differ between identical runs, so PR #7 rewrites ids by order of appearance before hashing. Replays cannot compare raw state |
| The 60 Hz `setInterval` loop in `createApp` always ticks every room | `app.ts:311–342` | A recording needs the game server and Socket.IO (so real browsers can render), but the agent runner must own the clock. Two tick owners would advance the room twice |
| A browser that renders a hero's view does so by owning that hero's session | `session:resume` in `app.ts:135` | Recording browsers could submit input, use items or advance dialogue for the agent, and closing a browser would disconnect the hero (input reset, story paused) |

## 1. Clock and id injection

**Change.**
- Add `export interface RoomRuntime { now(): number; id(): string }` to `GameRoom.ts`.
- Add an optional last constructor parameter, defaulting to `{ now: () => Date.now(), id: () => randomUUID() }`.
- Replace the 8 `Date.now()` / `randomUUID()` call sites in `GameRoom.ts` with `this.runtime.now()` / `this.runtime.id()`.
- `RoomManager` and `createApp` accept an optional `runtime` and pass it through. The expiry check in `app.ts:319` uses the room's runtime.
- This matches the Codex implementation on `codex/evaluation-archive` (`4d144f4`), which was reviewed in session 21. It will be re-applied from that diff, not rewritten.

**Evaluation runtime** (in `packages/agent`, not on the server):
- `now()` returns `serverTick × 1000/60`, so freshness is measured in game time.
- `id()` returns `"<kind>-<counter>"` from a counter reset at each episode.

**Equivalence and determinism tests** (new file `apps/server/test/roomRuntime.test.ts`; existing tests stay unchanged):

1. The whole existing suite passes unchanged with the default runtime. The known directional sprint-frame failure is reported separately.
2. **Default is production.** With `Date.now` and `crypto.randomUUID` spied, a room built without a runtime calls them exactly where it did before.
3. **Same inputs, same state.** The same input script is run under the production runtime and under a fake runtime that advances with the tick. Ids are normalised by order of appearance, and the world state is then deep-equal at every tick. Two scripts are used: the existing intent-only walkthrough helpers for Mirror Pond and the Hedge Maze (Slow Time, Super Speed, fireballs, Black Hole, pushing), and a combat script that creates projectiles and black holes. This shows that no rule changed.
4. **Deterministic ids.** Two rooms with the fake runtime and the same inputs have identical raw states, ids included.
5. **Slow Time freshness boundary.** With the fake clock, an input received 249 ms before activation activates Slow Time and one received 251 ms before does not. This mirrors the production rule. The existing Slow Time tests run unchanged.
6. **Expiry.** A disconnected session expires at exactly +30,000 ms on the fake clock and resumes before that.

## 2. `manualDriver` option

**Change.**
- Move the body of the 60 Hz loop (session expiry, empty-room cleanup, `room.tick()`, `scene:transition`, `state:sync`, `game:complete`, snapshot every `SNAPSHOT_INTERVAL_TICKS`) into one function, `stepRoom(code, room)`.
- The interval calls it exactly as before.
- `createApp({ manualDriver: true })` creates no interval and returns `step(code)`, which calls the same `stepRoom`. Production code paths are identical, and the evaluation host gets the same broadcasts as live play.

**Tests** (`apps/server/test/manualDriver.test.ts`):
- Without the option, the existing socket tests pass unchanged and the room advances on its own.
- With the option, `serverTick` does not change over 200 ms of real time, and advances by exactly 1 per `step`.
- Over real Socket.IO, a client receives `state:sync` on a scene transition and `game:snapshot` every `SNAPSHOT_INTERVAL_TICKS` steps. The events are the same as under the interval loop for the same input script.

## 3. Server-enforced view-only browser sessions: **design choice needed**

The browser must render a hero's view without being able to control anything. There are two ways to attach it.

**Option A: Codex's approach.** The browser resumes the hero's real session with the reconnect token, and the client stops sending input when `?evaluationPresentation=1` is set.
- Blocking is done by the client only. The server would need extra checks on every handler for "this socket is a presentation socket".
- A crash or reload of the browser disconnects the **hero**: `GameRoom.disconnect` resets input and the movement queue, and story scenes pause.
- The agent runner's own session handle is replaced by the browser's socket.

**Option B (recommended): a separate viewer attachment.**
- **Opt-in.** A new option, `createApp({ viewers: true })`, off by default. The evaluation host registers a single-use **view token** for each hero (`app.registerViewer(roomCode, playerId)`). It is separate from the reconnect token, so a viewer can never resume or control a hero.
- **New event.** `view:attach { roomCode, playerId, viewToken }` joins the socket to the room's broadcast channel and returns the same session shape the client uses to choose whose camera and HUD to draw, without a reconnect token.
- **Server-enforced.** The socket is marked as a viewer. `player:input` is ignored, and every request (`inventory:use`, `story:read`, `story:choose`, `npc:talk`, `role:select`, `appearance:select`, `lobby:ready`, `room:leave`, `game:restart`, `skill:unlock`, `room:create`, `room:join`, `session:resume`) is rejected with "View-only session".
- **No effect on the hero.** A viewer's disconnect calls nothing on the room. The hero stays connected and the agent's input is untouched.
- **Client.** `apps/client/src/net/NetworkClient.ts` gains a view mode, selected by `?view=<token>` in the URL. It sends `view:attach` instead of `session:resume`, never starts the input timer, and the UI disables panel actions. Rendering code is unchanged. Codex's DOM observation bridge (`apps/client/src/evaluation/visibleObservation.ts`) and the `PlayerView` identity tag are **not** brought over. Agents observe through `packages/agent/src/perception.ts`, not the browser.

**Integration tests for B** (`apps/server/test/viewOnly.test.ts`, real Socket.IO, as `AGENTS.md` requires for protocol changes):
- Without `viewers: true`, `view:attach` is rejected.
- A wrong, reused or other-room token is rejected.
- A viewer receives `state:sync` and `game:snapshot`.
- For each blocked request: the call is rejected and the room's state hash is unchanged.
- `player:input` from a viewer changes nothing over 10 steps.
- A viewer disconnect leaves the hero `connected`, the hero's input unchanged, and an active story scene unpaused.
- A client test checks that view mode never emits `player:input`.

**Owner decision needed:** confirm option B. It adds one protocol event and a client view mode under `apps/client/src/net/`, both opt-in. If you prefer A, the tests above still apply, but the server must also stop a browser disconnect from disconnecting the hero.

## 4. Agent-side changes that follow (no further approval needed)

These are in `packages/agent` and `scripts/midterm`, which `CLAUDE.md` lets the implementation agent edit:

- `AgentEnvironment` takes an optional room factory and tick function. Headless runs keep `new GameRoom(...)` and `room.tick()`. Recording runs create the room through the app's `RoomManager` with the evaluation runtime, and tick through `app.step(code)`. The rules object is the same either way.
- A recorder (ported from `packages/evaluation/src/video.ts`) opens two Playwright contexts with native `recordVideo` at 1x, one per hero's view, using view tokens. Pacing: while game time advances, one tick per 1/60 s of wall time. While a hero decides, time is frozen, and an overlay drawn by the host in each page shows "Sieg is choosing…", then the chosen action and its result, taken from the trace. The overlay is injected by Playwright and is not part of the game client.
- Each recording's manifest stores the trace file, its final state hash, the model ids and the wall-clock span. A replayed recording is labelled "replay" and must reproduce every per-tick state hash in the trace.

## Out of scope

- No change to `GameRoom.tick`'s rules, including its paused-room early return. That was noted in review 18 and will only be investigated if the scripted route shows a problem.
- No persistence or extra services (`AGENTS.md`).

## Implementation record (2026-10-27)

| Change | Files | Tests | Result |
| --- | --- | --- | --- |
| §1 clock and id injection | `apps/server/src/GameRoom.ts`, `RoomManager.ts` (Codex diff re-applied unchanged), `app.ts` (expiry via the room's runtime) | `apps/server/test/roomRuntime.test.ts`, 12 tests | Pass |
| §2 `manualDriver` and `stepRoom` | `apps/server/src/app.ts` | `apps/server/test/manualDriver.test.ts`, 4 tests | Pass |
| §3 option B, view-only attachment | `apps/server/src/app.ts`, `packages/shared/src/protocol.ts` (`view:attach`, `ViewSession`), `apps/client/src/net/NetworkClient.ts` (`?view=` mode) | `apps/server/test/viewOnly.test.ts`, 6 tests over real Socket.IO; `apps/client/test/viewMode.test.ts`, 3 tests | Pass |

Full suite after these changes: typecheck pass, `npm test` 589/589, build pass.

**What the equivalence test does, and a correction to the plan above.**

The production runtime and the deterministic runtime run the same seeded scripts:
- four scripts of 1,500 ticks each, two in an encounter room and two from `goddess`;
- both heroes act, covering movement, attacks, guard, push, Super Speed, Slow Time, Flight, Black Hole and E;
- every input is checked as accepted;
- the raw world is compared every 10 ticks.

The plan said "ids normalised by order of appearance". That proved too weak and slightly wrong. The server orders heroes by id with `a.id.localeCompare(b.id)` in `golemBeam.ts:85` and `enemySimulation.ts:167`. (`inventory.ts:52–56` also breaks ties by id, but between interaction targets, whose ids are fixed names, so random ids do not affect it.) Renaming ids therefore changes the result: the first draft of the test reported a difference in a golem beam's damage list.

The final test instead records the UUIDs the production run draws and replays them in the deterministic run. Ids are then identical and only the clock differs, and the raw worlds match exactly. A separate test confirms the scripts really trigger Slow Time, Super Speed, Flight, projectiles and Black Hole. An earlier draft omitted `movementEpoch`, so every scheduled input was rejected and the comparison was vacuous; the test now fails if any input is rejected.

**Consequence for evaluation ids (open question for the owner).** In production, the random UUIDs mean which hero wins an id tie-break is effectively a coin flip per room. With counter ids, Sieg (added first) always wins it. That decides which hero an enemy targets when both are exactly equally far, and the order in which a golem beam checks the heroes. Before the suite is frozen, the owner should choose between two options:
- keep counter ids (deterministic, a fixed order, disclosed as a deviation from production's random order);
- use ids drawn from a seeded generator (deterministic per seed; the tie-break order then differs between seeds, as it does between production rooms).

**Other notes.**
- Snapshots are `volatile` emits, as before. Socket.IO drops them while a socket is busy, so a host that steps faster than real time sends fewer snapshots than live play. Recording runs step at 60 Hz in real time, so this does not affect the video.
- `view:attach` sends the initial `state:sync` only to the attaching viewer, not to the whole room. A player attach broadcasts to the room. Neither changes any state.
