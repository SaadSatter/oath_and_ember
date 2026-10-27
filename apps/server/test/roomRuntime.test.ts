// Clock and id injection (docs/midterm/SERVER_CHANGES.md §1).
// The injected runtime must not change any rule: the same inputs give the same
// world under the production runtime and under a deterministic one.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameRoom, type RoomRuntime } from "../src/GameRoom.js";
import { neutral, type InputFrame } from "../../../packages/shared/src/gameTypes.js";
import { ticksFor } from "../../../packages/shared/src/constants.js";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Deterministic runtime: game-time clock and UUID-shaped counter ids. */
function fakeRuntime(clock: () => number): RoomRuntime {
  let n = 0;
  return {
    now: clock,
    id: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  };
}

/** Rename ids by order of first appearance so random and counter ids compare. */
function normalise(value: unknown) {
  const names = new Map<string, string>();
  return JSON.stringify(value).replace(UUID, (id) => {
    if (!names.has(id)) names.set(id, `id${names.size}`);
    return names.get(id)!;
  });
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the real client sends: a scheduled frame with the hero's movement epoch. */
function send(room: GameRoom, id: string, seq: number, held: Partial<InputFrame>) {
  const accepted = room.receiveInput(id, {
    ...neutral(seq),
    targetTick: room.state.serverTick + 1,
    movementEpoch: room.state.players[id].movementEpoch ?? 0,
    ...held,
  });
  if (!accepted) throw Error(`input ${seq} was rejected`);
}

type Start = "encounter" | "goddess";
function makeRoom(start: Start, runtime?: RoomRuntime) {
  const room =
    start === "encounter"
      ? new GameRoom("EQUIV1", true, "MAIN_HOUSE", false, undefined, runtime)
      : new GameRoom("EQUIV2", false, "MAIN_HOUSE", true, "goddess", runtime);
  const a = room.add("a").playerId,
    b = room.add("b").playerId;
  room.select(a, "OATH");
  room.select(b, "EMBER");
  room.ready(a, true);
  room.ready(b, true);
  return { room, ids: [a, b] as const };
}

/**
 * A seeded script of held controls for both heroes: movement, attacks, guard,
 * push, Super Speed, Slow Time, Flight, Black Hole and E. Each control is held
 * for a random 1–40 ticks, so presses, holds and releases all occur.
 */
function script(seed: number, ticks: number) {
  const rnd = mulberry32(seed);
  const frames: [Partial<InputFrame>, Partial<InputFrame>][] = [];
  const held: Partial<InputFrame>[] = [{}, {}];
  const left = [0, 0];
  for (let t = 0; t < ticks; t++) {
    for (const h of [0, 1]) {
      if (left[h]-- <= 0) {
        left[h] = 1 + Math.floor(rnd() * 40);
        const pick = rnd();
        held[h] = {
          moveX: Math.floor(rnd() * 3) - 1,
          moveY: Math.floor(rnd() * 3) - 1,
          primaryHeld: pick < 0.25,
          secondaryHeld: pick >= 0.25 && pick < 0.32,
          sprintHeld: h === 0 && pick >= 0.32 && pick < 0.45,
          pushHeld: h === 0 && pick >= 0.45 && pick < 0.5,
          slowTimeHeld: h === 1 && pick >= 0.32 && pick < 0.42,
          flightHeld: h === 1 && pick >= 0.42 && pick < 0.5,
          blackHoleHeld: h === 1 && pick >= 0.5 && pick < 0.56,
          interactHeld: pick >= 0.56 && pick < 0.6,
        };
      }
    }
    frames.push([{ ...held[0] }, { ...held[1] }]);
  }
  return frames;
}

/** Run one script and sample the normalised world every `every` ticks. */
function run(start: Start, frames: ReturnType<typeof script>, runtime?: (room: () => GameRoom) => RoomRuntime, every = 10, normaliseIds = true) {
  let ref: GameRoom | undefined;
  const { room, ids } = makeRoom(start, runtime?.(() => ref!));
  ref = room;
  const seq = [0, 0];
  const samples: string[] = [];
  frames.forEach((pair, t) => {
    for (const h of [0, 1])
      send(room, ids[h], ++seq[h], pair[h]);
    room.tick();
    // Advance any story line so scripted runs leave cutscenes the way players do.
    const cut = room.state.story?.cutscene;
    if (cut && t % 15 === 0)
      for (const id of ids) {
        try {
          room.readStoryLine(id, cut.id, cut.line);
        } catch {
          /* not this hero's line to move on */
        }
      }
    const view = () => (normaliseIds ? normalise(room.state) : JSON.stringify(room.state));
    if (t % every === 0) samples.push(view());
  });
  samples.push(normaliseIds ? normalise(room.state) : JSON.stringify(room.state));
  return { samples, room };
}

afterEach(() => vi.restoreAllMocks());

describe("default runtime is production behaviour", () => {
  it("reads the wall clock and makes random UUIDs when no runtime is given", () => {
    const room = new GameRoom("PROD01");
    const spy = vi.spyOn(Date, "now").mockReturnValue(123456);
    expect(room.runtime.now()).toBe(123456);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    const a = room.runtime.id(),
      b = room.runtime.id();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
    const s = room.add("x");
    expect(s.playerId).toMatch(UUID);
    expect(s.reconnectToken).toMatch(UUID);
  });

  it("expires a disconnected session against the wall clock, as before", () => {
    const room = new GameRoom("PROD02");
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const s = room.add("x");
    room.disconnect(s.playerId, "x");
    now.mockReturnValue(1_000 + 29_999);
    expect(() => room.resume(s.playerId, s.reconnectToken, "y")).not.toThrow();
    room.disconnect(s.playerId, "y");
    now.mockReturnValue(1_000 + 29_999 + 30_001);
    expect(() => room.resume(s.playerId, s.reconnectToken, "z")).toThrow(/Reconnect failed/);
  });
});

describe("same inputs, same world: production runtime vs deterministic runtime", () => {
  // The production run uses the wall clock and real random UUIDs, exactly as the
  // default runtime does, and records the ids it draws. The deterministic run
  // replays those ids on a game-time clock. With ids held equal, any difference
  // in the raw world would come from the clock change alone.
  for (const [start, seed] of [
    ["encounter", 11],
    ["encounter", 29],
    ["goddess", 7],
    ["goddess", 43],
  ] as const) {
    it(`${start} room, seed ${seed}: identical raw world at every sampled tick`, () => {
      const frames = script(seed, 1500);
      const drawn: string[] = [];
      const prod = run(start, frames, () => ({
        now: () => Date.now(),
        id: () => {
          const v = randomUUID();
          drawn.push(v);
          return v;
        },
      }), 10, false);
      let k = 0;
      const det = run(start, frames, (room) => ({
        now: () => (room().state.serverTick * 1000) / 60,
        id: () => drawn[k++],
      }), 10, false);
      expect(k).toBe(drawn.length);
      expect(det.samples.length).toBe(prod.samples.length);
      for (let i = 0; i < prod.samples.length; i++)
        if (det.samples[i] !== prod.samples[i])
          expect.fail(`world differs at sample ${i} (tick ~${i * 10})`);
    });
  }

  it("the scripts exercise what they compare: Slow Time, Super Speed, Flight, projectiles, Black Hole", () => {
    const seen = { slowTime: false, sprint: false, flight: false, projectiles: false, blackHoles: false };
    for (const seed of [11, 29]) {
      const frames = script(seed, 1500);
      let ref: GameRoom | undefined;
      const { room, ids } = makeRoom("encounter", fakeRuntime(() => (ref!.state.serverTick * 1000) / 60));
      ref = room;
      const seq = [0, 0];
      for (const pair of frames) {
        for (const h of [0, 1]) send(room, ids[h], ++seq[h], pair[h]);
        room.tick();
        seen.slowTime ||= !!room.state.slowTime;
        seen.sprint ||= (room.state.players[ids[0]].sprintRemaining ?? 0) > 0;
        seen.flight ||= (room.state.players[ids[1]].flightRemaining ?? 0) > 0;
        seen.projectiles ||= Object.keys(room.state.projectiles ?? {}).length > 0;
        seen.blackHoles ||= Object.keys(room.state.blackHoles ?? {}).length > 0;
      }
    }
    expect(seen).toEqual({ slowTime: true, sprint: true, flight: true, projectiles: true, blackHoles: true });
  });

  it("documents that id order breaks ties, so counter ids fix an order production leaves to chance", () => {
    // Server tie-breaks use a.id.localeCompare(b.id) (golemBeam.ts, enemySimulation.ts,
    // inventory.ts). Production ids are random UUIDs, so which hero wins a tie varies by
    // room. Evaluation ids must therefore be chosen deliberately (see SERVER_CHANGES.md).
    const order = (runtime: RoomRuntime) => {
      const { room, ids } = makeRoom("encounter", runtime);
      return ids[0].localeCompare(ids[1]);
    };
    expect(order(fakeRuntime(() => 0))).toBeLessThan(0);
  });
});

describe("deterministic runtime", () => {
  it("gives identical raw states, ids included, for identical inputs", () => {
    const frames = script(5, 900);
    const runRaw = () => {
      let ref: GameRoom | undefined;
      const { room, ids } = makeRoom("encounter", fakeRuntime(() => (ref!.state.serverTick * 1000) / 60));
      ref = room;
      const seq = [0, 0];
      for (const pair of frames) {
        for (const h of [0, 1])
          send(room, ids[h], ++seq[h], pair[h]);
        room.tick();
      }
      return JSON.stringify(room.state);
    };
    expect(runRaw()).toBe(runRaw());
  });

  it("keeps Slow Time's 250 ms input-freshness rule on the injected clock", () => {
    const attempt = (ageMs: number) => {
      let t = 10_000;
      const { room, ids } = makeRoom("encounter", fakeRuntime(() => t));
      const coco = ids[1];
      room.receiveInput(coco, { ...neutral(1), slowTimeHeld: false });
      room.receiveInput(coco, { ...neutral(2), slowTimeHeld: true });
      t += ageMs;
      room.tick();
      return room.state.slowTime;
    };
    expect(attempt(0)).toMatchObject({ endsTick: expect.any(Number) });
    expect(attempt(249)).toMatchObject({ endsTick: expect.any(Number) });
    expect(attempt(250)).toBeUndefined();
    expect(attempt(251)).toBeUndefined();
  });

  it("expires a disconnected session at exactly 30 s on the injected clock", () => {
    let t = 0;
    const room = new GameRoom("EXPIR1", false, "MAIN_HOUSE", false, undefined, fakeRuntime(() => t));
    const s = room.add("x");
    room.disconnect(s.playerId, "x");
    t = 30_000;
    expect(() => room.resume(s.playerId, s.reconnectToken, "y")).not.toThrow();
    room.disconnect(s.playerId, "y");
    t = 60_001;
    expect(() => room.resume(s.playerId, s.reconnectToken, "z")).toThrow(/Reconnect failed/);
  });

  it("starts Slow Time with the same timing under both runtimes", () => {
    const go = (runtime?: RoomRuntime) => {
      const { room, ids } = makeRoom("encounter", runtime);
      room.receiveInput(ids[1], { ...neutral(1), slowTimeHeld: true });
      room.tick();
      return room.state.slowTime && room.state.slowTime.endsTick - room.state.slowTime.startedTick;
    };
    expect(go()).toBe(ticksFor(10));
    expect(go(fakeRuntime(() => 0))).toBe(ticksFor(10));
  });
});
