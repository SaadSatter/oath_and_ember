import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { tickEnemies, damageEnemy } from "../src/enemySimulation.js";
import {
  spawnEnemy,
  golemMelee,
} from "../../../packages/shared/src/enemies.js";
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
  Object.assign(s, { x: 760, y: 450 });
  Object.assign(c, { x: 600, y: 600 });
  const hits: string[] = [];
  function step(n = 1) {
    for (let k = 0; k < n; k++) {
      w.serverTick++;
      tickEnemies(w, (p, d) => {
        hits.push(p.id);
        r.damage(p, d);
      });
    }
  }
  return { r, w, s, c, e, hits, step };
}
it("chooses close-range melee, hits once at contact, and completes the full punch before its cooldown", () => {
  const g = setup();
  g.step();
  expect(g.e.attackKind).toBe("melee");
  g.step(golemMelee.hitTicks - 1);
  expect(g.s.hp).toBe(100);
  g.step();
  expect(g.s.hp).toBe(72);
  expect(g.e.state).toBe("ATTACK");
  g.step(golemMelee.durationTicks - golemMelee.hitTicks);
  expect(g.e.state).toBe("CHASE");
  expect(g.hits).toEqual([g.s.id]);
  expect(g.w.projectiles).toEqual({});
  g.step(golemMelee.cooldownTicks - 1);
  expect(g.e.state).toBe("CHASE");
  g.step();
  expect(g.e.attackKind).toBe("melee");
  expect(g.e.state).toBe("ATTACK");
});
it("interrupts an unfinished beam charge when a hero rushes into melee range, with a fresh punch windup", () => {
  const g = setup();
  g.s.x = 600;
  g.step(ticksFor(0.667));
  expect(g.e.attackKind).toBe("beam");
  g.s.x = 760;
  g.step();
  expect(g.e.attackKind).toBe("melee");
  expect(g.e.attackStartedTick).toBe(g.w.serverTick);
  g.step(golemMelee.hitTicks - 1);
  expect(g.s.hp).toBe(100);
  g.step();
  expect(g.s.hp).toBe(72);
  expect(g.w.projectiles).toEqual({});
});
it("lets players dodge out of range or behind the locked punch direction", () => {
  for (const x of [700, 840]) {
    const g = setup();
    g.step();
    g.s.x = x;
    g.step(golemMelee.durationTicks);
    expect(g.s.hp).toBe(100);
    expect(g.hits).toEqual([]);
  }
});
it("keeps ranged attacks when the next attack target moves away", () => {
  const g = setup();
  g.step(ticksFor(0.833));
  g.s.x = 600;
  g.step(ticksFor(1));
  expect(g.e.attackKind).toBe("beam");
  g.step(ticksFor(1.2));
  expect(Object.values(g.w.projectiles)[0]?.effect).toBe("golem_beam");
});
it("prioritizes the adjacent hero over a retained distant beam target", () => {
  const g = setup();
  g.s.x = 600;
  g.step();
  Object.assign(g.c, { x: 800, y: 490 });
  g.step();
  expect(g.e.targetId).toBe(g.c.id);
  expect(g.e.attackKind).toBe("melee");
});
it("does not punch through a wall, hit disconnected heroes, or continue after death", () => {
  const g = setup();
  g.step();
  g.s.connected = false;
  g.step(golemMelee.durationTicks);
  expect(g.s.hp).toBe(100);
  const dead = setup();
  dead.step();
  damageEnemy(dead.e, 999, dead.w.serverTick);
  dead.step(golemMelee.durationTicks);
  expect(dead.hits).toEqual([]);
  const wall = setup();
  Object.assign(wall.e, { x: 1030, y: 600 });
  Object.assign(wall.s, { x: 1070, y: 600 });
  wall.step(ticksFor(2));
  expect(wall.hits).toEqual([]);
});
it("slows punch contact and recovery with Slow Time", () => {
  const g = setup();
  g.w.slowTime = { owner: g.c.id, startedTick: 0, endsTick: ticksFor(10) };
  g.step(ticksFor(0.433));
  expect(g.s.hp).toBe(100);
  g.step(ticksFor(1.667));
  expect(g.s.hp).toBe(72);
  expect(g.e.state).toBe("ATTACK");
  expect(g.hits).toHaveLength(1);
});
