import { DT } from "../../../packages/shared/src/constants.js";
import { enemyDefinitions } from "../../../packages/shared/src/enemies.js";
import type {
  Enemy,
  Player,
  Rect,
  World,
} from "../../../packages/shared/src/gameTypes.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
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
    walls = collisionRects(w.sceneId, w.puzzles),
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
    Math.min(map.width - d.body.halfWidth, e.x + (dx / n) * d.speed * DT),
  );
  if (!blocked(nx, e.y)) e.x = nx;
  const ny = Math.max(
    d.body.halfHeight,
    Math.min(map.height - d.body.halfHeight, e.y + (dy / n) * d.speed * DT),
  );
  if (!blocked(e.x, ny)) e.y = ny;
  e.vx = (e.x - ox) / DT;
  e.vy = (e.y - oy) / DT;
  if (e.vx || e.vy) e.facing = Math.atan2(e.vy, e.vx);
}
export function tickEnemies(w: World, damage: (p: Player, n: number) => void) {
  const walls = collisionRects(w.sceneId, w.puzzles);
  for (const e of Object.values(w.enemies)) {
    e.vx = e.vy = 0;
    if (e.hp <= 0) damageEnemy(e, 1, w.serverTick);
    if (e.state === "DEAD") {
      if (w.serverTick - (e.deadTick ?? w.serverTick) >= 30)
        delete w.enemies[e.id];
      continue;
    }
    const d = enemyDefinitions[e.type];
    const choices = Object.values(w.players)
      .filter(
        (p) => p.connected && p.hp > 0 && distance(e, p) <= d.detectionRange,
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
    // Windup locks target/facing. Range and visibility are checked again at resolution.
    if (e.state === "ATTACK" && e.attackStartedTick !== null) {
      if (w.serverTick - e.attackStartedTick >= d.windupTicks) {
        const p = w.players[e.targetId ?? ""];
        if (p && p.connected && p.hp > 0) {
          if (d.attack === "melee") {
            if (distance(e, p) <= d.attackRange && lineClear(e, p, walls))
              damage(p, d.damage);
          } else {
            const id = `${e.id}:attack:${e.attackSeq}`;
            w.projectiles[id] = {
              id,
              x: e.x,
              y: e.y,
              vx: Math.cos(e.attackFacing) * d.projectileSpeed,
              vy: Math.sin(e.attackFacing) * d.projectileSpeed,
              life: d.projectileLife,
              owner: e.id,
              faction: "enemies",
              damage: d.damage,
              radius: 6,
            };
          }
        }
        e.attackStartedTick = null;
        e.state = "CHASE";
        e.nextAttackTick = w.serverTick + d.cooldownTicks;
      }
      e.cooldown = Math.max(0, (e.nextAttackTick - w.serverTick) / 30);
      continue;
    }
    e.targetId = target?.id ?? null;
    e.cooldown = Math.max(0, (e.nextAttackTick - w.serverTick) / 30);
    if (!target) {
      e.state = "IDLE";
      continue;
    }
    const dist = distance(e, target);
    e.facing = Math.atan2(target.y - e.y, target.x - e.x);
    e.state = "CHASE";
    const retreat = d.movement === "ranged" && dist < d.preferredRange - 25;
    if (retreat || dist > d.attackRange)
      moveEnemy(
        e,
        (target.x - e.x) * (retreat ? -1 : 1),
        (target.y - e.y) * (retreat ? -1 : 1),
        w,
      );
    if (
      !retreat &&
      dist <= d.attackRange &&
      w.serverTick >= e.nextAttackTick &&
      lineClear(e, target, walls)
    ) {
      e.state = "ATTACK";
      e.attackStartedTick = w.serverTick;
      e.attackFacing = e.facing;
      e.attackSeq++;
      e.vx = e.vy = 0;
    }
  }
}
