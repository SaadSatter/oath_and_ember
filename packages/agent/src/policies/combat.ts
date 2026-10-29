// Observation-only combat. Picks one action against the nearest visible enemy
// using only the hero's own observation: Sieg closes in and swings (120° arc,
// about 2.6 tiles of reach); Coco keeps her distance and fires along one of
// the eight aim directions when the enemy lies close to it.

import type { GameAction, Observation } from "../types.js";
import { directionTo, planStep } from "./navigate.js";

const OCTANT = Math.PI / 4;

export interface FightOptions {
  /** Only engage enemies within this many tiles. */
  radius?: number;
  /** Treat water as passable (Coco in flight). */
  flying?: boolean;
}

export function nearestEnemy(o: Observation, radius = Infinity) {
  return o.visible
    .filter((v) => v.kind === "enemy")
    .map((v) => ({ v, d: Math.hypot(v.x - o.self.x, v.y - o.self.y) }))
    .filter((e) => e.d <= radius)
    .sort((a, b) => a.d - b.d)[0];
}

/** One combat action, or null when no enemy is within reach of the plan. */
export function planFight(o: Observation, opts: FightOptions = {}): GameAction | null {
  const e = nearestEnemy(o, opts.radius ?? 12);
  if (!e) return null;
  const dx = e.v.x - o.self.x,
    dy = e.v.y - o.self.y;
  if (o.hero === "Sieg") {
    if (e.d > 1.9) {
      const step = planStep(o, { x: e.v.x, y: e.v.y }, { tolerance: 1.6, maxTicks: 20, flying: opts.flying });
      return step.kind === "move" ? { type: "move", direction: step.direction, ticks: step.ticks } : null;
    }
    return { type: "attack", direction: directionTo(dx, dy) };
  }
  // Coco: back off when crowded, line up along an aim direction, then fire.
  if (e.d < 2.5) {
    const away = directionTo(-dx, -dy);
    return { type: "move", direction: away, ticks: 12 };
  }
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / OCTANT) * OCTANT;
  const error = angle - snapped;
  if (Math.abs(error) * e.d <= 0.45 && e.d <= 9) return { type: "attack", direction: directionTo(dx, dy) };
  if (e.d > 9) {
    const step = planStep(o, { x: e.v.x, y: e.v.y }, { tolerance: 6, maxTicks: 20, flying: opts.flying });
    return step.kind === "move" ? { type: "move", direction: step.direction, ticks: step.ticks } : null;
  }
  // Sidestep across the snapped aim line until the enemy lies on it: n is the
  // unit normal of that line, c the enemy's signed offset from it (tiles).
  const nx = -Math.sin(snapped),
    ny = Math.cos(snapped);
  const c = dx * nx + dy * ny;
  return {
    type: "move",
    direction: directionTo(Math.sign(c) * nx, Math.sign(c) * ny),
    ticks: Math.max(2, Math.min(12, Math.round((Math.abs(c) * 32) / (190 / 60)))),
  };
}
