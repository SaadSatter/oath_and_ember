import { SPEED, GRAVITY, JUMP, HALF } from "./constants.js";
import type { Player, InputFrame, Rect } from "./gameTypes.js";
import type { MapDefinition } from "./maps.js";
const overlaps = (p: Player, r: Rect) =>
  p.x + HALF > r.x &&
  p.x - HALF < r.x + r.w &&
  p.y + HALF > r.y &&
  p.y - HALF < r.y + r.h;
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
  p.x += p.vx * dt;
  for (const r of walls)
    if (overlaps(p, r)) {
      p.x = p.vx > 0 ? r.x - HALF : r.x + r.w + HALF;
      p.vx = 0;
    }
  p.y += p.vy * dt;
  p.grounded = false;
  for (const r of walls)
    if (overlaps(p, r)) {
      if (p.vy > 0) {
        p.y = r.y - HALF;
        p.grounded = true;
      } else p.y = r.y + r.h + HALF;
      p.vy = 0;
    }
  p.x = Math.max(HALF, Math.min(map.width - HALF, p.x));
  if (p.y > map.height + 150) {
    p.x = map.spawn.x;
    p.y = map.spawn.y;
    p.vy = 0;
  }
}
