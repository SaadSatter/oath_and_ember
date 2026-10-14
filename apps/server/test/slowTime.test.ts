import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { SPEED } from "../../../packages/shared/src/constants.js";
function fixture() {
  const room = new GameRoom("TIME23"),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  const sieg = room.state.players[a.playerId],
    coco = room.state.players[b.playerId];
  room.state.sceneId = "PUZZLE_GLADE";
  Object.assign(sieg, { sceneId: "PUZZLE_GLADE", x: 500, y: 680, facing: 0 });
  Object.assign(coco, { sceneId: "PUZZLE_GLADE", x: 550, y: 680, facing: 0 });
  const input = (id: string, extra: object) =>
    room.receiveInput(id, {
      ...neutral(room.sessions.get(id)!.input.seq + 1),
      ...extra,
    });
  return { room, sieg, coco, input };
}
it("provides Slow Time from the start and accepts only Coco's activation", () => {
  const { room, sieg, coco, input } = fixture();
  expect(coco.unlockedSkills).toContain("slow_time");
  expect(coco.skillPoints).toBe(0);
  expect(() => room.unlock(sieg.id, "slow_time")).toThrow();
  input(coco.id, { slowTimeHeld: false });
  input(coco.id, { slowTimeHeld: true });
  room.tick();
  expect(room.state.slowTime).toMatchObject({
    owner: coco.id,
    endsTick: room.state.serverTick + 300,
  });
});
it("slows everyone and restores Sieg's normal speed during his boost", () => {
  const { room, sieg, coco, input } = fixture();
  room.unlock(coco.id, "slow_time");
  input(coco.id, { slowTimeHeld: true, moveX: 1 });
  input(sieg.id, { moveX: 1 });
  room.tick();
  expect(sieg.vx).toBe(SPEED * 0.2);
  expect(coco.vx).toBe(SPEED * 0.2);
  room.unlock(sieg.id, "dash");
  input(sieg.id, { sprintHeld: true, moveX: 1 });
  room.tick();
  expect(sieg.vx).toBe(SPEED);
  expect(coco.vx).toBe(SPEED * 0.2);
  const ends = room.state.slowTime!.endsTick;
  while (room.state.serverTick < ends) room.tick();
  expect(room.state.slowTime).toBeUndefined();
  input(coco.id, { slowTimeHeld: false });
  input(coco.id, { slowTimeHeld: true });
  room.tick();
  expect(room.state.slowTime).toBeUndefined();
});
it("pushes Coco only while Sieg is boosted during Slow Time and keeps her within walls", () => {
  const { room, sieg, coco, input } = fixture();
  room.unlock(coco.id, "slow_time");
  room.unlock(sieg.id, "dash");
  coco.x = sieg.x + 23;
  input(coco.id, { slowTimeHeld: true });
  input(sieg.id, { moveX: 1, sprintHeld: true });
  const old = coco.x;
  room.tick();
  expect(coco.x).toBeGreaterThan(old);
  Object.assign(sieg, { x: 955, y: 680 });
  Object.assign(coco, { x: 978, y: 680 });
  input(sieg.id, { moveX: 1 });
  room.tick();
  expect(coco.x).toBeLessThanOrEqual(979);
});

it("broadcasts identical accepted Slow Time state and slowed movement to two clients", async () => {
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
    Object.assign(
      Object.values(room.state.players).find((p) => p.role === "EMBER")!,
      {
        x: 500,
        y: 680,
        facing: 0,
        unlockedSkills: ["ward", "slow_time"],
      },
    );
    clients[1].emit("player:input", {
      ...neutral(1),
      moveX: 1,
      slowTimeHeld: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 220));
    const shared = [...histories[0].keys()].filter((t) => histories[1].has(t));
    const pushed = shared.filter((t) => !!histories[0].get(t).slowTime);
    expect(pushed.length).toBeGreaterThan(0);
    for (const tick of pushed) {
      expect(histories[0].get(tick)).toEqual(histories[1].get(tick));
      const mage = Object.values(histories[0].get(tick).players).find(
        (p: any) => p.role === "EMBER",
      ) as any;
      expect(mage.vx).toBe(SPEED * 0.2);
    }
  } finally {
    clients.forEach((client) => client.disconnect());
    await app.close();
  }
});

it("keeps Coco with Sieg until he stops or changes direction, despite her own movement intent", () => {
  const { room, sieg, coco, input } = fixture();
  room.unlock(coco.id, "slow_time");
  room.unlock(sieg.id, "dash");
  coco.x = sieg.x + 23;
  input(coco.id, { slowTimeHeld: true });
  input(sieg.id, { sprintHeld: true, moveX: 1 });
  room.tick();
  const gap = coco.x - sieg.x;
  for (let n = 0; n < 12; n++) {
    input(coco.id, { moveY: -1 });
    input(sieg.id, { moveX: 1 });
    const oldY = coco.y;
    room.tick();
    expect(coco.x - sieg.x).toBeCloseTo(gap);
    expect(coco.y).toBeCloseTo(oldY);
  }
  const before = coco.x;
  input(sieg.id, {});
  input(coco.id, { moveY: -1 });
  room.tick();
  expect(coco.x).toBeCloseTo(before);
  expect(coco.vy).toBeLessThan(0);
});
it("releases Coco when Sieg turns away from the original pushing direction", () => {
  const { room, sieg, coco, input } = fixture();
  room.unlock(coco.id, "slow_time");
  room.unlock(sieg.id, "dash");
  coco.x = sieg.x + 23;
  input(coco.id, { slowTimeHeld: true });
  input(sieg.id, { moveX: 1, sprintHeld: true });
  room.tick();
  const y = coco.y;
  input(coco.id, {});
  input(sieg.id, { moveY: -1 });
  room.tick();
  expect(coco.y).toBeCloseTo(y);
  input(sieg.id, { moveY: -1 });
  room.tick();
  expect(coco.y).toBeCloseTo(y);
});
