// How far a move action actually carried the hero, compared with how far the
// same input would have carried them on open ground (owner approval
// 2026-10-28, after pilot-6; audit
// docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-pilot6-fixes.md,
// finding 2).
//
// A human player sees their hero stop against a hedge, a wall or a creature.
// Before this, a blocked move came back accepted with the full tick count and
// no feedback, so it looked exactly like a successful one.
//
// The open-ground distance is not a second speed formula: each tick it replays
// the engine's own shared kinematics (stepMovement) on a copy of the hero, with
// the same input and Slow Time flag, no obstacles and no map edge. Super
// Speed, Slow Time and Sieg's exception to it therefore count exactly as the
// server counts them. The copy is thrown away; the room is never touched.
// Reports never name what stopped the hero.

import { DT } from "../../shared/src/constants.js";
import type { InputFrame, Player } from "../../shared/src/gameTypes.js";
import type { MapDefinition } from "../../shared/src/maps.js";
import { stepMovement } from "../../shared/src/movement.js";
import { TILE, truncate2, vectorOf } from "./perception.js";
import type { Direction, MovementReport } from "./types.js";

/** Far from every map edge, so the replay is never clamped. */
const OPEN = 1e6;

/** World units the hero would cover in one tick on open ground with this input. */
export function openGroundStep(player: Player, frame: Partial<InputFrame>, map: MapDefinition, slowTime: boolean): number {
  const copy = structuredClone(player);
  copy.x = player.x + OPEN;
  copy.y = player.y + OPEN;
  const open: MapDefinition = { ...map, width: 4 * OPEN, height: 4 * OPEN, gaps: [] };
  stepMovement(copy, { ...frame } as InputFrame, open, [], DT, slowTime);
  return Math.hypot(copy.x - player.x - OPEN, copy.y - player.y - OPEN);
}

/** Below this the hero did not visibly move (a fiftieth of a tile, under one pixel). */
export const STILL_TILES = 0.02;
/** A move that covered at least this share of its open-ground distance counts as full. */
export const FULL_SHARE = 0.9;

const round2 = (n: number) => Math.round(n * 100) / 100;
const at = (q: { x: number; y: number }) => `(${truncate2(q.x / TILE)}, ${truncate2(q.y / TILE)})`;

/**
 * The movement outcome of one finished move. `movedTiles` is progress along
 * the requested direction (a sideways slide off a corner does not count as
 * progress); `requestedTiles` is the open-ground distance for the ticks that
 * actually ran.
 */
export function movementReport(
  direction: Direction,
  from: { x: number; y: number },
  to: { x: number; y: number },
  openGround: number,
): MovementReport {
  const v = vectorOf[direction],
    n = Math.hypot(v.x, v.y);
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const progress = Math.max(0, (dx * v.x + dy * v.y) / n);
  const displaced = Math.hypot(dx, dy) / TILE;
  const outcome =
    displaced < STILL_TILES ? "none" : openGround > 0 && progress >= FULL_SHARE * openGround ? "full" : "partial";
  return {
    outcome,
    movedTiles: round2(progress / TILE),
    requestedTiles: round2(openGround / TILE),
    from: { x: truncate2(from.x / TILE), y: truncate2(from.y / TILE) },
    to: { x: truncate2(to.x / TILE), y: truncate2(to.y / TILE) },
  };
}

/**
 * The feedback line for a move that fell short, or nothing for a full move
 * (a full move adds no line, so a batch of clear moves is not stopped) and
 * for a move that could not have gone anywhere even on open ground.
 */
export function movementLine(direction: Direction, r: MovementReport, from: { x: number; y: number }, to: { x: number; y: number }): string | undefined {
  if (r.outcome === "full" || r.requestedTiles < STILL_TILES) return;
  return r.outcome === "none"
    ? `You did not move ${direction} (0 of ${r.requestedTiles} tiles); you are still at ${at(to)}. Something blocked your way.`
    : `You moved ${direction} only ${r.movedTiles} of ${r.requestedTiles} tiles, from ${at(from)} to ${at(to)}. Something stopped you.`;
}
