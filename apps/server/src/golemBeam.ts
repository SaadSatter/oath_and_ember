import {
  golemBeam,
  golemPalmOrigin,
} from "../../../packages/shared/src/golem.js";
import { enemyDefinitions } from "../../../packages/shared/src/enemies.js";
import {
  DT,
  HALF,
  SLOW_TIME_SCALE,
} from "../../../packages/shared/src/constants.js";
import type {
  Player,
  Projectile,
  Rect,
  World,
} from "../../../packages/shared/src/gameTypes.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import { lineClear } from "./enemySimulation.js";
export const GOLEM_BLAST_RADIUS = 64;
// Return earliest contact so a fast beam cannot hit someone through a nearer wall.
function contact(
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: Rect,
  padding: number,
) {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, r.x - padding, r.x + r.w + padding],
    [a.y, b.y - a.y, r.y - padding, r.y + r.h + padding],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (start < min || start > max) return Infinity;
      continue;
    }
    const one = (min - start) / delta,
      two = (max - start) / delta;
    lo = Math.max(lo, Math.min(one, two));
    hi = Math.min(hi, Math.max(one, two));
    if (lo > hi) return Infinity;
  }
  return lo;
}
export function tickGolemBeam(
  w: World,
  q: Projectile,
  damage: (p: Player, n: number) => void,
) {
  const scene = q.sceneId ?? w.sceneId,
    map = maps[scene],
    owner = w.enemies[q.owner];
  if (
    !owner ||
    owner.hp <= 0 ||
    owner.state === "DEAD" ||
    scene !== w.sceneId ||
    owner.attackKind === "melee"
  ) {
    delete w.projectiles[q.id];
    return;
  }
  const scale = w.slowTime ? SLOW_TIME_SCALE : 1;
  q.beamAge = (q.beamAge ?? 0) + DT * scale;
  q.life = Math.max(0, q.life - DT * scale);
  const a = golemPalmOrigin(owner);
  q.beamOrigin = a;
  const angle = owner.attackFacing,
    b = {
      x: a.x + Math.cos(angle) * golemBeam.range,
      y: a.y + Math.sin(angle) * golemBeam.range,
    };
  const walls = collisionRects(
    scene,
    w.puzzles,
    w.pushableOffsets,
    w.bridgePuzzle,
    w.players,
    w.serverTick,
  ).filter((r) => !r.terrain);
  const players = Object.values(w.players)
    .filter(
      (p) => p.connected && p.hp > 0 && (p.sceneId ?? w.sceneId) === scene,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  let first = 1,
    contactId = "range";
  const consider = (t: number, id: string) => {
    if (t < first) {
      first = t;
      contactId = id;
    }
  };
  walls.forEach((r, i) =>
    consider(contact(a, b, r, q.radius ?? 6), `wall:${i}`),
  );
  players.forEach((p) =>
    consider(
      contact(
        a,
        b,
        { x: p.x - HALF, y: p.y - HALF, w: HALF * 2, h: HALF * 2 },
        q.radius ?? 6,
      ),
      `player:${p.id}`,
    ),
  );
  for (const [start, delta, low, high] of [
    [a.x, b.x - a.x, 6, map.width - 6],
    [a.y, b.y - a.y, 6, map.height - 6],
  ]) {
    if (delta > 0 && start + delta >= high)
      consider(Math.max(0, (high - start) / delta), "border");
    if (delta < 0 && start + delta <= low)
      consider(Math.max(0, (low - start) / delta), "border");
  }
  q.x = a.x + (b.x - a.x) * first;
  q.y = a.y + (b.y - a.y) * first;
  q.beamDamaged ??= [];
  if (contactId !== "range") {
    for (const p of players)
      if (
        !q.beamDamaged.includes(p.id) &&
        Math.hypot(p.x - q.x, p.y - q.y) <= GOLEM_BLAST_RADIUS &&
        lineClear(q, p, walls)
      ) {
        damage(p, q.damage ?? 28);
        q.beamDamaged.push(p.id);
      }
    if (contactId !== q.beamContact) {
      q.beamImpacts = (q.beamImpacts ?? 0) + 1;
      (w.projectileImpacts ??= []).push({
        id: `${q.id}:impact:${q.beamImpacts}`,
        x: q.x,
        y: q.y,
        owner: q.owner,
        tick: w.serverTick,
        sceneId: scene,
        effect: "golem_blast",
        radius: GOLEM_BLAST_RADIUS,
      });
    }
  }
  q.beamContact = contactId;
  if (!q.life) {
    delete w.projectiles[q.id];
    owner.state = "CHASE";
    owner.attackStartedTick = null;
    owner.nextAttackTick =
      w.serverTick + enemyDefinitions[owner.type].cooldownTicks;
  }
}
