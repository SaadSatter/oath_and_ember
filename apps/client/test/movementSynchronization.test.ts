import { expect, it } from "vitest";
import { GameRoom } from "../../server/src/GameRoom.js";
import { Prediction } from "../src/net/prediction.js";
import { SimulationClock } from "../src/net/simulationClock.js";
import { Interpolation } from "../src/net/interpolation.js";
import {
  neutral,
  type InputFrame,
  type World,
} from "../../../packages/shared/src/gameTypes.js";
import {
  DT,
  INPUT_LEAD_TICKS,
  MAX_PREDICTION_LEAD,
  SERVER_HZ,
  SNAPSHOT_INTERVAL_TICKS,
  ticksFor,
} from "../../../packages/shared/src/constants.js";
// Network jitter in these scenarios is authored in 30Hz ticks (33ms units).
const JITTER = ticksFor(1 / 30);
import { collisionRects } from "../../../packages/shared/src/maps.js";
function pair() {
  const room = new GameRoom("SYNC01", false, "FOREST_RUINS");
  const a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  room.state.enemies = {};
  room.state.puzzles.gate.complete = true;
  room.state.puzzles.bridge.complete = true;
  const players = [
    room.state.players[a.playerId],
    room.state.players[b.playerId],
  ];
  players.forEach((p, n) =>
    Object.assign(p, {
      x: 100,
      y: 400 + n * 80,
      unlockedSkills: [n ? "blink" : "dash"],
    }),
  );
  return { room, players };
}
for (const hz of [30, 60, 120, 144])
  it(`has bounded, deterministic two-player movement through batching, loss and release at ${hz}Hz renders`, () => {
    const { room, players } = pair();
    const clients = players.map((p) => {
      const prediction = new Prediction();
      prediction.reset(p);
      return {
        prediction,
        clock: new SimulationClock(),
        world: structuredClone(room.state),
        seq: 0,
        history: [] as InputFrame[],
      };
    });
    clients.forEach((c) => c.clock.reset(0, 0));
    const packets: { due: number; n: number; frames: InputFrame[] }[] = [];
    const snapshots: { due: number; world: World }[] = [];
    let sampleTime = 0,
      renderTime = 0;
    let maxCorrection = 0;
    for (let tick = 1; tick <= ticksFor(13); tick++) {
      const now = (tick - 1) * 1000 * DT;
      // Rendering reads state; it cannot determine the number of physics steps.
      while (renderTime <= now) {
        for (const c of clients)
          expect(Number.isFinite(c.prediction.player!.x)).toBe(true);
        renderTime += 1000 / hz;
      }
      // Some samples share a target tick; some timer wakes are skipped entirely.
      if (tick % 17 !== 0) {
        for (let extra = 0; extra < (tick % 13 === 0 ? 2 : 1); extra++)
          clients.forEach((c, n) => {
            const input = {
              ...neutral(++c.seq),
              targetTick: c.clock.target(c.world.serverTick, now),
              moveX: tick <= ticksFor(5) ? 1 : tick <= ticksFor(10) ? -1 : 0,
              secondaryHeld:
                tick <= ticksFor(10) && tick % ticksFor(3) < ticksFor(0.267),
            };
            c.prediction.push(input, c.world);
            c.history.push({ ...input });
            if (c.history.length > 6) c.history.shift();
            // Redundancy recovers missing transition packets before their target tick.
            if (c.seq % 11 !== 0)
              packets.push({
                due: tick + (tick % 4) * JITTER,
                n,
                frames: structuredClone(c.history),
              });
            expect(
              c.prediction.simulationTick - c.world.serverTick,
            ).toBeLessThanOrEqual(MAX_PREDICTION_LEAD);
          });
        sampleTime = now;
      }
      for (const packet of packets.filter((p) => p.due <= tick))
        for (const input of packet.frames)
          room.receiveInput(players[packet.n].id, input);
      for (let i = packets.length - 1; i >= 0; i--)
        if (packets[i].due <= tick) packets.splice(i, 1);
      room.tick();
      if (tick % SNAPSHOT_INTERVAL_TICKS === 0)
        snapshots.push({
          due: tick + (tick % 3) * JITTER,
          world: structuredClone(room.state),
        });
      for (const snapshot of snapshots.filter((s) => s.due <= tick))
        clients.forEach((c, n) => {
          if (snapshot.world.serverTick <= c.world.serverTick) return;
          c.world = snapshot.world;
          c.prediction.reconcile(
            snapshot.world.players[players[n].id],
            snapshot.world,
          );
          maxCorrection = Math.max(maxCorrection, c.prediction.error);
          const q = c.prediction.player!;
          expect(
            collisionRects(q.sceneId!, c.world.puzzles).some(
              (r) =>
                q.x + 13 > r.x &&
                q.x - 13 < r.x + r.w &&
                q.y + 13 > r.y &&
                q.y - 13 < r.y + r.h,
            ),
          ).toBe(false);
        });
      for (let i = snapshots.length - 1; i >= 0; i--)
        if (snapshots[i].due <= tick) snapshots.splice(i, 1);
    }
    expect(sampleTime).toBeGreaterThan(10000);
    expect(maxCorrection).toBeLessThan(1e-6);
    for (let n = 0; n < 2; n++)
      expect(clients[n].prediction.player!.x).toBeCloseTo(players[n].x);
  });
it("uses server simulation spacing when snapshots arrive as a burst", () => {
  const { room, players } = pair(),
    p = players[0],
    interpolation = new Interpolation();
  room.state.serverTick = 0;
  interpolation.push(structuredClone(room.state), 1000);
  for (let tick = 1; tick <= ticksFor(0.2); tick++) {
    room.state.serverTick = tick;
    p.x = 100 + tick * 190 * DT;
    interpolation.push(structuredClone(room.state), 1200);
  }
  for (let ms = 1100; ms < 1290; ms += 1000 / 120) {
    const a = interpolation.position(p.id, "players", ms)!,
      b = interpolation.position(p.id, "players", ms + 1000 / 120)!;
    expect(b.x - a.x).toBeCloseTo(190 / 120);
  }
  const count = interpolation.buffer.length;
  interpolation.push({ ...room.state, serverTick: 1 }, 1400);
  expect(interpolation.buffer.length).toBe(count);
});
it("never advances prediction beyond its lead during a five-second snapshot outage", () => {
  const { room, players } = pair();
  const prediction = new Prediction(),
    clock = new SimulationClock();
  prediction.reset(players[0]);
  clock.reset(0, 0);
  for (let n = 0; n < 150; n++)
    prediction.push(
      {
        ...neutral(n + 1),
        targetTick: clock.target(0, (n * 1000) / 30),
        moveX: 1,
      },
      room.state,
    );
  expect(prediction.simulationTick).toBe(MAX_PREDICTION_LEAD - 1);
  expect(prediction.player!.x).toBeCloseTo(
    100 + (MAX_PREDICTION_LEAD - INPUT_LEAD_TICKS) * 190 * DT,
  );
});
it("calibrates promptly after delayed full sync and bounds delayed probes and recalibrates after server stalls", () => {
  const clock = new SimulationClock();
  clock.reset(100, 1000);
  clock.sample(120, 1000, 1002);
  expect(clock.target(120, 1002)).toBe(120 + INPUT_LEAD_TICKS);
  clock.sample(121, 1002, 1302); // Queue delay is not a reliable clock measurement.
  // Anchored on the first probe (half its 2ms round trip), then 300ms of time.
  expect(clock.estimate(1302)).toBeCloseTo(
    120 + (2 * SERVER_HZ) / 2000 + (300 * SERVER_HZ) / 1000,
  );
});
it("does not interpolate a same-scene respawn through intervening obstacles", () => {
  const { room, players } = pair();
  const i = new Interpolation();
  i.push(structuredClone(room.state), 1000);
  room.state.serverTick = 2;
  players[0].movementEpoch!++;
  players[0].x = 700;
  i.push(structuredClone(room.state), 1067);
  expect(i.position(players[0].id, "players", 1120)!.x).toBe(700);
});

it("does not jump remote positions when a dry interpolation buffer receives a burst", () => {
  const { room, players } = pair();
  const interpolation = new Interpolation();
  interpolation.push(structuredClone(room.state), 1000);
  expect(interpolation.position(players[0].id, "players", 2000)!.x).toBe(100);
  for (let tick = 1; tick <= 6; tick++) {
    room.state.serverTick = tick;
    players[0].x = 100 + tick * 190 * DT;
    interpolation.push(structuredClone(room.state), 2000);
  }
  expect(interpolation.position(players[0].id, "players", 2016)!.x).toBeCloseTo(
    103.04,
  );
});
it("keeps outgoing commands in the server acceptance window at the prediction ceiling", () => {
  const { room, players } = pair();
  const prediction = new Prediction();
  prediction.reset(players[0]);
  for (let seq = 1; seq <= 150; seq++) {
    const input = {
      ...neutral(seq),
      targetTick: MAX_PREDICTION_LEAD,
      moveX: 1,
    };
    prediction.push(input, room.state);
    expect(input.targetTick).toBeLessThanOrEqual(MAX_PREDICTION_LEAD);
    expect(room.receiveInput(players[0].id, input)).toBe(true);
  }
});

it("ignores clock replies from an earlier reset or superseded probe", () => {
  const clock = new SimulationClock();
  clock.reset(100, 1000);
  clock.sample(120, 1100, 1102);
  clock.sample(50, 1001, 1200);
  expect(clock.estimate(1200)).toBeCloseTo(
    120 + (2 * SERVER_HZ) / 2000 + (98 * SERVER_HZ) / 1000,
  );
  clock.reset(200, 1300);
  clock.sample(125, 1200, 1350);
  expect(clock.estimate(1350)).toBeCloseTo(200 + (50 * SERVER_HZ) / 1000);
});

it("does not replay queued movement while the partner disconnect pauses authority", () => {
  const { room, players } = pair();
  const prediction = new Prediction();
  prediction.reset(players[0]);
  prediction.push(
    { ...neutral(1), targetTick: 8, moveX: 1, secondaryHeld: true },
    room.state,
  );
  room.disconnect(players[1].id);
  for (let tick = 0; tick < 20; tick++) {
    room.tick();
    prediction.reconcile(players[0], room.state);
    expect(prediction.player!.x).toBe(players[0].x);
    expect(prediction.simulationTick).toBe(room.state.serverTick);
    expect(prediction.pending).toHaveLength(0);
  }
});
it("does not collapse the movement buffer after a delayed clock reply and add extra steps on release", () => {
  const clock = new SimulationClock();
  clock.reset(1000, 0);
  clock.sample(1000, 0, 2); // Initial low-latency calibration.
  clock.sample(1001, 30, 800); // An old reply finally runs after a browser stall.
  const before = clock.target(1024, 800);
  expect(before).toBeGreaterThanOrEqual(1024 + INPUT_LEAD_TICKS);
  clock.sample(1024, 800, 802);
  const after = clock.target(1024, 802);
  expect(after - before).toBeLessThanOrEqual(1);
});

it("glides the local hero at constant speed despite uneven input timer wakes", () => {
  const { room, players } = pair();
  const prediction = new Prediction(),
    clock = new SimulationClock();
  prediction.reset(players[0]);
  clock.reset(0, 0);
  const world = structuredClone(room.state);
  let seq = 0,
    nextWake = 0,
    previous: { x: number } | null = null;
  const steps: number[] = [];
  for (let ms = 0; ms < 1000; ms += 1000 / 60) {
    // setInterval wakes late, early, or twice in one frame; render stays at 60Hz.
    while (nextWake <= ms) {
      world.serverTick = Math.max(
        0,
        Math.floor((nextWake * SERVER_HZ) / 1000) - 2,
      );
      prediction.push(
        {
          ...neutral(++seq),
          targetTick: clock.target(world.serverTick, nextWake),
          moveX: 1,
        },
        world,
      );
      nextWake += seq % 3 === 0 ? 50 : 25;
    }
    const at = prediction.renderPosition(ms)!;
    if (previous && ms > 500) steps.push(at.x - previous.x);
    previous = at;
  }
  for (const step of steps) expect(step).toBeCloseTo(190 / 60, 0);
  expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(0.6);
});

it("recovers remote interpolation delay that a network stall added", () => {
  const { room, players } = pair();
  const interpolation = new Interpolation();
  interpolation.push(structuredClone(room.state), 1000);
  interpolation.position(players[0].id, "players", 1000);
  // A 400ms stall drains the buffer, then the backlog arrives at once.
  interpolation.position(players[0].id, "players", 1400);
  for (let tick = 1; tick <= 15; tick++) {
    room.state.serverTick = tick;
    interpolation.push(structuredClone(room.state), 1400);
  }
  let lag = 0,
    frame = 0;
  for (let ms = 1400; ms <= 6000; ms += 1000 / 60) {
    // Steady snapshots resume after the stall.
    if (++frame % 4 === 0) {
      room.state.serverTick += 2;
      interpolation.push(structuredClone(room.state), ms);
    }
    interpolation.position(players[0].id, "players", ms);
    lag =
      interpolation.buffer.at(-1)!.time -
      (interpolation as unknown as { playbackTime: number }).playbackTime;
  }
  expect(lag).toBeLessThanOrEqual(270);
});
