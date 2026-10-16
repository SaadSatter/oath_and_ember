import { maps } from "../../../packages/shared/src/maps.js";
import type {
  Player,
  Projectile,
  Rect,
  World,
} from "../../../packages/shared/src/gameTypes.js";
import {
  DT,
  HALF,
  SLOW_TIME_SCALE,
} from "../../../packages/shared/src/constants.js";
import {
  POND_ROTATION_STEP,
  normalizeMirrorAngle,
  mirrorPondState,
  pondChest,
  pondGuardrails,
  pondMirrorWall,
  pondPuzzle,
  pondSpawn,
  pondSpikes,
  pondStations,
  pondStoneWalls,
  pondTrial,
} from "../../../packages/shared/src/mirrorPond.js";
import type { InventoryService } from "./inventory.js";
export const POND_CHEST_TARGET = "pond-vanity-mirror-chest";
export function ensureMirrorPond(w: World, inventory: InventoryService) {
  w.puzzles.mirrorPond ??= pondPuzzle();
  if (!inventory.targets.has(POND_CHEST_TARGET))
    inventory.register(w, {
      id: POND_CHEST_TARGET,
      name: "Vanity Mirror Chest",
      sceneId: "MIRROR_POND",
      kind: "chest",
      ...pondChest,
      reward: "vanity_mirror",
      available: (world) => !!mirrorPondState(world.puzzles)?.raised,
    });
  updatePondChest(w, inventory);
}
export function updatePondChest(w: World, inventory: InventoryService) {
  const target = inventory.targets.get(POND_CHEST_TARGET);
  if (!target) return;
  if (mirrorPondState(w.puzzles)?.raised) {
    const { reward: _reward, available: _available, ...view } = target;
    (w.inventoryTargets ??= {})[target.id] = view;
  } else delete w.inventoryTargets?.[target.id];
}
const overlaps = (p: { x: number; y: number }, r: Rect) =>
  p.x + HALF > r.x &&
  p.x - HALF < r.x + r.w &&
  p.y + HALF > r.y &&
  p.y - HALF < r.y + r.h;
export function pushPondMirror(w: World, p: Player) {
  if (
    (p.sceneId ?? w.sceneId) !== "MIRROR_POND" ||
    p.role !== "OATH" ||
    p.hp <= 0
  )
    return false;
  const pond = mirrorPondState(w.puzzles);
  if (!pond) return false;
  const choices = pondStations
    .map((s, i) => ({ s, i, d: Math.hypot(p.x - s.x, p.y - s.y) }))
    .filter(({ d }) => d <= 104)
    .sort((a, b) => a.d - b.d);
  const chosen = choices[0];
  if (!chosen) return false;
  const { s, i, d } = chosen;
  if (
    d > 1 &&
    ((s.x - p.x) * Math.cos(p.facing) + (s.y - p.y) * Math.sin(p.facing)) / d <
      0.45
  )
    return false;
  const angle = normalizeMirrorAngle(pond.mirrors[i] + POND_ROTATION_STEP),
    wall = pondMirrorWall(i, angle);
  if (
    Object.values(w.players).some(
      (q) =>
        q.connected &&
        (q.sceneId ?? w.sceneId) === "MIRROR_POND" &&
        overlaps(q, wall),
    )
  )
    return false;
  pond.mirrors[i] = angle;
  w.worldRevision++;
  return true;
}
export function tickMirrorPond(
  w: World,
  before: Map<string, { x: number; y: number }>,
) {
  const pond = mirrorPondState(w.puzzles);
  if (w.sceneId !== "MIRROR_POND" || !pond) return;
  const oldSpikes = pondSpikes(pond.clock);
  pond.clock += DT * (w.slowTime ? SLOW_TIME_SCALE : 1);
  const spikes = pondSpikes(pond.clock);
  for (const p of Object.values(w.players)) {
    if (
      p.role !== "OATH" ||
      !p.connected ||
      (p.sceneId ?? w.sceneId) !== "MIRROR_POND"
    )
      continue;
    if (p.x > 42 * 32 + HALF) pond.entryPassed = false;
    const from = before.get(p.id) ?? p;
    const inTrial = overlaps(p, pondTrial) || overlaps(from, pondTrial);
    const hit =
      inTrial &&
      spikes.some((r, i) => {
        const old = oldSpikes[i];
        const swept = {
          x: r.x,
          y: Math.min(r.y, old.y),
          w: r.w,
          h: r.h + Math.abs(r.y - old.y),
        };
        return contact(from, p, swept, HALF) !== Infinity;
      });
    if (
      inTrial &&
      ((!pond.entryPassed && !(p.sprintRemaining && p.sprintRemaining > 0)) ||
        hit)
    ) {
      p.hp = Math.max(1, p.hp - 8);
      Object.assign(p, pondSpawn("OATH"), {
        vx: 0,
        vy: 0,
        movementEpoch: (p.movementEpoch ?? 0) + 1,
      });
      pond.entryPassed = false;
      pond.failures++;
      continue;
    }
    if (p.x <= 37 * 32 - HALF && p.y >= 25 * 32 && p.y <= 27 * 32)
      pond.entryPassed = true;
  }
}
// First swept AABB contact, independent of frame rate or browser physics.
function contact(
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: Rect,
  padding = 4,
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
function mirrorContact(
  from: { x: number; y: number },
  to: { x: number; y: number },
  index: number,
  angle: number,
) {
  const s = pondStations[index],
    tangent = { x: Math.cos(angle), y: Math.sin(angle) },
    normal = { x: -tangent.y, y: tangent.x };
  const d0 = (from.x - s.x) * normal.x + (from.y - s.y) * normal.y,
    d1 = (to.x - s.x) * normal.x + (to.y - s.y) * normal.y;
  if (Math.abs(d0 - d1) < 1e-10) return Infinity;
  const t = d0 / (d0 - d1);
  if (t < 0 || t > 1) return Infinity;
  const x = from.x + (to.x - from.x) * t,
    y = from.y + (to.y - from.y) * t;
  return Math.abs((x - s.x) * tangent.x + (y - s.y) * tangent.y) <= 66.4
    ? t
    : Infinity;
}
// Swept circle contact prevents fast shots from tunnelling through a torch radius.
export const POND_TORCH_RADIUS = 28;
function torchContact(
  from: { x: number; y: number },
  to: { x: number; y: number },
  center: { x: number; y: number },
  radius: number,
) {
  const x = from.x - center.x,
    y = from.y - center.y,
    dx = to.x - from.x,
    dy = to.y - from.y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return Infinity;
  const b = 2 * (x * dx + y * dy),
    disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}
export function tracePondFireball(
  w: World,
  q: Projectile,
  from: { x: number; y: number },
  to: { x: number; y: number },
  bounce = 0,
): boolean {
  const pond = mirrorPondState(w.puzzles);
  if (!pond) return true;
  let first = Infinity,
    event: { kind: "wall" | "mirror" | "torch"; index: number } | undefined;
  const consider = (
    t: number,
    kind: "wall" | "mirror" | "torch",
    index: number,
  ) => {
    if (t < first) {
      first = t;
      event = { kind, index };
    }
  };
  // The perimeter geometry still blocks heroes and incoming shots. Once reflected,
  // magic travels freely across the grass so missed angles remain visible.
  if (q.pondReflection === undefined)
    for (const wall of [...pondStoneWalls, ...pondGuardrails])
      consider(contact(from, to, wall, q.radius ?? 4), "wall", 0);
  for (let i = 0; i < 4; i++) {
    if (q.pondReflection === undefined)
      consider(mirrorContact(from, to, i, pond.mirrors[i]), "mirror", i);
    const t = pondStations[i].torch;
    consider(
      torchContact(from, to, t, POND_TORCH_RADIUS + (q.radius ?? 4)),
      "torch",
      i,
    );
  }
  if (!event) {
    q.x = to.x;
    q.y = to.y;
    return (
      q.pondReflection !== undefined &&
      (to.x < -64 ||
        to.y < -64 ||
        to.x > maps.MIRROR_POND.width + 64 ||
        to.y > maps.MIRROR_POND.height + 64)
    );
  }
  const hit = {
    x: from.x + (to.x - from.x) * first,
    y: from.y + (to.y - from.y) * first,
  };
  q.x = hit.x;
  q.y = hit.y;
  // TypeScript cannot infer mutations inside consider().
  const resolved = event as {
    kind: "wall" | "mirror" | "torch";
    index: number;
  };
  if (resolved.kind === "wall") return true;
  const i = resolved.index,
    s = pondStations[i];
  if (resolved.kind === "torch") {
    if (
      q.pondReflection !== undefined &&
      q.faction !== "enemies" &&
      w.players[q.owner]?.role === "EMBER" &&
      !pond.torches[i]
    ) {
      pond.torches[i] = true;
      pond.raised = pond.torches.every(Boolean);
      w.puzzles.mirrorPond.complete = pond.raised;
      w.worldRevision++;
    }
    return true;
  }
  const speed = Math.hypot(q.vx, q.vy),
    origin = q.castOrigin;
  if (
    bounce >= 1 ||
    q.pondReflection !== undefined ||
    q.faction === "enemies" ||
    w.players[q.owner]?.role !== "EMBER" ||
    !origin ||
    Math.abs(origin.x - s.shot.x) > 32 ||
    Math.abs(origin.y - s.shot.y) > 32 ||
    speed < 1 ||
    (q.vx * s.incoming.x + q.vy * s.incoming.y) / speed < 0.98
  )
    return true;
  const tx = Math.cos(pond.mirrors[i]),
    ty = Math.sin(pond.mirrors[i]),
    dot = q.vx * tx + q.vy * ty;
  q.vx = 2 * dot * tx - q.vx;
  q.vy = 2 * dot * ty - q.vy;
  q.pondReflection = i;
  q.life = Math.max(
    q.life,
    Math.hypot(maps.MIRROR_POND.width, maps.MIRROR_POND.height) / speed + 1,
  );
  const remaining = Math.hypot(to.x - from.x, to.y - from.y) * (1 - first),
    ux = q.vx / speed,
    uy = q.vy / speed;
  const start = { x: hit.x + ux * 0.01, y: hit.y + uy * 0.01 };
  return tracePondFireball(
    w,
    q,
    start,
    { x: hit.x + ux * remaining, y: hit.y + uy * remaining },
    bounce + 1,
  );
}
