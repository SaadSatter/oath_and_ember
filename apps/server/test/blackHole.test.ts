import { expect, it } from "vitest";
import { io } from "socket.io-client";
import { createApp } from "../src/app.js";
import { GameRoom } from "../src/GameRoom.js";
import { tickBlackHoles } from "../src/blackHoles.js";
import { blackHoleTuning as T } from "../../../packages/shared/src/blackHole.js";
import { spawnEnemy } from "../../../packages/shared/src/enemies.js";
import {
  neutral,
  type BlackHole,
} from "../../../packages/shared/src/gameTypes.js";
function fixture(scene: "FOREST_RUINS" | "BRIDGE_RUINS" = "FOREST_RUINS") {
  const room = new GameRoom("HOLE", false, scene),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  const coco = room.state.players[b.playerId],
    sieg = room.state.players[a.playerId];
  room.state.enemies = {};
  Object.assign(coco, { x: 700, y: 450, facing: 0 });
  const hole: BlackHole = {
    id: "hole",
    owner: coco.id,
    sceneId: scene,
    x: 700,
    y: 450,
    vx: T.speed,
    vy: 0,
    remainingRange: T.range,
    phase: "travel",
    startedTick: 0,
    life: T.duration,
    damaged: [],
  };
  room.state.blackHoles = { hole };
  return { room, w: room.state, coco, sieg, hole };
}
it("stops at exactly six 32px tiles and remains for four seconds", () => {
  const { w, hole } = fixture();
  for (let tick = 0; tick < 32; tick++) tickBlackHoles(w);
  expect(hole.phase).toBe("vortex");
  expect(hole.x).toBe(700 + 192);
  expect(hole.remainingRange).toBe(0);
  for (let tick = 0; tick < 119; tick++) tickBlackHoles(w);
  expect(w.blackHoles?.hole).toBeDefined();
  tickBlackHoles(w);
  expect(w.blackHoles?.hole).toBeUndefined();
});
it("stops at first enemy contact, damages once, and pulls toward that contact", () => {
  const { w, hole, coco, sieg } = fixture();
  const e = (w.enemies.target = spawnEnemy("target", "mossling", 800, 450));
  for (let tick = 0; tick < 15; tick++) tickBlackHoles(w);
  expect(hole.phase).toBe("vortex");
  expect(hole.x).toBeCloseTo(774, 3);
  expect(e.hp).toBe(30);
  expect(e.x).toBeLessThan(800);
  for (let tick = 0; tick < 20; tick++) tickBlackHoles(w);
  expect(e.hp).toBe(30);
  expect(Math.abs(e.x - hole.x)).toBeLessThan(1);
  expect(coco.hp).toBe(100);
  expect(sieg.hp).toBe(100);
});
it("affects enemies within three tiles, including new arrivals, without damaging allies or dead enemies", () => {
  const { w, hole } = fixture();
  hole.phase = "vortex";
  hole.vx = 0;
  const close = (w.enemies.close = spawnEnemy("close", "mossling", 790, 450));
  const far = (w.enemies.far = spawnEnemy("far", "mossling", 797, 450));
  const dead = (w.enemies.dead = spawnEnemy("dead", "mossling", 750, 450));
  dead.hp = 0;
  dead.state = "DEAD";
  tickBlackHoles(w);
  expect(close.hp).toBe(30);
  expect(close.x).toBeLessThan(790);
  expect(far.hp).toBe(60);
  expect(far.x).toBe(797);
  expect(dead.x).toBe(750);
  far.x = 780;
  tickBlackHoles(w);
  expect(far.hp).toBe(30);
  expect(close.hp).toBe(30);
});
it("stops before a solid gate and cannot damage or pull enemies through it", () => {
  const { w, hole } = fixture("BRIDGE_RUINS");
  Object.assign(hole, { x: 672, y: 1200, vx: 0, vy: -T.speed });
  const enemy = (w.enemies.enemy = spawnEnemy("enemy", "mossling", 672, 1100));
  for (let tick = 0; tick < 20; tick++) tickBlackHoles(w);
  expect(hole.phase).toBe("vortex");
  expect(hole.y).toBeGreaterThanOrEqual(1142);
  expect(enemy.hp).toBe(60);
  expect(enemy.y).toBe(1100);
});
it("Slow Time reduces travel and pull speed without changing the range", () => {
  const { w, hole, coco } = fixture();
  w.slowTime = { owner: coco.id, startedTick: 0, endsTick: 300 };
  tickBlackHoles(w);
  expect(hole.x - 700).toBeCloseTo(1.2);
  for (let tick = 1; tick < 160; tick++) tickBlackHoles(w);
  expect(hole.phase).toBe("vortex");
  expect(hole.x).toBeCloseTo(892);
  const e = (w.enemies.enemy = spawnEnemy(
    "enemy",
    "mossling",
    hole.x + 60,
    450,
  ));
  tickBlackHoles(w);
  expect(e.x - (hole.x + 60)).toBeCloseTo(-100 / 150);
});
it("requires Coco's unlock, respects cooldown and does not repeat while the key is held", () => {
  const { room, w, coco, sieg } = fixture();
  w.blackHoles = {};
  coco.unlockedSkills = coco.unlockedSkills.filter((id) => id !== "black_hole");
  room.receiveInput(coco.id, { ...neutral(1), blackHoleHeld: true });
  room.tick();
  expect(Object.keys(w.blackHoles!)).toHaveLength(0);
  room.unlock(coco.id, "black_hole");
  room.receiveInput(coco.id, neutral(2));
  room.tick();
  room.receiveInput(coco.id, { ...neutral(3), blackHoleHeld: true });
  room.tick();
  expect(Object.keys(w.blackHoles!)).toHaveLength(1);
  expect(coco.cooldowns.black_hole).toBe(10);
  room.receiveInput(sieg.id, { ...neutral(1), blackHoleHeld: true });
  room.tick();
  expect(Object.keys(w.blackHoles!)).toHaveLength(1);
  for (let seq = 4; seq < 340; seq++) {
    room.receiveInput(coco.id, { ...neutral(seq), blackHoleHeld: true });
    room.tick();
  }
  expect(Object.keys(w.blackHoles!)).toHaveLength(0);
  room.receiveInput(coco.id, neutral(340));
  room.tick();
  room.receiveInput(coco.id, { ...neutral(341), blackHoleHeld: true });
  room.tick();
  expect(Object.keys(w.blackHoles!)).toHaveLength(1);
  room.transition("AIRSHIP");
  expect(Object.keys(w.blackHoles!)).toHaveLength(0);
});
it("synchronizes the new cast intent and rejects client-selected range or damage", async () => {
  const app = createApp({ startingScene: "BRIDGE_RUINS" });
  await new Promise<void>((res) => app.http.listen(0, "127.0.0.1", res));
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`,
    clients = [io(url), io(url)];
  const request = (
    c: (typeof clients)[number],
    event: string,
    payload: object,
  ) => new Promise<any>((res) => c.emit(event, payload, res));
  const histories = [new Map<number, any>(), new Map<number, any>()];
  clients.forEach((c, i) =>
    c.on("game:snapshot", (w) => histories[i].set(w.serverTick, w)),
  );
  try {
    await Promise.all(
      clients.map((c) => new Promise<void>((res) => c.on("connect", res))),
    );
    const a = (await request(clients[0], "room:create", {})).data;
    await request(clients[1], "room:join", { roomCode: a.roomCode });
    await request(clients[0], "role:select", { role: "OATH" });
    await request(clients[1], "role:select", { role: "EMBER" });
    await request(clients[0], "lobby:ready", { ready: true });
    await request(clients[1], "lobby:ready", { ready: true });
    expect(
      (await request(clients[1], "skill:unlock", { nodeId: "black_hole" })).ok,
    ).toBe(true);
    const room = app.manager.get(a.roomCode)!;
    clients[1].emit("player:input", {
      ...neutral(1),
      blackHoleHeld: true,
      remainingRange: 999,
      damage: 999,
    });
    await new Promise((res) => setTimeout(res, 80));
    expect(Object.keys(room.state.blackHoles ?? {})).toHaveLength(0);
    clients[1].emit("player:input", { ...neutral(2), blackHoleHeld: true });
    await new Promise((res) => setTimeout(res, 180));
    expect(
      Object.values(room.state.blackHoles ?? {})[0].remainingRange,
    ).toBeLessThanOrEqual(T.range);
    const ticks = [...histories[0].keys()].filter(
      (t) =>
        histories[1].has(t) &&
        Object.keys(histories[0].get(t).blackHoles ?? {}).length,
    );
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks)
      expect(histories[0].get(t).blackHoles).toEqual(
        histories[1].get(t).blackHoles,
      );
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
});

it("removes the owner's vortex immediately on disconnect", () => {
  const { room, w, coco } = fixture();
  room.disconnect(coco.id);
  expect(Object.keys(w.blackHoles ?? {})).toHaveLength(0);
});
