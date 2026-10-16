import {
  SPEED,
  GRAVITY,
  JUMP,
  HALF,
  SLOW_TIME_SCALE,
  SPRINT_MULTIPLIER,
} from "./constants.js";
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
// The facing a movement intent produces. Movement and action aim share it, so an
// attack aimed with the newest intent matches the facing prediction shows.
export function facingFor(
  mode: MapDefinition["mode"],
  moveX: number,
  moveY: number,
  previous: number,
) {
  const mx = Math.max(-1, Math.min(1, moveX)),
    my = Math.max(-1, Math.min(1, moveY));
  if (!mx && !my) return previous;
  return mode === "PLATFORMER" ? (mx < 0 ? Math.PI : 0) : Math.atan2(my, mx);
}
// How far off a corner a blocked cardinal step may be nudged around it.
export const CORNER_SLIDE = 10;
function clearAt(point: { x: number; y: number }, map: MapDefinition, walls: Rect[]) {
  return (
    point.x >= HALF &&
    point.x <= map.width - HALF &&
    point.y >= HALF &&
    point.y <= map.height - HALF &&
    !walls.some((r) => overlaps(point, r))
  );
}
// A cardinal step blocked by an edge the hero only clips is converted into a
// sideways slide toward the nearest opening, at the same speed. The nearest
// offset wins and ties favour the negative side, so both peers agree.
function cornerSlide(
  p: { x: number; y: number },
  axis: "x" | "y",
  delta: number,
  map: MapDefinition,
  walls: Rect[],
) {
  const side = axis === "x" ? "y" : "x";
  // Probes sit on whole-pixel positions (edges are whole pixels), so a hero
  // standing at a fractional position slides exactly onto the edge instead of
  // overshooting it by the fraction.
  for (let offset = 1; offset <= CORNER_SLIDE; offset++)
    for (const sign of [-1, 1]) {
      const target =
        sign < 0 ? Math.ceil(p[side]) - offset : Math.floor(p[side]) + offset;
      const probe = { ...p, [side]: target };
      if (!clearAt(probe, map, walls)) continue;
      const ahead = { ...probe, [axis]: probe[axis] + Math.sign(delta) };
      if (!clearAt(ahead, map, walls)) continue;
      const step =
        Math.min(Math.abs(delta), Math.abs(target - p[side])) * sign;
      return constrainMotion(
        p,
        axis === "x" ? { x: 0, y: step } : { x: step, y: 0 },
        map,
        walls,
      );
    }
  return null;
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
  p.facing = facingFor(map.mode, mx, my, p.facing);
  const dx = p.vx * dt,
    dy = p.vy * dt * (map.mode === "PLATFORMER" ? verticalTimeScale : 1);
  const ox = p.x,
    oy = p.y;
  let next = constrainMotion(p, { x: dx, y: dy }, map, walls);
  if (map.mode === "TOP_DOWN" && (!dx || !dy) && (dx || dy)) {
    const axis = dx ? "x" : "y";
    const blocked = axis === "x" ? next.x === ox : next.y === oy;
    const slid = blocked && cornerSlide(p, axis, dx || dy, map, walls);
    if (slid) next = slid;
  }
  p.x = next.x;
  p.y = next.y;
  if (p.x !== ox + dx) p.vx = 0;
  p.grounded = map.mode === "PLATFORMER" && dy > 0 && p.y < oy + dy;
  if (p.y !== oy + dy) p.vy = 0;
  if (map.mode === "TOP_DOWN" && dt) {
    if (!dx && p.x !== ox) p.vx = (p.x - ox) / dt;
    if (!dy && p.y !== oy) p.vy = (p.y - oy) / dt;
  }
  if (p.y > map.height + 150) {
    p.x = map.spawn.x;
    p.y = map.spawn.y;
    p.vy = 0;
  }
}

export function flightWalls(walls: Rect[], flying: boolean): Rect[] {
  return flying ? walls.filter((r) => !r.terrain) : walls;
}
function overlaps(p: { x: number; y: number }, r: Rect) {
  return (
    p.x + HALF > r.x &&
    p.x - HALF < r.x + r.w &&
    p.y + HALF > r.y &&
    p.y - HALF < r.y + r.h
  );
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
  p.flightRemaining = Math.max(0, (p.flightRemaining ?? 0) - dt);
  if (p.flightRemaining < 1e-9) p.flightRemaining = 0;
  p.cooldowns.flight = Math.max(0, (p.cooldowns.flight ?? 0) - dt);
  if (
    i.flightHeld &&
    !p.flightWasHeld &&
    p.role === "EMBER" &&
    p.hp > 0 &&
    p.unlockedSkills.includes("flight") &&
    !p.cooldowns.flight
  ) {
    p.flightRemaining = 20;
    p.cooldowns.flight = 27;
    p.flightGround = { x: p.x, y: p.y };
  }
  p.flightWasHeld = !!i.flightHeld;
  if (p.hp <= 0) p.flightRemaining = 0;
  const overGap = [...walls.filter((r) => r.terrain), ...(map.gaps ?? [])].some(
    (r) => overlaps(p, r),
  );
  if (!p.flightRemaining && overGap && p.flightGround) {
    const ground = p.flightGround;
    const landing = [
      ground,
      ...[32, -32, 64, -64].map((dx) => ({ x: ground.x + dx, y: ground.y })),
      map.spawn,
    ].find(
      (point) =>
        point.x >= HALF &&
        point.x <= map.width - HALF &&
        point.y >= HALF &&
        point.y <= map.height - HALF &&
        !walls.some((r) => overlaps(point, r)) &&
        !(map.gaps ?? []).some((r) => overlaps(point, r)),
    );
    if (landing) Object.assign(p, landing, { vx: 0, vy: 0 });
    p.movementEpoch = (p.movementEpoch ?? 0) + 1;
    delete p.flightGround;
  }
  const movementMap = p.flightRemaining
    ? { ...map, mode: "TOP_DOWN" as const }
    : map;
  const movementWalls = flightWalls(walls, !!p.flightRemaining);
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
    movementMap,
    movementWalls,
    dt,
    slowTime
      ? (p.sprintRemaining ?? 0) > 0 && p.role === "OATH"
        ? 1
        : SLOW_TIME_SCALE
      : (p.sprintRemaining ?? 0) > 0
        ? SPRINT_MULTIPLIER
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
      movementMap,
      movementWalls,
      dt * 3,
      slowTime ? SLOW_TIME_SCALE : 1,
    );
    p.movementIntent = intent;
    p.cooldowns.dash = 2;
  }
  if (
    p.flightRemaining &&
    !walls.some((r) => overlaps(p, r)) &&
    !(map.gaps ?? []).some((r) => overlaps(p, r))
  )
    p.flightGround = { x: p.x, y: p.y };
}
