import type { Rect } from "./gameTypes.js";
// Ground bases only, in world units. Canopies remain traversable overhead.
// These match the existing tree placements and trunk-base anchors; no art data
// or image dimensions participate in authoritative movement.
export const exteriorTrees = [
  { x: 480, y: 128 },
  { x: 80, y: 160 },
  { x: 640, y: 224 },
  { x: 144, y: 320 },
  { x: 816, y: 384 },
  { x: 48, y: 416 },
  { x: 256, y: 576 },
  { x: 672, y: 608 },
];
const trunkWidths = [40, 28, 24, 40, 28, 28];
export const treeFootprint = (x: number, y: number, index: number): Rect => ({
  x: x - trunkWidths[index % 6] / 2,
  y: y - 12,
  w: trunkWidths[index % 6],
  h: 12,
});
export const exteriorTreeSolids = exteriorTrees.map((p, i) =>
  treeFootprint(p.x, p.y, i),
);
export const forestTreeSolids: Rect[] = [];
for (let n = 0; n < 50; n++) {
  const x = 70 + ((n * 137) % 1650),
    y = 80 + ((n * 241) % 730);
  if (Math.abs(y - 450) > 130) forestTreeSolids.push(treeFootprint(x, y, n));
}
