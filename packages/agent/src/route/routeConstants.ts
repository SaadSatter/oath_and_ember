// Frozen constants of the scripted route (review H3).
//
// The S2-S4 scenario start states are reached by replaying a prefix of the
// scripted route (suite.ts). That prefix must never move when the quest-aware
// baseline's knowledge (policies/questKnowledge.ts) is edited, so the route
// keeps its own copy here, deep-frozen. The values were copied unchanged from
// questKnowledge.ts at commit bc377ee; test/route/checkpointFreeze.test.ts pins
// the resulting start-state hashes. Do not edit these: a change alters the
// frozen evaluation suite and needs the owner's approval and a suite change-log
// entry.
// Coordinates are tiles (32 px), y grows downward.

import type { Point } from "../policies/navigate.js";
import type { Direction } from "../types.js";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

export const WALK_SPEED = 190 / 32 / 60;

const SHRINE_VALUE = { west: { x: 3, y: 18 }, east: { x: 37, y: 18 }, north: { x: 20, y: 2.5 }, offering: { x: 20, y: 17 } };

const POND_PLAN_VALUE: { phase: string; walk?: number[][]; push?: number; to?: number }[][] = [[{"phase":"solve","walk":[[38.125,15.5],[37.25,14.625],[37.25,9.25],[37,9]],"push":45,"to":157.5},{"phase":"rest","walk":[[37,11],[36.5,11.5]],"push":29,"to":294},{"phase":"rest","walk":[[36.5,11.125],[38.125,9.5],[39.5,9.5]],"push":16,"to":270},{"phase":"leave","walk":[[38.875,9.5],[38.75,9.375],[38.375,9.375],[36.5,7.5]]}],[{"phase":"solve","walk":[[29.5,5.5],[29,5]],"push":45,"to":67.5},{"phase":"rest","walk":[[27,5],[26.5,4.5]],"push":29,"to":24},{"phase":"rest","walk":[[23.5,4.5]],"push":16,"to":360},{"phase":"leave","walk":[[23.5,5.125],[23.375,5.25],[23.375,5.625],[22.5,6.5]]}],[{"phase":"solve","walk":[[5.5,14],[6.5,15]],"push":45,"to":22.5},{"phase":"rest","walk":[[6.5,16.5],[7.5,17.5]],"push":29,"to":66},{"phase":"rest","walk":[[7.5,17.125],[5.875,15.5],[4.5,15.5]],"push":16,"to":90},{"phase":"leave","walk":[[4.5,21.5],[5.5,22.5]]}],[{"phase":"solve","walk":[[19,29]],"push":45,"to":292.5},{"phase":"rest","walk":[[21,29],[21.5,28.5]],"push":29,"to":156},{"phase":"rest","walk":[[22.5,28.5]],"push":16,"to":180},{"phase":"leave","walk":[[26.5,28.5],[27.5,29.5]]}]];

const MIRROR_VALUE: Point[] = [{ x: 38, y: 12 }, { x: 26, y: 6 }, { x: 6, y: 18 }, { x: 22, y: 30 }];

const MIRROR_TARGET_VALUE = [157.5, 67.5, 22.5, 112.5];

const MIRROR_REST_VALUE = [90, 0, 90, 0];

const PAD_VALUE: Point[] = [{ x: 28, y: 12 }, { x: 26, y: 12 }, { x: 16, y: 18 }, { x: 22, y: 25 }];

const SHOT_VALUE: Direction[] = ["e", "n", "w", "s"];

const TO_MIRROR_VALUE: Point[][] = [
  [{ x: 38.5, y: 25.5 }, { x: 38.5, y: 15.5 }],
  [{ x: 29.5, y: 7.5 }],
  [{ x: 5.5, y: 6.5 }, { x: 5.5, y: 13.5 }],
  [{ x: 5.5, y: 28.5 }, { x: 18.5, y: 28.5 }],
];


export const SHRINE = deepFreeze(SHRINE_VALUE);
export const POND_PLAN = deepFreeze(POND_PLAN_VALUE);
export const MIRROR = deepFreeze(MIRROR_VALUE);
export const MIRROR_TARGET = deepFreeze(MIRROR_TARGET_VALUE);
export const MIRROR_REST = deepFreeze(MIRROR_REST_VALUE);
export const PAD = deepFreeze(PAD_VALUE);
export const SHOT = deepFreeze(SHOT_VALUE);
export const TO_MIRROR = deepFreeze(TO_MIRROR_VALUE);
