import { describe, it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import {
  mirrorPondState,
  pondStations,
  pondCenter,
  pondBridge,
  pondSpikes,
  pondSpikeState,
  pondSpikeColumns,
  pondSpikeTiming,
  pondTrial,
  pondCulvertMouth,
  pondCulvert,
  pondSpawn,
  pondMirrorWalls,
  pondPushTurn,
  normalizeMirrorAngle,
  POND_ROTATION_STEP,
  pondFenceWalls,
} from "../../../packages/shared/src/mirrorPond.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import { DT, HALF, ticksFor } from "../../../packages/shared/src/constants.js";
import {
  move,
  flightWalls,
  stepMovement,
  constrainMotion,
} from "../../../packages/shared/src/movement.js";
import {
  neutral,
  type Projectile,
  type Rect,
} from "../../../packages/shared/src/gameTypes.js";
import {
  pushPondMirror,
  tracePondFireball,
  tickMirrorPond,
  updatePondChest,
  POND_CHEST_TARGET,
  POND_TORCH_RADIUS,
} from "../src/mirrorPond.js";
function setup() {
  const r = new GameRoom("ABC234", false, "MIRROR_POND"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  return {
    r,
    w: r.state,
    s: r.state.players[a.playerId],
    c: r.state.players[b.playerId],
    pond: mirrorPondState(r.state.puzzles)!,
  };
}
function shot(
  game: ReturnType<typeof setup>,
  i: number,
  patch: Partial<Projectile> = {},
) {
  const station = pondStations[i];
  return {
    id: `shot-${i}`,
    owner: game.c.id,
    sceneId: "MIRROR_POND" as const,
    x: station.shot.x,
    y: station.shot.y,
    vx: station.incoming.x * 180,
    vy: station.incoming.y * 180,
    life: 672 / 180,
    castOrigin: { ...station.shot },
    ...patch,
  };
}
function trace(game: ReturnType<typeof setup>, q: Projectile) {
  let travelled = 0;
  for (let n = 0; n < 112; n++) {
    const old = { x: q.x, y: q.y },
      next = { x: q.x + q.vx / 30, y: q.y + q.vy / 30 };
    q.life -= 1 / 30;
    const hit = tracePondFireball(game.w, q, old, next);
    travelled += 6;
    if (hit || q.life <= 0) return { hit, travelled };
  }
  return { hit: false, travelled };
}
describe("Mirror Pond authoritative mechanics", () => {
  it("retains quick Push taps, rotates while held, and stops on release", () => {
    const g = setup();
    Object.assign(g.s, { x: 38 * 32 + 24, y: 15 * 32, facing: -Math.PI / 2 });
    g.r.receiveInput(g.s.id, { ...neutral(1), pushHeld: true });
    g.r.receiveInput(g.s.id, { ...neutral(2), pushHeld: false });
    g.r.tick();
    expect(g.pond.mirrors[0]).toBeCloseTo(
      pondStations[0].rest + POND_ROTATION_STEP,
    );
    g.r.tick();
    g.r.receiveInput(g.s.id, { ...neutral(3), pushHeld: true });
    g.r.tick();
    expect(g.pond.mirrors[0]).toBeCloseTo(
      pondStations[0].rest + 2 * POND_ROTATION_STEP,
    );
    g.r.tick();
    expect(g.pond.mirrors[0]).toBeCloseTo(
      pondStations[0].rest + 3 * POND_ROTATION_STEP,
    );
    g.r.receiveInput(g.s.id, { ...neutral(4), pushHeld: false });
    g.r.tick();
    expect(g.pond.mirrors[0]).toBeCloseTo(
      pondStations[0].rest + 3 * POND_ROTATION_STEP,
    );
  });
  it("swings like a fan blade from one spot until the mirror faces Sieg, without snapping", () => {
    const g = setup();
    Object.assign(g.s, { x: 38 * 32 + 24, y: 15 * 32, facing: -Math.PI / 2 });
    let turns = 0;
    while (pushPondMirror(g.w, g.s) && turns < 240) turns++;
    // Pushing below the pivot swings the upright mirror clockwise until its
    // center faces Sieg; then he must step to a new spot to keep turning.
    const s = pondStations[0],
      facesSieg = Math.atan2(g.s.y - s.y, g.s.x - s.x) + Math.PI / 2;
    expect(turns).toBeGreaterThan(40);
    expect(turns).toBeLessThan(60);
    expect(g.pond.mirrors[0]).toBeCloseTo(s.rest + turns * POND_ROTATION_STEP);
    expect(Math.abs(g.pond.mirrors[0] - facesSieg)).toBeLessThan(0.1);
  });
  it("reflects at the actual chosen angle; incorrect angles miss rather than auto-correct", () => {
    const g = setup();
    g.pond.mirrors[0] = Math.PI / 4;
    const q = shot(g, 0);
    trace(g, q);
    expect(q.pondReflection).toBe(0);
    expect(q.vx).toBeCloseTo(0);
    expect(q.vy).toBeCloseTo(180);
    expect(g.pond.torches[0]).toBe(false);
  });
  it("has water until all four torches light; raises the entire center and bridge on the fourth hit", () => {
    const g = setup();
    expect(g.pond.raised).toBe(false);
    expect(g.w.inventoryTargets?.[POND_CHEST_TARGET]).toBeUndefined();
    Object.assign(g.c, { x: pondCenter.x + 64, y: pondCenter.y + 64 });
    expect(() =>
      g.r.useItem(g.c.id, { requestId: "early", targetId: POND_CHEST_TARGET }),
    ).toThrow();
    for (let i = 0; i < 4; i++) {
      g.pond.mirrors[i] = normalizeMirrorAngle(pondStations[i].angle);
      const q = shot(g, i);
      const result = trace(g, q);
      expect(result.hit).toBe(true);
      expect(q.pondReflection).toBe(i);
      expect(g.pond.torches[i]).toBe(true);
      expect(result.travelled).toBeLessThanOrEqual(672);
      expect(g.pond.raised).toBe(i === 3);
    }
    updatePondChest(g.w, g.r.inventory);
    expect(g.w.inventoryTargets?.[POND_CHEST_TARGET]).toBeDefined();
    const terrain = collisionRects(
      "MIRROR_POND",
      g.w.puzzles,
      undefined,
      undefined,
      g.w.players,
      0,
      "OATH",
    ).filter((r) => r.terrain);
    for (const p of [
      { x: pondCenter.x + 64, y: pondCenter.y + 64 },
      { x: pondBridge.x + 32, y: pondBridge.y + 32 },
    ])
      expect(
        terrain.some(
          (r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h,
        ),
      ).toBe(false);
  });
  it("requires a correctly aimed mirror and its firing pad; direct, backward, and wrong-pad shots cannot light torches", () => {
    for (let i = 0; i < 4; i++) {
      const g = setup();
      trace(g, shot(g, i));
      expect(g.pond.torches).toEqual([false, false, false, false]);
      g.pond.mirrors[i] = normalizeMirrorAngle(pondStations[i].angle);
      trace(g, shot(g, i, { castOrigin: { x: 0, y: 0 } }));
      expect(g.pond.torches[i]).toBe(false);
      const t = pondStations[i].torch;
      trace(g, shot(g, i, { x: t.x - 30, y: t.y, vx: 180, vy: 0 }));
      expect(g.pond.torches[i]).toBe(false);
    }
  });
  it("Push changes angle only for Sieg, blocks the next section when deployed, and refuses to embed a player", () => {
    const g = setup();
    Object.assign(g.s, { x: 38 * 32 + 24, y: 15 * 32, facing: -Math.PI / 2 });
    Object.assign(g.c, { x: 28 * 32, y: 12 * 32 });
    expect(pushPondMirror(g.w, g.c)).toBe(false);
    expect(pushPondMirror(g.w, g.s)).toBe(true);
    expect(g.pond.mirrors[0]).toBeCloseTo(
      pondStations[0].rest + POND_ROTATION_STEP,
    );
    g.pond.mirrors[0] = normalizeMirrorAngle(pondStations[0].angle);
    const walls = pondMirrorWalls(0, g.pond.mirrors[0]);
    const left = Math.min(...walls.map((r) => r.x)),
      right = Math.max(...walls.map((r) => r.x + r.w));
    expect(right - left).toBeGreaterThan(128);
    const blocked = constrainMotion(
      g.s,
      { x: 0, y: -200 },
      maps.MIRROR_POND,
      collisionRects(
        "MIRROR_POND",
        g.w.puzzles,
        undefined,
        undefined,
        g.w.players,
        0,
        "OATH",
      ),
    );
    expect(blocked.y).toBeGreaterThan(pondStations[0].y);
    // Pushing up on the right half from below turns it counter-clockwise.
    Object.assign(g.s, blocked);
    expect(pushPondMirror(g.w, g.s)).toBe(true);
    expect(g.pond.mirrors[0]).toBeCloseTo(
      normalizeMirrorAngle(pondStations[0].angle - POND_ROTATION_STEP),
    );
    // Coco just above the rising tip stops the frame instead of being swept.
    const tip = pondMirrorWalls(0, g.pond.mirrors[0]).reduce((a, b) =>
      b.x > a.x ? b : a,
    );
    Object.assign(g.c, { x: tip.x + 7, y: tip.y - HALF - 0.5 });
    const before = g.pond.mirrors[0];
    expect(pushPondMirror(g.w, g.s)).toBe(false);
    expect(g.pond.mirrors[0]).toBe(before);
  });
  it("Coco cannot enter the perimeter even in Flight; the separate culvert is traversable only while flying", () => {
    const g = setup();
    Object.assign(g.c, { x: 44.5 * 32, y: 26 * 32, flightRemaining: 10 });
    for (let n = 0; n < ticksFor(4); n++)
      stepMovement(
        g.c,
        { ...neutral(), moveX: -1 },
        maps.MIRROR_POND,
        collisionRects(
          "MIRROR_POND",
          g.w.puzzles,
          undefined,
          undefined,
          g.w.players,
          0,
          "EMBER",
        ),
        DT,
      );
    expect(g.c.x).toBeGreaterThanOrEqual(44 * 32 + 13);
    Object.assign(g.c, { x: 43 * 32, y: 31 * 32, flightRemaining: 0 });
    const walls = collisionRects(
      "MIRROR_POND",
      g.w.puzzles,
      undefined,
      undefined,
      g.w.players,
      0,
      "EMBER",
    );
    stepMovement(g.c, { ...neutral(), moveX: -1 }, maps.MIRROR_POND, walls, 1);
    expect(g.c.x).toBeGreaterThanOrEqual(42 * 32 + 13);
    g.c.flightRemaining = 10;
    for (let n = 0; n < ticksFor(1.333); n++)
      stepMovement(
        g.c,
        { ...neutral(), moveX: -1 },
        maps.MIRROR_POND,
        walls,
        DT,
      );
    expect(g.c.x).toBeLessThan(40 * 32);
  });
  it("floor spikes rise on a staggered timer, Slow Time scales their clock, and failures keep lit torches", () => {
    const fast = setup(),
      slow = setup();
    slow.w.slowTime = {
      owner: slow.c.id,
      startedTick: 0,
      endsTick: ticksFor(10),
    };
    tickMirrorPond(fast.w, new Map());
    tickMirrorPond(slow.w, new Map());
    expect(slow.pond.clock).toBeCloseTo(fast.pond.clock * 0.2);
    // Columns never move: they only change phase in place.
    const { period, warning, stagger } = pondSpikeTiming;
    const raisedAt = (i: number) => (warning + i * stagger + 0.01) * period;
    for (let i = 0; i < pondSpikeColumns.length; i++) {
      expect(pondSpikeState(raisedAt(i), i).phase).toBe("raised");
      expect(pondSpikes(raisedAt(i))).toContainEqual(pondSpikeColumns[i]);
      expect(pondSpikeState(raisedAt(i) - 0.02 * period, i).phase).toBe(
        "warning",
      );
    }
    // The ripple reaches each lane in turn, west to east.
    expect(pondSpikeState(raisedAt(0), 4).phase).not.toBe("raised");
    // Only raised columns are dangerous; warning tips never are.
    expect(pondSpikes(0.01 * period)).toEqual([]);
    const g = setup();
    g.pond.torches[0] = true;
    g.pond.clock = raisedAt(2) - DT;
    Object.assign(g.s, { x: pondSpikeColumns[2].x + 16, y: 26 * 32 });
    tickMirrorPond(g.w, new Map());
    expect(g.pond.failures).toBe(1);
    expect(g.s.x).toBe(pondSpawn("OATH").x);
    expect(g.pond.torches[0]).toBe(true);
  });
  it("warning tips never hurt, and only raised columns reset Sieg", () => {
    const { period, stagger } = pondSpikeTiming;
    const g = setup();
    // Warning phase of column 2, just after it starts peeking.
    g.pond.clock = (2 * stagger + 0.01) * period;
    expect(pondSpikeState(g.pond.clock, 2).phase).toBe("warning");
    Object.assign(g.s, { x: pondSpikeColumns[2].x + 16, y: 26 * 32 });
    const before = { x: g.s.x, y: g.s.y };
    tickMirrorPond(g.w, new Map());
    expect(g.pond.failures).toBe(0);
    expect({ x: g.s.x, y: g.s.y }).toEqual(before);
  });
  it("walking never crosses the spike lanes; Super Speed can, and Slow Time makes it comfortable", () => {
    // Straight westward runs from the court at every start offset in one cycle.
    const crossings = (speed: number, scale: number) => {
      let wins = 0,
        tries = 0;
      for (let start = 0; start < pondSpikeTiming.period / scale; start += DT) {
        tries++;
        let x = pondTrial.x + pondTrial.w + HALF + 1,
          clock = start * scale,
          safe = true;
        while (safe && x > pondTrial.x - HALF) {
          const from = x;
          const old = pondSpikes(clock);
          x -= speed * DT;
          clock += DT * scale;
          safe = ![...old, ...pondSpikes(clock)].some(
            (r) => from + HALF > r.x && x - HALF < r.x + r.w,
          );
        }
        if (safe) wins++;
      }
      return wins / tries;
    };
    expect(crossings(190, 1)).toBe(0);
    expect(crossings(380, 1)).toBeGreaterThan(0.1);
    expect(crossings(190, 0.2)).toBeGreaterThan(crossings(380, 1));
  });
  it("leaves the east walkway open past the entrance while the culvert stays sealed", () => {
    const g = setup();
    const walls = collisionRects(
      "MIRROR_POND",
      g.w.puzzles,
      g.w.pushableOffsets,
      g.w.bridgePuzzle,
      g.w.players,
      g.w.serverTick,
      "OATH",
    );
    const walk = (
      from: { x: number; y: number },
      moveY: number,
      ticks: number,
    ) => {
      Object.assign(g.s, from);
      for (let n = 0; n < ticks; n++)
        move(g.s, { ...neutral(), moveY }, maps.MIRROR_POND, walls, DT);
      return g.s.y;
    };
    // North along the walkway lane right beside the entrance (tile 38),
    // never touching a spike lane.
    expect(walk({ x: 38.5 * 32, y: 25 * 32 }, -1, 60)).toBeLessThan(20 * 32);
    // From the culvert, the south rail still blocks the way up to the walkway.
    expect(walk({ x: 38.5 * 32, y: 30.5 * 32 }, -1, 60)).toBeGreaterThan(
      28 * 32,
    );
  });
  it("blocks Sieg at both dry banks of the full water culvert, including while sprinting or dashing", () => {
    for (const raised of [false, true])
      for (const abilities of [false, true])
        for (const approach of [
          { x: 38 * 32, y: 32 * 32 + HALF, moveY: -1, edge: 32 * 32 + HALF },
          { x: 35 * 32, y: 26 * 32 - HALF, moveY: 1, edge: 26 * 32 - HALF },
        ]) {
          const g = setup();
          g.pond.raised = raised;
          Object.assign(g.s, { x: approach.x, y: approach.y });
          g.s.unlockedSkills = ["dash"];
          const predicted = structuredClone(g.s);
          const walls = collisionRects(
            "MIRROR_POND",
            g.w.puzzles,
            undefined,
            undefined,
            {},
            0,
            "OATH",
          );
          for (let n = 0; n < ticksFor(1); n++) {
            const input = {
              ...neutral(n + 1),
              moveY: approach.moveY,
              sprintHeld: abilities,
              secondaryHeld: abilities,
            };
            g.r.receiveInput(g.s.id, input);
            g.r.tick();
            stepMovement(predicted, input, maps.MIRROR_POND, walls, DT);
          }
          expect(g.s.y).toBe(approach.edge);
          expect(predicted.y).toBe(g.s.y);
          for (const r of pondCulvert)
            expect(
              g.s.x + HALF > r.x &&
                g.s.x - HALF < r.x + r.w &&
                g.s.y + HALF > r.y &&
                g.s.y - HALF < r.y + r.h,
            ).toBe(false);
        }
  });
  it("bars the culvert mouth to walkers so the spike entrance is Sieg's only way in", () => {
    const g = setup();
    const wallsFor = (role: "OATH" | "EMBER") =>
      collisionRects(
        "MIRROR_POND",
        g.w.puzzles,
        g.w.pushableOffsets,
        g.w.bridgePuzzle,
        g.w.players,
        g.w.serverTick,
        role,
      );
    // Walking west along the culvert row from the court stops at the grate.
    Object.assign(g.s, { x: 44 * 32, y: 31 * 32 });
    for (let n = 0; n < ticksFor(2); n++)
      move(
        g.s,
        { ...neutral(), moveX: -1 },
        maps.MIRROR_POND,
        wallsFor("OATH"),
        DT,
      );
    expect(g.s.x).toBeGreaterThanOrEqual(
      pondCulvertMouth.x + pondCulvertMouth.w + HALF,
    );
    // Flood fill every spot Sieg can stand on from his spawn, treating the
    // spike lanes as impassable: none of it lies inside the pond walls.
    const walls = [...wallsFor("OATH"), pondTrial];
    const free = (x: number, y: number) =>
      x >= HALF &&
      y >= HALF &&
      x <= maps.MIRROR_POND.width - HALF &&
      y <= maps.MIRROR_POND.height - HALF &&
      !walls.some(
        (r) =>
          x + HALF > r.x &&
          x - HALF < r.x + r.w &&
          y + HALF > r.y &&
          y - HALF < r.y + r.h,
      );
    const spawn = pondSpawn("OATH"),
      seen = new Set([`${spawn.x},${spawn.y}`]),
      queue = [[spawn.x, spawn.y]];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const [dx, dy] of [
        [8, 0],
        [-8, 0],
        [0, 8],
        [0, -8],
      ]) {
        const key = `${x + dx},${y + dy}`;
        if (!seen.has(key) && free(x + dx, y + dy)) {
          seen.add(key);
          queue.push([x + dx, y + dy]);
        }
      }
    }
    const inside = [...seen].filter((k) => {
      const [x, y] = k.split(",").map(Number);
      return x < 40 * 32 && y > 4 * 32 && y < 32 * 32;
    });
    expect(inside).toEqual([]);
    // Coco's flight still crosses the mouth over the culvert water.
    expect(
      flightWalls(wallsFor("EMBER"), true).some(
        (r) =>
          r.x < pondCulvertMouth.x + pondCulvertMouth.w &&
          r.x + r.w > pondCulvertMouth.x &&
          r.y < pondCulvertMouth.y + pondCulvertMouth.h &&
          r.y + r.h > pondCulvertMouth.y,
      ),
    ).toBe(false);
  });
  it("grants one shared mirror, persists solved state on revisits, and preserves the quest inventory", () => {
    const g = setup();
    g.pond.torches = [true, true, true, true];
    g.pond.raised = true;
    Object.assign(g.s, { x: 24 * 32, y: 19 * 32 });
    Object.assign(g.c, { x: 24 * 32, y: 20 * 32 });
    g.r.useItem(g.s.id, { requestId: "one", targetId: POND_CHEST_TARGET });
    g.r.useItem(g.c.id, { requestId: "two", targetId: POND_CHEST_TARGET });
    expect(g.w.inventory!.counts.vanity_mirror).toBe(1);
    g.r.transition("FOREST_RUINS", true);
    g.r.transition("MIRROR_POND");
    expect(g.pond.raised).toBe(true);
    expect(g.w.inventory!.counts.vanity_mirror).toBe(1);
  });
});
it("synchronizes numeric mirror angles to both clients and rejects client-supplied angles", async () => {
  const { createApp } = await import("../src/app.js"),
    { io } = await import("socket.io-client");
  const app = createApp({ startingScene: "MIRROR_POND" });
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(app.http.address() as any).port}`,
    clients = [io(url), io(url)],
    histories = clients.map(() => new Map<number, any>());
  clients.forEach((c, i) =>
    c.on("game:snapshot", (w) => histories[i].set(w.serverTick, w)),
  );
  const req = (c: any, event: string, data: any) =>
    new Promise<any>((res, rej) =>
      c
        .timeout(2000)
        .emit(event, data, (e: any, r: any) => (e ? rej(e) : res(r))),
    );
  try {
    await Promise.all(
      clients.map((c) => new Promise<void>((r) => c.on("connect", r))),
    );
    const a = (await req(clients[0], "room:create", {})).data;
    await req(clients[1], "room:join", { roomCode: a.roomCode });
    await req(clients[0], "role:select", { role: "OATH" });
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode),
      s = room.state.players[a.playerId];
    Object.assign(s, { x: 38 * 32 + 24, y: 15 * 32, facing: -Math.PI / 2 });
    clients[0].emit("player:input", {
      ...neutral(1),
      pushHeld: true,
      mirrorAngle: 0,
    });
    await req(clients[0], "clock:probe", {});
    expect(room.sessions.get(s.id)!.input.seq).toBe(0);
    expect(mirrorPondState(room.state.puzzles)!.mirrors[0]).toBe(Math.PI / 2);
    clients[0].emit("player:input", { ...neutral(2), pushHeld: true });
    await new Promise((r) => setTimeout(r, 180));
    clients[0].emit("player:input", neutral(3));
    await new Promise((r) => setTimeout(r, 120));
    const ticks = [...histories[0].keys()].filter(
      (t) =>
        histories[1].has(t) &&
        mirrorPondState(histories[0].get(t).puzzles)!.mirrors[0] > Math.PI / 2,
    );
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks)
      expect(mirrorPondState(histories[0].get(t).puzzles)).toEqual(
        mirrorPondState(histories[1].get(t).puzzles),
      );
    const stopped = mirrorPondState(room.state.puzzles)!.mirrors[0];
    await new Promise((r) => setTimeout(r, 120));
    expect(mirrorPondState(room.state.puzzles)!.mirrors[0]).toBe(stopped);
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
}, 15000);

it("keeps reflected misses flying across perimeter grass until they leave the world", () => {
  const g = setup(),
    q = shot(g, 0, {
      x: 1400,
      y: 1100,
      vx: 180,
      vy: 0,
      pondReflection: 0,
      life: 10,
    });
  g.w.projectiles[q.id] = q;
  for (let n = 0; n < ticksFor(0.333); n++) g.r.tick();
  expect(g.w.projectiles[q.id]).toBeDefined();
  expect(q.x).toBeCloseTo(1460);
  for (let n = 0; n < ticksFor(1); n++) g.r.tick();
  expect(g.w.projectiles[q.id]).toBeUndefined();
});
it("lights any torch reached by a reflected fireball's swept circular radius, without auto-aiming", () => {
  const g = setup(),
    torch = pondStations[3].torch;
  const q = shot(g, 0, {
    pondReflection: 0,
    x: torch.x - 100,
    y: torch.y + POND_TORCH_RADIUS - 1,
    vx: 180,
    vy: 0,
  });
  expect(tracePondFireball(g.w, q, q, { x: torch.x + 100, y: q.y })).toBe(true);
  expect(g.pond.torches[3]).toBe(true);
  const miss = setup(),
    outside = shot(miss, 0, {
      pondReflection: 0,
      x: torch.x - 100,
      y: torch.y + POND_TORCH_RADIUS + 5,
    });
  expect(
    tracePondFireball(miss.w, outside, outside, {
      x: torch.x + 100,
      y: outside.y,
    }),
  ).toBe(false);
  expect(miss.pond.torches[3]).toBe(false);
  const corner = shot(miss, 0, {
    pondReflection: 0,
    x: torch.x + 30,
    y: torch.y + 30,
  });
  expect(
    tracePondFireball(miss.w, corner, corner, { x: corner.x + 1, y: corner.y }),
  ).toBe(false);
  expect(miss.pond.torches[3]).toBe(false);
});
it("gives a real mirror reflection enough lifetime to visibly fly off screen", () => {
  const g = setup(),
    s = pondStations[0];
  g.pond.mirrors[0] = Math.PI / 4;
  const q = shot(g, 0, { life: 0.02 });
  tracePondFireball(g.w, q, { x: s.x - 8, y: s.y }, { x: s.x + 8, y: s.y });
  expect(q.pondReflection).toBe(0);
  expect(q.life).toBeGreaterThan(10);
  expect(q.vy).toBeCloseTo(180);
});

it("lets Sieg walk the paved east entrance without invisible rail collisions or a hidden sprint reset", () => {
  const g = setup();
  Object.assign(g.s, { x: 1424, y: 790 });
  for (let i = 0; i < ticksFor(1.067); i++)
    stepMovement(
      g.s,
      { ...neutral(), moveX: -1 },
      maps.MIRROR_POND,
      collisionRects(
        "MIRROR_POND",
        g.w.puzzles,
        undefined,
        undefined,
        g.w.players,
        0,
        "OATH",
      ),
      DT,
    );
  expect(g.s.x).toBeLessThan(1240);
  expect(g.s.hp).toBe(100);
  Object.assign(g.s, { x: 1320, y: 790, sprintRemaining: 0 });
  tickMirrorPond(g.w, new Map());
  expect(g.s.x).toBe(1320);
  expect(g.pond.failures).toBe(0);
});
it("keeps fencing solid during Coco flight while leaving the water culvert open", () => {
  const g = setup();
  Object.assign(g.c, { x: 1120, y: 600, flightRemaining: 10 });
  const walls = () =>
    collisionRects(
      "MIRROR_POND",
      g.w.puzzles,
      undefined,
      undefined,
      g.w.players,
      0,
      "EMBER",
    );
  for (let i = 0; i < ticksFor(0.833); i++)
    stepMovement(
      g.c,
      { ...neutral(), moveX: 1 },
      maps.MIRROR_POND,
      walls(),
      DT,
    );
  expect(g.c.x).toBeLessThanOrEqual(1139);
  Object.assign(g.c, { x: 1120, y: 960, flightRemaining: 10 });
  for (let i = 0; i < ticksFor(0.833); i++)
    stepMovement(
      g.c,
      { ...neutral(), moveY: -1 },
      maps.MIRROR_POND,
      walls(),
      DT,
    );
  expect(g.c.y).toBeLessThan(896);
  expect(
    pondFenceWalls(g.w.puzzles).some(
      (r) => r.x <= 864 && r.x + r.w >= 864 && r.y === 888,
    ),
  ).toBe(true);
  g.pond.raised = true;
  expect(
    pondFenceWalls(g.w.puzzles).some(
      (r) => r.x < 864 && r.x + r.w > 864 && r.y === 888,
    ),
  ).toBe(false);
  Object.assign(g.s, { x: 864, y: 940 });
  for (let i = 0; i < ticksFor(0.733); i++)
    stepMovement(
      g.s,
      { ...neutral(), moveY: -1 },
      maps.MIRROR_POND,
      collisionRects(
        "MIRROR_POND",
        g.w.puzzles,
        undefined,
        undefined,
        g.w.players,
        0,
        "OATH",
      ),
      DT,
    );
  expect(g.s.y).toBeLessThan(896);
});
it("leaves the fence open in front of every mirror, while water still bars walkers", () => {
  const g = setup();
  const fence = pondFenceWalls(g.w.puzzles);
  const touches = (a: Rect, b: Rect) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (let i = 0; i < 4; i++) {
    const s = pondStations[i];
    // The frame sweeps a full turn without crossing a rail.
    for (let step = 0; step < 240; step++)
      expect(
        fence.some((r) =>
          pondMirrorWalls(i, (step * Math.PI) / 120).some((m) => touches(m, r)),
        ),
      ).toBe(false);
    // The shot lane from the firing pad to the mirror is clear of rails.
    const lane = {
      x: Math.min(s.shot.x, s.x) - 4,
      y: Math.min(s.shot.y, s.y) - 4,
      w: Math.abs(s.x - s.shot.x) + 8,
      h: Math.abs(s.y - s.shot.y) + 8,
    };
    expect(fence.some((r) => touches(lane, r))).toBe(false);
  }
  // Sieg on the east bank walks into the opening but stops at the water.
  Object.assign(g.s, { x: 1200, y: 300 });
  for (let i = 0; i < ticksFor(2); i++)
    move(
      g.s,
      { ...neutral(), moveX: -1 },
      maps.MIRROR_POND,
      collisionRects(
        "MIRROR_POND",
        g.w.puzzles,
        {},
        undefined,
        g.w.players,
        0,
        "OATH",
      ),
      DT,
    );
  expect(g.s.x).toBeCloseTo(36 * 32 + HALF);
});

it("turns like a fan blade: the pushed half and the pushed face set the direction", () => {
  const g = setup(),
    i = 1,
    station = pondStations[i];
  // Mirror 2 rests horizontal. Clockwise is +1 (screen y points down).
  expect(g.pond.mirrors[i]).toBe(0);
  const push = (dx: number, dy: number) => {
    const at = { x: station.x + dx, y: station.y + dy };
    return pondPushTurn(g.pond, {
      ...at,
      facing: Math.atan2(-dy, -dx),
    });
  };
  // From below: left half clockwise, right half counter-clockwise.
  expect(push(-40, 30)).toEqual({ index: i, direction: 1 });
  expect(push(40, 30)).toEqual({ index: i, direction: -1 });
  // From above, both reverse.
  expect(push(-40, -30)).toEqual({ index: i, direction: -1 });
  expect(push(40, -30)).toEqual({ index: i, direction: 1 });
  // Pushing the pivot itself, or square onto an end, does nothing.
  expect(push(0, 30)).toBeNull();
  expect(push(-90, 0)).toBeNull();
  // Facing away from the mirror does nothing.
  expect(
    pondPushTurn(g.pond, {
      x: station.x - 40,
      y: station.y + 30,
      facing: Math.PI / 2,
    }),
  ).toBeNull();
  // The server applies the same rule.
  Object.assign(g.s, {
    x: station.x - 40,
    y: station.y + 30,
    facing: Math.atan2(-30, 40),
  });
  expect(pushPondMirror(g.w, g.s)).toBe(true);
  expect(g.pond.mirrors[i]).toBeCloseTo(POND_ROTATION_STEP);
  Object.assign(g.s, { x: station.x + 40, facing: Math.atan2(-30, -40) });
  expect(pushPondMirror(g.w, g.s)).toBe(true);
  expect(g.pond.mirrors[i]).toBeCloseTo(0);
});
