import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { tickEnemies, damageEnemy } from "../src/enemySimulation.js";
import { tickGolemBeam, GOLEM_BLAST_RADIUS } from "../src/golemBeam.js";
import {
  spawnEnemy,
  enemyDefinitions,
} from "../../../packages/shared/src/enemies.js";
import type { Projectile } from "../../../packages/shared/src/gameTypes.js";
import { ticksFor } from "../../../packages/shared/src/constants.js";
function setup() {
  const r = new GameRoom("ABC234", false, "FOREST_RUINS"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const w = r.state,
    s = w.players[a.playerId],
    c = w.players[b.playerId],
    e = spawnEnemy("golem", "ironbound_sentinel", 800, 450);
  w.enemies = { golem: e };
  Object.assign(s, { x: 600, y: 450 });
  Object.assign(c, { x: 600, y: 505 });
  return { r, w, s, c, e };
}
function beam(g: ReturnType<typeof setup>, patch: Partial<Projectile> = {}) {
  Object.assign(g.e, {
    x: 800,
    y: 450,
    attackFacing: Math.atan2(45, -168),
    attackKind: "beam",
    state: "ATTACK",
    attackStartedTick: 0,
  });
  const q: Projectile = {
    id: "beam",
    owner: g.e.id,
    faction: "enemies",
    effect: "golem_beam",
    sceneId: "FOREST_RUINS",
    x: 768,
    y: 405,
    vx: -400,
    vy: 0,
    life: 2,
    damage: 28,
    radius: 6,
    beamOrigin: { x: 768, y: 405 },
    beamDamaged: [],
    ...patch,
  };
  g.w.projectiles[q.id] = q;
  return q;
}
function shotTick(g: ReturnType<typeof setup>, q: Projectile) {
  tickGolemBeam(g.w, q, (p, n) => g.r.damage(p, n));
}
it("charges, locks its palm aim, and holds a continuous beam without duplicating shots", () => {
  const g = setup();
  g.w.serverTick++;
  tickEnemies(g.w, () => {});
  const facing = g.e.attackFacing;
  Object.assign(g.s, { x: 700, y: 600 });
  for (let n = 0; n < enemyDefinitions.ironbound_sentinel.windupTicks - 1; n++) {
    g.w.serverTick++;
    tickEnemies(g.w, () => {});
  }
  expect(g.w.projectiles).toEqual({});
  g.w.serverTick++;
  tickEnemies(g.w, () => {});
  const q = Object.values(g.w.projectiles)[0];
  expect(q.effect).toBe("golem_beam");
  expect(q.beamOrigin).toEqual({ x: 768, y: 405 });
  expect(g.e.attackFacing).toBe(facing);
  for (let n = 0; n < ticksFor(0.667); n++) {
    g.w.serverTick++;
    tickEnemies(g.w, () => {});
    shotTick(g, q);
  }
  expect(Object.keys(g.w.projectiles)).toHaveLength(1);
  expect(g.e.state).toBe("ATTACK");
  expect(q.life).toBeGreaterThan(1);
  damageEnemy(g.e, 999, g.w.serverTick);
  shotTick(g, q);
  expect(g.w.projectiles[q.id]).toBeUndefined();
});
it("ends at first contact and applies its two-tile area damage only once per hero per burst", () => {
  const g = setup(),
    q = beam(g);
  shotTick(g, q);
  expect(GOLEM_BLAST_RADIUS).toBe(64);
  expect(g.s.hp).toBe(72);
  expect(g.c.hp).toBe(72);
  expect(g.w.projectiles[q.id]).toBeDefined();
  expect(q.beamContact).toBe(`player:${g.s.id}`);
  expect(g.w.projectileImpacts).toHaveLength(1);
  for (let n = 0; n < ticksFor(0.667); n++) shotTick(g, q);
  expect(g.s.hp).toBe(72);
  expect(g.c.hp).toBe(72);
  expect(g.w.projectileImpacts).toHaveLength(1);
});
it("excludes disconnected, dead, distant or other-scene players from endpoint area damage", () => {
  for (const patch of [
    { y: 600 },
    { connected: false },
    { hp: 0 },
    { sceneId: "HEDGE_MAZE" as const },
  ]) {
    const g = setup();
    Object.assign(g.c, patch);
    const hp = g.c.hp,
      q = beam(g);
    shotTick(g, q);
    expect(g.c.hp).toBe(hp);
  }
});
it("clips its continuous ray against walls and prevents blast damage through them", () => {
  const g = setup();
  Object.assign(g.s, { x: 1100, y: 600 });
  Object.assign(g.c, { x: 1010, y: 620 });
  const q = beam(g);
  Object.assign(g.e, { x: 868, y: 645, attackFacing: 0 });
  shotTick(g, q);
  expect(q.beamOrigin).toEqual({ x: 900, y: 600 });
  expect(q.x).toBeCloseTo(1044);
  expect(g.s.hp).toBe(100);
  expect(g.c.hp).toBe(72);
  expect(g.w.projectiles[q.id]).toBeDefined();
});
it("Slow Time scales the charge and continuous duration while the palm remains attached", () => {
  const g = setup();
  g.w.slowTime = { owner: g.c.id, startedTick: 0, endsTick: ticksFor(10) };
  for (let n = 0; n < ticksFor(1.2); n++) {
    g.w.serverTick++;
    tickEnemies(g.w, () => {});
  }
  expect(g.w.projectiles).toEqual({});
  const q = beam(g);
  shotTick(g, q);
  expect(q.life).toBeCloseTo(2 - 1 / 150);
  expect(q.beamAge).toBeCloseTo(1 / 150);
  g.e.x += 10;
  shotTick(g, q);
  expect(q.beamOrigin!.x).toBe(778);
});
it("expires after the burst and gives the owner a cooldown", () => {
  const g = setup(),
    q = beam(g, { life: 0.001 });
  shotTick(g, q);
  expect(g.w.projectiles[q.id]).toBeUndefined();
  expect(g.e.attackStartedTick).toBeNull();
  expect(g.e.nextAttackTick).toBeGreaterThan(g.w.serverTick);
});
it("synchronizes the charged beam, impact position and area damage to both real clients", async () => {
  const { createApp } = await import("../src/app.js"),
    { io } = await import("socket.io-client");
  const app = createApp({ startingScene: "FOREST_RUINS" });
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(app.http.address() as any).port}`,
    clients = [io(url), io(url)],
    histories = clients.map(() => new Map<number, any>());
  clients.forEach((c, i) =>
    c.on("game:snapshot", (w) => histories[i].set(w.serverTick, w)),
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
    Object.assign(room.state.players[a.playerId], { x: 600, y: 450 });
    Object.assign(room.state.players[b.playerId], { x: 600, y: 505 });
    room.state.enemies = {
      golem: spawnEnemy("golem", "ironbound_sentinel", 800, 450),
    };
    for (
      let n = 0;
      n < 35 &&
      !room.state.projectileImpacts?.some((i) => i.effect === "golem_blast");
      n++
    )
      await new Promise((r) => setTimeout(r, 80));
    await new Promise((r) => setTimeout(r, 100));
    const ticks = [...histories[0].keys()].filter((t) => histories[1].has(t));
    expect(
      ticks.some((t) =>
        Object.values(histories[0].get(t).projectiles).some(
          (q: any) => q.effect === "golem_beam",
        ),
      ),
    ).toBe(true);
    const hits = ticks.filter((t) =>
      histories[0]
        .get(t)
        .projectileImpacts?.some((i: any) => i.effect === "golem_blast"),
    );
    expect(hits.length).toBeGreaterThan(0);
    for (const t of hits) {
      const one = histories[0].get(t),
        two = histories[1].get(t);
      expect(one.projectileImpacts).toEqual(two.projectileImpacts);
      expect(one.players[a.playerId].hp).toBe(72);
      expect(one.players[b.playerId].hp).toBe(72);
      expect(one.players).toEqual(two.players);
    }
    // The same protocol publishes the close-range mode and its single authoritative hit.
    const s = room.state.players[a.playerId],
      c = room.state.players[b.playerId];
    Object.assign(s, { x: 760, y: 450, hp: 100 });
    Object.assign(c, { x: 600, y: 600 });
    room.state.enemies = {
      golem: spawnEnemy("golem", "ironbound_sentinel", 800, 450),
    };
    for (let n = 0; n < 15 && s.hp === 100; n++)
      await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 80));
    expect(s.hp).toBe(72);
    const melee = [...histories[0].keys()].filter(
      (t) =>
        histories[1].has(t) &&
        histories[0].get(t).enemies.golem?.attackKind === "melee",
    );
    expect(melee.length).toBeGreaterThan(0);
    for (const t of melee) {
      const one = histories[0].get(t),
        two = histories[1].get(t);
      expect(one.enemies).toEqual(two.enemies);
      expect(one.players).toEqual(two.players);
    }
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
}, 15000);

it("interrupts an active continuous beam for a fresh close-range melee attack", () => {
  const g = setup(),
    q = beam(g);
  Object.assign(g.s, { x: 760, y: 450 });
  g.w.serverTick++;
  tickEnemies(g.w, () => {});
  expect(g.w.projectiles[q.id]).toBeUndefined();
  expect(g.e.attackKind).toBe("melee");
  expect(g.e.attackStartedTick).toBe(g.w.serverTick);
});
