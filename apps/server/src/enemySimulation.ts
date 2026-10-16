import {
  golemBeam,
  golemPalmOrigin,
} from "../../../packages/shared/src/golem.js";
import { SLOW_TIME_SCALE } from "../../../packages/shared/src/constants.js";
import {
  DT,
  SERVER_HZ,
  ticksFor,
} from "../../../packages/shared/src/constants.js";
import {
  enemyDefinitions,
  golemMelee,
} from "../../../packages/shared/src/enemies.js";
import type {
  Enemy,
  Player,
  Rect,
  World,
} from "../../../packages/shared/src/gameTypes.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { steerTarget } from "./enemyNavigation.js";
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function damageEnemy(e: Enemy, amount: number, tick: number) {
  if (e.state === "DEAD" || amount <= 0) return;
  e.hp = Math.max(0, e.hp - amount);
  if (e.hp === 0) {
    e.state = "DEAD";
    e.deadTick = tick;
    e.targetId = null;
    e.vx = e.vy = 0;
    e.attackStartedTick = null;
  }
}
export function segmentHits(
  x: number,
  y: number,
  nx: number,
  ny: number,
  r: Rect,
  padding = 0,
) {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [x, nx - x, r.x - padding, r.x + r.w + padding],
    [y, ny - y, r.y - padding, r.y + r.h + padding],
  ]) {
    if (delta === 0) {
      if (start < min || start > max) return false;
      continue;
    }
    const a = (min - start) / delta,
      b = (max - start) / delta;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
    if (lo > hi) return false;
  }
  return true;
}
export const lineClear = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  walls: Rect[],
) => !walls.some((r) => segmentHits(a.x, a.y, b.x, b.y, r));
function moveEnemy(e: Enemy, dx: number, dy: number, w: World) {
  const d = enemyDefinitions[e.type],
    map = maps[w.sceneId],
    walls = collisionRects(
      w.sceneId,
      w.puzzles,
      w.pushableOffsets,
      w.bridgePuzzle,
      w.players,
      w.serverTick,
    ),
    n = Math.hypot(dx, dy) || 1;
  const ox = e.x,
    oy = e.y;
  const blocked = (x: number, y: number) =>
    walls.some(
      (r) =>
        x + d.body.halfWidth > r.x &&
        x - d.body.halfWidth < r.x + r.w &&
        y + d.body.halfHeight > r.y &&
        y - d.body.halfHeight < r.y + r.h,
    );
  const nx = Math.max(
    d.body.halfWidth,
    Math.min(
      map.width - d.body.halfWidth,
      e.x + (dx / n) * d.speed * DT * (w.slowTime ? SLOW_TIME_SCALE : 1),
    ),
  );
  if (!blocked(nx, e.y)) e.x = nx;
  const ny = Math.max(
    d.body.halfHeight,
    Math.min(
      map.height - d.body.halfHeight,
      e.y + (dy / n) * d.speed * DT * (w.slowTime ? SLOW_TIME_SCALE : 1),
    ),
  );
  if (!blocked(e.x, ny)) e.y = ny;
  e.vx = (e.x - ox) / DT;
  e.vy = (e.y - oy) / DT;
  if (e.vx || e.vy) e.facing = Math.atan2(e.vy, e.vx);
}
export function tickEnemies(w: World, damage: (p: Player, n: number) => void) {
  const walls = collisionRects(
    w.sceneId,
    w.puzzles,
    w.pushableOffsets,
    w.bridgePuzzle,
    w.players,
    w.serverTick,
  );
  for (const e of Object.values(w.enemies)) {
    e.vx = e.vy = 0;
    if (e.hp <= 0) damageEnemy(e, 1, w.serverTick);
    if (e.state === "DEAD") {
      if (w.serverTick - (e.deadTick ?? w.serverTick) >= ticksFor(1))
        delete w.enemies[e.id];
      continue;
    }
    if (e.passive) {
      e.state = "IDLE";
      e.attackStartedTick = null;
      continue;
    }
    const d = enemyDefinitions[e.type];
    if (w.slowTime) {
      if (e.attackStartedTick !== null)
        e.attackStartedTick += 1 - SLOW_TIME_SCALE;
      if (e.nextAttackTick > w.serverTick)
        e.nextAttackTick += 1 - SLOW_TIME_SCALE;
    }
    const choices = Object.values(w.players)
      .filter(
        (p) =>
          (p.sceneId ?? w.sceneId) === w.sceneId &&
          p.connected &&
          p.hp > 0 &&
          distance(e, p) <= d.detectionRange,
      )
      .sort(
        (a, b) => distance(e, a) - distance(e, b) || a.id.localeCompare(b.id),
      );
    const retained = choices.find((p) => p.id === e.targetId);
    const nearest = choices[0];
    const target =
      retained && nearest && distance(e, retained) <= distance(e, nearest) + 30
        ? retained
        : nearest;
    const golem = e.type === "ironbound_sentinel";
    const close =
      golem &&
      nearest &&
      distance(e, nearest) <= golemMelee.range &&
      lineClear(e, nearest, walls)
        ? nearest
        : undefined;
    const activeBeam = golem
      ? Object.values(w.projectiles).find(
          (q) => q.owner === e.id && q.effect === "golem_beam",
        )
      : undefined;
    if (activeBeam && !close) {
      e.state = "ATTACK";
      continue;
    }
    if (activeBeam && close) delete w.projectiles[activeBeam.id];
    // A hero rushing the charge forces a fresh, readable punch windup.
    if (close && e.state === "ATTACK" && e.attackKind !== "melee") {
      e.attackKind = "melee";
      e.attackHit = false;
      e.attackStartedTick = w.serverTick;
      e.targetId = close.id;
      e.attackFacing = e.facing = Math.atan2(close.y - e.y, close.x - e.x);
      e.attackSeq++;
    }
    if (
      golem &&
      e.state === "ATTACK" &&
      e.attackKind === "melee" &&
      e.attackStartedTick !== null
    ) {
      const age = w.serverTick - e.attackStartedTick,
        p = w.players[e.targetId ?? ""];
      if (age >= golemMelee.hitTicks && !e.attackHit) {
        e.attackHit = true;
        if (
          p &&
          p.connected &&
          p.hp > 0 &&
          (p.sceneId ?? w.sceneId) === w.sceneId
        ) {
          const dx = p.x - e.x,
            dy = p.y - e.y,
            dist = Math.hypot(dx, dy);
          if (
            dist <= golemMelee.range &&
            (dist < 1 ||
              (dx * Math.cos(e.attackFacing) + dy * Math.sin(e.attackFacing)) /
                dist >=
                golemMelee.facingDot) &&
            lineClear(e, p, walls)
          )
            damage(p, d.damage);
        }
      }
      if (age >= golemMelee.durationTicks) {
        e.state = "CHASE";
        e.attackStartedTick = null;
        e.nextAttackTick = w.serverTick + golemMelee.cooldownTicks;
      }
      e.cooldown = Math.max(0, (e.nextAttackTick - w.serverTick) / SERVER_HZ);
      continue;
    }
    // Windup locks target/facing. Range and visibility are checked again at resolution.
    if (e.state === "ATTACK" && e.attackStartedTick !== null) {
      if (w.serverTick - e.attackStartedTick >= d.windupTicks) {
        const p = w.players[e.targetId ?? ""];
        if (
          p &&
          (p.sceneId ?? w.sceneId) === w.sceneId &&
          p.connected &&
          p.hp > 0
        ) {
          if (d.attack === "melee") {
            if (distance(e, p) <= d.attackRange && lineClear(e, p, walls))
              damage(p, d.damage);
          } else {
            const id = `${e.id}:attack:${e.attackSeq}`;
            w.projectiles[id] = {
              id,
              sceneId: w.sceneId,
              x: e.x,
              y: e.y,
              vx: Math.cos(e.attackFacing) * d.projectileSpeed,
              vy: Math.sin(e.attackFacing) * d.projectileSpeed,
              life: d.projectileLife,
              owner: e.id,
              faction: "enemies",
              damage: d.damage,
              radius: 6,
              ...(e.type === "ironbound_sentinel"
                ? {
                    effect: "golem_beam" as const,
                    beamOrigin: golemPalmOrigin(e),
                    ...golemPalmOrigin(e),
                    beamAge: 0,
                    beamDamaged: [],
                    life: golemBeam.duration,
                  }
                : {}),
            };
          }
        }
        if (
          golem &&
          Object.values(w.projectiles).some(
            (q) => q.owner === e.id && q.effect === "golem_beam",
          )
        )
          continue;
        if (!p || (p.sceneId ?? w.sceneId) !== w.sceneId) e.targetId = null;
        e.attackStartedTick = null;
        e.state = "CHASE";
        e.nextAttackTick = w.serverTick + d.cooldownTicks;
      }
      e.cooldown = Math.max(0, (e.nextAttackTick - w.serverTick) / SERVER_HZ);
      continue;
    }
    const chosen = close ?? target;
    e.targetId = chosen?.id ?? null;
    e.cooldown = Math.max(0, (e.nextAttackTick - w.serverTick) / SERVER_HZ);
    if (!chosen) {
      e.state = "IDLE";
      continue;
    }
    const dist = distance(e, chosen);
    e.facing = Math.atan2(chosen.y - e.y, chosen.x - e.x);
    e.state = "CHASE";
    const retreat = d.movement === "ranged" && dist < d.preferredRange - 25;
    const sighted = lineClear(e, chosen, walls);
    if (retreat)
      moveEnemy(e, e.x - chosen.x, e.y - chosen.y, w);
    // In range but behind a wall still means closing in, never standing still.
    else if (dist > d.attackRange || !sighted) {
      // Walk around walls rather than pressing into them.
      const map = maps[w.sceneId],
        goal =
          steerTarget(
            e,
            chosen,
            walls,
            map.width,
            map.height,
            d.body.halfWidth,
            d.body.halfHeight,
          ) ?? chosen;
      moveEnemy(e, goal.x - e.x, goal.y - e.y, w);
    }
    if (
      !retreat &&
      dist <= d.attackRange &&
      w.serverTick >= e.nextAttackTick &&
      sighted
    ) {
      if (golem) {
        e.attackKind = dist <= golemMelee.range ? "melee" : "beam";
        e.attackHit = false;
      }
      e.state = "ATTACK";
      e.attackStartedTick = w.serverTick;
      e.attackFacing = e.facing;
      if (golem && e.attackKind === "beam") {
        const palm = golemPalmOrigin(e);
        e.attackFacing = e.facing = Math.atan2(
          chosen.y - palm.y,
          chosen.x - palm.x,
        );
      }
      e.attackSeq++;
      e.vx = e.vy = 0;
    }
  }
}
