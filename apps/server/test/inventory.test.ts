import { describe, expect, it } from "vitest";
import { io } from "socket.io-client";
import { GameRoom } from "../src/GameRoom.js";
import { createApp } from "../src/app.js";
function pair() {
  const room = new GameRoom("ABC234");
  const a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  for (const p of Object.values(room.state.players))
    Object.assign(p, { x: 480, y: 380, sceneId: "MAIN_HOUSE" });
  return {
    room,
    a: room.state.players[a.playerId],
    b: room.state.players[b.playerId],
  };
}
describe("authoritative shared inventory", () => {
  it("checks range, scene, life, obstruction, puzzle state and ownership without consuming anything", () => {
    const { room, a } = pair();
    room.inventory.register(room.state, {
      id: "gate",
      name: "Gate",
      kind: "gate",
      sceneId: "MAIN_HOUSE",
      x: 480,
      y: 390,
      itemId: "hedge_gate_key",
    });
    const use = (requestId: string) =>
      room.useItem(a.id, {
        requestId,
        targetId: "gate",
        itemId: "hedge_gate_key",
      });
    expect(() => use("missing")).toThrow("not in");
    room.state.inventory!.counts.hedge_gate_key = 1;
    a.x = 600;
    expect(() => use("far")).toThrow("closer");
    a.x = 480;
    a.sceneId = "HOUSE_INTERIOR";
    expect(() => use("scene")).toThrow("not on your map");
    a.sceneId = "MAIN_HOUSE";
    a.hp = 0;
    expect(() => use("dead")).toThrow("right now");
    a.hp = 100;
    room.inventory.register(room.state, {
      id: "blocked",
      name: "Blocked",
      kind: "chest",
      sceneId: "MAIN_HOUSE",
      x: 230,
      y: 350,
      reward: "vanity_mirror",
    });
    Object.assign(a, { x: 190, y: 350 });
    expect(() =>
      room.useItem(a.id, { requestId: "wall", targetId: "blocked" }),
    ).toThrow("blocked");
    Object.assign(a, { x: 480, y: 380 });
    room.inventory.register(room.state, {
      id: "locked",
      name: "Locked",
      kind: "chest",
      sceneId: "MAIN_HOUSE",
      x: 480,
      y: 390,
      reward: "vanity_mirror",
      available: () => false,
    });
    expect(() =>
      room.useItem(a.id, { requestId: "lock", targetId: "locked" }),
    ).toThrow("Solve");
    expect(room.state.inventory).toMatchObject({
      revision: 0,
      counts: { hedge_gate_key: 1 },
      claimed: [],
      unlocked: [],
    });
    // A rejected request is immutable too; a new intent gets a fresh request ID.
    expect(() => use("missing")).toThrow("not in");
  });
  it("does not consume shared tools for incorrect offerings; records one successful wig offering", () => {
    const { room, a, b } = pair();
    room.inventory.register(room.state, {
      id: "goddess",
      name: "Goddess",
      kind: "offering",
      sceneId: "MAIN_HOUSE",
      x: 480,
      y: 390,
      itemId: "griffin_wig",
    });
    room.state.inventory!.counts = {
      vanity_mirror: 1,
      enchanted_shears: 1,
      griffin_wig: 1,
    };
    expect(() =>
      room.useItem(a.id, {
        requestId: "wrong",
        targetId: "goddess",
        itemId: "vanity_mirror",
      }),
    ).toThrow("Nothing was consumed");
    const intent = {
      requestId: "offer",
      targetId: "goddess",
      itemId: "griffin_wig" as const,
    };
    const result = room.useItem(a.id, intent);
    expect(room.useItem(a.id, intent)).toEqual(result);
    room.useItem(b.id, { ...intent, requestId: "partner" });
    expect(room.state.inventory).toMatchObject({
      revision: 1,
      counts: { vanity_mirror: 1, enchanted_shears: 1, griffin_wig: 0 },
      completed: ["goddess"],
    });
    expect(() => room.useItem(a.id, { ...intent, targetId: "other" })).toThrow(
      "Request ID",
    );
    room.transition("HOUSE_INTERIOR");
    expect(room.state.inventory!.completed).toEqual(["goddess"]);
    room.reset();
    expect(room.state.inventory!.counts).toEqual({});
    expect(room.inventory.targets.size).toBe(0);
  });
});
it("synchronizes concurrent claims and key use across two sockets and restores inventory on resume", async () => {
  const app = createApp();
  await new Promise<void>((resolve) =>
    app.http.listen(0, "127.0.0.1", resolve),
  );
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const clients = [io(url), io(url)];
  const req = (index: number, event: string, p: unknown) =>
    new Promise<any>((resolve, reject) =>
      clients[index]
        .timeout(2000)
        .emit(event, p, (error: Error, result: unknown) =>
          error ? reject(error) : resolve(result),
        ),
    );
  try {
    await Promise.all(
      clients.map(
        (s) => new Promise<void>((resolve) => s.on("connect", resolve)),
      ),
    );
    const session = (await req(0, "room:create", {})).data;
    const partner = (await req(1, "room:join", { roomCode: session.roomCode }))
      .data;
    await req(0, "role:select", { role: "OATH" });
    await req(1, "role:select", { role: "EMBER" });
    await req(0, "lobby:ready", { ready: true });
    await req(1, "lobby:ready", { ready: true });
    const room = app.manager.get(session.roomCode);
    for (const p of Object.values(room.state.players))
      Object.assign(p, { x: 480, y: 380, sceneId: "MAIN_HOUSE" });
    room.inventory.register(room.state, {
      id: "key-chest",
      name: "Key chest",
      kind: "chest",
      sceneId: "MAIN_HOUSE",
      x: 480,
      y: 390,
      reward: "hedge_gate_key",
    });
    room.inventory.register(room.state, {
      id: "gate",
      name: "Gate",
      kind: "gate",
      sceneId: "MAIN_HOUSE",
      x: 480,
      y: 390,
      itemId: "hedge_gate_key",
    });
    const update = new Promise<any>((resolve) =>
      clients[1].once("state:sync", resolve),
    );
    const claim = { requestId: "claim", targetId: "key-chest" };
    const claims = await Promise.all([
      req(0, "inventory:use", claim),
      req(1, "inventory:use", claim),
    ]);
    expect(claims.every((r) => r.ok)).toBe(true);
    expect((await update).inventory.counts.hedge_gate_key).toBe(1);
    expect(room.state.inventory!.revision).toBe(1);
    expect((await req(0, "inventory:use", claim)).data).toEqual(claims[0].data);
    expect(
      (
        await req(0, "inventory:use", {
          requestId: "forged",
          targetId: "gate",
          itemId: "hedge_gate_key",
          playerId: partner.playerId,
          counts: { hedge_gate_key: 99 },
        })
      ).ok,
    ).toBe(false);
    const uses = await Promise.all(
      [0, 1].map((i) =>
        req(i, "inventory:use", {
          requestId: "open",
          targetId: "gate",
          itemId: "hedge_gate_key",
        }),
      ),
    );
    expect(uses.every((r) => r.ok)).toBe(true);
    expect(room.state.inventory).toMatchObject({
      revision: 2,
      counts: { hedge_gate_key: 0 },
      unlocked: ["gate"],
    });
    room.state.players[partner.playerId].sceneId = "HOUSE_INTERIOR";
    room.inventory.register(room.state, {
      id: "mirror",
      name: "Mirror chest",
      kind: "chest",
      sceneId: "MAIN_HOUSE",
      x: 480,
      y: 390,
      reward: "vanity_mirror",
    });
    const remoteUpdate = new Promise<any>((resolve) =>
      clients[1].once("state:sync", resolve),
    );
    expect(
      (
        await req(0, "inventory:use", {
          requestId: "mirror",
          targetId: "mirror",
        })
      ).ok,
    ).toBe(true);
    expect((await remoteUpdate).inventory.counts.vanity_mirror).toBe(1);
    expect(
      (
        await req(1, "inventory:use", {
          requestId: "remote",
          targetId: "mirror",
        })
      ).ok,
    ).toBe(false);
    clients[0].disconnect();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    clients[0] = io(url);
    await new Promise<void>((resolve) => clients[0].on("connect", resolve));
    const resumed = new Promise<any>((resolve) =>
      clients[0].once("state:sync", resolve),
    );
    expect((await req(0, "session:resume", session)).ok).toBe(true);
    expect((await resumed).inventory).toMatchObject({
      counts: { hedge_gate_key: 0, vanity_mirror: 1 },
      unlocked: ["gate"],
    });
  } finally {
    clients.forEach((s) => s.disconnect());
    await app.close();
  }
}, 15000);
