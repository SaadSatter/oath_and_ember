import type { Puzzle, Rect, Role, Player } from "./gameTypes.js";
export type GriffinPhase =
  | "FLY"
  | "PULLED"
  | "TAKEOFF"
  | "LAND"
  | "BEAM_CHARGE"
  | "BEAM"
  | "HEADBUTT_CHARGE"
  | "HEADBUTT"
  | "STUNNED"
  | "DISTRACTED"
  | "DEFEATED";
export interface GriffinState {
  x: number;
  y: number;
  facing: number;
  hp: number;
  phase: GriffinPhase;
  timer: number;
  clock: number;
  grounded: number;
  cooldown: number;
  aimX: number;
  aimY: number;
  attackHits: string[];
  beamStarted?: number;
  beam?: { x: number; y: number; contactId: string; impactClock: number };
  pillars: boolean[];
  stationary: number;
  lastSiegX: number;
  lastSiegY: number;
  mirrorDelivered: boolean;
  wigClaimed: boolean;
}
export const griffinNest = { x: 640, y: 112 };
export const GRIFFIN_NEST = "griffin-nest";
export const griffinPillars: Rect[] = [
  { x: 352, y: 544, w: 64, h: 64 },
  { x: 864, y: 544, w: 64, h: 64 },
  { x: 352, y: 832, w: 64, h: 64 },
  { x: 864, y: 832, w: 64, h: 64 },
];
export const griffinWater: Rect[] = [
  { x: 24, y: 24, w: 536, h: 360, terrain: "water" },
  { x: 720, y: 24, w: 536, h: 360, terrain: "water" },
  { x: 560, y: 192, w: 160, h: 192, terrain: "water" },
];
export const griffinTrees = [
  { x: 96, y: 704 },
  { x: 1184, y: 704 },
  { x: 176, y: 992 },
  { x: 1104, y: 992 },
];
export const griffinBounds: Rect[] = [
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 1128, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 1152 },
  { x: 1256, y: 0, w: 24, h: 1152 },
];
griffinBounds.push(
  ...griffinTrees.map((p) => ({ x: p.x - 15, y: p.y + 40, w: 30, h: 26 })),
);
export const griffinSpawn = (role: Role | null) => ({
  x: role === "EMBER" ? 688 : 592,
  y: 1056,
});
export const newGriffin = (): GriffinState => ({
  x: 640,
  y: 256,
  facing: Math.PI / 2,
  hp: 320,
  phase: "FLY",
  timer: 0,
  clock: 0,
  grounded: 0,
  cooldown: 2,
  aimX: 640,
  aimY: 1000,
  attackHits: [],
  pillars: [false, false, false, false],
  stationary: 0,
  lastSiegX: 0,
  lastSiegY: 0,
  mirrorDelivered: false,
  wigClaimed: false,
});
export const griffinState = (p: Record<string, { griffin?: GriffinState }>) =>
  p.griffin?.griffin;
export const griffinWalls = (
  p: Record<string, { griffin?: GriffinState }>,
): Rect[] => griffinPillars.filter((_, i) => !griffinState(p)?.pillars[i]);
export const griffinPuzzle = (): Puzzle => ({
  id: "griffin",
  physical: false,
  arcane: false,
  complete: false,
  progress: 0,
  griffin: newGriffin(),
});
export const griffinAirborne = (g: GriffinState) =>
  g.grounded <= 0 && !["STUNNED", "DEFEATED", "DISTRACTED"].includes(g.phase);

export const griffinBeamDuration = 2;
export const griffinPullTuning = {
  radius: 160,
  strength: 2.2,
  landingY: 432,
  grounded: 14,
} as const;
export const griffinMouthDirections = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
] as const;
export function griffinMouthDirection(facing: number) {
  return [
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
    "north",
    "north-east",
  ][
    ((Math.round(facing / (Math.PI / 4)) % 8) + 8) % 8
  ] as (typeof griffinMouthDirections)[number];
}
/** Native pose coordinates relative to the same stable anchor as movement sprites. */
export function griffinMouth(g: GriffinState) {
  const offsets = {
    south: [0, -28],
    "south-east": [36, -24],
    east: [49, -41],
    "north-east": [19, -56],
    north: [0, -69],
    "north-west": [-23, -56],
    west: [-49, -41],
    "south-west": [-36, -24],
  };
  const [x, y] = offsets[griffinMouthDirection(g.facing)];
  return { x: g.x + x, y: g.y + y - (griffinAirborne(g) ? 22 : 0) };
}
/** First solid/player contact, shared by the warning and authoritative beam. */
export function griffinBeamEnd(
  g: GriffinState,
  walls: Rect[],
  players: Player[] = [],
) {
  const origin = griffinMouth(g),
    dx = Math.cos(g.facing),
    dy = Math.sin(g.facing);
  let length = 1500,
    contactId = "range";
  const blockers = [
    ...walls.map((r, i) => ({ ...r, id: `solid:${i}` })),
    ...players
      .filter(
        (p) => p.connected && p.hp > 0 && p.sceneId === "GRIFFIN_ENCLOSURE",
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => ({
        x: p.x - 21,
        y: p.y - 21,
        w: 42,
        h: 42,
        id: `player:${p.id}`,
      })),
  ];
  for (const r of blockers) {
    let low = 0,
      high = length;
    for (const [start, delta, min, max] of [
      [origin.x, dx, r.x, r.x + r.w],
      [origin.y, dy, r.y, r.y + r.h],
    ]) {
      if (Math.abs(delta) < 1e-9) {
        if (start < min || start > max) {
          high = -1;
          break;
        }
      } else {
        const a = (min - start) / delta,
          b = (max - start) / delta;
        low = Math.max(low, Math.min(a, b));
        high = Math.min(high, Math.max(a, b));
      }
    }
    if (high >= low && low >= 0 && low < length) {
      length = low;
      contactId = r.id;
    }
  }
  return { x: origin.x + dx * length, y: origin.y + dy * length, contactId };
}
