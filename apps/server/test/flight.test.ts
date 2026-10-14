import { expect, it } from "vitest";
import { io } from "socket.io-client";
import { createApp } from "../src/app.js";
import { GameRoom } from "../src/GameRoom.js";
import { stepMovement } from "../../../packages/shared/src/movement.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import {
  neutral,
  type Player,
  type Rect,
} from "../../../packages/shared/src/gameTypes.js";
import { DT } from "../../../packages/shared/src/constants.js";
const hero = () =>
  ({
    role: "EMBER",
    hp: 100,
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 0,
    cooldowns: {},
    unlockedSkills: ["flight"],
  }) as Player;
const map = { ...maps.GRASSLANDS, width: 1000, height: 1000 };
it("predicts 20 seconds of flight and 7 seconds of recovery, with no held-key repeats", () => {
  const a = hero(),
    b = structuredClone(a);
  for (let tick = 0; tick <= 600; tick++) {
    const frame = { ...neutral(tick + 1), flightHeld: true };
    stepMovement(a, frame, map, [], DT);
    stepMovement(b, frame, map, [], DT);
    expect(a).toEqual(b);
  }
  expect(a.flightRemaining).toBe(0);
  expect(a.cooldowns.flight).toBeCloseTo(7);
  for (let tick = 0; tick < 211; tick++)
    stepMovement(a, { ...neutral(), flightHeld: true }, map, [], DT);
  expect(a.flightRemaining).toBe(0);
  stepMovement(a, neutral(), map, [], DT);
  stepMovement(a, { ...neutral(), flightHeld: true }, map, [], DT);
  expect(a.flightRemaining).toBe(20);
});
it("requires living Coco and the purchased flight skill", () => {
  for (const change of [
    { role: "OATH" as const },
    { hp: 0 },
    { unlockedSkills: [] },
    { cooldowns: { flight: 4 } },
  ]) {
    const p = { ...hero(), ...change };
    stepMovement(p, { ...neutral(), flightHeld: true }, map, [], DT);
    expect(p.flightRemaining).toBe(0);
  }
});
it("crosses only water/canyon blockers, while solid obstacles still stop flight", () => {
  for (const terrain of ["water", "canyon"] as const) {
    const walls: Rect[] = [
      { x: 140, y: 50, w: 80, h: 100, terrain },
      { x: 280, y: 50, w: 50, h: 100 },
    ];
    const grounded = hero(),
      flying = hero();
    for (let tick = 0; tick < 40; tick++) {
      stepMovement(grounded, { ...neutral(), moveX: 1 }, map, walls, DT);
      stepMovement(
        flying,
        { ...neutral(), moveX: 1, flightHeld: tick === 0 },
        map,
        walls,
        DT,
      );
    }
    expect(grounded.x).toBe(127);
    expect(flying.x).toBe(267);
  }
});
it("lands safely at the last dry position when flight expires over water", () => {
  const p = hero(),
    walls: Rect[] = [{ x: 140, y: 50, w: 300, h: 100, terrain: "water" }];
  for (let tick = 0; tick < 20; tick++)
    stepMovement(
      p,
      { ...neutral(), moveX: 1, flightHeld: tick === 0 },
      map,
      walls,
      DT,
    );
  expect(p.x).toBeGreaterThan(140);
  const safe = { ...p.flightGround! };
  for (let tick = 0; tick < 581; tick++)
    stepMovement(p, neutral(), map, walls, DT);
  expect(p.flightRemaining).toBe(0);
  expect({ x: p.x, y: p.y }).toEqual(safe);
  expect(p.movementEpoch).toBe(1);
  expect(p.cooldowns.flight).toBeCloseTo(7);
});
it("allows flight through the ruins water crossing but preserves walls and puzzle wards", () => {
  const p = hero();
  Object.assign(p, { x: 1010, y: 450 });
  const walls = collisionRects("FOREST_RUINS", {});
  for (let tick = 0; tick < 25; tick++)
    stepMovement(
      p,
      { ...neutral(), moveX: 1, flightHeld: tick === 0 },
      maps.FOREST_RUINS,
      walls,
      DT,
    );
  expect(p.x).toBeGreaterThan(1085);
  const r = new GameRoom("FLY", false, "BRIDGE_RUINS"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const coco = r.state.players[b.playerId];
  r.unlock(coco.id, "flight");
  Object.assign(coco, { x: 640, y: 832 });
  for (let n = 0; n < 40; n++) {
    r.receiveInput(coco.id, {
      ...neutral(n + 1),
      moveX: -1,
      flightHeld: n === 0,
    });
    r.tick();
  }
  expect(coco.x).toBeGreaterThanOrEqual(461);
  expect(coco.x).toBeLessThan(500);
  expect(r.state.bridgePuzzle!.failures).toBe(0);
});
it("accepts flight intent on the wire, rejects fabricated timers, and synchronizes both clients", async () => {
  const app = createApp({ startingScene: "BRIDGE_RUINS" });
  await new Promise<void>((res) => app.http.listen(0, "127.0.0.1", res));
  const port = (app.http.address() as { port: number }).port;
  const clients = [
    io(`http://127.0.0.1:${port}`),
    io(`http://127.0.0.1:${port}`),
  ];
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
    const b = (await request(clients[1], "room:join", { roomCode: a.roomCode }))
      .data;
    await request(clients[0], "role:select", { role: "OATH" });
    await request(clients[1], "role:select", { role: "EMBER" });
    await request(clients[0], "lobby:ready", { ready: true });
    await request(clients[1], "lobby:ready", { ready: true });
    expect(
      (await request(clients[1], "skill:unlock", { nodeId: "flight" })).ok,
    ).toBe(true);
    const room = app.manager.get(a.roomCode),
      coco = room.state.players[b.playerId];
    clients[1].emit("player:input", {
      ...neutral(1),
      flightHeld: true,
      flightRemaining: 999,
      x: 1,
    });
    await new Promise((res) => setTimeout(res, 80));
    expect(coco.flightRemaining ?? 0).toBe(0);
    clients[1].emit("player:input", { ...neutral(2), flightHeld: true });
    await new Promise((res) => setTimeout(res, 180));
    expect(coco.flightRemaining).toBeGreaterThan(19);
    expect(coco.flightRemaining).toBeLessThanOrEqual(20);
    const ticks = [...histories[0].keys()].filter(
      (t) =>
        histories[1].has(t) &&
        histories[0].get(t).players[b.playerId].flightRemaining > 0,
    );
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks)
      expect(histories[0].get(tick).players[b.playerId]).toEqual(
        histories[1].get(tick).players[b.playerId],
      );
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
});
