// Hand-coded quest knowledge, disclosed (docs/midterm/BASELINE_PLAN.md).
//
// Every constant here was worked out offline while building the scripted route
// (docs/midterm/ROUTE_LOG.md), partly with the route-development tools in
// scripts/midterm/route-dev/, which read static map geometry from the engine.
// That work passed through every scenario, including the held-out S4 and F,
// so the quest-aware baseline's knowledge of S4 and F is NOT held out.
//
// Used by the quest-aware baseline (policies/questBaseline.ts). The scripted
// route, whose prefixes build the frozen S2-S4 start states, keeps its own
// frozen copy in route/routeConstants.ts (review H3), so editing this file
// cannot move a scenario's start. Nothing here reads game state; the baseline
// still acts only on each hero's own observation and messages.
// Coordinates are tiles (32 px), y grows downward.

import type { Point } from "./navigate.js";
import type { Direction } from "../types.js";

/** Walking speed, tiles per tick. */
export const WALK_SPEED = 190 / 32 / 60;

/** Item ids as they appear in the shared backpack. */
export const ITEM = {
  shears: "enchanted_shears",
  mirror: "vanity_mirror",
  wig: "griffin_wig",
  gateKey: "hedge_gate_key",
} as const;

// ── Goddess Shrine ─────────────────────────────────────────────────────────
/** Shrine exits (maps.GODDESS_SHRINE.points). */
export const SHRINE = { west: { x: 3, y: 18 }, east: { x: 37, y: 18 }, north: { x: 20, y: 2.5 }, offering: { x: 20, y: 17 } };
/** Where Sieg stands to use each exit. */
export const SHRINE_EXIT_SPOT = {
  west: { x: SHRINE.west.x + 0.5, y: SHRINE.west.y },
  east: { x: SHRINE.east.x - 0.4, y: SHRINE.east.y },
  north: { x: SHRINE.north.x, y: SHRINE.north.y + 0.5 },
};
/** From the north arrival around the statue to the offering (route-dev/legs.ts). */
export const FINALE_PATH = {
  coco: [{ x: 23.5, y: 10.5 }, { x: 23.5, y: 14.5 }, { x: 20.5, y: 14.5 }, { x: 20.5, y: 17.5 }],
  sieg: [{ x: 16.5, y: 10.5 }, { x: 16.5, y: 14.5 }, { x: 18.5, y: 14.5 }, { x: 18.5, y: 18.5 }],
};

// ── Hedge Maze ─────────────────────────────────────────────────────────────
/** Guard fights on the way in (Coco's spot; Sieg stands one tile east). */
export const MAZE_GUARD_SPOTS = [{ x: 10, y: 34.5 }, { x: 16.5, y: 34.5 }];
/** The dry hedge is east of this spot (Fireball burns it). */
export const MAZE_HEDGE_SPOT = { x: 16.5, y: 34.5 };
/** Coco's Black Hole spot (cast east) and Sieg's waiting spot. */
export const MAZE_COW = { cocoApproach: { x: 20.5, y: 34.5 }, cocoCast: { x: 20.5, y: 25.5 }, castDirection: "e" as Direction, siegWait: { x: 17.5, y: 34.5 } };
const AROUND_COW = [{ x: 20.5, y: 27.5 }, { x: 21.5, y: 27.5 }, { x: 21.5, y: 30.5 }, { x: 27.5, y: 30.5 }];
export const MAZE_PATH = {
  cocoToGateSide: [...AROUND_COW, { x: 27.5, y: 19.5 }, { x: 32.5, y: 19.5 }],
  siegToWolf: [{ x: 20.5, y: 34.5 }, { x: 20.5, y: 27.5 }, ...AROUND_COW.slice(1), { x: 27.5, y: 15.5 }, { x: 11.5, y: 15.5 }, { x: 11.5, y: 7.5 }, { x: 19.5, y: 7.5 }],
  /** The wolf's top corridor (row 4.5), swept when the wolf is out of sight. */
  wolfCorridor: [{ x: 4, y: 4.5 }, { x: 19.5, y: 4.5 }, { x: 34, y: 4.5 }],
  /** Sieg to the gate: from the top corridor, or from the row-12.5 lane. */
  siegToGateFromTop: [{ x: 39.5, y: 4.5 }, { x: 39.5, y: 14.5 }],
  siegToGateFromLane: (x: number) => [{ x, y: 12.5 }, { x: 39.5, y: 12.5 }, { x: 39.5, y: 14.5 }],
  cocoToGate: [{ x: 33.5, y: 18.5 }, { x: 39.5, y: 18.5 }, { x: 39.5, y: 15.8 }],
  cocoToChest: [{ x: 39.5, y: 15.5 }, { x: 44.5, y: 15.5 }, { x: 44.5, y: 6.5 }],
  cocoToExit: [{ x: 42.5, y: 6.5 }, { x: 42.5, y: 12.5 }, { x: 26.5, y: 12.5 }, { x: 26.5, y: 27.5 }, { x: 24.5, y: 27.5 }, { x: 24.5, y: 30.5 }, { x: 20.5, y: 30.5 }, { x: 20.5, y: 32.5 }, { x: 4.5, y: 32.5 }, { x: 4.2, y: 34 }],
};

// ── Mirror Pond ────────────────────────────────────────────────────────────
/** Coco's flight through the culvert to the first island, and back to the exit. */
export const POND_FLIGHT_IN: Point[] = [{ x: 44, y: 31.6 }, { x: 35, y: 31 }, { x: 35, y: 27 }, { x: 28, y: 12 }];
export const POND_FLIGHT_OUT: Point[] = [{ x: 35, y: 27 }, { x: 35, y: 31 }, { x: 44, y: 31.6 }, { x: 46.3, y: 33.5 }];
/** Sieg waits here for the east spike column to retract; he is across once x < 37.5. */
export const SPIKE_MOUTH = { x: 45, y: 26 };
export const SPIKES_CROSSED_X = 37.5;
/**
 * Per mirror, Sieg's walks and push lengths from route-dev/pond-plan.ts (exact
 * 4 px paths with the hero's ±13 px box, the mirror at the angle it has at
 * that point; one push tick turns a mirror 1.5°). Phases: solve, rest, leave.
 */
export const POND_PLAN: { phase: string; walk?: number[][]; push?: number; to?: number }[][] = [[{"phase":"solve","walk":[[38.125,15.5],[37.25,14.625],[37.25,9.25],[37,9]],"push":45,"to":157.5},{"phase":"rest","walk":[[37,11],[36.5,11.5]],"push":29,"to":294},{"phase":"rest","walk":[[36.5,11.125],[38.125,9.5],[39.5,9.5]],"push":16,"to":270},{"phase":"leave","walk":[[38.875,9.5],[38.75,9.375],[38.375,9.375],[36.5,7.5]]}],[{"phase":"solve","walk":[[29.5,5.5],[29,5]],"push":45,"to":67.5},{"phase":"rest","walk":[[27,5],[26.5,4.5]],"push":29,"to":24},{"phase":"rest","walk":[[23.5,4.5]],"push":16,"to":360},{"phase":"leave","walk":[[23.5,5.125],[23.375,5.25],[23.375,5.625],[22.5,6.5]]}],[{"phase":"solve","walk":[[5.5,14],[6.5,15]],"push":45,"to":22.5},{"phase":"rest","walk":[[6.5,16.5],[7.5,17.5]],"push":29,"to":66},{"phase":"rest","walk":[[7.5,17.125],[5.875,15.5],[4.5,15.5]],"push":16,"to":90},{"phase":"leave","walk":[[4.5,21.5],[5.5,22.5]]}],[{"phase":"solve","walk":[[19,29]],"push":45,"to":292.5},{"phase":"rest","walk":[[21,29],[21.5,28.5]],"push":29,"to":156},{"phase":"rest","walk":[[22.5,28.5]],"push":16,"to":180},{"phase":"leave","walk":[[26.5,28.5],[27.5,29.5]]}]];
export const MIRROR: Point[] = [{ x: 38, y: 12 }, { x: 26, y: 6 }, { x: 6, y: 18 }, { x: 22, y: 30 }];
/** Solve angle (reflects the pad shot onto the flame) and the resting angle afterwards. */
export const MIRROR_TARGET = [157.5, 67.5, 22.5, 112.5];
export const MIRROR_REST = [90, 0, 90, 0];
/** Coco's firing pads and shot directions. */
export const PAD: Point[] = [{ x: 28, y: 12 }, { x: 26, y: 12 }, { x: 16, y: 18 }, { x: 22, y: 25 }];
export const SHOT: Direction[] = ["e", "n", "w", "s"];
/** Sieg's walk from the previous mirror to each mirror's first push spot. */
export const TO_MIRROR: Point[][] = [
  [{ x: 38.5, y: 25.5 }, { x: 38.5, y: 15.5 }],
  [{ x: 29.5, y: 7.5 }],
  [{ x: 5.5, y: 6.5 }, { x: 5.5, y: 13.5 }],
  [{ x: 5.5, y: 28.5 }, { x: 18.5, y: 28.5 }],
];
/** Sieg steps aside here once the flames are lit; Coco flies to the sanctuary chest. */
export const SANCTUARY = { siegAside: [{ x: 27.5, y: 21.5 }, { x: 24.5, y: 20.5 }], cocoChest: { x: 24, y: 19.5 } };

// ── Griffin Enclosure ──────────────────────────────────────────────────────
/** Coco flies to the nest; E there gives the griffin the tools; E again picks up the wig. */
export const GRIFFIN = { nest: { x: 20, y: 4.4 }, cocoShore: { x: 20.5, y: 14 }, siegExit: { x: 20, y: 33.4 } };
