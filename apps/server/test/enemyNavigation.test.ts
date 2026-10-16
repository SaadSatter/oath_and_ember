import { expect, it } from "vitest";
import {
  steerTarget,
  bodyPathClear,
} from "../src/enemyNavigation.js";
import { GameRoom } from "../src/GameRoom.js";
import { tickEnemies } from "../src/enemySimulation.js";
import { spawnEnemy, enemyDefinitions } from "../../../packages/shared/src/enemies.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import { DT, ticksFor } from "../../../packages/shared/src/constants.js";
import type { Rect } from "../../../packages/shared/src/gameTypes.js";

const HALF = 14;
const overlaps = (p: { x: number; y: number }, r: Rect) =>
  p.x + HALF > r.x &&
  p.x - HALF < r.x + r.w &&
  p.y + HALF > r.y &&
  p.y - HALF < r.y + r.h;
// Walk a body toward the steering point the way the server moves enemies.
function chase(
  from: { x: number; y: number },
  to: { x: number; y: number },
  walls: Rect[],
  seconds: number,
) {
  const p = { ...from },
    trail = [{ ...p }];
  for (let n = 0; n < ticksFor(seconds); n++) {
    const goal = steerTarget(p, to, walls, 800, 600, HALF, HALF) ?? to;
    const dx = goal.x - p.x,
      dy = goal.y - p.y,
      len = Math.hypot(dx, dy) || 1,
      step = Math.min(len, 65 * DT);
    const nx = p.x + (dx / len) * step;
    if (!walls.some((r) => overlaps({ x: nx, y: p.y }, r))) p.x = nx;
    const ny = p.y + (dy / len) * step;
    if (!walls.some((r) => overlaps({ x: p.x, y: ny }, r))) p.y = ny;
    trail.push({ ...p });
    if (Math.hypot(p.x - to.x, p.y - to.y) < 30) break;
  }
  return { p, trail };
}

it("walks around a wall between it and the hero instead of pressing into it", () => {
  // A long wall with a gap only at its far southern end.
  const walls: Rect[] = [{ x: 380, y: 0, w: 40, h: 480 }];
  const { p, trail } = chase({ x: 200, y: 200 }, { x: 600, y: 200 }, walls, 25);
  expect(Math.hypot(p.x - 600, p.y - 200)).toBeLessThan(30);
  // It never overlapped the wall on the way, and had to detour south.
  expect(trail.every((q) => !walls.some((r) => overlaps(q, r)))).toBe(true);
  expect(Math.max(...trail.map((q) => q.y))).toBeGreaterThan(480);
});
it("goes straight when nothing is in the way, and keeps its approach when no route exists", () => {
  expect(steerTarget({ x: 100, y: 100 }, { x: 300, y: 100 }, [], 800, 600, HALF, HALF)).toEqual({
    x: 300,
    y: 100,
  });
  // Target fully boxed in: no route, so the caller keeps the direct approach.
  const box: Rect[] = [
    { x: 500, y: 100, w: 200, h: 20 },
    { x: 500, y: 280, w: 200, h: 20 },
    { x: 500, y: 100, w: 20, h: 200 },
    { x: 680, y: 100, w: 20, h: 200 },
  ];
  expect(steerTarget({ x: 100, y: 200 }, { x: 600, y: 200 }, box, 800, 600, HALF, HALF)).toBeNull();
  expect(bodyPathClear({ x: 100, y: 200 }, { x: 600, y: 200 }, box, HALF, HALF)).toBe(false);
});
it("routes identically for identical worlds", () => {
  const walls: Rect[] = [
    { x: 300, y: 100, w: 30, h: 400 },
    { x: 500, y: 0, w: 30, h: 380 },
  ];
  const a = chase({ x: 150, y: 300 }, { x: 700, y: 300 }, walls, 20),
    b = chase({ x: 150, y: 300 }, { x: 700, y: 300 }, walls, 20);
  expect(a.trail).toEqual(b.trail);
  expect(Math.hypot(a.p.x - 700, a.p.y - 300)).toBeLessThan(30);
});
it("server enemies close in on a hero they detect but cannot see, instead of standing still", () => {
  const r = new GameRoom("NAV234", true),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const w = r.state,
    [hero, other] = Object.values(w.players);
  other.x = 100;
  other.y = 100;
  // Find a spot on the map where a mossling in attack range has its view
  // blocked by a wall, then confirm it moves rather than freezing.
  const walls = collisionRects(w.sceneId, w.puzzles);
  const range = enemyDefinitions.mossling.attackRange;
  let placed = false;
  for (const wall of walls) {
    if (wall.terrain || wall.w < 30 || wall.h < 30) continue;
    const e = { x: wall.x - 15, y: wall.y + wall.h / 2 },
      p = { x: wall.x + wall.w + 15, y: e.y };
    if (Math.hypot(p.x - e.x, p.y - e.y) > range + 40) continue;
    const free = (q: { x: number; y: number }) =>
      !walls.some((r) => q.x + 14 > r.x && q.x - 14 < r.x + r.w && q.y + 12 > r.y && q.y - 12 < r.y + r.h);
    if (!free(e) || !free(p)) continue;
    // Only a wall the mossling can actually get around.
    const map = maps[w.sceneId],
      d = enemyDefinitions.mossling;
    const goal = steerTarget(e, p, walls, map.width, map.height, d.body.halfWidth, d.body.halfHeight);
    if (!goal || (goal.x === p.x && goal.y === p.y)) continue;
    w.enemies = { m: spawnEnemy("m", "mossling", e.x, e.y) };
    Object.assign(hero, p);
    placed = true;
    break;
  }
  expect(placed).toBe(true);
  const start = { x: w.enemies.m.x, y: w.enemies.m.y };
  for (let n = 0; n < ticksFor(1); n++) {
    w.serverTick++;
    tickEnemies(w, () => {});
  }
  expect(Math.hypot(w.enemies.m.x - start.x, w.enemies.m.y - start.y)).toBeGreaterThan(10);
});
