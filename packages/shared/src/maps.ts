import { settlements, settlementWalls } from "./settlements.js";
import {
  griffinBounds,
  griffinWater,
  griffinSpawn,
  griffinWalls,
  type GriffinState,
} from "./griffin.js";
import { shrinePoints, shrineSpawn, shrineWalls } from "./shrine.js";
import {
  pondFixedWalls,
  pondCollisionWalls,
  pondSpawn,
  type MirrorPondState,
} from "./mirrorPond.js";
import {
  mazeHedges,
  mazeDynamicWalls,
  type HedgeMazeState,
} from "./hedgeMaze.js";
import {
  bridgeFixedWalls,
  bridgeDynamicWalls,
  bridgeRoleWalls,
  BRIDGE_SIZE,
} from "./bridgePuzzle.js";
import { pushableDefinitions, pushableRect } from "./pushables.js";
import { gladeDynamicWalls, type GladeState } from "./statueGlade.js";
import type { World } from "./gameTypes.js";
import { composedScenes, type ComposedScene } from "./composedScenes.js";
import {
  exteriorTreeSolids,
  forestTreeSolids,
  aldenYardObjectSolids,
  aldenYardFenceSolids,
} from "./environmentSolids.js";
import type { SceneId, Rect } from "./gameTypes.js";
import { stallSolids } from "./storyProps.js";
import {
  WOODS_SIZE,
  woodsExit,
  woodsSpawn,
  woodsWalls,
} from "./prologueWoods.js";
import postTownSolids from "./postTownSolids.json" with { type: "json" };
import {
  villageInteriors,
  villageInteriorIds,
  villageDoorPoint,
  type VillageInterior,
} from "./villageInteriors.js";
export const postTownRoute = {
  EMBERBROOK_VILLAGE: { name: "Emberbrook Village", next: "TRANSITION_TRAIL" },
  TRANSITION_TRAIL: { name: "Transition trail", next: "GRASSLANDS" },
  GRASSLANDS: { name: "Grasslands", next: "PUZZLE_GLADE" },
  PUZZLE_GLADE: { name: "Puzzle glade", next: "MONSTER_CLEARING" },
  MONSTER_CLEARING: { name: "Monster clearing", next: "BRIDGE_RUINS" },
} as const;
export const previousMap: Partial<Record<SceneId, SceneId>> = {
  GODDESS_SHRINE: "BRIDGE_RUINS",
  GRIFFIN_ENCLOSURE: "GODDESS_SHRINE",
  MIRROR_POND: "GODDESS_SHRINE",
  HEDGE_MAZE: "GODDESS_SHRINE",
  EMBERBROOK_VILLAGE: "MAIN_HOUSE",
  TRANSITION_TRAIL: "EMBERBROOK_VILLAGE",
  GRASSLANDS: "TRANSITION_TRAIL",
  PUZZLE_GLADE: "GRASSLANDS",
  MONSTER_CLEARING: "PUZZLE_GLADE",
  BRIDGE_RUINS: "MONSTER_CLEARING",
  FOREST_RUINS: "GODDESS_SHRINE",
  AIRSHIP: "FOREST_RUINS",
  AIRSHIP_BOSS: "AIRSHIP",
};
export type PostTownScene = keyof typeof postTownRoute;
export function isPostTownScene(id: SceneId): id is PostTownScene {
  return Object.hasOwn(postTownRoute, id);
}
export interface MapDefinition {
  id: SceneId;
  mode: "TOP_DOWN" | "PLATFORMER";
  width: number;
  height: number;
  walls: Rect[];
  /** Presentation framing only; never used by movement. */
  cameraBounds?: Rect;
  gaps?: Rect[];
  /** Server-reviewed interaction area, independent of doorway artwork. */
  doorInteractionBounds?: Rect;
  spawn: { x: number; y: number };
  points: Record<string, { x: number; y: number }>;
}
export const ENVIRONMENT_SCALE = 2;
export const ENVIRONMENT_TILE_SIZE = 16;
function postTownMap(
  id: PostTownScene,
  spawn: { x: number; y: number },
  exit: { x: number; y: number },
  width = 1024,
  height = 768,
): MapDefinition {
  return {
    id,
    mode: "TOP_DOWN",
    width,
    height,
    spawn,
    // Reviewed static footprints. Art files are never loaded by the server.
    walls: [
      { x: 0, y: 0, w: width, h: 32 },
      { x: 0, y: height - 32, w: width, h: 32 },
      { x: 0, y: 0, w: 32, h: height },
      { x: width - 32, y: 0, w: 32, h: height },
      ...postTownSolids[id],
    ],
    points: { exit },
  };
}
function composedMap(id: ComposedScene): MapDefinition {
  const floor = composedScenes[id];
  return {
    id,
    mode: "TOP_DOWN",
    width: floor.width,
    height: floor.height,
    spawn: { ...floor.spawn },
    cameraBounds: floor.cameraBounds,
    doorInteractionBounds: floor.doorInteractionBounds,
    walls: floor.solids,
    points: Object.fromEntries(
      Object.entries(floor.points).map(([k, p]) => [k, { ...p }]),
    ),
  };
}
function villageInteriorMap(id: VillageInterior): MapDefinition {
  const room = villageInteriors[id];
  return {
    id,
    mode: "TOP_DOWN",
    width: room.width,
    height: room.height,
    spawn: { ...room.spawn },
    cameraBounds: room.cameraBounds,
    doorInteractionBounds: room.doorInteractionBounds,
    walls: room.solids,
    points: { leave: { ...room.leave } },
  };
}
export const maps: Record<SceneId, MapDefinition> = {
  ...(Object.fromEntries(
    Object.entries(settlements).map(([id, room]) => [
      id,
      {
        id,
        mode: "TOP_DOWN",
        width: room.width,
        height: room.height,
        spawn: room.spawn,
        walls: settlementWalls(id as keyof typeof settlements),
        points: {},
      },
    ]),
  ) as Record<keyof typeof settlements, MapDefinition>),
  ...(Object.fromEntries(
    villageInteriorIds.map((id) => [id, villageInteriorMap(id)]),
  ) as Record<VillageInterior, MapDefinition>),
  VILLAGE_COTTAGE: villageInteriorMap("VILLAGE_COTTAGE"),
  VILLAGE_ELDER_HOUSE: villageInteriorMap("VILLAGE_ELDER_HOUSE"),
  VILLAGE_APOTHECARY: villageInteriorMap("VILLAGE_APOTHECARY"),
  GRIFFIN_ENCLOSURE: {
    id: "GRIFFIN_ENCLOSURE",
    mode: "TOP_DOWN",
    width: 1280,
    height: 1152,
    spawn: griffinSpawn("OATH"),
    walls: [...griffinBounds, ...griffinWater],
    points: { back: { x: 640, y: 1088 } },
  },
  GODDESS_SHRINE: {
    id: "GODDESS_SHRINE",
    mode: "TOP_DOWN",
    width: 1280,
    height: 1024,
    spawn: shrineSpawn("OATH"),
    walls: shrineWalls,
    points: shrinePoints,
  },
  MIRROR_POND: {
    id: "MIRROR_POND",
    mode: "TOP_DOWN",
    width: 1536,
    height: 1280,
    spawn: pondSpawn("OATH"),
    walls: pondFixedWalls,
    points: { back: { x: 46.5 * 32, y: 34 * 32 } },
  },
  HEDGE_MAZE: {
    id: "HEDGE_MAZE",
    mode: "TOP_DOWN",
    width: 1536,
    height: 1280,
    spawn: { x: 4 * 32, y: 34 * 32 },
    walls: mazeHedges,
    points: { back: { x: 48, y: 34 * 32 } },
  },
  BRIDGE_RUINS: {
    id: "BRIDGE_RUINS",
    mode: "TOP_DOWN",
    ...BRIDGE_SIZE,
    spawn: { x: 464, y: 1408 },
    walls: bridgeFixedWalls,
    points: { exit: { x: 480, y: 144 } },
  },
  // Arrive on the west end of the plaza road; leave up the north road.
  EMBERBROOK_VILLAGE: postTownMap(
    "EMBERBROOK_VILLAGE",
    { x: 96, y: 350 },
    { x: 480, y: 64 },
    1152,
    832,
  ),
  TRANSITION_TRAIL: postTownMap(
    "TRANSITION_TRAIL",
    { x: 100, y: 675 },
    { x: 940, y: 675 },
  ),
  GRASSLANDS: postTownMap("GRASSLANDS", { x: 90, y: 420 }, { x: 940, y: 420 }),
  PUZZLE_GLADE: postTownMap(
    "PUZZLE_GLADE",
    { x: 180, y: 675 },
    { x: 485, y: 540 },
  ),
  MONSTER_CLEARING: postTownMap(
    "MONSTER_CLEARING",
    { x: 100, y: 300 },
    { x: 940, y: 420 },
  ),
  MAIN_HOUSE: {
    id: "MAIN_HOUSE",
    mode: "TOP_DOWN",
    width: 864,
    height: 640,
    spawn: { x: 456, y: 354 },
    walls: [
      ...exteriorTreeSolids,
      ...aldenYardObjectSolids,
      ...aldenYardFenceSolids,
      { x: 0, y: 0, w: 864, h: 16 },
      { x: 0, y: 624, w: 864, h: 16 },
      { x: 0, y: 0, w: 16, h: 640 },
      { x: 848, y: 0, w: 16, h: 640 },
      { x: 280, y: 250, w: 184, h: 64 },
      { x: 496, y: 250, w: 48, h: 64 },
      { x: 464, y: 250, w: 32, h: 48 },
    ],
    points: {
      door: { x: 480, y: 326 },
      exit: { x: 810, y: 500 },
      // Playtest shortcut: straight to the Goddess Shrine hub.
      shrine: { x: 130, y: 500 },
    },
  },
  // Alden's magic shop (scripts/build-magic-shop.py).
  HOUSE_INTERIOR: composedMap("HOUSE_INTERIOR"),
  HOUSE_UPPER: composedMap("HOUSE_UPPER"),
  // Chapter 0 prologue forest (scripts/build-prologue-forest.py).
  PROLOGUE_TRAIL: composedMap("PROLOGUE_TRAIL"),
  PROLOGUE_CLEARING: composedMap("PROLOGUE_CLEARING"),
  // The Mossling Woods tutorial: the Transition Trail's art, plus a pond.
  PROLOGUE_WOODS: {
    id: "PROLOGUE_WOODS",
    mode: "TOP_DOWN",
    ...WOODS_SIZE,
    spawn: { ...woodsSpawn },
    walls: woodsWalls,
    points: { exit: { ...woodsExit } },
  },
  FOREST_RUINS: {
    id: "FOREST_RUINS",
    mode: "TOP_DOWN",
    width: 1800,
    height: 900,
    spawn: { x: 120, y: 450 },
    walls: [
      ...forestTreeSolids,
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
      shrine: { x: 240, y: 650 },
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
    gaps: [{ x: 650, y: 610, w: 110, h: 140, terrain: "canyon" }],
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
// Emberbrook's market stalls (storyProps.ts) stand on the south lawn.
maps.EMBERBROOK_VILLAGE.walls.push(...stallSolids);
// Emberbrook Village houses: a door point on the village map for each.
for (const id of villageInteriorIds.filter(
  (id) => !villageInteriors[id].outsideScene,
))
  maps.EMBERBROOK_VILLAGE.points[villageDoorPoint(id)] = {
    ...villageInteriors[id].door,
  };
export type { VillageInterior };
// Return entrances are explicit shared interaction points, never client destinations.
for (const scene of Object.keys(previousMap) as SceneId[])
  if (
    scene !== "MIRROR_POND" &&
    scene !== "GODDESS_SHRINE" &&
    scene !== "GRIFFIN_ENCLOSURE"
  )
    maps[scene].points.back = { ...maps[scene].spawn };
export function collisionRects(
  scene: SceneId,
  puzzles: Record<
    string,
    {
      complete: boolean;
      maze?: HedgeMazeState;
      pond?: MirrorPondState;
      griffin?: GriffinState;
      glade?: GladeState;
    }
  >,
  offsets?: World["pushableOffsets"],
  bridge?: World["bridgePuzzle"],
  players: World["players"] = {},
  tick = 0,
  role?: World["players"][string]["role"],
): Rect[] {
  return [
    ...(scene === "GRIFFIN_ENCLOSURE" ? griffinWalls(puzzles) : []),
    ...(scene === "MIRROR_POND" ? pondCollisionWalls(puzzles, role) : []),
    ...(scene === "HEDGE_MAZE" ? mazeDynamicWalls(puzzles) : []),
    ...(scene === "PUZZLE_GLADE" ? gladeDynamicWalls(puzzles) : []),
    ...(scene === "BRIDGE_RUINS"
      ? [...bridgeDynamicWalls(bridge, players, tick), ...bridgeRoleWalls(role)]
      : []),
    ...maps[scene].walls.map((rect) => {
      const d = pushableDefinitions.find(
        (d) =>
          d.scene === scene &&
          d.rect.x === rect.x &&
          d.rect.y === rect.y &&
          d.rect.w === rect.w &&
          d.rect.h === rect.h,
      );
      return d ? pushableRect(d, offsets) : rect;
    }),
    ...(scene === "FOREST_RUINS"
      ? [
          ...(!puzzles.gate?.complete
            ? [{ x: 450, y: 370, w: 35, h: 160 }]
            : []),
          ...(!puzzles.bridge?.complete
            ? [{ x: 1050, y: 370, w: 35, h: 160, terrain: "water" as const }]
            : []),
        ]
      : []),
  ];
}
