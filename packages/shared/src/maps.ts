import type { SceneId, Rect } from "./gameTypes.js";
export interface MapDefinition {
  id: SceneId;
  mode: "TOP_DOWN" | "PLATFORMER";
  width: number;
  height: number;
  walls: Rect[];
  /** Presentation framing only; never used by movement. */
  cameraBounds?: Rect;
  spawn: { x: number; y: number };
  points: Record<string, { x: number; y: number }>;
}
export const ENVIRONMENT_SCALE = 2;
export const ENVIRONMENT_TILE_SIZE = 16;
export const maps: Record<SceneId, MapDefinition> = {
  MAIN_HOUSE: {
    id: "MAIN_HOUSE",
    mode: "TOP_DOWN",
    width: 864,
    height: 640,
    spawn: { x: 456, y: 354 },
    walls: [
      { x: 0, y: 0, w: 864, h: 16 },
      { x: 0, y: 624, w: 864, h: 16 },
      { x: 0, y: 0, w: 16, h: 640 },
      { x: 848, y: 0, w: 16, h: 640 },
      { x: 280, y: 250, w: 184, h: 64 },
      { x: 496, y: 250, w: 48, h: 64 },
      { x: 464, y: 250, w: 32, h: 48 },
      { x: 276, y: 314, w: 44, h: 42 },
      { x: 540, y: 322, w: 28, h: 36 },
      { x: 346, y: 534, w: 188, h: 90 },
      { x: 590, y: 524, w: 44, h: 80 },
      { x: 212, y: 200, w: 8, h: 240 },
      { x: 616, y: 200, w: 8, h: 240 },
      { x: 212, y: 432, w: 252, h: 8 },
      { x: 496, y: 432, w: 128, h: 8 },
    ],
    points: { door: { x: 480, y: 326 }, exit: { x: 810, y: 500 } },
  },
  HOUSE_INTERIOR: {
    id: "HOUSE_INTERIOR",
    mode: "TOP_DOWN",
    width: 832,
    height: 704,
    spawn: { x: 608, y: 454 },
    cameraBounds: { x: 160, y: 160, w: 512, h: 352 },
    // Manually reviewed solid footprints in normalized TMX coordinates ×2.
    // Walls block their bases, not the decorative vertical artwork above them.
    walls: [
      { x: 0, y: 0, w: 832, h: 192 },
      { x: 0, y: 192, w: 160, h: 512 },
      { x: 672, y: 192, w: 160, h: 512 },
      { x: 160, y: 512, w: 512, h: 192 },
      { x: 160, y: 192, w: 128, h: 64 },
      { x: 160, y: 344, w: 128, h: 96 },
      { x: 280, y: 352, w: 16, h: 160 },
      { x: 504, y: 192, w: 16, h: 222 },
      { x: 520, y: 320, w: 152, h: 24 },
      { x: 520, y: 344, w: 72, h: 70 },
      { x: 624, y: 344, w: 48, h: 70 },
      { x: 296, y: 226, w: 42, h: 72 },
      { x: 344, y: 240, w: 24, h: 34 },
      { x: 456, y: 192, w: 48, h: 86 },
      { x: 472, y: 274, w: 32, h: 60 },
      { x: 340, y: 356, w: 122, h: 106 },
      { x: 164, y: 440, w: 60, h: 54 },
      { x: 250, y: 454, w: 28, h: 42 },
      { x: 200, y: 256, w: 48, h: 70 },
      { x: 568, y: 214, w: 88, h: 62 },
    ],
    points: { door: { x: 608, y: 430 } },
  },
  FOREST_RUINS: {
    id: "FOREST_RUINS",
    mode: "TOP_DOWN",
    width: 1800,
    height: 900,
    spawn: { x: 120, y: 450 },
    walls: [
      { x: 0, y: 0, w: 1800, h: 35 },
      { x: 0, y: 865, w: 1800, h: 35 },
      { x: 0, y: 0, w: 35, h: 900 },
      { x: 1765, y: 0, w: 35, h: 900 },
      { x: 450, y: 35, w: 35, h: 335 },
      { x: 450, y: 530, w: 35, h: 335 },
      { x: 1050, y: 35, w: 35, h: 335 },
      { x: 1050, y: 530, w: 35, h: 335 },
    ],
    points: {
      bramble: { x: 410, y: 400 },
      rune: { x: 410, y: 505 },
      crate: { x: 790, y: 430 },
      plate: { x: 945, y: 430 },
      crystal: { x: 920, y: 520 },
      exit: { x: 1670, y: 450 },
    },
  },
  AIRSHIP: {
    id: "AIRSHIP",
    mode: "PLATFORMER",
    width: 1800,
    height: 750,
    spawn: { x: 100, y: 620 },
    walls: [
      { x: 0, y: 690, w: 650, h: 60 },
      { x: 760, y: 690, w: 1040, h: 60 },
      { x: 590, y: 585, w: 230, h: 25 },
      { x: 980, y: 570, w: 200, h: 25 },
      { x: 0, y: 0, w: 30, h: 750 },
      { x: 1770, y: 0, w: 30, h: 750 },
    ],
    points: {
      crank: { x: 1250, y: 660 },
      core: { x: 1390, y: 660 },
      exit: { x: 1680, y: 660 },
    },
  },
  AIRSHIP_BOSS: {
    id: "AIRSHIP_BOSS",
    mode: "PLATFORMER",
    width: 1200,
    height: 750,
    spawn: { x: 100, y: 620 },
    walls: [
      { x: 0, y: 690, w: 1200, h: 60 },
      { x: 0, y: 0, w: 30, h: 750 },
      { x: 1170, y: 0, w: 30, h: 750 },
    ],
    points: { anchor: { x: 820, y: 655 }, boss: { x: 970, y: 650 } },
  },
};
export function collisionRects(
  scene: SceneId,
  puzzles: Record<string, { complete: boolean }>,
): Rect[] {
  return [
    ...maps[scene].walls,
    ...(scene === "FOREST_RUINS"
      ? [
          ...(!puzzles.gate?.complete
            ? [{ x: 450, y: 370, w: 35, h: 160 }]
            : []),
          ...(!puzzles.bridge?.complete
            ? [{ x: 1050, y: 370, w: 35, h: 160 }]
            : []),
        ]
      : []),
  ];
}
