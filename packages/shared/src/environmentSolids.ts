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
/**
 * The old tree above Alden's grave (Chapter 0): one large ember-leaved tree
 * stands where three ordinary ones did, so the grave stands apart. `replaces`
 * are indexes into exteriorTrees that are no longer drawn or solid.
 */
export const oldTree = {
  x: 100,
  y: 330,
  replaces: [1, 3, 5],
  footprint: { x: 74, y: 318, w: 52, h: 12 } as Rect,
};
export const exteriorTreeSolids = [
  ...exteriorTrees.flatMap((p, i) =>
    oldTree.replaces.includes(i) ? [] : [treeFootprint(p.x, p.y, i)],
  ),
  oldTree.footprint,
];
export const aldenYardObjects: { id: string; footprint: Rect }[] = [
  { id: "northwest-boulder", footprint: { x: 148, y: 112, w: 56, h: 32 } },
  { id: "north-cairn", footprint: { x: 558, y: 62, w: 36, h: 20 } },
  { id: "northeast-boulder", footprint: { x: 694, y: 82, w: 52, h: 24 } },
  { id: "southwest-rocks", footprint: { x: 70, y: 566, w: 46, h: 32 } },
  { id: "west-road-rock", footprint: { x: 148, y: 476, w: 24, h: 12 } },
  { id: "southwest-pebble", footprint: { x: 38, y: 528, w: 20, h: 14 } },
  { id: "south-pebble", footprint: { x: 360, y: 556, w: 22, h: 18 } },
  { id: "south-boulder", footprint: { x: 406, y: 576, w: 88, h: 40 } },
  { id: "south-cairn", footprint: { x: 526, y: 570, w: 44, h: 28 } },
  { id: "east-road-rock", footprint: { x: 708, y: 430, w: 22, h: 16 } },
  { id: "southeast-rock", footprint: { x: 788, y: 538, w: 34, h: 24 } },
  { id: "well", footprint: { x: 654, y: 296, w: 50, h: 24 } },
  { id: "west-stump", footprint: { x: 58, y: 210, w: 40, h: 18 } },
  { id: "north-stump", footprint: { x: 366, y: 64, w: 36, h: 18 } },
  { id: "east-stump", footprint: { x: 726, y: 350, w: 34, h: 26 } },
  { id: "fallen-branch", footprint: { x: 702, y: 218, w: 22, h: 26 } },
  { id: "scarecrow-post", footprint: { x: 756, y: 178, w: 20, h: 28 } },
  { id: "porch-crates", footprint: { x: 276, y: 314, w: 44, h: 42 } },
  { id: "east-crate", footprint: { x: 560, y: 286, w: 26, h: 26 } },
  { id: "porch-barrel", footprint: { x: 538, y: 344, w: 24, h: 28 } },
  { id: "north-shrub", footprint: { x: 244, y: 94, w: 32, h: 18 } },
  { id: "northeast-shrub", footprint: { x: 800, y: 96, w: 32, h: 20 } },
  { id: "east-small-shrub", footprint: { x: 840, y: 138, w: 18, h: 18 } },
  { id: "west-shrub", footprint: { x: 8, y: 252, w: 44, h: 20 } },
  { id: "garden-shrub", footprint: { x: 282, y: 402, w: 38, h: 24 } },
  { id: "garden-small-shrub", footprint: { x: 548, y: 398, w: 22, h: 16 } },
  { id: "gate-shrub", footprint: { x: 398, y: 452, w: 40, h: 22 } },
  { id: "east-shrub", footprint: { x: 652, y: 386, w: 34, h: 24 } },
  { id: "southwest-shrub", footprint: { x: 166, y: 584, w: 58, h: 26 } },
  { id: "northwest-mushrooms", footprint: { x: 174, y: 168, w: 32, h: 22 } },
  { id: "north-mushrooms", footprint: { x: 494, y: 128, w: 42, h: 28 } },
  { id: "garden-mushroom", footprint: { x: 396, y: 382, w: 34, h: 22 } },
  { id: "gate-mushrooms", footprint: { x: 526, y: 448, w: 34, h: 22 } },
];
export const aldenYardObjectSolids = aldenYardObjects.map(
  (object) => object.footprint,
);
export const aldenYardFenceSolids: Rect[] = [
  { x: 212, y: 176, w: 412, h: 16 },
  { x: 212, y: 176, w: 8, h: 264 },
  { x: 616, y: 176, w: 8, h: 264 },
  { x: 212, y: 432, w: 252, h: 8 },
  { x: 496, y: 432, w: 128, h: 8 },
];
export const forestTreeSolids: Rect[] = [];
for (let n = 0; n < 50; n++) {
  const x = 70 + ((n * 137) % 1650),
    y = 80 + ((n * 241) % 730);
  if (Math.abs(y - 450) > 130) forestTreeSolids.push(treeFootprint(x, y, n));
}
