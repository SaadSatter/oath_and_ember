import type { SceneId, Rect } from "./gameTypes.js";
export interface MapDefinition {
  id: SceneId;
  mode: "TOP_DOWN" | "PLATFORMER";
  width: number;
  height: number;
  walls: Rect[];
  spawn: { x: number; y: number };
  points: Record<string, { x: number; y: number }>;
}
export const maps: Record<SceneId, MapDefinition> = {
  MAIN_HOUSE: {
    id: "MAIN_HOUSE",
    mode: "TOP_DOWN",
    width: 864,
    height: 640,
    spawn: { x: 560, y: 500 },
    walls: [
      { x: 0, y: 0, w: 864, h: 16 },
      { x: 0, y: 624, w: 864, h: 16 },
      { x: 0, y: 0, w: 16, h: 640 },
      { x: 848, y: 0, w: 16, h: 640 },
      { x: 280, y: 250, w: 264, h: 130 },
      { x: 212, y: 200, w: 8, h: 240 },
      { x: 616, y: 200, w: 8, h: 240 },
      { x: 212, y: 432, w: 180, h: 8 },
      { x: 488, y: 432, w: 136, h: 8 },
    ],
    points: { exit: { x: 810, y: 500 } },
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
