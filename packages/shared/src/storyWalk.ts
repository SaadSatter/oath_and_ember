import { DT, SPEED } from "./constants.js";
import type { Player, World } from "./gameTypes.js";
import { collisionRects, maps } from "./maps.js";
import { steerTarget } from "./navigation.js";

// A hero the story is walking into place before a scene (World.story.walks).
// The server moves them with this input, tick by tick; the walking hero's own
// client predicts every tick with the very same function from its predicted
// position, so the walk is as smooth as any other movement. Walks begin a
// moment after they are announced (WALK_LEAD), so both start on one tick.

/** Hero body half-size, as movement uses. */
export const WALK_BODY = 13;
/** One tick of walking: within this of the mark, the hero has arrived. */
export const WALK_ARRIVE = SPEED * DT;
/** Ticks between a walk being announced and its first step. */
export const WALK_LEAD = Math.round(0.3 / DT);

/**
 * Movement toward the hero's mark at simulation tick `tick` (around anything
 * in the way), or null when the story is not walking this hero.
 */
export function storyWalkInput(
  w: World,
  p: Pick<Player, "id" | "x" | "y" | "sceneId" | "role">,
  tick: number,
) {
  const walk = w.story?.walks?.[p.id];
  // Before its first step the hero moves on their own input (the scene was
  // only just announced); a mark still being decided means standing still.
  if (!walk || tick < walk.start) return null;
  const left = Math.hypot(walk.x - p.x, walk.y - p.y);
  if (walk.pending || left <= WALK_ARRIVE) return { moveX: 0, moveY: 0 };
  const scene = p.sceneId ?? w.sceneId,
    map = maps[scene];
  const walls = collisionRects(
    scene,
    w.puzzles,
    w.pushableOffsets,
    w.bridgePuzzle,
    w.players,
    w.serverTick,
    p.role,
  );
  const goal =
    steerTarget(p, walk, walls, map.width, map.height, WALK_BODY, WALK_BODY) ??
    walk;
  const dx = goal.x - p.x,
    dy = goal.y - p.y,
    d = Math.hypot(dx, dy);
  if (d < 0.5) return { moveX: 0, moveY: 0 };
  return { moveX: dx / d, moveY: dy / d };
}
