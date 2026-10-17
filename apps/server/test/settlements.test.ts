import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import {
  settlementPortals,
  settlements,
  stairPairs,
} from "../../../packages/shared/src/settlements.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
const clear = (id: keyof typeof maps, p: { x: number; y: number }) =>
  !collisionRects(id, {}).some(
    (r) =>
      p.x + 13 > r.x &&
      p.x - 13 < r.x + r.w &&
      p.y + 13 > r.y &&
      p.y - 13 < r.y + r.h,
  );
function party() {
  const room = new GameRoom("TOWNS1"),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  return {
    room,
    a: room.state.players[a.playerId],
    b: room.state.players[b.playerId],
  };
}
it("places every travel sign, stair landing and doorway on walkable authoritative floor", () => {
  for (const t of settlementPortals) {
    expect(clear(t.from, t.at), `${t.from} ${t.label} entrance`).toBe(true);
    expect(clear(t.to, t.arrival), `${t.to} arrival`).toBe(true);
  }
  expect(Object.keys(settlements)).toHaveLength(2);
  expect(stairPairs).toHaveLength(5);
});
it("uses E edges for every new portal, supports independent floors, and rejects remote activation", () => {
  for (const t of settlementPortals) {
    const { room, a, b } = party();
    Object.assign(a, { sceneId: t.from, x: t.at.x + 100, y: t.at.y });
    const send = (held: boolean) => {
      const s = room.sessions.get(a.id)!;
      room.receiveInput(a.id, {
        ...neutral(s.input.seq + 1),
        interactHeld: held,
      });
      room.tick();
    };
    send(true);
    expect(a.sceneId).toBe(t.from);
    send(false);
    Object.assign(a, t.at);
    const epoch = a.movementEpoch ?? 0;
    send(true);
    expect(a.sceneId, `${t.from} to ${t.to}`).toBe(t.to);
    expect(a.movementEpoch).toBeGreaterThan(epoch);
    expect(clear(t.to, a)).toBe(true);
    expect(b.sceneId).toBe("MAIN_HOUSE");
    send(true);
    expect(a.sceneId).toBe(t.to);
  }
});

it("synchronizes independent upstairs travel to both clients and rejects client-supplied destinations", async () => {
  const { createApp } = await import("../src/app.js");
  const { io } = await import("socket.io-client");
  const app = createApp({ startingScene: "EMBERBROOK_VILLAGE" });
  await new Promise<void>((resolve) =>
    app.http.listen(0, "127.0.0.1", resolve),
  );
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const clients = [io(url), io(url)];
  const histories = clients.map(() => new Map<number, any>());
  clients.forEach((c, i) =>
    c.on("game:snapshot", (w) => histories[i].set(w.serverTick, w)),
  );
  const req = (i: number, event: string, data: unknown) =>
    new Promise<any>((resolve, reject) =>
      clients[i]
        .timeout(2000)
        .emit(event, data, (e: any, r: any) => (e ? reject(e) : resolve(r))),
    );
  const until = async (test: () => boolean) => {
    const end = Date.now() + 3000;
    while (!test() && Date.now() < end)
      await new Promise((r) => setTimeout(r, 20));
    expect(test()).toBe(true);
  };
  try {
    await Promise.all(
      clients.map((c) => new Promise<void>((r) => c.on("connect", r))),
    );
    const a = (await req(0, "room:create", {})).data;
    const b = (await req(1, "room:join", { roomCode: a.roomCode })).data;
    await req(0, "role:select", { role: "OATH" });
    await req(1, "role:select", { role: "EMBER" });
    await req(0, "lobby:ready", { ready: true });
    await req(1, "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode),
      p = room.state.players[a.playerId];
    Object.assign(p, { sceneId: "VILLAGE_COTTAGE", x: 440, y: 300 });
    clients[0].emit("player:input", { ...neutral(1), interactHeld: true });
    await until(() => p.sceneId === "VILLAGE_COTTAGE_UPPER");
    await until(() =>
      [...histories[0].keys()].some(
        (t) =>
          histories[1].has(t) &&
          histories[0].get(t).players[a.playerId].sceneId ===
            "VILLAGE_COTTAGE_UPPER",
      ),
    );
    for (const t of [...histories[0].keys()].filter(
      (t) =>
        histories[1].has(t) &&
        histories[0].get(t).players[a.playerId].sceneId ===
          "VILLAGE_COTTAGE_UPPER",
    )) {
      expect(histories[0].get(t).players).toEqual(histories[1].get(t).players);
      expect(histories[0].get(t).players[b.playerId].sceneId).toBe(
        "EMBERBROOK_VILLAGE",
      );
    }
    clients[0].emit("player:input", {
      ...neutral(2),
      interactHeld: true,
      sceneId: "STONEBRIDGE_TOWN",
      x: 480,
      y: 356,
    });
    await new Promise((r) => setTimeout(r, 80));
    expect(p.sceneId).toBe("VILLAGE_COTTAGE_UPPER");
    clients[0].emit("player:input", { ...neutral(3), interactHeld: false });
    await new Promise((r) => setTimeout(r, 80));
    clients[0].emit("player:input", { ...neutral(4), interactHeld: true });
    await until(() => p.sceneId === "VILLAGE_COTTAGE");
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
});

it("keeps signs, doors and stairs reachable from each map's normal spawn", () => {
  for (const from of new Set(settlementPortals.map((t) => t.from))) {
    const map = maps[from],
      step = 16;
    const start = {
      x: Math.round(map.spawn.x / step) * step,
      y: Math.round(map.spawn.y / step) * step,
    };
    const seen = new Set<string>(),
      queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      for (const [dx, dy] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ]) {
        const next = { x: p.x + dx, y: p.y + dy },
          key = `${next.x},${next.y}`;
        if (
          seen.has(key) ||
          next.x < 13 ||
          next.y < 13 ||
          next.x > map.width - 13 ||
          next.y > map.height - 13 ||
          !clear(from, next)
        )
          continue;
        seen.add(key);
        queue.push(next);
      }
    }
    for (const t of settlementPortals.filter((t) => t.from === from))
      expect(
        queue.some((p) => Math.hypot(p.x - t.at.x, p.y - t.at.y) <= 30),
        `${from}: reachable ${t.label}`,
      ).toBe(true);
  }
});

it("puts the new residents on clear walking routes, away from stairs and doors", async () => {
  const { npcs, npcPose } =
    await import("../../../packages/shared/src/npcs.js");
  const residents = npcs.filter((n) =>
    ["WILLOWBANK_VILLAGE", "STONEBRIDGE_TOWN", "STONEBRIDGE_INN"].includes(
      n.scene,
    ),
  );
  expect(residents).toHaveLength(9);
  for (const npc of residents)
    for (let tick = 0; tick < 1800; tick += 8) {
      const p = npcPose(npc, tick);
      expect(clear(npc.scene, p), `${npc.id} at tick ${tick}`).toBe(true);
      for (const door of settlementPortals.filter((t) => t.from === npc.scene))
        expect(
          Math.hypot(p.x - door.at.x, p.y - door.at.y),
          `${npc.id} leaves the door/stairs clear`,
        ).toBeGreaterThan(48);
    }
});

it("keeps rounded grass corners walkable while pond centers remain solid", async () => {
  const { settlementWaterWalls } =
    await import("../../../packages/shared/src/settlements.js");
  for (const id of Object.keys(settlements) as (keyof typeof settlements)[]) {
    const water = settlements[id].water[0],
      walls = settlementWaterWalls(id);
    const wet = (x: number, y: number) =>
      walls.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    expect(wet(water.x + 8, water.y + 8)).toBe(false);
    expect(wet(water.x + water.w / 2, water.y + water.h / 2)).toBe(true);
  }
});
