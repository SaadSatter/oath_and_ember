import type { Player } from "../../../../packages/shared/src/gameTypes.js";
import {
  heroAssets,
  type AnimationState,
  type MovementMode,
} from "./definitions.js";
import type { Role } from "../../../../packages/shared/src/gameTypes.js";
export interface VisualHints {
  slowTimeStarting?: boolean;
  timeScale?: number;
  hurt?: boolean;
  serverTick?: number;
  interacting?: boolean;
  scriptedWalking?: boolean;
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
  if (
    (hints.interacting && !hints.scriptedWalking) ||
    ["interact", "channel"].includes(player.actionState)
  )
    return "interact_channel";
  const vx = player.movementIntent?.x ?? player.vx;
  const vy = player.movementIntent?.y ?? player.vy;
  if (mode === "PLATFORMER") {
    if (!player.grounded) return player.vy < 0 ? "jump" : "fall";
    return Math.abs(vx) > (player.movementIntent ? 0 : 1) ? "run" : "idle";
  }
  if (Math.hypot(vx, vy) <= (player.movementIntent ? 0 : 1))
    return directionalIdle(player.facing);
  if (Math.abs(vy) > Math.abs(vx)) return vy < 0 ? "walk_north" : "walk_south";
  return vx < 0 ? "walk_west" : "walk_east";
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
const cardinals = {
  up: ["walk_north", "idle_up"],
  down: ["walk_south", "idle_down"],
  left: ["walk_west", "idle_left"],
  right: ["walk_east", "idle_right"],
} as const;
export type Cardinal = keyof typeof cardinals;
export function cardinalOf(state: AnimationState): Cardinal | null {
  for (const [c, names] of Object.entries(cardinals))
    if ((names as readonly string[]).includes(state)) return c as Cardinal;
  return null;
}
// Presentation only: diagonal travel keeps the cardinal the hero already shows
// when it is one of the two directions being travelled, rather than snapping
// to east/west. Authoritative facing, aim and dash direction are untouched.
export function stickyCardinal(
  state: AnimationState,
  previous: Cardinal | null,
  direction: { x: number; y: number },
): AnimationState {
  const current = cardinalOf(state);
  if (!current || !previous || current === previous) return state;
  const { x, y } = direction;
  if (!x || !y || Math.abs(Math.abs(x) - Math.abs(y)) > 0.05 * Math.hypot(x, y))
    return state;
  const allowed =
    (previous === "up" && y < 0) ||
    (previous === "down" && y > 0) ||
    (previous === "left" && x < 0) ||
    (previous === "right" && x > 0);
  if (!allowed) return state;
  return cardinals[previous][state.startsWith("walk") ? 0 : 1];
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
