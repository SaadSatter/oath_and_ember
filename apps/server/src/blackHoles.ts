import { blackHoleTuning as T } from "../../../packages/shared/src/blackHole.js";
import { DT, SLOW_TIME_SCALE } from "../../../packages/shared/src/constants.js";
import type { World, Rect } from "../../../packages/shared/src/gameTypes.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { constrainMotion } from "../../../packages/shared/src/movement.js";
import { damageEnemy, segmentHits } from "./enemySimulation.js";
// Find the first swept contact, rather than placing a stopped projectile inside a wall.
function contact(x: number, y: number, nx: number, ny: number, rect: Rect) {
  if (!segmentHits(x, y, nx, ny, rect, 6)) return 1;
  let low = 0,
    high = 1;
  for (let n = 0; n < 18; n++) {
    const middle = (low + high) / 2;
    if (
      segmentHits(x, y, x + (nx - x) * middle, y + (ny - y) * middle, rect, 6)
    )
      high = middle;
    else low = middle;
  }
  return low;
}
export function tickBlackHoles(w: World) {
  for (const hole of Object.values(w.blackHoles ?? {})) {
    if (
      hole.sceneId !== (w.players[hole.owner]?.sceneId ?? w.sceneId) ||
      !w.players[hole.owner]?.connected
    ) {
      delete w.blackHoles![hole.id];
      continue;
    }
    const walls = collisionRects(
      hole.sceneId,
      w.puzzles,
      w.pushableOffsets,
      w.bridgePuzzle,
      w.players,
      w.serverTick,
    ).filter((r) => !r.terrain);
    const enemies = Object.values(
      hole.sceneId === w.sceneId ? w.enemies : {},
    ).filter((e) => e.state !== "DEAD" && e.hp > 0);
    if (hole.phase === "travel") {
      const distance = Math.min(
        hole.remainingRange,
        T.speed * DT * (w.slowTime ? SLOW_TIME_SCALE : 1),
      );
      const nx = hole.x + (hole.vx / T.speed) * distance,
        ny = hole.y + (hole.vy / T.speed) * distance;
      let fraction = 1;
      let hit = false;
      const blockers = [
        ...walls,
        ...enemies.map((e) => ({ x: e.x - 20, y: e.y - 20, w: 40, h: 40 })),
      ];
      for (const rect of blockers)
        if (segmentHits(hole.x, hole.y, nx, ny, rect, 6)) {
          hit = true;
          fraction = Math.min(fraction, contact(hole.x, hole.y, nx, ny, rect));
        }
      hole.x += (nx - hole.x) * fraction;
      hole.y += (ny - hole.y) * fraction;
      hole.remainingRange = Math.max(
        0,
        hole.remainingRange - distance * fraction,
      );
      if (hit || hole.remainingRange < 1e-7) {
        hole.phase = "vortex";
        hole.vx = hole.vy = 0;
      }
    } else {
      hole.life -= DT;
      if (hole.life < 1e-7) {
        delete w.blackHoles![hole.id];
        continue;
      }
    }
    if (hole.phase !== "vortex") continue;
    for (const enemy of enemies) {
      const dx = hole.x - enemy.x,
        dy = hole.y - enemy.y,
        distance = Math.hypot(dx, dy);
      if (
        distance > T.pullRadius ||
        walls.some((r) => segmentHits(hole.x, hole.y, enemy.x, enemy.y, r))
      )
        continue;
      if (!hole.damaged.includes(enemy.id)) {
        damageEnemy(enemy, T.damage, w.serverTick);
        hole.damaged.push(enemy.id);
      }
      if (enemy.hp <= 0 || distance < 1) continue;
      const pull = Math.min(
        distance,
        T.pullSpeed * DT * (w.slowTime ? SLOW_TIME_SCALE : 1),
      );
      const next = constrainMotion(
        enemy,
        { x: (dx / distance) * pull, y: (dy / distance) * pull },
        maps[hole.sceneId],
        walls,
      );
      enemy.x = next.x;
      enemy.y = next.y;
    }
  }
}
