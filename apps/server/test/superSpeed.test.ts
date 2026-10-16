import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { stepMovement } from "../../../packages/shared/src/movement.js";
import {
  neutral,
  type Player,
} from "../../../packages/shared/src/gameTypes.js";
import { DT, SPEED, ticksFor } from "../../../packages/shared/src/constants.js";
import { maps } from "../../../packages/shared/src/maps.js";
const hero = () =>
  ({
    role: "OATH",
    hp: 100,
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 0,
    cooldowns: {},
    unlockedSkills: ["dash"],
  }) as Player;
it("predicts the same 2x ten-second boost and five-second recovery without changing diagonal speed", () => {
  const a = hero(),
    b = structuredClone(a),
    input = { ...neutral(1), moveX: 1, moveY: 1, sprintHeld: true };
  for (let tick = 0; tick < ticksFor(10); tick++) {
    const frame = { ...input, sprintHeld: tick === 0 };
    const before = { x: a.x, y: a.y };
    stepMovement(
      a,
      frame,
      { ...maps.GRASSLANDS, width: 5000, height: 5000 },
      [],
      DT,
    );
    stepMovement(
      b,
      frame,
      { ...maps.GRASSLANDS, width: 5000, height: 5000 },
      [],
      DT,
    );
    expect(a).toEqual(b);
    expect(Math.hypot(a.x - before.x, a.y - before.y)).toBeCloseTo(
      SPEED * 2 * DT,
    );
  }
  const before = a.x;
  stepMovement(
    a,
    { ...input, moveY: 0, sprintHeld: false },
    { ...maps.GRASSLANDS, width: 5000, height: 5000 },
    [],
    DT,
  );
  expect(a.x - before).toBeCloseTo(SPEED * DT);
  stepMovement(
    a,
    input,
    { ...maps.GRASSLANDS, width: 5000, height: 5000 },
    [],
    DT,
  );
  expect(a.sprintRemaining).toBe(0);
});
it("requires Sieg's unlocked skill, prevents held-key repeats and sweeps boost movement against walls", () => {
  for (const change of [
    { role: "EMBER" as const },
    { hp: 0 },
    { unlockedSkills: [] },
  ]) {
    const p = { ...hero(), ...change };
    stepMovement(
      p,
      { ...neutral(1), moveX: 1, sprintHeld: true },
      { ...maps.GRASSLANDS, width: 5000, height: 5000 },
      [],
      DT,
    );
    expect(p.sprintRemaining).toBe(0);
  }
  const p = hero();
  // One boosted step from here would end inside the wall; it stops flush.
  p.x = 207 - SPEED * DT;
  stepMovement(
    p,
    { ...neutral(1), moveX: 1, sprintHeld: true },
    maps.GRASSLANDS,
    [{ x: 220, y: 50, w: 20, h: 100 }],
    DT,
  );
  expect(p.x).toBe(207);
  for (let n = 0; n < ticksFor(17); n++)
    stepMovement(
      p,
      { ...neutral(1), sprintHeld: true },
      { ...maps.GRASSLANDS, width: 5000, height: 5000 },
      [],
      DT,
    );
  expect(p.sprintRemaining).toBe(0);
});

it("broadcasts identical accepted Super Speed movement to both real clients", async () => {
  const { createApp } = await import("../src/app.js");
  const { io } = await import("socket.io-client");
  const app = createApp();
  await new Promise<void>((resolve) =>
    app.http.listen(0, "127.0.0.1", resolve),
  );
  const url = `http://127.0.0.1:${(app.http.address() as any).port}`;
  const clients = [io(url), io(url)];
  const histories = clients.map(() => new Map<number, any>());
  clients.forEach((client, i) =>
    client.on("game:snapshot", (world) =>
      histories[i].set(world.serverTick, world),
    ),
  );
  const req = (client: any, event: string, data: any) =>
    new Promise<any>((resolve, reject) =>
      client
        .timeout(2000)
        .emit(event, data, (error: any, result: any) =>
          error ? reject(error) : resolve(result),
        ),
    );
  try {
    await Promise.all(
      clients.map(
        (client) =>
          new Promise<void>((resolve) => client.on("connect", resolve)),
      ),
    );
    const a = (await req(clients[0], "room:create", {})).data;
    await req(clients[1], "room:join", { roomCode: a.roomCode });
    await req(clients[0], "role:select", { role: "OATH" });
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode);
    room.state.sceneId = "PUZZLE_GLADE";
    for (const p of Object.values(room.state.players))
      p.sceneId = "PUZZLE_GLADE";
    Object.assign(room.state.players[a.playerId], {
      x: 500,
      y: 680,
      facing: 0,
      unlockedSkills: ["dash"],
    });
    clients[0].emit("player:input", {
      ...neutral(1),
      moveX: 1,
      sprintHeld: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 220));
    const shared = [...histories[0].keys()].filter((t) => histories[1].has(t));
    const pushed = shared.filter(
      (t) => histories[0].get(t).players[a.playerId].sprintRemaining > 0,
    );
    expect(pushed.length).toBeGreaterThan(0);
    for (const tick of pushed) {
      expect(histories[0].get(tick)).toEqual(histories[1].get(tick));
      expect(histories[0].get(tick).players[a.playerId].vx).toBe(SPEED * 2);
    }
  } finally {
    clients.forEach((client) => client.disconnect());
    await app.close();
  }
}, 15000);

it("retains a quick Super Speed click when release arrives before the next server tick", () => {
  const room = new GameRoom("FAST23"),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  const p = room.state.players[a.playerId];
  p.unlockedSkills = ["dash"];
  room.receiveInput(p.id, { ...neutral(1), sprintHeld: true });
  room.receiveInput(p.id, neutral(2));
  room.tick();
  expect(p.sprintRemaining).toBe(10);
});
it("recharges for five seconds after the ten-second boost ends", () => {
  const p = hero(),
    map = { ...maps.GRASSLANDS, width: 5000, height: 5000 };
  stepMovement(p, { ...neutral(1), sprintHeld: true }, map, [], DT);
  for (let n = 0; n < ticksFor(10); n++) stepMovement(p, neutral(2), map, [], DT);
  expect(p.sprintRemaining).toBe(0);
  expect(p.cooldowns.sprint).toBeCloseTo(5);
  stepMovement(p, { ...neutral(3), sprintHeld: true }, map, [], DT);
  expect(p.sprintRemaining).toBe(0);
  for (let n = 0; n < ticksFor(5); n++) stepMovement(p, neutral(4), map, [], DT);
  stepMovement(p, { ...neutral(5), sprintHeld: true }, map, [], DT);
  expect(p.sprintRemaining).toBe(10);
});
