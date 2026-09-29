import { describe, it, expect } from "vitest";
import { io } from "socket.io-client";
import { GameRoom } from "../src/GameRoom.js";
import { RoomManager } from "../src/RoomManager.js";
import { createApp } from "../src/app.js";
import { move } from "../../../packages/shared/src/movement.js";
import { maps } from "../../../packages/shared/src/maps.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
function pair() {
  const r = new GameRoom("ABC234"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  return { r, a: r.state.players[a.playerId], b: r.state.players[b.playerId] };
}
function input(
  r: GameRoom,
  id: string,
  patch: Partial<ReturnType<typeof neutral>>,
) {
  const s = r.sessions.get(id)!;
  s.input = { ...neutral(s.input.seq + 1), ...patch };
  s.received = Date.now();
}
describe("room invariants", () => {
  it("creates unambiguous codes, rejects third player and duplicate roles", () => {
    const r = new RoomManager().create();
    expect(r.state.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const a = r.add("a");
    r.add("b");
    expect(() => r.add("c")).toThrow("full");
    r.select(a.playerId, "OATH");
    expect(() => r.select([...r.sessions.keys()][1], "OATH")).toThrow("taken");
  });
  it("reserves disconnected slot and validates resume secrets and expiry", () => {
    const r = new GameRoom("ABC234"),
      s = r.add("a");
    r.disconnect(s.playerId);
    expect(() => r.resume(s.playerId, "bad", "b")).toThrow();
    expect(r.resume(s.playerId, s.reconnectToken, "b")).toEqual(s);
    r.disconnect(s.playerId);
    r.sessions.get(s.playerId)!.expires = 0;
    expect(() => r.resume(s.playerId, s.reconnectToken, "c")).toThrow();
  });
  it("enforces skill role, prerequisites, points and single payment", () => {
    const { r, a, b } = pair();
    expect(() => r.unlock(b.id, "guard")).toThrow();
    expect(() => r.unlock(a.id, "heavy")).toThrow();
    r.unlock(a.id, "guard");
    expect(a.skillPoints).toBe(0);
    expect(() => r.unlock(a.id, "guard")).toThrow();
    expect(() => r.unlock(a.id, "heavy")).toThrow("points");
  });
});
describe("shared movement", () => {
  it("normalizes diagonals and blocks walls", () => {
    const { a } = pair(),
      b = structuredClone(a);
    move(a, { ...neutral(), moveX: 1 }, maps.FOREST_RUINS, [], 1 / 30);
    move(
      b,
      { ...neutral(), moveX: 1, moveY: 1 },
      maps.FOREST_RUINS,
      [],
      1 / 30,
    );
    expect(Math.hypot(b.x - 120, b.y - 430)).toBeCloseTo(a.x - 120);
    a.x = 430;
    a.y = 100;
    move(
      a,
      { ...neutral(), moveX: 1 },
      maps.FOREST_RUINS,
      maps.FOREST_RUINS.walls,
      0.1,
    );
    expect(a.x).toBe(437);
  });
  it("applies gravity and only jumps while grounded", () => {
    const { a } = pair();
    a.x = 100;
    a.y = 677;
    a.grounded = true;
    move(
      a,
      { ...neutral(), jumpHeld: true },
      maps.AIRSHIP,
      maps.AIRSHIP.walls,
      1 / 30,
    );
    expect(a.vy).toBeLessThan(0);
    const vy = a.vy;
    move(
      a,
      { ...neutral(), jumpHeld: true },
      maps.AIRSHIP,
      maps.AIRSHIP.walls,
      1 / 30,
    );
    expect(a.vy).toBeGreaterThan(vy);
  });
});
describe("authoritative gameplay", () => {
  it("requires both gate contributions and preserves completion", () => {
    const { r, a, b } = pair();
    a.x = 410;
    a.y = 400;
    input(r, a.id, { primaryHeld: true });
    r.tick();
    expect(r.state.puzzles.gate.complete).toBe(false);
    b.x = 410;
    b.y = 505;
    input(r, b.id, { interactHeld: true });
    r.tick();
    expect(r.state.puzzles.gate.complete).toBe(true);
    r.tick();
    expect(a.skillPoints).toBe(2);
  });
  it("enforces attack cooldown and expires projectiles", () => {
    const { r, a, b } = pair();
    a.x = 690;
    a.y = 380;
    input(r, a.id, { primaryHeld: true });
    r.tick();
    const hp = r.state.enemies.moss.hp;
    r.tick();
    expect(r.state.enemies.moss.hp).toBe(hp);
    input(r, b.id, { primaryHeld: true });
    r.tick();
    expect(Object.keys(r.state.projectiles)).toHaveLength(1);
    input(r, b.id, {});
    for (let n = 0; n < 60; n++) r.tick();
    expect(Object.keys(r.state.projectiles)).toHaveLength(0);
  });
  it("engine requires simultaneous roles and boss requires shield disruption", () => {
    const { r, a, b } = pair();
    r.transition("AIRSHIP");
    a.x = 1250;
    a.y = 677;
    b.x = 1390;
    b.y = 677;
    input(r, a.id, { interactHeld: true });
    for (let n = 0; n < 100; n++) r.tick();
    expect(r.state.puzzles.engine.complete).toBe(false);
    input(r, b.id, { interactHeld: true });
    for (let n = 0; n < 92; n++) r.tick();
    expect(r.state.puzzles.engine.complete).toBe(true);
    r.transition("AIRSHIP_BOSS");
    a.x = 950;
    a.y = 677;
    input(r, a.id, { primaryHeld: true });
    r.tick();
    expect(r.state.boss!.hp).toBe(220);
    b.x = 820;
    b.y = 677;
    input(r, b.id, { interactHeld: true });
    r.tick();
    expect(r.state.boss!.phase).toBe("VULNERABLE");
    r.state.boss!.hp = 1;
    r.state.boss!.shieldReturned = true;
    a.cooldowns.attack = 0;
    r.tick();
    expect(r.state.phase).toBe("COMPLETE");
  });
});
it("real Socket.IO clients create/join, reject malformed input, synchronize and resume", async () => {
  const app = createApp();
  await new Promise<void>((res) => app.http.listen(0, "127.0.0.1", res));
  const port = (app.http.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}`;
  const clients = [io(url), io(url), io(url)];
  const req = (s: (typeof clients)[number], e: string, p: unknown) =>
    new Promise<any>((res, rej) => {
      s.timeout(2000).emit(e, p, (err: Error, r: unknown) =>
        err ? rej(err) : res(r),
      );
    });
  try {
    await Promise.all(
      clients.map((s) => new Promise<void>((res) => s.on("connect", res))),
    );
    const sa = (await req(clients[0], "room:create", {})).data;
    const sb = (await req(clients[1], "room:join", { roomCode: sa.roomCode }))
      .data;
    expect(
      (await req(clients[2], "room:join", { roomCode: sa.roomCode })).ok,
    ).toBe(false);
    await req(clients[0], "role:select", { role: "OATH" });
    expect((await req(clients[1], "role:select", { role: "OATH" })).ok).toBe(
      false,
    );
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    const room = app.manager.get(sa.roomCode),
      start = room.state.players[sa.playerId].x;
    clients[0].emit("player:input", { ...neutral(1), moveX: 1 });
    await new Promise((res) => setTimeout(res, 120));
    expect(room.state.players[sa.playerId].x).toBeGreaterThan(start);
    expect(room.state.players[sa.playerId].lastProcessedInputSeq).toBe(1);
    clients[0].emit("player:input", {
      ...neutral(2),
      moveX: 999,
      x: 9000,
      hp: 9000,
    });
    await new Promise((res) => setTimeout(res, 40));
    expect(room.state.players[sa.playerId].lastProcessedInputSeq).toBe(1);
    const snapshots = await Promise.all(
      clients
        .slice(0, 2)
        .map((s) => new Promise<any>((res) => s.once("game:snapshot", res))),
    );
    expect(snapshots[0]).toEqual(snapshots[1]);
    clients[1].disconnect();
    await new Promise((res) => setTimeout(res, 30));
    expect((await req(clients[2], "session:resume", sb)).ok).toBe(true);
  } finally {
    clients.forEach((s) => s.disconnect());
    await app.close();
  }
});
