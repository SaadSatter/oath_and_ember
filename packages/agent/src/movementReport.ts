// How far a move action carried the hero by its own walking, compared with how
// far the same input would have carried them on open ground (owner approval
// 2026-10-28, after pilot-6; audits
// docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-pilot6-fixes.md
// and 2026-10-28-adapter-pilot6-review-fixes.md).
//
// A human player sees their hero stop against a hedge, a wall or a creature;
// sees them not respond while a scene holds them; and sees them carried or put
// somewhere by the game. Before this, a blocked move came back accepted with the
// full tick count and no feedback, so it looked exactly like a successful one.
//
// The environment sorts every tick of a move by what the server actually did
// (environment.ts), using only engine state:
//   - applied: the server moved the hero with this move's input that tick
//     (`p.movementInput` holds the frame sent: same `seq`, same direction);
//   - not applied: the server used other input or none (a scene or lock,
//     stale input, a paused tick, the story walking the hero);
//   - moved by the game: something other than the hero's walking placed them
//     (a `movementEpoch` change: respawn, flight landing, reconnect; or Slow
//     Time carry by the partner).
// Only applied ticks are compared with open ground. Their open-ground distance
// replays the shared kinematics (`stepMovement`) on a copy of the hero taken
// before the tick, with the same input and the Slow Time state in force when
// the server moved the hero (after the tick: Slow Time starts and ends before
// movement), and with no obstacles and no map edge. On open ground it
// therefore matches the server's own step for that tick; it is not a second
// speed formula. The copies are thrown away; the room is never touched.
// Reports never name what stopped, held or moved the hero.

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

/** What one move's ticks did, accumulated by the environment (world units). */
export interface MoveTally {
  /** Open-ground distance over applied ticks. */
  openGround: number;
  /** Progress along the requested direction over applied ticks (may be negative per tick). */
  progress: number;
  /** Distance travelled in any direction over applied ticks. */
  travelled: number;
  applied: number;
  notApplied: number;
  movedByGame: number;
}
export const newTally = (): MoveTally => ({ openGround: 0, progress: 0, travelled: 0, applied: 0, notApplied: 0, movedByGame: 0 });

/** Adds one applied tick: the hero's own step from `before` to `after`. */
export function tallyApplied(t: MoveTally, direction: Direction, before: { x: number; y: number }, after: { x: number; y: number }, openGround: number) {
  const v = vectorOf[direction],
    n = Math.hypot(v.x, v.y);
  const dx = after.x - before.x,
    dy = after.y - before.y;
  t.applied++;
  t.openGround += openGround;
  t.progress += (dx * v.x + dy * v.y) / n;
  t.travelled += Math.hypot(dx, dy);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const at = (q: { x: number; y: number }) => `(${truncate2(q.x / TILE)}, ${truncate2(q.y / TILE)})`;

/**
 * The movement outcome of one finished move. Outcomes compare the applied
 * ticks only: "full" (at least 90% of the open-ground distance, in the
 * requested direction), "partial" (visibly moved but fell short: blocked
 * partway, or slid sideways off a corner), "none" (did not visibly move),
 * "not_applied" (no tick used this move's input). `from` and `to` are where
 * the hero stood when the action began and ended, whatever moved them.
 */
export function movementReport(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: MoveTally,
): MovementReport {
  const outcome: MovementReport["outcome"] = !t.applied
    ? "not_applied"
    : t.travelled / TILE < STILL_TILES
      ? "none"
      : t.openGround > 0 && t.progress >= FULL_SHARE * t.openGround
        ? "full"
        : "partial";
  return {
    outcome,
    movedTiles: round2(Math.max(0, t.progress) / TILE),
    requestedTiles: round2(t.openGround / TILE),
    from: { x: truncate2(from.x / TILE), y: truncate2(from.y / TILE) },
    to: { x: truncate2(to.x / TILE), y: truncate2(to.y / TILE) },
    ticks: { applied: t.applied, notApplied: t.notApplied, movedByGame: t.movedByGame },
  };
}

/**
 * Feedback lines for a move. A collision line only when the applied ticks
 * fell short of open ground (none for a full move, so a batch of clear moves
 * is not stopped, and none for a move that could not have gone anywhere even
 * on open ground). Separate neutral lines for ticks the game did not take the
 * input or moved the hero itself: those are not collisions.
 */
export function movementLines(direction: Direction, r: MovementReport, from: { x: number; y: number }, to: { x: number; y: number }): string[] {
  const lines: string[] = [];
  const total = r.ticks.applied + r.ticks.notApplied + r.ticks.movedByGame;
  if ((r.outcome === "partial" || r.outcome === "none") && r.requestedTiles >= STILL_TILES)
    lines.push(
      r.outcome === "none"
        ? `You did not move ${direction} (0 of ${r.requestedTiles} tiles); you are still at ${at(to)}. Something blocked your way.`
        : `You moved ${direction} only ${r.movedTiles} of ${r.requestedTiles} tiles, from ${at(from)} to ${at(to)}. Something stopped you.`,
    );
  if (r.ticks.notApplied) lines.push(`For ${r.ticks.notApplied} of ${total} ticks your hero did not take your movement input.`);
  if (r.ticks.movedByGame) lines.push(`For ${r.ticks.movedByGame} of ${total} ticks the game moved your hero instead of your own walking.`);
  return lines;
}
