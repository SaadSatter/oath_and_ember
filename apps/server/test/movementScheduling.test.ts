import { expect, it, vi } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { DT, ticksFor } from "../../../packages/shared/src/constants.js";
import { maps } from "../../../packages/shared/src/maps.js";
import {
  exteriorTrees,
  exteriorTreeSolids,
} from "../../../packages/shared/src/environmentSolids.js";
import { readFileSync } from "node:fs";
import { move } from "../../../packages/shared/src/movement.js";
function pair() {
  const room = new GameRoom("TICKS1"),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  const p = room.state.players[a.playerId];
  Object.assign(p, { sceneId: "HOUSE_INTERIOR", x: 320, y: 480 });
  return { room, p };
}
it("does not retroactively expire scheduled movement when wall time stalls, then stops at the simulation lease boundary", () => {
  const { room, p } = pair();
  const date = vi.spyOn(Date, "now").mockReturnValue(1000);
  try {
    expect(
      room.receiveInput(p.id, {
        ...neutral(1),
        targetTick: 6,
        movementEpoch: p.movementEpoch,
        moveX: 1,
      }),
    ).toBe(true);
    date.mockReturnValue(2000);
    // Scheduled intent holds for a 250ms simulation lease past its target tick.
    const leaseEnds = 6 + Math.ceil(0.25 / DT);
    for (let tick = 1; tick <= leaseEnds + 6; tick++) {
      room.tick();
      expect(p.x).toBeCloseTo(
        320 + Math.max(0, Math.min(tick, leaseEnds) - 5) * 190 * DT,
      );
    }
    expect(p.movementInput!.moveX).toBe(0);
  } finally {
    date.mockRestore();
  }
});
it("keeps sequence acknowledgement distinct from scheduled physics and bounds the intent queue", () => {
  const { room, p } = pair();
  for (let seq = 1; seq <= 100; seq++)
    expect(
      room.receiveInput(p.id, {
        ...neutral(seq),
        targetTick: 5,
        movementEpoch: p.movementEpoch,
        moveX: 1,
      }),
    ).toBe(true);
  expect(room.sessions.get(p.id)!.movementQueue!.size).toBe(1);
  for (let tick = 1; tick <= 4; tick++) {
    room.tick();
    expect(p.x).toBe(320);
    expect(p.lastProcessedInputSeq).toBe(0);
  }
  room.tick();
  expect(p.x).toBeCloseTo(320 + 190 * DT);
  expect(p.lastProcessedInputSeq).toBe(100);
  expect(
    room.receiveInput(p.id, {
      ...neutral(101),
      targetTick: 99999,
      movementEpoch: p.movementEpoch,
      moveX: 1,
    }),
  ).toBe(false);
});
it("discards old location intent on entry and exit even if the old packet arrives later", () => {
  const { room, p } = pair();
  Object.assign(p, { sceneId: "MAIN_HOUSE", x: 456, y: 354 });
  const epoch = p.movementEpoch!;
  room.receiveInput(p.id, {
    ...neutral(1),
    targetTick: 6,
    movementEpoch: epoch,
    moveX: 1,
  });
  room.receiveInput(p.id, {
    ...neutral(2),
    targetTick: 7,
    movementEpoch: epoch,
    interactHeld: true,
  });
  room.tick();
  expect(p.sceneId).toBe("HOUSE_INTERIOR");
  expect(room.sessions.get(p.id)!.movementQueue!.size).toBe(0);
  expect(
    room.receiveInput(p.id, {
      ...neutral(3),
      targetTick: 8,
      movementEpoch: epoch,
      moveX: 1,
    }),
  ).toBe(false);
  expect(
    room.receiveInput(p.id, {
      ...neutral(4),
      targetTick: 8,
      movementEpoch: p.movementEpoch,
      moveX: -1,
    }),
  ).toBe(true);
});
it("blocks every exterior trunk base with small geometry and permits diagonal sliding around it", () => {
  const source = JSON.parse(
    readFileSync(
      "apps/client/public/assets/environment/main-house/trees.json",
      "utf8",
    ),
  );
  expect(exteriorTrees).toEqual(
    source.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
  );
  for (const r of exteriorTreeSolids) {
    const { p } = pair();
    Object.assign(p, { x: r.x - 13, y: r.y + 6 });
    for (let tick = 0; tick < 300; tick++)
      move(p, { ...neutral(), moveX: 1 }, maps.MAIN_HOUSE, [r], DT);
    expect(p.x).toBe(r.x - 13);
    for (let tick = 0; tick < 20; tick++)
      move(p, { ...neutral(), moveX: 1, moveY: -1 }, maps.MAIN_HOUSE, [r], DT);
    expect(p.x).toBeGreaterThan(r.x - 13);
    expect(p.y + 13).toBeLessThanOrEqual(r.y);
  }
});
it("validates bounded redundant intent packets over real sockets and publishes identical authoritative ticks to both clients", async () => {
  const { createApp } = await import("../src/app.js"),
    { io } = await import("socket.io-client");
  const app = createApp();
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const sockets = [
    io(url, { transports: ["websocket"] }),
    io(url, { transports: ["websocket"] }),
  ];
  const request = (n: number, name: string, payload: unknown) =>
    new Promise<any>((r) => (sockets[n].emit as Function)(name, payload, r));
  const seen = [new Map<number, string>(), new Map<number, string>()];
  try {
    await Promise.all(
      sockets.map((s) => new Promise<void>((r) => s.once("connect", r))),
    );
    const a = (await request(0, "room:create", {})).data,
      b = (await request(1, "room:join", { roomCode: a.roomCode })).data;
    await request(0, "role:select", { role: "OATH" });
    await request(1, "role:select", { role: "EMBER" });
    await request(0, "lobby:ready", { ready: true });
    await request(1, "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode),
      ids = [a.playerId, b.playerId];
    ids.forEach((id) =>
      Object.assign(room.state.players[id], {
        sceneId: "HOUSE_INTERIOR",
        x: 320,
        y: 480,
      }),
    );
    const probe = (await request(0, "clock:probe", {})).data;
    expect(probe.serverTick).toBeLessThanOrEqual(room.state.serverTick);
    sockets.forEach((s, n) =>
      s.on("game:snapshot", (w) =>
        seen[n].set(w.serverTick, JSON.stringify(w.players)),
      ),
    );
    const start = room.state.serverTick;
    for (let n = 0; n < 2; n++) {
      const epoch = room.state.players[ids[n]].movementEpoch;
      // Different packet sequence IDs, identical intended physics ticks.
      sockets[n].emit("player:input", {
        frames: Array.from({ length: 6 }, (_, i) => ({
          ...neutral((n + 1) * 100 + i),
          targetTick: start + ticksFor(0.2) + i,
          movementEpoch: epoch,
          moveX: 1,
        })),
      });
      sockets[n].emit("player:input", {
        ...neutral(9999),
        targetTick: start + 99999,
        movementEpoch: epoch,
        moveX: -1,
      });
      sockets[n].emit("player:input", {
        ...neutral(9998),
        targetTick: -1,
        movementEpoch: epoch,
        moveX: -1,
      });
      (sockets[n].emit as Function)("player:input", {
        frames: [
          {
            ...neutral(9997),
            targetTick: start + ticksFor(0.2),
            movementEpoch: epoch,
            moveX: -1,
            x: 99999,
          },
        ],
      });
    }
    await new Promise((r) => setTimeout(r, 110));
    expect(room.state.players[ids[0]].x).toBe(320);
    await new Promise((r) => setTimeout(r, 450));
    const p = room.state.players[ids[0]],
      q = room.state.players[ids[1]];
    expect(p.x).toBeCloseTo(q.x);
    expect(p.x).toBeGreaterThan(320);
    expect(p.lastProcessedInputSeq).toBe(105);
    expect(q.lastProcessedInputSeq).toBe(205);
    expect(room.sessions.get(ids[0])!.input.seq).toBe(105);
    const common = [...seen[0].keys()].filter((t) => seen[1].has(t));
    expect(common.length).toBeGreaterThan(2);
    for (const tick of common)
      expect(seen[0].get(tick)).toBe(seen[1].get(tick));
  } finally {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  }
}, 15000);
