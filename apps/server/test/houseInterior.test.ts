import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import {
  collisionRects,
  maps,
  ENVIRONMENT_SCALE,
  ENVIRONMENT_TILE_SIZE,
} from "../../../packages/shared/src/maps.js";
import { move } from "../../../packages/shared/src/movement.js";
function pair() {
  const r = new GameRoom("HOUSE1"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  return { r, a: r.state.players[a.playerId], b: r.state.players[b.playerId] };
}
function input(r: GameRoom, id: string, interactHeld: boolean) {
  const s = r.sessions.get(id)!;
  s.input = { ...neutral(s.input.seq + 1), interactHeld };
  s.received = Date.now();
  r.tick();
}
it("starts beside the actual doorway with unchanged tile/world proportions", () => {
  const { r, a, b } = pair();
  expect([a.sceneId, b.sceneId]).toEqual(["MAIN_HOUSE", "MAIN_HOUSE"]);
  expect(a.y).toBe(354);
  expect(b.x - a.x).toBe(50);
  for (const p of [a, b])
    expect(
      collisionRects("MAIN_HOUSE", {}).some(
        (q) =>
          p.x + 13 > q.x &&
          p.x - 13 < q.x + q.w &&
          p.y + 13 > q.y &&
          p.y - 13 < q.y + q.h,
      ),
    ).toBe(false);
  expect(ENVIRONMENT_TILE_SIZE * ENVIRONMENT_SCALE).toBe(32);
  expect(maps.HOUSE_INTERIOR.width).toBe(26 * 32);
});
it("validates door distance, supports independent entry/exit, and requires E release", () => {
  const { r, a, b } = pair();
  a.x = 700;
  input(r, a.id, true);
  expect(a.sceneId).toBe("MAIN_HOUSE");
  input(r, a.id, false);
  Object.assign(a, { x: 480, y: 344 });
  input(r, a.id, true);
  expect(a.sceneId).toBe("HOUSE_INTERIOR");
  expect(b.sceneId).toBe("MAIN_HOUSE");
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  expect([a.x, a.y]).toEqual([608, 454]);
  input(r, a.id, true);
  expect(a.sceneId).toBe("HOUSE_INTERIOR");
  Object.assign(b, { x: 480, y: 344 });
  input(r, b.id, true);
  expect(b.sceneId).toBe("HOUSE_INTERIOR");
  input(r, a.id, false);
  input(r, a.id, true);
  expect(a.sceneId).toBe("MAIN_HOUSE");
  expect(b.sceneId).toBe("HOUSE_INTERIOR");
  expect([a.x, a.y]).toEqual([480, 344]);
  input(r, a.id, true);
  expect(a.sceneId).toBe("MAIN_HOUSE");
  expect(a.skillPoints).toBe(1);
});
it("blocks interior furniture and boundary bases but permits the door corridor", () => {
  const { a } = pair();
  a.sceneId = "HOUSE_INTERIOR";
  a.x = 608;
  a.y = 454;
  move(
    a,
    { ...neutral(), moveY: -1 },
    maps.HOUSE_INTERIOR,
    collisionRects("HOUSE_INTERIOR", {}),
    0.15,
  );
  expect(a.y).toBeLessThan(454);
  a.x = 400;
  a.y = 488;
  move(
    a,
    { ...neutral(), moveY: -1 },
    maps.HOUSE_INTERIOR,
    collisionRects("HOUSE_INTERIOR", {}),
    0.1,
  );
  expect(a.y).toBe(475);
  a.x = 640;
  a.y = 480;
  move(
    a,
    { ...neutral(), moveX: 1 },
    maps.HOUSE_INTERIOR,
    collisionRects("HOUSE_INTERIOR", {}),
    0.1,
  );
  expect(a.x).toBe(659);
});
it("keeps cross-location projectiles and enemies from hitting an interior hero", () => {
  const { r, a, b } = pair();
  r.transition("FOREST_RUINS");
  a.sceneId = "HOUSE_INTERIOR";
  a.x = 600;
  a.y = 454;
  for (const e of Object.values(r.state.enemies)) {
    e.x = a.x;
    e.y = a.y;
    e.targetId = a.id;
    e.state = "ATTACK";
    e.attackStartedTick = r.state.serverTick - 100;
  }
  b.x = 100;
  b.y = 700;
  r.state.projectiles.test = {
    id: "test",
    sceneId: "FOREST_RUINS",
    x: 590,
    y: 454,
    vx: 420,
    vy: 0,
    life: 1,
    owner: "enemy",
    faction: "enemies",
    damage: 50,
  };
  r.tick();
  expect(a.hp).toBe(100);
  expect(Object.values(r.state.enemies).every((e) => e.targetId !== a.id)).toBe(
    true,
  );
});
it("synchronizes independent locations to two real sockets and restores the interior on reconnect", async () => {
  const { createApp } = await import("../src/app.js");
  const { io } = await import("socket.io-client");
  const app = createApp();
  await new Promise<void>((resolve) =>
    app.http.listen(0, "127.0.0.1", resolve),
  );
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const sockets = [
    io(url, { transports: ["websocket"] }),
    io(url, { transports: ["websocket"] }),
  ];
  const req = (s: (typeof sockets)[number], event: string, data: unknown) =>
    new Promise<any>((resolve, reject) =>
      s
        .timeout(2000)
        .emit(event, data, (err: any, result: any) =>
          err ? reject(err) : resolve(result),
        ),
    );
  const snapshots = () =>
    Promise.all(
      sockets.map(
        (s) => new Promise<any>((resolve) => s.once("game:snapshot", resolve)),
      ),
    );
  try {
    await Promise.all(
      sockets.map(
        (s) => new Promise<void>((resolve) => s.on("connect", resolve)),
      ),
    );
    const a = (await req(sockets[0], "room:create", {})).data;
    const b = (await req(sockets[1], "room:join", { roomCode: a.roomCode }))
      .data;
    await req(sockets[0], "role:select", { role: "OATH" });
    await req(sockets[1], "role:select", { role: "EMBER" });
    await req(sockets[0], "lobby:ready", { ready: true });
    await req(sockets[1], "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode);
    Object.assign(room.state.players[a.playerId], { x: 480, y: 344 });
    sockets[0].emit("player:input", { ...neutral(1), interactHeld: true });
    let states = await snapshots();
    if (states[0].players[a.playerId].sceneId !== "HOUSE_INTERIOR")
      states = await snapshots();
    expect(states[0]).toEqual(states[1]);
    expect(states[0].players[a.playerId].sceneId).toBe("HOUSE_INTERIOR");
    expect(states[0].players[b.playerId].sceneId).toBe("MAIN_HOUSE");
    // Real input and matched snapshots must agree while Coco pushes into a wall.
    Object.assign(room.state.players[b.playerId], { x: 400, y: 327 });
    let seq = 1;
    const hold = setInterval(
      () => sockets[1].emit("player:input", { ...neutral(seq++), moveY: -1 }),
      30,
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const blocked = await snapshots();
      expect(blocked[0]).toEqual(blocked[1]);
      expect(blocked[0].players[b.playerId]).toMatchObject({
        x: 400,
        y: 327,
        vx: 0,
        vy: 0,
        movementIntent: { x: 0, y: -1 },
      });
    } finally {
      clearInterval(hold);
      sockets[1].emit("player:input", neutral(seq++));
    }
    const removed = new Promise<void>((resolve) =>
      sockets[0].once("disconnect", () => resolve()),
    );
    sockets[0].disconnect();
    await removed;
    await new Promise((resolve) => setTimeout(resolve, 80));
    sockets[0].connect();
    await new Promise<void>((resolve) => sockets[0].once("connect", resolve));
    expect((await req(sockets[0], "session:resume", a)).ok).toBe(true);
    expect(room.state.players[a.playerId].sceneId).toBe("HOUSE_INTERIOR");
    expect(room.state.players[a.playerId].connected).toBe(true);
  } finally {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  }
});
