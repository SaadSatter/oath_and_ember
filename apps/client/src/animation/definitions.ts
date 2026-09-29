import type { Role } from "../../../../packages/shared/src/gameTypes.js";
export type MovementMode = "TOP_DOWN" | "PLATFORMER";
export const animationSets = {
  TOP_DOWN: [
    "idle",
    "walk_north",
    "walk_south",
    "walk_east",
    "walk_west",
    "primary_attack",
    "secondary_ability",
    "interact_channel",
    "hurt",
  ],
  PLATFORMER: [
    "idle",
    "run",
    "jump",
    "fall",
    "primary_attack",
    "secondary_ability",
    "interact_channel",
    "hurt",
  ],
} as const;
export type AnimationState = (typeof animationSets)[MovementMode][number];
export interface Clip {
  start: number;
  end: number;
  fps: number;
  repeat: number;
}
export interface HeroAsset {
  source: "generated" | "file";
  url: string;
  frameWidth: number;
  frameHeight: number;
  origin: { x: number; y: number };
  scale: number;
  clips: Record<MovementMode, Partial<Record<AnimationState, Clip>>>;
}
// Frame numbers belong exclusively to the art manifest, never gameplay scenes.
function clips(): HeroAsset["clips"] {
  let row = 0;
  const result: HeroAsset["clips"] = { TOP_DOWN: {}, PLATFORMER: {} };
  for (const mode of ["TOP_DOWN", "PLATFORMER"] as const)
    for (const state of animationSets[mode]) {
      result[mode][state] = {
        start: row * 4,
        end: row * 4 + 3,
        fps: state === "idle" ? 6 : state === "hurt" ? 12 : 10,
        repeat: ["primary_attack", "hurt"].includes(state) ? 0 : -1,
      };
      row++;
    }
  return result;
}
export const heroAssets: Record<Role, HeroAsset> = {
  OATH: {
    source: "generated",
    url: "/assets/characters/oath/oath.png",
    frameWidth: 64,
    frameHeight: 64,
    origin: { x: 0.5, y: 0.5 },
    scale: 1,
    clips: clips(),
  },
  EMBER: {
    source: "generated",
    url: "/assets/characters/ember/ember.png",
    frameWidth: 64,
    frameHeight: 64,
    origin: { x: 0.5, y: 0.5 },
    scale: 1,
    clips: clips(),
  },
};
export const textureKey = (role: Role) => `hero:${role}`;
export const animationKey = (
  role: Role,
  mode: MovementMode,
  state: AnimationState,
) => `${textureKey(role)}:${mode}:${state}`;
