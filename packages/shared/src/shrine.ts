import type { World, Rect, Role } from "./gameTypes.js";
export const SHRINE_OFFERING = "bald-goddess-offering";
export const shrineComplete = (w: Pick<World, "inventory">) =>
  !!w.inventory?.completed.includes(SHRINE_OFFERING);
export const shrinePoints = {
  west: { x: 96, y: 576 },
  east: { x: 1184, y: 576 },
  north: { x: 640, y: 80 },
  back: { x: 640, y: 960 },
  offering: { x: 640, y: 544 },
};
export const shrineSpawn = (role: Role | null) => ({
  x: role === "EMBER" ? 688 : 592,
  y: 880,
});
export const shrinePaths: Rect[] = [
  { x: 384, y: 224, w: 512, h: 544 },
  { x: 64, y: 480, w: 320, h: 192 },
  { x: 896, y: 480, w: 320, h: 192 },
  { x: 544, y: 32, w: 192, h: 192 },
  { x: 544, y: 768, w: 192, h: 224 },
  { x: 384, y: 800, w: 512, h: 192 },
];
export const shrinePlinth: Rect = { x: 560, y: 365, w: 160, h: 72 };
export const shrineTrees = [
  { x: 160, y: 192 },
  { x: 256, y: 320 },
  { x: 160, y: 800 },
  { x: 1088, y: 192 },
  { x: 992, y: 320 },
  { x: 1120, y: 832 },
  { x: 384, y: 96 },
  { x: 896, y: 96 },
];
export const shrineWalls: Rect[] = [
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 1000, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 1024 },
  { x: 1256, y: 0, w: 24, h: 1024 },
  shrinePlinth,
  ...shrineTrees.map((p) => ({ x: p.x - 15, y: p.y - 16, w: 30, h: 26 })),
];

export const shrineShrubs = [
  { x: 320, y: 416 },
  { x: 960, y: 416 },
  { x: 320, y: 736 },
  { x: 960, y: 736 },
  { x: 448, y: 160 },
  { x: 832, y: 160 },
];
shrineWalls.push(
  ...shrineShrubs.map((p) => ({ x: p.x - 24, y: p.y - 14, w: 48, h: 28 })),
);
