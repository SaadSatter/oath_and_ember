// Observation-only navigation. Plans a short move from one hero's own screen
// grid (observation.screen) toward a target in tile coordinates. It reads
// nothing but the observation, so the scripted route and the quest-aware
// baseline can both use it without touching the engine.

import type { Direction, Observation } from "../types.js";

/**
 * The observation as the scripted route and quest baseline were tuned on it:
 * `self` to one decimal. Since 2026-10-28 (pilot-6 fix 3) the interface gives
 * `self` truncated to two decimals; the scripted players round it back here so
 * their frozen behaviour, and the S2-S4 start states the route builds, stay
 * identical. A policy-side choice: every player still gets the same
 * observation. Rounds half up from the hundredths. This equals the earlier
 * round1 of the raw position for every position tested, including 60,540
 * positions reached by walking, slowed, sprinting and diagonal steps
 * (asTuned.test.ts). One theoretical window remains: a value stored as the
 * double just below a decimal x.x5 boundary (within about 1e-14 tile, e.g.
 * 1.45, stored as 1.4499…), where round1 rounded up but the truncated
 * hundredths no longer can. The frozen route and baseline runs are pinned in
 * scriptedFreeze.test.ts.
 */
export function asTuned(o: Observation): Observation {
  const one = (v: number) => Math.floor((Math.round(v * 100) + 5) / 10) / 10;
  return { ...o, self: { ...o.self, x: one(o.self.x), y: one(o.self.y) } };
}

/** Walking speed in tiles per tick: SPEED 190 px/s over 32 px tiles at 60 Hz. */
export const WALK_TILES_PER_TICK = 190 / 32 / 60;

const DIRS: [Direction, number, number][] = [
  ["e", 1, 0],
  ["w", -1, 0],
  ["s", 0, 1],
  ["n", 0, -1],
  ["ne", 1, -1],
  ["nw", -1, -1],
  ["se", 1, 1],
  ["sw", -1, 1],
];

export interface Point {
  x: number;
  y: number;
}

export interface NavOptions {
  /** Treat "~" (water or gap) as passable, for Coco in flight. */
  flying?: boolean;
  /** Arrival tolerance in tiles. */
  tolerance?: number;
  /** Tiles per tick to assume when converting distance into ticks. */
  speed?: number;
  /** Most ticks one move may last (the interface allows 60). */
  maxTicks?: number;
  /** Extra cells to treat as blocked (absolute tile coordinates). */
  avoid?: Point[];
}

export type NavStep =
  | { kind: "arrived" }
  | { kind: "move"; direction: Direction; ticks: number }
  | { kind: "stuck"; reason: string };

/** The hero's view as a lookup of absolute tile cells. */
export function screenCells(o: Observation) {
  const { originX, originY, rows } = o.screen;
  const at = (x: number, y: number) => rows[y - originY]?.[x - originX];
  return { originX, originY, width: rows[0]?.length ?? 0, height: rows.length, at };
}

const passable = (ch: string | undefined, flying: boolean) =>
  ch !== undefined && ch !== "#" && ch !== " " && (flying || ch !== "~");

export function directionTo(dx: number, dy: number): Direction {
  const a = Math.atan2(dy, dx);
  const i = Math.round(a / (Math.PI / 4));
  return (["e", "se", "s", "sw", "w", "nw", "n", "ne"] as Direction[])[(i + 8) % 8];
}

/**
 * Next move toward `target`. Searches the visible grid (8-way, no corner
 * cutting); when the target is off screen it heads for the visible cell that
 * best trades path length against straight-line distance to the target.
 */
export function planStep(o: Observation, target: Point, opts: NavOptions = {}): NavStep {
  const tolerance = opts.tolerance ?? 0.25;
  const speed = opts.speed ?? WALK_TILES_PER_TICK;
  const maxTicks = opts.maxTicks ?? 60;
  const flying = !!opts.flying;
  const me = { x: o.self.x, y: o.self.y };
  const dx = target.x - me.x,
    dy = target.y - me.y,
    dist = Math.hypot(dx, dy);
  if (dist <= tolerance) return { kind: "arrived" };

  const grid = screenCells(o);
  const avoid = new Set((opts.avoid ?? []).map((p) => `${Math.floor(p.x)},${Math.floor(p.y)}`));
  const open = (x: number, y: number) => passable(grid.at(x, y), flying) && !avoid.has(`${x},${y}`);
  const start = { x: Math.floor(me.x), y: Math.floor(me.y) };
  const goal = { x: Math.floor(target.x), y: Math.floor(target.y) };

  // Close and in the same or a neighbouring open cell: go straight there,
  // unless that would cut the corner of a blocked cell.
  const gx = goal.x - start.x,
    gy = goal.y - start.y;
  const cornerFree = !(gx && gy) || (open(start.x + gx, start.y) && open(start.x, start.y + gy));
  if (Math.max(Math.abs(gx), Math.abs(gy)) <= 1 && open(goal.x, goal.y) && cornerFree)
    return { kind: "move", direction: directionTo(dx, dy), ticks: Math.max(1, Math.min(maxTicks, Math.round(dist / speed))) };

  // Breadth-first search over visible cells.
  const key = (x: number, y: number) => `${x},${y}`;
  const prev = new Map<string, string | null>([[key(start.x, start.y), null]]);
  const dist0 = new Map<string, number>([[key(start.x, start.y), 0]]);
  const queue: Point[] = [start];
  let best: Point | undefined,
    bestScore = Infinity;
  const inView = (x: number, y: number) =>
    x >= grid.originX && y >= grid.originY && x < grid.originX + grid.width && y < grid.originY + grid.height;
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const d = dist0.get(key(c.x, c.y))!;
    if (c.x === goal.x && c.y === goal.y) {
      best = c;
      bestScore = -1;
      break;
    }
    const score = d + 1.5 * Math.hypot(goal.x - c.x, goal.y - c.y);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
    for (const [, sx, sy] of DIRS) {
      const nx = c.x + sx,
        ny = c.y + sy;
      if (!inView(nx, ny) || prev.has(key(nx, ny)) || !open(nx, ny)) continue;
      if (sx && sy && (!open(c.x + sx, c.y) || !open(c.x, c.y + sy))) continue;
      prev.set(key(nx, ny), key(c.x, c.y));
      dist0.set(key(nx, ny), d + (sx && sy ? Math.SQRT2 : 1));
      queue.push({ x: nx, y: ny });
    }
  }
  if (!best || (best.x === start.x && best.y === start.y)) {
    // Nothing better is visible: try the straight line (the grid is coarse).
    return { kind: "move", direction: directionTo(dx, dy), ticks: Math.max(1, Math.min(maxTicks, 20, Math.round(dist / speed))) };
  }
  // Path from start to best; follow it while the direction stays the same.
  const path: Point[] = [];
  for (let k: string | null | undefined = key(best.x, best.y); k && k !== key(start.x, start.y); k = prev.get(k)) {
    const [x, y] = k.split(",").map(Number);
    path.unshift({ x, y });
  }
  // Step 1: from the exact position to the centre of the first cell.
  const first = path[0];
  const firstDir = directionTo(first.x + 0.5 - me.x, first.y + 0.5 - me.y);
  // Extend while successive cells keep that direction.
  let end = first;
  for (let j = 1; j < path.length && j < 6; j++) {
    const step = directionTo(path[j].x - path[j - 1].x, path[j].y - path[j - 1].y);
    if (step !== firstDir) break;
    end = path[j];
  }
  // If the last cell is the goal cell, aim at the exact target instead.
  const aim = end.x === goal.x && end.y === goal.y ? target : { x: end.x + 0.5, y: end.y + 0.5 };
  const d = Math.hypot(aim.x - me.x, aim.y - me.y);
  return { kind: "move", direction: firstDir, ticks: Math.max(1, Math.min(maxTicks, Math.round(d / speed))) };
}
