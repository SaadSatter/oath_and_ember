import { SPEED, GRAVITY, JUMP, HALF, SLOW_TIME_SCALE } from "./constants.js";
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
        (start > (min + max) / 2 && delta < 0);
      if (towardCenter) end = start;
    }
  }
  return end;
}
// Also used to keep presentation paths outside solids; does not simulate intent.
export function constrainMotion(
  position: { x: number; y: number },
  delta: { x: number; y: number },
  map: MapDefinition,
  walls: Rect[],
) {
  const x = Math.max(
    HALF,
    Math.min(
      map.width - HALF,
      sweep(position.x, position.y, delta.x, walls, "x"),
    ),
  );
  let y = sweep(position.y, x, delta.y, walls, "y");
  if (map.mode === "TOP_DOWN")
    y = Math.max(HALF, Math.min(map.height - HALF, y));
  return { x, y };
}
// Shared fixed-step kinematics keep prediction reproducible without browser physics.
export function move(
  p: Player,
  i: InputFrame,
  map: MapDefinition,
  walls: Rect[],
  dt: number,
  speedMultiplier = 1,
  verticalTimeScale = 1,
) {
  const mx = Math.max(-1, Math.min(1, i.moveX)),
    my = Math.max(-1, Math.min(1, i.moveY));
  p.movementIntent = { x: mx, y: my };
  if (map.mode === "TOP_DOWN") {
    const n = Math.hypot(mx, my) || 1;
    p.vx = (mx / n) * SPEED * speedMultiplier;
    p.vy = (my / n) * SPEED * speedMultiplier;
  } else {
    p.vx = mx * SPEED * speedMultiplier;
    if (i.jumpHeld && p.grounded) {
      p.vy = -JUMP;
      p.grounded = false;
    }
    p.vy += GRAVITY * dt * verticalTimeScale;
  }
  if (mx || my)
    p.facing =
      map.mode === "PLATFORMER" ? (mx < 0 ? Math.PI : 0) : Math.atan2(my, mx);
  const dx = p.vx * dt,
    dy = p.vy * dt * (map.mode === "PLATFORMER" ? verticalTimeScale : 1);
  const ox = p.x,
    oy = p.y;
  const next = constrainMotion(p, { x: dx, y: dy }, map, walls);
  p.x = next.x;
  p.y = next.y;
  if (p.x !== ox + dx) p.vx = 0;
  p.grounded = map.mode === "PLATFORMER" && dy > 0 && p.y < oy + dy;
  if (p.y !== oy + dy) p.vy = 0;
  if (p.y > map.height + 150) {
    p.x = map.spawn.x;
    p.y = map.spawn.y;
    p.vy = 0;
  }
}

// Movement abilities are part of the same deterministic step on both peers.
// Combat cooldowns remain server-owned; only the movement cooldown is predicted.
export function stepMovement(
  p: Player,
  i: InputFrame,
  map: MapDefinition,
  walls: Rect[],
  dt: number,
  slowTime = false,
) {
  const remaining = (p.sprintRemaining ?? 0) - dt;
  p.sprintRemaining = remaining < 1e-9 ? 0 : remaining;
  p.cooldowns.sprint = Math.max(0, (p.cooldowns.sprint ?? 0) - dt);
  if (
    i.sprintHeld &&
    !p.sprintWasHeld &&
    p.role === "OATH" &&
    p.hp > 0 &&
    p.unlockedSkills.includes("dash") &&
    !p.cooldowns.sprint
  ) {
    p.sprintRemaining = 10;
    p.cooldowns.sprint = 15;
  }
  p.sprintWasHeld = !!i.sprintHeld;
  if (p.hp <= 0) p.sprintRemaining = 0;
  move(
    p,
    i,
    map,
    walls,
    dt,
    slowTime
      ? (p.sprintRemaining ?? 0) > 0 && p.role === "OATH"
        ? 1
        : SLOW_TIME_SCALE
      : (p.sprintRemaining ?? 0) > 0
        ? 2
        : 1,
    slowTime && !(p.role === "OATH" && (p.sprintRemaining ?? 0) > 0)
      ? SLOW_TIME_SCALE
      : 1,
  );
  if (p.cooldowns.dash !== undefined)
    p.cooldowns.dash = Math.max(0, p.cooldowns.dash - dt);
  if (
    i.secondaryHeld &&
    (p.unlockedSkills.includes("dash") || p.unlockedSkills.includes("blink")) &&
    !p.cooldowns.dash
  ) {
    const intent = p.movementIntent;
    move(
      p,
      { ...i, moveX: Math.cos(p.facing), moveY: Math.sin(p.facing) },
      map,
      walls,
      dt * 3,
      slowTime ? SLOW_TIME_SCALE : 1,
    );
    p.movementIntent = intent;
    p.cooldowns.dash = 2;
  }
}
