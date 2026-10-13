import { siegBasicClip, siegBasicKey } from "./siegAttack.js";
import type { Role } from "../../../../packages/shared/src/gameTypes.js";
export type CombatDirection = "down" | "up" | "left" | "right";
export const combatDirection = (facing: number): CombatDirection =>
  Math.abs(Math.cos(facing)) >= Math.abs(Math.sin(facing))
    ? Math.cos(facing) < 0
      ? "left"
      : "right"
    : Math.sin(facing) < 0
      ? "up"
      : "down";
export const combatAssets = {
  OATH: {
    url: "/assets/characters/oath/combat.png",
    frameWidth: 128,
    frameHeight: 128,
    counts: [6, 6, 6, 6],
    directions: ["right", "left", "down", "up"] as CombatDirection[],
    fps: 12,
  },
  EMBER: {
    url: "/assets/characters/ember/combat.png",
    frameWidth: 128,
    frameHeight: 128,
    counts: [6, 6, 6, 7],
    directions: ["right", "left", "down", "up"] as CombatDirection[],
    fps: 12,
  },
};
export const combatTextureKey = (role: Role, effects = false) =>
  `hero:${role}:combat${effects ? ":effects" : ""}`;
export const combatKey = (
  role: Role,
  direction: CombatDirection,
  kind = "sword",
) =>
  `${role === "OATH" && kind === "sword" ? siegBasicKey : combatTextureKey(role)}:${direction}`;
export function combatClip(role: Role, direction: CombatDirection) {
  const a = combatAssets[role],
    row = a.directions.indexOf(direction),
    count = a.counts[row];
  return {
    start: row * 8,
    end: row * 8 + count - 1,
    fps: a.fps,
    durationMs: (count / a.fps) * 1000,
  };
}

export const heavyAsset = {
  url: "/assets/characters/oath/heavy.png",
  frameWidth: 128,
  frameHeight: 128,
};
export const heavyKey = "hero:OATH:heavy";
export const heavyRow = (direction: CombatDirection) =>
  ({ right: 0, up: 1, down: 2, left: 3 })[direction] * 12;
export const heavyAnimationKey = (direction: CombatDirection, charge = false) =>
  `${heavyKey}:${direction}${charge ? ":charge" : ""}`;
export function actionClip(
  role: Role,
  direction: CombatDirection,
  kind: string,
) {
  if (role === "OATH" && kind === "sword") return siegBasicClip(direction);
  return role === "OATH" && kind === "heavy"
    ? {
        start: heavyRow(direction) + 2,
        end: heavyRow(direction) + 10,
        fps: 18,
        durationMs: 500,
      }
    : combatClip(role, direction);
}
