import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import {
  shrinePoints,
  shrineSpawn,
  SHRINE_OFFERING,
  shrineComplete,
} from "../../../packages/shared/src/shrine.js";
import {
  maps,
  collisionRects,
  previousMap,
} from "../../../packages/shared/src/maps.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { stepMovement } from "../../../packages/shared/src/movement.js";
function setup() {
  const r = new GameRoom("ABC234", false, "GODDESS_SHRINE"),
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
  };
}
it("starts both heroes together in the approved 40x32 top-down shrine and keeps paths navigable", () => {
  const g = setup();
  expect(g.w.sceneId).toBe("GODDESS_SHRINE");
  expect(maps.GODDESS_SHRINE).toMatchObject({
    width: 1280,
    height: 1024,
    mode: "TOP_DOWN",
  });
  expect(g.s).toMatchObject(shrineSpawn("OATH"));
  expect(g.c).toMatchObject(shrineSpawn("EMBER"));
  const walls = collisionRects("GODDESS_SHRINE", g.w.puzzles);
  for (const p of [...Object.values(shrinePoints), g.s, g.c])
    expect(
      walls.some(
        (r) =>
          p.x + 13 > r.x &&
          p.x - 13 < r.x + r.w &&
          p.y + 13 > r.y &&
          p.y - 13 < r.y + r.h,
      ),
    ).toBe(false);
  // Walk from the courtyard through the plaza to each side branch without teleporting.
  for (const goal of [
    shrinePoints.offering,
    { x: 640, y: 576 },
    shrinePoints.west,
    shrinePoints.east,
  ]) {
    for (
      let n = 0;
      n < 250 && Math.hypot(g.s.x - goal.x, g.s.y - goal.y) > 5;
      n++
    )
      stepMovement(
        g.s,
        {
          ...neutral(),
          moveX: Math.abs(goal.x - g.s.x) > 3 ? Math.sign(goal.x - g.s.x) : 0,
          moveY: Math.abs(goal.y - g.s.y) > 3 ? Math.sign(goal.y - g.s.y) : 0,
        },
        maps.GODDESS_SHRINE,
        walls,
        1 / 30,
      );
    expect(Math.hypot(g.s.x - goal.x, g.s.y - goal.y)).toBeLessThan(6);
  }
});
it("offers cryptic dialogue without naming the wig, rejects tools humorously, and consumes the correct offering once", () => {
  const g = setup();
  Object.assign(g.s, shrinePoints.offering);
  Object.assign(g.c, { x: 672, y: 544 });
  const talk = g.r.useItem(g.s.id, {
    requestId: "talk",
    targetId: SHRINE_OFFERING,
  });
  expect(talk.message).toContain("crown");
  expect(talk.message.toLowerCase()).not.toContain("wig");
  expect(g.w.inventory!.revision).toBe(0);
  expect(g.w.inventoryTargets![SHRINE_OFFERING].itemId).toBeUndefined();
  g.w.inventory!.counts.enchanted_shears = 1;
  g.w.inventory!.counts.vanity_mirror = 1;
  expect(() =>
    g.r.useItem(g.s.id, {
      requestId: "shears",
      targetId: SHRINE_OFFERING,
      itemId: "enchanted_shears",
    }),
  ).toThrow("trim");
  expect(() =>
    g.r.useItem(g.c.id, {
      requestId: "mirror",
      targetId: SHRINE_OFFERING,
      itemId: "vanity_mirror",
    }),
  ).toThrow("reflecting");
  expect(g.w.inventory!.counts.enchanted_shears).toBe(1);
  expect(g.w.inventory!.counts.vanity_mirror).toBe(1);
  expect(() =>
    g.r.useItem(g.s.id, {
      requestId: "forged",
      targetId: SHRINE_OFFERING,
      itemId: "griffin_wig",
    }),
  ).toThrow("not in the shared");
  g.w.inventory!.counts.griffin_wig = 1;
  g.r.useItem(g.s.id, {
    requestId: "wig",
    targetId: SHRINE_OFFERING,
    itemId: "griffin_wig",
  });
  g.r.useItem(g.c.id, {
    requestId: "wig-too",
    targetId: SHRINE_OFFERING,
    itemId: "griffin_wig",
  });
  expect(shrineComplete(g.w)).toBe(true);
  expect(g.w.inventory!.counts.griffin_wig).toBe(0);
  expect(g.w.inventory!.revision).toBe(1);
});
it("validates shrine distance and returns from both puzzle branches with progress retained", () => {
  const g = setup();
  expect(() =>
    g.r.useItem(g.s.id, { requestId: "far", targetId: SHRINE_OFFERING }),
  ).toThrow("closer");
  g.w.inventory!.counts.vanity_mirror = 1;
  g.s.hp = 63;
  g.c.hp = 71;
  for (const scene of ["HEDGE_MAZE", "MIRROR_POND"] as const) {
    g.r.transition(scene);
    expect(previousMap[scene]).toBe("GODDESS_SHRINE");
    g.r.transition("GODDESS_SHRINE", true);
    const p = scene === "HEDGE_MAZE" ? shrinePoints.east : shrinePoints.west;
    expect(Math.abs(g.s.x - p.x)).toBeLessThanOrEqual(96);
    expect(g.w.inventory!.counts.vanity_mirror).toBe(1);
    expect(g.s.hp).toBe(63);
    expect(g.c.hp).toBe(71);
  }
});
it("travels through the shrine portals using E intent and returns south to the campaign entrance", () => {
  const g = setup();
  function interact(point: { x: number; y: number }) {
    Object.assign(g.s, point);
    for (let n = 0; n < 31; n++) g.r.tick();
    g.r.receiveInput(g.s.id, {
      ...neutral(g.r.sessions.get(g.s.id)!.input.seq + 1),
      interactHeld: true,
    });
    g.r.tick();
  }
  interact(shrinePoints.west);
  expect(g.w.sceneId).toBe("MIRROR_POND");
  interact(maps.MIRROR_POND.points.back);
  expect(g.w.sceneId).toBe("GODDESS_SHRINE");
  interact(shrinePoints.east);
  expect(g.w.sceneId).toBe("HEDGE_MAZE");
  interact(maps.HEDGE_MAZE.points.back);
  expect(g.w.sceneId).toBe("GODDESS_SHRINE");
  interact(shrinePoints.back);
  expect(g.w.sceneId).toBe("BRIDGE_RUINS");
});
it("synchronizes dialogue, rejected gifts and one atomic shared offering across both clients", async () => {
  const { createApp } = await import("../src/app.js"),
    { io } = await import("socket.io-client");
  const app = createApp({ startingScene: "GODDESS_SHRINE" });
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(app.http.address() as any).port}`,
    clients = [io(url), io(url)],
    history = clients.map(() => new Map<number, any>());
  clients.forEach((c, i) =>
    c.on("game:snapshot", (w) => history[i].set(w.serverTick, w)),
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
    const a = (await req(clients[0], "room:create", {})).data,
      b = (await req(clients[1], "room:join", { roomCode: a.roomCode })).data;
    await req(clients[0], "role:select", { role: "OATH" });
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode);
    Object.assign(room.state.players[a.playerId], shrinePoints.offering);
    Object.assign(room.state.players[b.playerId], { x: 672, y: 544 });
    const talk = await req(clients[0], "inventory:use", {
      requestId: "talk",
      targetId: SHRINE_OFFERING,
    });
    expect(talk.data.message).toContain("crown");
    expect(
      (
        await req(clients[0], "inventory:use", {
          requestId: "fake",
          targetId: SHRINE_OFFERING,
          itemId: "griffin_wig",
        })
      ).ok,
    ).toBe(false);
    // Future Griffin reward fixture; clients cannot grant themselves this item.
    room.state.inventory!.counts.griffin_wig = 1;
    const results = await Promise.all(
      clients.map((c, i) =>
        req(c, "inventory:use", {
          requestId: `offer-${i}`,
          targetId: SHRINE_OFFERING,
          itemId: "griffin_wig",
        }),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
    const ticks = [...history[0].keys()].filter(
      (t) => history[1].has(t) && shrineComplete(history[0].get(t)),
    );
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(history[0].get(t).inventory).toEqual(history[1].get(t).inventory);
      expect(history[0].get(t).inventory.counts.griffin_wig).toBe(0);
      expect(history[0].get(t).inventory.revision).toBe(1);
    }
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
});
