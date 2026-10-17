import type { SceneId, World, Player, Rect } from "./gameTypes.js";
import solids from "./postTownSolids.json" with { type: "json" };
// Reviewed object indices match the approved puzzle-map artwork and footprints.
export const pushableDefinitions = [
  {
    id: "puzzle-chair",
    scene: "PUZZLE_GLADE" as SceneId,
    objectIndex: 0,
    label: "Pushable chair",
    rect: solids.PUZZLE_GLADE[0],
  },
  // The statue doesn't want these — and says so when they're pushed to her.
  {
    id: "puzzle-gold-rock",
    scene: "PUZZLE_GLADE" as SceneId,
    objectIndex: 1,
    label: "Pushable rock",
    rect: solids.PUZZLE_GLADE[1],
  },
  {
    id: "puzzle-purple-rock",
    scene: "PUZZLE_GLADE" as SceneId,
    objectIndex: 3,
    label: "Pushable rock",
    rect: solids.PUZZLE_GLADE[3],
  },
];
export function pushableRect(
  definition: (typeof pushableDefinitions)[number],
  offsets: World["pushableOffsets"],
): Rect {
  const offset = offsets?.[definition.id];
  return {
    ...definition.rect,
    x: definition.rect.x + (offset?.x ?? 0),
    y: definition.rect.y + (offset?.y ?? 0),
  };
}
export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
// Server-only caller validates intent, scene, reach, facing and collision.
export function pushNearby(
  p: Player,
  scene: SceneId,
  world: World,
  walls: Rect[],
  dt: number,
) {
  const dx = Math.cos(p.facing),
    dy = Math.sin(p.facing);
  for (const definition of pushableDefinitions.filter(
    (d) => d.scene === scene,
  )) {
    const rect = pushableRect(definition, world.pushableOffsets);
    const cx = Math.max(rect.x, Math.min(rect.x + rect.w, p.x));
    const cy = Math.max(rect.y, Math.min(rect.y + rect.h, p.y));
    if (
      Math.hypot(cx - p.x, cy - p.y) > 40 ||
      (cx - p.x) * dx + (cy - p.y) * dy < 0
    )
      continue;
    const next = {
      ...rect,
      x: rect.x + dx * dt * 60,
      y: rect.y + dy * dt * 60,
    };
    const obstacles = walls.filter(
      (r) =>
        !(r.x === rect.x && r.y === rect.y && r.w === rect.w && r.h === rect.h),
    );
    if (obstacles.some((r) => overlaps(next, r))) return;
    if (
      Object.values(world.players).some(
        (other) =>
          other.id !== p.id &&
          other.hp > 0 &&
          (other.sceneId ?? world.sceneId) === scene &&
          overlaps(next, { x: other.x - 10, y: other.y - 12, w: 20, h: 24 }),
      )
    )
      return;
    world.pushableOffsets ??= {};
    const old = world.pushableOffsets[definition.id] ?? { x: 0, y: 0 };
    world.pushableOffsets[definition.id] = {
      x: old.x + dx * dt * 60,
      y: old.y + dy * dt * 60,
    };
    return;
  }
}
