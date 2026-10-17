import type { Rect, SceneId } from "./gameTypes.js";
import { villageInteriors, type VillageInterior } from "./villageInteriors.js";
// Visible building areas are authored world geometry, with front paths and
// doorway landings outside their footprints. Sprite padding is handled by the client.
export const settlements = {
  WILLOWBANK_VILLAGE: {
    name: "Willowbank Village",
    width: 1280,
    height: 960,
    spawn: { x: 640, y: 816 },
    paths: [
      { x: 592, y: 160, w: 96, h: 768 },
      { x: 160, y: 400, w: 960, h: 96 },
      { x: 280, y: 360, w: 64, h: 56 },
      { x: 824, y: 360, w: 64, h: 56 },
      { x: 280, y: 896, w: 712, h: 48 },
      { x: 280, y: 864, w: 64, h: 48 },
      { x: 824, y: 864, w: 64, h: 48 },
    ],
    water: [{ x: 1032, y: 64, w: 184, h: 800 }],
    buildings: [
      {
        interior: "WILLOWBANK_HOME",
        art: 2,
        x: 240,
        y: 48,
        w: 246,
        h: 312,
        door: { x: 312, y: 376 },
        label: "Riverside Home",
      },
      { art: 1, x: 784, y: 48, w: 246, h: 312, label: "Mill Storehouse" },
      { art: 2, x: 240, y: 552, w: 246, h: 312, label: "Fisherman’s Cottage" },
      { art: 1, x: 784, y: 552, w: 246, h: 312, label: "Weaver’s Cottage" },
    ],
    trees: [
      { x: 128, y: 160 },
      { x: 128, y: 544 },
      { x: 128, y: 928 },
      { x: 896, y: 544 },
    ],
  },
  STONEBRIDGE_TOWN: {
    name: "Stonebridge Town",
    width: 1536,
    height: 1152,
    spawn: { x: 768, y: 1072 },
    paths: [
      { x: 704, y: 120, w: 128, h: 1000 },
      { x: 144, y: 512, w: 1248, h: 96 },
      { x: 624, y: 352, w: 272, h: 256 },
      { x: 408, y: 468, w: 64, h: 76 },
      { x: 1000, y: 360, w: 64, h: 184 },
      { x: 200, y: 1024, w: 952, h: 64 },
      { x: 200, y: 984, w: 64, h: 56 },
      { x: 488, y: 984, w: 64, h: 56 },
      { x: 1000, y: 952, w: 64, h: 88 },
    ],
    water: [{ x: 1248, y: 704, w: 224, h: 288 }],
    buildings: [
      {
        interior: "STONEBRIDGE_INN",
        art: 3,
        x: 272,
        y: 32,
        w: 332,
        h: 436,
        door: { x: 440, y: 484 },
        label: "Stonebridge Inn",
      },
      { art: 2, x: 960, y: 48, w: 246, h: 312, label: "Market Hall" },
      { art: 1, x: 160, y: 672, w: 246, h: 312, label: "Guild House" },
      { art: 2, x: 448, y: 672, w: 246, h: 312, label: "Merchant’s House" },
      { art: 1, x: 960, y: 640, w: 246, h: 312, label: "Artisan Workshop" },
    ],
    trees: [
      { x: 1344, y: 224 },
      { x: 1120, y: 560 },
      { x: 128, y: 240 },
      { x: 128, y: 608 },
    ],
  },
} as const;
export type SettlementScene = keyof typeof settlements;
export const isSettlementScene = (id: SceneId): id is SettlementScene =>
  Object.hasOwn(settlements, id);
export function settlementWalls(id: SettlementScene): Rect[] {
  const m = settlements[id];
  return [
    { x: 0, y: 0, w: m.width, h: 32 },
    { x: 0, y: m.height - 32, w: m.width, h: 32 },
    { x: 0, y: 0, w: 32, h: m.height },
    { x: m.width - 32, y: 0, w: 32, h: m.height },
    ...settlementWaterWalls(id),
    { x: m.width / 2 - 30, y: 448, w: 60, h: 36 },
    ...m.buildings.map((b) => ({
      x: b.x,
      y: b.y + Math.round(b.h * 0.55),
      w: b.w,
      h: Math.round(b.h * 0.45),
    })),
    ...m.trees.map((t) => ({ x: t.x - 12, y: t.y - 12, w: 24, h: 24 })),
  ];
}
export interface SettlementPortal {
  from: SceneId;
  to: SceneId;
  at: { x: number; y: number };
  arrival: { x: number; y: number };
  label: string;
  stairs?: boolean;
}
export const settlementPortals: SettlementPortal[] = [];
const pair = (
  from: SceneId,
  to: SceneId,
  at: { x: number; y: number },
  arrival: { x: number; y: number },
  outLabel: string,
  backLabel: string,
  stairs = false,
) => {
  settlementPortals.push(
    { from, to, at, arrival, label: outLabel, stairs },
    { from: to, to: from, at: arrival, arrival: at, label: backLabel, stairs },
  );
};
pair(
  "EMBERBROOK_VILLAGE",
  "WILLOWBANK_VILLAGE",
  { x: 1030, y: 650 },
  { x: 640, y: 816 },
  "E · Willowbank Village",
  "E · Emberbrook Village",
);
pair(
  "WILLOWBANK_VILLAGE",
  "STONEBRIDGE_TOWN",
  { x: 640, y: 190 },
  { x: 768, y: 1072 },
  "E · Stonebridge Town",
  "E · Willowbank Village",
);
for (const id of Object.keys(settlements) as SettlementScene[]) {
  for (const b of settlements[id].buildings) {
    if (!("interior" in b)) continue;
    const room = villageInteriors[b.interior];
    pair(id, b.interior, b.door, room.leave, `E · ${room.name}`, "E · Outside");
    // Entering the room must arrive on walkable floor rather than on the border.
    settlementPortals[settlementPortals.length - 2].arrival = { ...room.spawn };
  }
}
export const stairPairs: [VillageInterior, VillageInterior][] = [
  ["VILLAGE_COTTAGE", "VILLAGE_COTTAGE_UPPER"],
  ["VILLAGE_ELDER_HOUSE", "VILLAGE_ELDER_UPPER"],
  ["VILLAGE_APOTHECARY", "VILLAGE_APOTHECARY_UPPER"],
  ["WILLOWBANK_HOME", "WILLOWBANK_HOME_UPPER"],
  ["STONEBRIDGE_INN", "STONEBRIDGE_INN_UPPER"],
];
for (const [lower, upper] of stairPairs) {
  const room = villageInteriors[upper];
  pair(
    lower,
    upper,
    room.outside,
    { ...room.leave, y: room.leave.y - 40 },
    "E · Upstairs",
    "E · Downstairs",
    true,
  );
  settlementPortals[settlementPortals.length - 2].arrival = { ...room.spawn };
}

// Tile corners describe the shoreline. Geometry is authored here, independent
// of the art's Wang-tile indices, and shared by server movement and prediction.
export const SHORE_TILE = 32;
export function settlementWaterAt(id: SettlementScene, x: number, y: number) {
  return settlements[id].water.some((r) => {
    // Elliptical banks avoid long rectangular corners and produce a smooth
    // progression of curved Wang tiles along both the pond and river bend.
    const rx = r.w / 2,
      ry = r.h / 2,
      dx = x - (r.x + rx),
      dy = y - (r.y + ry);
    return dx * dx * ry * ry + dy * dy * rx * rx < rx * rx * ry * ry;
  });
}
export function settlementWaterTiles(id: SettlementScene) {
  const out: { x: number; y: number; mask: number }[] = [];
  for (const r of settlements[id].water) {
    for (
      let y = Math.floor(r.y / SHORE_TILE) * SHORE_TILE;
      y < r.y + r.h;
      y += SHORE_TILE
    )
      for (
        let x = Math.floor(r.x / SHORE_TILE) * SHORE_TILE;
        x < r.x + r.w;
        x += SHORE_TILE
      ) {
        const mask =
          Number(settlementWaterAt(id, x, y)) |
          (Number(settlementWaterAt(id, x + SHORE_TILE, y)) * 2) |
          (Number(settlementWaterAt(id, x, y + SHORE_TILE)) * 4) |
          (Number(settlementWaterAt(id, x + SHORE_TILE, y + SHORE_TILE)) * 8);
        if (mask) out.push({ x, y, mask });
      }
  }
  return out;
}
// The solid shoreline follows the same corner field as the rendered tiles.
export function settlementWaterSolidAt(
  id: SettlementScene,
  x: number,
  y: number,
) {
  const left = Math.floor(x / SHORE_TILE) * SHORE_TILE,
    top = Math.floor(y / SHORE_TILE) * SHORE_TILE;
  const fx = (x - left) / SHORE_TILE,
    fy = (y - top) / SHORE_TILE;
  return (
    Number(settlementWaterAt(id, left, top)) * (1 - fx) * (1 - fy) +
      Number(settlementWaterAt(id, left + SHORE_TILE, top)) * fx * (1 - fy) +
      Number(settlementWaterAt(id, left, top + SHORE_TILE)) * (1 - fx) * fy +
      Number(settlementWaterAt(id, left + SHORE_TILE, top + SHORE_TILE)) *
        fx *
        fy >
    0.5
  );
}
export function settlementWaterWalls(id: SettlementScene): Rect[] {
  const out: Rect[] = [],
    step = 8;
  for (const r of settlements[id].water)
    for (
      let y = Math.floor(r.y / SHORE_TILE) * SHORE_TILE;
      y < r.y + r.h;
      y += step
    ) {
      let start: number | undefined;
      for (
        let x = Math.floor(r.x / SHORE_TILE) * SHORE_TILE;
        x <= r.x + r.w;
        x += step
      ) {
        const wet =
          x < r.x + r.w &&
          settlementWaterSolidAt(id, x + step / 2, y + step / 2);
        if (wet && start === undefined) start = x;
        if (!wet && start !== undefined) {
          out.push({ x: start, y, w: x - start, h: step });
          start = undefined;
        }
      }
    }
  return out;
}
