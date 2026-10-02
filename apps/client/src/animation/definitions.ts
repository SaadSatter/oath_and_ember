import type { Role } from "../../../../packages/shared/src/gameTypes.js";
export type MovementMode = "TOP_DOWN" | "PLATFORMER";
// Semantic actions remain available to future art, but this milestone registers
// approved directional idles and walk cycles. Missing clips resolve to a deliberate fallback.
export const animationSets = {
  TOP_DOWN: [
    "idle_down",
    "idle_up",
    "idle_left",
    "idle_right",
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
  source: "file";
  url: string;
  frameWidth: number;
  frameHeight: number;
  clips: Record<MovementMode, Partial<Record<AnimationState, Clip>>>;
}
function directionalClips(): HeroAsset["clips"] {
  return {
    TOP_DOWN: {
      ...Object.fromEntries(
        ["idle_down", "idle_up", "idle_left", "idle_right"].map(
          (state, frame) => [
            state,
            { start: frame, end: frame, fps: 1, repeat: -1 },
          ],
        ),
      ),
      ...Object.fromEntries(
        ["walk_south", "walk_north", "walk_east", "walk_west"].map(
          (state, row) => [
            state,
            { start: 4 + row * 6, end: 9 + row * 6, fps: 8, repeat: -1 },
          ],
        ),
      ),
    },
    PLATFORMER: {},
  };
}
export const heroAssets: Record<Role, HeroAsset> = {
  OATH: {
    source: "file",
    url: "/assets/characters/oath/top-down.png",
    frameWidth: 48,
    frameHeight: 64,
    clips: directionalClips(),
  },
  EMBER: {
    source: "file",
    url: "/assets/characters/ember/top-down.png",
    frameWidth: 48,
    frameHeight: 64,
    clips: directionalClips(),
  },
};
export const textureKey = (role: Role) => `hero:${role}`;
export const animationKey = (
  role: Role,
  mode: MovementMode,
  state: AnimationState,
) => `${textureKey(role)}:${mode}:${state}`;
