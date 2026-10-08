import { describe, it, expect } from "vitest";
import {
  spawnEnemy,
  enemyDefinitions,
  forestEncounter,
} from "../../../packages/shared/src/enemies.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { GameRoom } from "../src/GameRoom.js";
import { tickEnemies, damageEnemy } from "../src/enemySimulation.js";
function fixture() {
  const r = new GameRoom("ENE234", true),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const ps = Object.values(r.state.players);
  for (const p of ps) {
    p.x = 550;
    p.y = 450;
  }
  r.state.enemies = { test: spawnEnemy("test", "mossling", 800, 450) };
  return { r, w: r.state, a: ps[0], b: ps[1], e: r.state.enemies.test };
}
const step = (f: ReturnType<typeof fixture>, n = 1) => {
  for (let i = 0; i < n; i++) {
    f.w.serverTick++;
    tickEnemies(f.w, (p, d) => f.r.damage(p, d));
  }
};
describe("deterministic authoritative enemy architecture", () => {
  it("spawns unique IDs and typed full-health instances", () => {
    const r = new GameRoom("ENE234", true);
    expect(Object.keys(r.state.enemies)).toHaveLength(4);
    for (const spec of forestEncounter)
      expect(r.state.enemies[spec.id]).toMatchObject({
        type: spec.type,
        hp: enemyDefinitions[spec.type].maxHp,
        state: "IDLE",
      });
  });
  it("idles without detectable living connected players", () => {
    const f = fixture();
    f.a.x = f.b.x = 100;
    step(f);
    expect(f.e.state).toBe("IDLE");
    expect(f.e.x).toBe(800);
    f.a.x = 700;
    f.a.connected = false;
    f.b.hp = 0;
    step(f);
    expect(f.e.targetId).toBeNull();
  });
  it("detects, chases and faces the server-selected nearest player", () => {
    const f = fixture();
    f.a.x = 650;
    f.b.x = 600;
    step(f);
    expect(f.e.targetId).toBe(f.a.id);
    expect(f.e.state).toBe("CHASE");
    expect(f.e.x).toBeCloseTo(800 - 65 / 30);
    expect(f.e.facing).toBeCloseTo(Math.PI);
  });
  it("retains nearly tied targets and switches for meaningful distance differences", () => {
    const f = fixture();
    f.a.x = 700;
    f.b.x = 680;
    step(f);
    f.b.x = 710;
    step(f);
    expect(f.e.targetId).toBe(f.a.id);
    f.b.x = 760;
    step(f);
    expect(f.e.targetId).toBe(f.b.id);
  });
  it("blocks collision instead of traversing a closed gate", () => {
    const f = fixture();
    f.w.puzzles.gate.complete = false;
    f.e.x = 505;
    f.e.y = 450;
    f.a.x = f.b.x = 400;
    step(f, 60);
    expect(f.e.x).toBeGreaterThanOrEqual(499);
  });
  it("telegraphs melee, checks resolution range, and enforces cooldown", () => {
    const f = fixture();
    f.a.x = 775;
    f.b.x = 550;
    step(f);
    expect(f.e.state).toBe("ATTACK");
    expect(f.a.hp).toBe(100);
    step(f, 12);
    expect(f.a.hp).toBe(90);
    step(f, 29);
    expect(f.a.hp).toBe(90);
    step(f);
    expect(f.e.attackSeq).toBe(2);
    step(f, 12);
    expect(f.a.hp).toBe(80);
  });
  it("allows a hero to evade a melee windup", () => {
    const f = fixture();
    f.a.x = 775;
    step(f);
    f.a.x = 650;
    step(f, 12);
    expect(f.a.hp).toBe(100);
  });
  it("clamps damage, records death, cancels attack and despawns after 30 ticks", () => {
    const f = fixture();
    f.a.x = 775;
    step(f);
    damageEnemy(f.e, 999, f.w.serverTick);
    expect(f.e).toMatchObject({
      hp: 0,
      state: "DEAD",
      targetId: null,
      attackStartedTick: null,
    });
    step(f, 29);
    expect(f.w.enemies.test).toBeDefined();
    step(f);
    expect(f.w.enemies.test).toBeUndefined();
    expect(f.a.hp).toBe(100);
  });
  it("configures basic Mossling and slow durable high-damage Sentinel", () => {
    const m = enemyDefinitions.mossling,
      s = enemyDefinitions.ironbound_sentinel;
    expect(m.attack).toBe("melee");
    expect(s.speed).toBeLessThan(m.speed);
    expect(s.maxHp).toBeGreaterThan(m.maxHp * 2);
    expect(s.damage).toBeGreaterThan(m.damage);
    expect(s.cooldownTicks).toBeGreaterThan(m.cooldownTicks);
  });
  it("Wisp retreats at close range and fires an authoritative aimed projectile", () => {
    const f = fixture();
    f.e = f.w.enemies.test = spawnEnemy("test", "cinder_wisp", 800, 450);
    f.a.x = 720;
    step(f);
    expect(f.e.x).toBeGreaterThan(800);
    expect(f.e.state).toBe("CHASE");
    f.a.x = 600;
    step(f);
    expect(f.e.state).toBe("ATTACK");
    step(f, 18);
    const q = Object.values(f.w.projectiles)[0];
    expect(q).toMatchObject({ owner: "test", faction: "enemies", damage: 12 });
    expect(q.vx).toBeLessThan(0);
  });
  it("Sieg sword and upgraded heavy use the generic enemy damage path", () => {
    const f = fixture();
    f.e.x = 600;
    const session = f.r.sessions.get(f.a.id)!;
    session.input = { ...neutral(1), primaryHeld: true };
    session.received = Date.now();
    f.r.tick();
    expect(f.e.hp).toBe(35);
  });
  it("Coco projectile hits once and cannot damage players", () => {
    const f = fixture();
    f.e.x = 650;
    f.a.x = 600;
    f.w.projectiles.q = {
      id: "q",
      x: 600,
      y: 450,
      vx: 420,
      vy: 0,
      life: 2,
      owner: f.b.id,
    };
    for (let i = 0; i < 4; i++) f.r.tick();
    expect(f.e.hp).toBe(40);
    expect(f.a.hp).toBe(100);
    expect(f.w.projectiles.q).toBeUndefined();
  });
  it("enemy projectile damages players once, never allies", () => {
    const f = fixture();
    f.e.x = 600;
    f.w.projectiles.q = {
      id: "q",
      x: 600,
      y: 450,
      vx: -180,
      vy: 0,
      life: 2,
      owner: f.e.id,
      faction: "enemies",
      damage: 12,
    };
    for (let i = 0; i < 7; i++) f.r.tick();
    expect(f.e.hp).toBe(60);
    expect(f.a.hp).toBe(88);
    expect(f.b.hp).toBe(100);
    expect(f.w.projectiles.q).toBeUndefined();
  });
  it("projectile cannot tunnel through walls", () => {
    const f = fixture();
    f.w.puzzles.gate.complete = false;
    f.a.x = 400;
    f.w.projectiles.q = {
      id: "q",
      x: 500,
      y: 450,
      vx: -1800,
      vy: 0,
      life: 2,
      owner: "test",
      faction: "enemies",
      damage: 12,
    };
    f.r.tick();
    expect(f.a.hp).toBe(100);
    expect(f.w.projectiles.q).toBeUndefined();
  });
  it("identical initial state and tick input produce identical enemy state", () => {
    const f = fixture(),
      w = structuredClone(f.w);
    for (let i = 0; i < 100; i++) {
      f.w.serverTick++;
      w.serverTick++;
      tickEnemies(f.w, () => {});
      tickEnemies(w, () => {});
    }
    expect(w.enemies).toEqual(f.w.enemies);
    expect(w.projectiles).toEqual(f.w.projectiles);
  });
});

it("two real clients receive identical typed authoritative states, attacks, health, death and despawn at matched ticks", async () => {
  const { createApp } = await import("../src/app.js"),
    { io } = await import("socket.io-client");
  const app = createApp({ encounter: true });
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const clients = [
    io(`http://127.0.0.1:${(app.http.address() as any).port}`),
    io(`http://127.0.0.1:${(app.http.address() as any).port}`),
  ];
  const req = (s: any, event: string, p: any) =>
    new Promise<any>((resolve, reject) =>
      s
        .timeout(2000)
        .emit(event, p, (err: any, r: any) => (err ? reject(err) : resolve(r))),
    );
  const histories = clients.map(() => new Map<number, any>());
  clients.forEach((s, i) =>
    s.on("game:snapshot", (w) => histories[i].set(w.serverTick, w)),
  );
  try {
    await Promise.all(
      clients.map((s) => new Promise<void>((r) => s.on("connect", r))),
    );
    const a = (await req(clients[0], "room:create", {})).data;
    await req(clients[1], "room:join", { roomCode: a.roomCode });
    await req(clients[0], "role:select", { role: "OATH" });
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode),
      e = room.state.enemies.moss,
      p = room.state.players[a.playerId];
    e.x = p.x + 25;
    e.y = p.y;
    await new Promise((r) => setTimeout(r, 600));
    damageEnemy(e, 999, room.state.serverTick);
    await new Promise((r) => setTimeout(r, 1200));
    const shared = [...histories[0].keys()].filter((t) => histories[1].has(t));
    expect(shared.length).toBeGreaterThan(15);
    for (const t of shared)
      expect(histories[0].get(t)).toEqual(histories[1].get(t));
    const states = shared.map((t) => histories[0].get(t));
    expect(states.some((w) => w.enemies.moss?.state === "ATTACK")).toBe(true);
    expect(states.some((w) => w.players[a.playerId].hp < 100)).toBe(true);
    expect(
      states.some(
        (w) => w.enemies.moss?.state === "DEAD" && w.enemies.moss.hp === 0,
      ),
    ).toBe(true);
    expect(states.some((w) => !w.enemies.moss)).toBe(true);
  } finally {
    clients.forEach((s) => s.disconnect());
    await app.close();
  }
});
