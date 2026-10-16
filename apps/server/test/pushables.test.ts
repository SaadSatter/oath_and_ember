import { DT, ticksFor } from "../../../packages/shared/src/constants.js";
import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { collisionRects } from "../../../packages/shared/src/maps.js";
import {
  pushableDefinitions,
  pushableRect,
} from "../../../packages/shared/src/pushables.js";
function fixture() {
  const room = new GameRoom("PUSH23");
  const a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  room.state.sceneId = "PUZZLE_GLADE";
  for (const player of Object.values(room.state.players))
    player.sceneId = "PUZZLE_GLADE";
  const player = room.state.players[a.playerId];
  Object.assign(player, { x: 915, y: 144, facing: 0 });
  const session = room.sessions.get(player.id)!;
  const tick = () => {
    session.received = Date.now();
    session.input = { ...neutral(session.input.seq + 1), pushHeld: true };
    room.tick();
  };
  return { room, player, tick };
}
it("moves the reviewed chair from held intent and moves its authoritative collision footprint", () => {
  const { room, player, tick } = fixture();
  tick();
  expect(player.actionState).toBe("push");
  expect(room.state.pushableOffsets?.["puzzle-chair"]).toEqual({ x: 60 * DT, y: 0 });
  const rect = pushableRect(pushableDefinitions[0], room.state.pushableOffsets);
  expect(
    collisionRects(
      "PUZZLE_GLADE",
      room.state.puzzles,
      room.state.pushableOffsets,
    ),
  ).toContainEqual(rect);
  for (let n = 0; n < ticksFor(1); n++) tick();
  expect(
    pushableRect(pushableDefinitions[0], room.state.pushableOffsets).x + rect.w,
  ).toBeLessThanOrEqual(992);
});
it("rejects distant, wrong-facing, wrong-role, dead and other-scene pushing", () => {
  for (const change of [
    { x: 100 },
    { facing: Math.PI },
    { role: "EMBER" as const },
    { hp: 0 },
    { sceneId: "MAIN_HOUSE" as const },
  ]) {
    const { room, player, tick } = fixture();
    Object.assign(player, change);
    tick();
    expect(room.state.pushableOffsets).toEqual({});
  }
});
it("does not push another player out of the way", () => {
  const { room, player, tick } = fixture();
  const partner = Object.values(room.state.players).find(
    (p) => p.id !== player.id,
  )!;
  Object.assign(partner, { x: 969, y: 144 });
  tick();
  expect(room.state.pushableOffsets).toEqual({});
});

it("broadcasts identical push positions and presentation state to two real clients", async () => {
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
      x: 915,
      y: 144,
      facing: 0,
    });
    clients[0].emit("player:input", { ...neutral(1), pushHeld: true });
    await new Promise((resolve) => setTimeout(resolve, 220));
    const shared = [...histories[0].keys()].filter((t) => histories[1].has(t));
    const pushed = shared.filter(
      (t) => histories[0].get(t).pushableOffsets?.["puzzle-chair"]?.x > 0,
    );
    expect(pushed.length).toBeGreaterThan(0);
    for (const tick of pushed) {
      expect(histories[0].get(tick)).toEqual(histories[1].get(tick));
      expect(histories[0].get(tick).players[a.playerId].actionState).toBe(
        "push",
      );
    }
  } finally {
    clients.forEach((client) => client.disconnect());
    await app.close();
  }
}, 15000);

it("E interacts for either hero without posing or moving pushable objects; only Sieg's dedicated push intent moves them", () => {
  for (const role of ["OATH", "EMBER"] as const) {
    const { room, player } = fixture();
    player.role = role;
    room.receiveInput(player.id, { ...neutral(1), interactHeld: true });
    room.tick();
    expect(player.actionState).not.toBe("push");
    expect(room.state.pushableOffsets?.["puzzle-chair"]).toBeUndefined();
    room.receiveInput(player.id, { ...neutral(2), pushHeld: true });
    room.tick();
    if (role === "OATH")
      expect(room.state.pushableOffsets?.["puzzle-chair"]?.x).toBeGreaterThan(
        0,
      );
    else expect(room.state.pushableOffsets?.["puzzle-chair"]).toBeUndefined();
  }
});

it("E plus movement cannot move the persistent boulder", () => {
  const room = new GameRoom("USE123", false, "BRIDGE_RUINS"),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  const sieg = room.state.players[a.playerId],
    start = { ...room.state.bridgePuzzle!.boulder };
  Object.assign(sieg, { x: 288, y: 1448 });
  for (let seq = 1; seq <= 15; seq++) {
    room.receiveInput(sieg.id, {
      ...neutral(seq),
      moveY: -1,
      interactHeld: true,
    });
    room.tick();
  }
  expect(room.state.bridgePuzzle!.boulder).toEqual(start);
  expect(sieg.actionState).not.toBe("push");
  room.receiveInput(sieg.id, { ...neutral(16), moveY: -1, pushHeld: true });
  room.tick();
  expect(room.state.bridgePuzzle!.boulder.y).toBeLessThan(start.y);
});
