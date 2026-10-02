import type { Player } from "../../../../packages/shared/src/gameTypes.js";
import {
  heroAssets,
  type AnimationState,
  type MovementMode,
} from "./definitions.js";
import type { Role } from "../../../../packages/shared/src/gameTypes.js";
export interface VisualHints {
  hurt?: boolean;
  serverTick?: number;
  interacting?: boolean;
}
// Reads state only. Visual hints never change HP, movement, cooldowns or actions.
export function selectAnimation(
  player: Readonly<Player>,
  mode: MovementMode,
  hints: VisualHints = {},
): AnimationState {
  if (hints.hurt || player.actionState === "hurt") return "hurt";
  if (player.actionState === "attack") return "primary_attack";
  if (player.actionState === "guard" || player.actionState === "secondary")
    return "secondary_ability";
  if (hints.interacting || ["interact", "channel"].includes(player.actionState))
    return "interact_channel";
  if (mode === "PLATFORMER") {
    if (!player.grounded) return player.vy < 0 ? "jump" : "fall";
    return Math.abs(player.vx) > 1 ? "run" : "idle";
  }
  if (Math.hypot(player.vx, player.vy) <= 1)
    return directionalIdle(player.facing);
  if (Math.abs(player.vy) > Math.abs(player.vx))
    return player.vy < 0 ? "walk_north" : "walk_south";
  return player.vx < 0 ? "walk_west" : "walk_east";
}

// Facing is already carried by authoritative snapshots and by local prediction.
// Use its cardinal sector even at rest, rather than inferring from noisy
// interpolated position deltas that can flicker as snapshots arrive.
export function directionalIdle(facing: number): AnimationState {
  const x = Math.cos(facing),
    y = Math.sin(facing);
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? "idle_left" : "idle_right";
  return y < 0 ? "idle_up" : "idle_down";
}
export function resolveHeroAnimation(
  role: Role,
  mode: MovementMode,
  state: AnimationState,
  facing: number,
): AnimationState | null {
  const clips = heroAssets[role].clips[mode];
  if (clips[state]) return state;
  if (mode === "PLATFORMER") return null; // Never pass top-down art off as side-view.
  const idle = directionalIdle(facing);
  return clips[idle] ? idle : null;
}
