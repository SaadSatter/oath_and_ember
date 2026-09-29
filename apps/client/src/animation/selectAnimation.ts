import type { Player } from "../../../../packages/shared/src/gameTypes.js";
import type { AnimationState, MovementMode } from "./definitions.js";
export interface VisualHints {
  hurt?: boolean;
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
  if (Math.hypot(player.vx, player.vy) <= 1) return "idle";
  if (Math.abs(player.vy) > Math.abs(player.vx))
    return player.vy < 0 ? "walk_north" : "walk_south";
  return player.vx < 0 ? "walk_west" : "walk_east";
}
