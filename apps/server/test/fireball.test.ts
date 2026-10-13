import { it, expect } from "vitest";
import { io } from "socket.io-client";
import { createApp } from "../src/app.js";
import { GameRoom } from "../src/GameRoom.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { fireballFrame } from "../../client/src/animation/projectile.js";
it("captures all four server-selected strengths at cast time", () => {
  const room = new GameRoom("ABC234", false, "FOREST_RUINS");
  const a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  const p = room.state.players[b.playerId];
  p.skillPoints = 3;
  for (let level = 1; level <= 4; level++) {
    if (level > 1) room.unlock(p.id, `fireball_${level}`);
    const release = room.sessions.get(p.id)!;
    release.input = neutral(level); release.received = Date.now(); room.tick();
    p.cooldowns.attack = 0;
    const session = room.sessions.get(p.id)!;
    session.input = { ...neutral(level), primaryHeld: true };
    session.received = Date.now();
    room.tick();
    const q = Object.values(room.state.projectiles).find(
      (q) => q.owner === p.id && q.fireballLevel === level,
    )!;
    expect(q).toBeDefined();
    expect(q.damage).toBe(20 + (level - 1) * 10);
    expect(Math.hypot(q.vx, q.vy)).toBeCloseTo(180);
    expect(fireballFrame(level, 0)).toBe((level - 1) * 9);
    expect(fireballFrame(level, 1170)).toBe((level - 1) * 9);
  }
  expect(p.skillPoints).toBe(0);
  expect(
    Object.values(room.state.projectiles).find((q) => q.fireballLevel === 1)
      ?.damage,
  ).toBe(20);
});
it("validates the fireball skill chain over real sockets and broadcasts identical strength to both clients", async () => {
  const app = createApp();
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const clients = [
    io(`http://127.0.0.1:${(app.http.address() as any).port}`),
    io(`http://127.0.0.1:${(app.http.address() as any).port}`),
  ];
  const req = (i: number, e: string, p: unknown) =>
    new Promise<any>((resolve, reject) =>
      clients[i]
        .timeout(2000)
        .emit(e, p, (err: Error, v: any) => (err ? reject(err) : resolve(v))),
    );
  try {
    await Promise.all(
      clients.map((c) => new Promise<void>((r) => c.on("connect", r))),
    );
    const a = (await req(0, "room:create", {})).data,
      b = (await req(1, "room:join", { roomCode: a.roomCode })).data;
    await req(0, "role:select", { role: "OATH" });
    await req(1, "role:select", { role: "EMBER" });
    await req(0, "lobby:ready", { ready: true });
    await req(1, "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode),
      p = room.state.players[b.playerId];
    p.skillPoints = 3;
    expect((await req(0, "skill:unlock", { nodeId: "fireball_2" })).ok).toBe(
      false,
    );
    expect((await req(1, "skill:unlock", { nodeId: "fireball_4" })).ok).toBe(
      false,
    );
    for (const level of [2, 3, 4])
      expect(
        (await req(1, "skill:unlock", { nodeId: `fireball_${level}` })).ok,
      ).toBe(true);
    expect((await req(1, "skill:unlock", { nodeId: "fireball_4" })).ok).toBe(
      false,
    );
    expect(p.skillPoints).toBe(0);
    // Intent enters through the validated input schema; no strength/damage supplied by clients.
    const samples = clients.map(
      (c) =>
        new Promise<any>((r) => {
          const listener = (w: any) => {
            if (
              Object.values(w.projectiles).some((q: any) => q.owner === p.id)
            ) {
              c.off("game:snapshot", listener);
              r(w);
            }
          };
          c.on("game:snapshot", listener);
        }),
    );
    clients[1].emit("player:input", { ...neutral(1), primaryHeld: true });
    const worlds = await Promise.all(samples);
    for (const w of worlds) {
      const q = Object.values(w.projectiles).find(
        (q: any) => q.owner === p.id,
      ) as any;
      expect(q.fireballLevel).toBe(4);
      expect(q.damage).toBe(50);
    }
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
});

it("casts once per press despite held or repeated input, and permits a new press after release", () => {
  const room = new GameRoom("ABC234", false, "FOREST_RUINS");
  const a = room.add("a"), b = room.add("b");
  room.select(a.playerId, "OATH"); room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true); room.ready(b.playerId, true);
  const p = room.state.players[b.playerId], session = room.sessions.get(p.id)!;
  let seq = 0;
  const press = (held: boolean) => {
    session.input = { ...neutral(++seq), primaryHeld: held };
    session.received = Date.now();
    room.tick();
  };
  press(true);
  const firstCast = p.combat!.seq;
  expect(Object.values(room.state.projectiles).filter(q => q.owner === p.id)).toHaveLength(1);
  for (let tick = 0; tick < 35; tick++) {
    press(true);
    expect(p.combat!.seq).toBe(firstCast);
  }
  const previousIds = new Set(Object.keys(room.state.projectiles));
  press(false); press(true);
  expect(p.combat!.seq).toBeGreaterThan(firstCast);
  expect(Object.values(room.state.projectiles).filter(q => q.owner === p.id && !previousIds.has(q.id))).toHaveLength(1);
});
