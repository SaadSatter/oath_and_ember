import { SPEED, GRAVITY, JUMP, HALF } from "./constants.js";
import type { Player, InputFrame, Rect } from "./gameTypes.js";
import type { MapDefinition } from "./maps.js";
// Sweep the requested axis against every obstacle, choosing the nearest contact.
// Never resolve using a velocity that an earlier obstacle has already zeroed.
function sweep(
  start: number,
  cross: number,
  delta: number,
  walls: Rect[],
  axis: "x" | "y",
) {
  if (!delta) return start;
  let end = start + delta;
  for (const r of walls) {
    const low = axis === "x" ? r.x : r.y;
    const size = axis === "x" ? r.w : r.h;
    const other = axis === "x" ? r.y : r.x;
    const otherSize = axis === "x" ? r.h : r.w;
    if (cross + HALF <= other || cross - HALF >= other + otherSize) continue;
    const min = low - HALF,
      max = low + size + HALF;
    if (delta > 0 && start <= min && end > min) end = Math.min(end, min);
    else if (delta < 0 && start >= max && end < max) end = Math.max(end, max);
    else if (start > min && start < max) {
      // An embedded spawn must not teleport on an idle tick. Allow movement
      // toward the nearest exit, but stop attempts to penetrate further.
      const towardCenter =
        (start < (min + max) / 2 && delta > 0) ||
        (start >= (min + max) / 2 && delta < 0);
      if (towardCenter) end = start;
    }
  }
  return end;
}
// Shared fixed-step kinematics keep prediction reproducible without browser physics.
export function move(
  p: Player,
  i: InputFrame,
  map: MapDefinition,
  walls: Rect[],
  dt: number,
) {
  const mx = Math.max(-1, Math.min(1, i.moveX)),
    my = Math.max(-1, Math.min(1, i.moveY));
  p.movementIntent = { x: mx, y: my };
  if (map.mode === "TOP_DOWN") {
    const n = Math.hypot(mx, my) || 1;
    p.vx = (mx / n) * SPEED;
    p.vy = (my / n) * SPEED;
  } else {
    p.vx = mx * SPEED;
    if (i.jumpHeld && p.grounded) {
      p.vy = -JUMP;
      p.grounded = false;
    }
    p.vy += GRAVITY * dt;
  }
  if (mx || my)
    p.facing =
      map.mode === "PLATFORMER" ? (mx < 0 ? Math.PI : 0) : Math.atan2(my, mx);
  const dx = p.vx * dt,
    dy = p.vy * dt;
  const ox = p.x,
    oy = p.y;
  p.x = Math.max(
    HALF,
    Math.min(map.width - HALF, sweep(ox, oy, dx, walls, "x")),
  );
  if (p.x !== ox + dx) p.vx = 0;
  p.y = sweep(oy, p.x, dy, walls, "y");
  if (map.mode === "TOP_DOWN")
    p.y = Math.max(HALF, Math.min(map.height - HALF, p.y));
  p.grounded = map.mode === "PLATFORMER" && dy > 0 && p.y < oy + dy;
  if (p.y !== oy + dy) p.vy = 0;
  if (p.y > map.height + 150) {
    p.x = map.spawn.x;
    p.y = map.spawn.y;
    p.vy = 0;
  }
}
