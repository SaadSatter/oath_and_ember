// Opt-in detailed Black Hole preview for the centralized player. The legacy
// navigator preview is left unchanged. All geometry comes from the observer's
// own screen/map, visible extents and public body/ability dimensions.
import type { Direction, Observation, VisibleThing } from "../types.js";
import type { HeroMemory } from "../heroMemory.js";
import { BLACK_HOLE } from "./navigator.js";

export const PULL_PREVIEW = Object.freeze({
  version: 1,
  projectileHalf: 6 / 32,
  heroHalf: 13 / 32,
  rangeError: 0.08,
});
type Rect = { x: number; y: number; w: number; h: number };
// Segment against an expanded AABB: the same swept-contact construction as
// the engine, without importing any engine/map/scenario or hidden geometry.
export function observedContact(
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: Rect,
  margin = 0,
) {
  let lo = 0,
    hi = 1;
  for (const axis of ["x", "y"] as const) {
    const delta = b[axis] - a[axis],
      min = r[axis] - margin,
      max = r[axis] + (axis === "x" ? r.w : r.h) + margin;
    if (Math.abs(delta) < 1e-10) {
      if (a[axis] < min || a[axis] > max) return undefined;
      continue;
    }
    const q1 = (min - a[axis]) / delta,
      q2 = (max - a[axis]) / delta;
    lo = Math.max(lo, Math.min(q1, q2));
    hi = Math.min(hi, Math.max(q1, q2));
    if (lo > hi) return undefined;
  }
  return hi >= 0 && lo <= 1 ? Math.max(0, lo) : undefined;
}
const units: Record<Direction, [number, number]> = {
  n: [0, -1],
  ne: [Math.SQRT1_2, -Math.SQRT1_2],
  e: [1, 0],
  se: [Math.SQRT1_2, Math.SQRT1_2],
  s: [0, 1],
  sw: [-Math.SQRT1_2, Math.SQRT1_2],
  w: [-1, 0],
  nw: [-Math.SQRT1_2, -Math.SQRT1_2],
};
const direction = (x: number, y: number): Direction | "here" =>
  Math.hypot(x, y) < 0.01
    ? "here"
    : (["e", "se", "s", "sw", "w", "nw", "n", "ne"] as const)[
        (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8
      ];
const round = (x: number) => Math.round(x * 1000) / 1000;
export function pullPreview(memory: HeroMemory, o: Observation) {
  const blockers: { rect: Rect; name: string }[] = [];
  // A drawn blocked cell is only an approximation to partial-tile geometry;
  // this uncertainty is retained in the range classification below.
  const from = o.self,
    toRange = BLACK_HOLE.rangeTiles;
  for (
    let y = Math.max(0, Math.floor(from.y - toRange - 1));
    y <= Math.min(o.area.heightTiles - 1, Math.ceil(from.y + toRange + 1));
    y++
  )
    for (
      let x = Math.max(0, Math.floor(from.x - toRange - 1));
      x <= Math.min(o.area.widthTiles - 1, Math.ceil(from.x + toRange + 1));
      x++
    )
      if (memory.terrainAt(o.area.name, x, y) === "#")
        blockers.push({
          rect: { x, y, w: 1, h: 1 },
          name: "a blocked tile on your map",
        });
  for (const v of o.visible) {
    if (v.kind === "creature" && v.extent)
      blockers.push({ rect: v.extent, name: `the body of ${v.name}` });
    if (v.kind === "enemy")
      blockers.push({
        rect: {
          x: v.x - BLACK_HOLE.enemyHalf,
          y: v.y - BLACK_HOLE.enemyHalf,
          w: 2 * BLACK_HOLE.enemyHalf,
          h: 2 * BLACK_HOLE.enemyHalf,
        },
        name: `${v.name} (enemy)`,
      });
  }
  const heroes = [
    { name: o.hero, x: o.self.x, y: o.self.y },
    ...o.visible
      .filter((v) => v.kind === "partner")
      .map((v) => ({ name: v.name, x: v.x, y: v.y })),
  ];
  return (Object.keys(units) as Direction[]).map((d) => {
    const [ux, uy] = units[d],
      end = { x: from.x + ux * toRange, y: from.y + uy * toRange };
    let fraction = 1,
      stoppedBy = "its full range";
    for (const b of blockers) {
      const hit = observedContact(
        from,
        end,
        b.rect,
        PULL_PREVIEW.projectileHalf,
      );
      if (hit !== undefined && hit < fraction) {
        fraction = hit;
        stoppedBy = b.name;
      }
    }
    const landing = {
      x: from.x + (end.x - from.x) * fraction,
      y: from.y + (end.y - from.y) * fraction,
    };
    const candidates = o.visible
      .filter((v) => ["enemy", "creature", "object"].includes(v.kind))
      .map((v) => {
        const distance = Math.hypot(v.x - landing.x, v.y - landing.y);
        const range =
          distance < BLACK_HOLE.pullTiles - PULL_PREVIEW.rangeError
            ? "within_radius"
            : distance <= BLACK_HOLE.pullTiles + PULL_PREVIEW.rangeError
              ? "boundary_uncertain"
              : "outside_radius";
        // This is a possible straight pull path, not an assertion that terrain
        // permits that displacement or that any puzzle requires it.
        const halfX = (v.extent?.w ?? (v.kind === "enemy" ? 1.25 : 0)) / 2,
          halfY = (v.extent?.h ?? (v.kind === "enemy" ? 1.25 : 0)) / 2;
        const obstructing =
          halfX && halfY
            ? heroes
                .filter((h) => {
                  const swept = observedContact(v, landing, {
                    x: h.x - halfX - PULL_PREVIEW.heroHalf,
                    y: h.y - halfY - PULL_PREVIEW.heroHalf,
                    w: 2 * (halfX + PULL_PREVIEW.heroHalf),
                    h: 2 * (halfY + PULL_PREVIEW.heroHalf),
                  });
                  return (
                    swept !== undefined &&
                    swept < 1 &&
                    Math.hypot(landing.x - v.x, landing.y - v.y) > 0.01
                  );
                })
                .map((h) => ({
                  hero: h.name,
                  x: h.x,
                  y: h.y,
                  explanation: `${h.name} stands between ${v.name} and the predicted pull destination, or overlaps its swept body. Move clear to permit that displacement.`,
                }))
            : [];
        const wallBetween = blockers.some(
          (b) =>
            b.name === "a blocked tile on your map" &&
            observedContact(landing, v, b.rect) !== undefined,
        );
        return {
          name: v.name,
          kind: v.kind,
          x: v.x,
          y: v.y,
          distance: round(distance),
          range,
          pulled_toward: direction(landing.x - v.x, landing.y - v.y),
          predicted_destination: { x: round(landing.x), y: round(landing.y) },
          obstructing_heroes: obstructing,
          ...(wallBetween ? { line_blocked_on_your_map: true } : {}),
        };
      });
    return {
      direction: d,
      stops_at: { x: round(landing.x), y: round(landing.y) },
      stopped_by: stoppedBy,
      within_pull: candidates.filter((v) => v.range === "within_radius"),
      near_pull_boundary: candidates.filter(
        (v) => v.range === "boundary_uncertain",
      ),
      uncertainty:
        "Estimated from visible cells and rounded positions. Boundary targets are not confirmed in range; terrain may constrain the pull. A shot pulls toward its landing point, not its firing direction.",
    };
  });
}
