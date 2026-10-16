import { describe, it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import {
  mirrorPondState,
  pondStations,
  pondCenter,
  pondBridge,
  pondSpikes,
  pondSpawn,
  pondMirrorWall,
  normalizeMirrorAngle,
  POND_ROTATION_STEP,
} from "../../../packages/shared/src/mirrorPond.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import {
  stepMovement,
  constrainMotion,
} from "../../../packages/shared/src/movement.js";
import {
  neutral,
  type Projectile,
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
    Object.assign(g.s, { x: 38 * 32, y: 15 * 32, facing: -Math.PI / 2 });
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
  it("allows a complete 360 degree turn without snapping to solution angles", () => {
    const g = setup();
    Object.assign(g.s, { x: 38 * 32, y: 15 * 32, facing: -Math.PI / 2 });
    const start = g.pond.mirrors[0];
    for (let n = 0; n < 240; n++) expect(pushPondMirror(g.w, g.s)).toBe(true);
    expect(g.pond.mirrors[0]).toBeCloseTo(start, 9);
    pushPondMirror(g.w, g.s);
    expect(g.pond.mirrors[0]).toBeCloseTo(start + POND_ROTATION_STEP);
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
    Object.assign(g.s, { x: 38 * 32, y: 15 * 32, facing: -Math.PI / 2 });
    Object.assign(g.c, { x: 28 * 32, y: 12 * 32 });
    expect(pushPondMirror(g.w, g.c)).toBe(false);
    expect(pushPondMirror(g.w, g.s)).toBe(true);
    expect(g.pond.mirrors[0]).toBeCloseTo(
      pondStations[0].rest + POND_ROTATION_STEP,
    );
    g.pond.mirrors[0] = normalizeMirrorAngle(pondStations[0].angle);
    const wall = pondMirrorWall(0, g.pond.mirrors[0]);
    expect(wall.w).toBeGreaterThan(128);
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
    expect(pushPondMirror(g.w, g.s)).toBe(true);
    expect(g.pond.mirrors[0]).toBeCloseTo(
      normalizeMirrorAngle(pondStations[0].angle + POND_ROTATION_STEP),
    );
    Object.assign(g.s, {
      x: pondStations[0].x - 40,
      y: pondStations[0].y,
      facing: 0,
    });
    expect(pushPondMirror(g.w, g.s)).toBe(false);
  });
  it("Coco cannot enter the perimeter even in Flight; the separate culvert is traversable only while flying", () => {
    const g = setup();
    Object.assign(g.c, { x: 44.5 * 32, y: 26 * 32, flightRemaining: 10 });
    for (let n = 0; n < 120; n++)
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
        1 / 30,
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
    for (let n = 0; n < 40; n++)
      stepMovement(
        g.c,
        { ...neutral(), moveX: -1 },
        maps.MIRROR_POND,
        walls,
        1 / 30,
      );
    expect(g.c.x).toBeLessThan(40 * 32);
  });
  it("spikes move vertically, Slow Time scales their clock, and failures keep lit torches", () => {
    const fast = setup(),
      slow = setup();
    slow.w.slowTime = { owner: slow.c.id, startedTick: 0, endsTick: 300 };
    tickMirrorPond(fast.w, new Map());
    tickMirrorPond(slow.w, new Map());
    expect(slow.pond.clock).toBeCloseTo(fast.pond.clock * 0.2);
    expect(pondSpikes(0)[0].x).toBe(pondSpikes(0.3)[0].x);
    expect(pondSpikes(0)[0].y).not.toBe(pondSpikes(0.3)[0].y);
    const g = setup();
    g.pond.torches[0] = true;
    Object.assign(g.s, { x: 39 * 32, y: 26 * 32 });
    tickMirrorPond(g.w, new Map());
    expect(g.pond.failures).toBe(1);
    expect(g.s.x).toBe(pondSpawn("OATH").x);
    expect(g.pond.torches[0]).toBe(true);
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
    Object.assign(s, { x: 38 * 32, y: 15 * 32, facing: -Math.PI / 2 });
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
});

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
  for (let n = 0; n < 10; n++) g.r.tick();
  expect(g.w.projectiles[q.id]).toBeDefined();
  expect(q.x).toBeCloseTo(1460);
  for (let n = 0; n < 30; n++) g.r.tick();
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
