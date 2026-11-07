// Feedback for visible world changes (owner approval 2026-10-28; audit
// docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-s2-feedback.md).
//
// A human player sees the dry hedge's shrubs vanish and the cow slide on
// screen. Before this, the observation only dropped the hedge from `visible`
// or changed the cow's coordinates, with no event. These watchers turn such
// changes into feedback lines. The rules (audit findings 3 and 4):
//   - checked every tick, against that tick's camera for that hero, with the
//     same rule perceive() uses for `visible` (onScreen);
//   - only for a hero in the same area as the change;
//   - worded as drawn: what vanished or moved, and where. Never a cause,
//     puzzle progress or a hidden flag (the maze's `parked`, for example).
// Reads state only; changes nothing.

import type { Player, World } from "../../shared/src/gameTypes.js";
import { hedgeMazeState, mazeBurnBush } from "../../shared/src/hedgeMaze.js";
import { directionOf, onScreen, round1, sceneOf, TILE } from "./perception.js";

/** The watched parts of the world at one moment. */
export interface WorldSnapshot {
  hedgeBurned: boolean | null;
  cow: { x: number; y: number } | null;
}

export function worldSnapshot(w: World): WorldSnapshot {
  const maze = hedgeMazeState(w.puzzles);
  return {
    hedgeBurned: maze ? maze.burned : null,
    cow: maze ? { x: maze.cow.x, y: maze.cow.y } : null,
  };
}

/** Where perception lists the dry hedge (its centre). */
const HEDGE_AT = { x: mazeBurnBush.x + mazeBurnBush.w / 2, y: mazeBurnBush.y + mazeBurnBush.h / 2 };
const tiles = (q: { x: number; y: number }) => `(${round1(q.x / TILE)}, ${round1(q.y / TILE)})`;

/** A visible move still in progress, reported once when the hero's action ends. */
export interface SeenMove {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/**
 * What `p` saw change during one tick. `lines` are reported at once; a cow
 * move is folded into `cow` and reported when the action ends, so a pull that
 * lasts seconds gives one line, not one per tick.
 */
export function tickEvents(before: WorldSnapshot, after: WorldSnapshot, w: World, p: Player, seenCow?: SeenMove) {
  const lines: string[] = [];
  let cow = seenCow;
  if (sceneOf(w, p) === "HEDGE_MAZE") {
    if (before.hedgeBurned === false && after.hedgeBurned === true && onScreen(w, p, HEDGE_AT))
      lines.push(`The dry hedge at ${tiles(HEDGE_AT)} disappeared.`);
    const a = before.cow,
      b = after.cow;
    if (a && b && (a.x !== b.x || a.y !== b.y) && (onScreen(w, p, a) || onScreen(w, p, b)))
      cow = { from: cow?.from ?? a, to: b };
  }
  return { lines, cow };
}

/** The line for a cow move this hero watched, or nothing if it moved less than drawn precision. */
export function cowLine(move: SeenMove | undefined): string | undefined {
  if (!move || tiles(move.from) === tiles(move.to)) return;
  const dir = directionOf(Math.atan2(move.to.y - move.from.y, move.to.x - move.from.x));
  return `The cow moved ${dir}, from ${tiles(move.from)} to ${tiles(move.to)}.`;
}
