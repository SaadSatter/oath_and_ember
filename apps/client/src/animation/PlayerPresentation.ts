import type {
  Player,
  CombatAction,
} from "../../../../packages/shared/src/gameTypes.js";
import { combatDirection, combatClip, type CombatDirection } from "./combat.js";
import type { MovementMode } from "./definitions.js";
export type Presentation =
  | { kind: "defeated" | "hurt" | "locomotion" }
  | {
      kind: "combat";
      direction: CombatDirection;
      action: CombatAction;
      elapsedMs: number;
    };
// Presentation-only state machine. Highest priority: defeat > hurt > accepted
// combat > held ability/channel fallback > locomotion. Input never starts combat.
export class PlayerPresentation {
  private seen = 0;
  private active: {
    action: CombatAction;
    direction: CombatDirection;
    start: number;
    end: number;
  } | null = null;
  private queued: CombatAction | null = null;
  update(
    p: Readonly<Player>,
    mode: MovementMode,
    now: number,
    serverTick: number,
    hurt: boolean,
  ): Presentation {
    if (p.combat && p.combat.seq > this.seen) {
      this.seen = p.combat.seq;
      this.queued = p.combat;
    }
    if (mode !== "TOP_DOWN" || p.hp <= 0 || hurt || p.actionState === "hurt") {
      this.active = null;
      this.queued = null;
      return {
        kind:
          p.hp <= 0
            ? "defeated"
            : hurt || p.actionState === "hurt"
              ? "hurt"
              : "locomotion",
      };
    }
    if (this.active && now >= this.active.end) this.active = null;
    if (!this.active && this.queued && p.role) {
      const action = this.queued;
      this.queued = null;
      const direction = combatDirection(action.facing),
        clip = combatClip(p.role, direction);
      const age = Math.max(0, ((serverTick - action.startedTick) * 1000) / 30);
      // Old snapshots on scene creation/reconnect never replay stale attacks.
      if (age < clip.durationMs)
        this.active = {
          action,
          direction,
          start: now - age,
          end: now - age + clip.durationMs,
        };
    }
    return this.active
      ? {
          kind: "combat",
          direction: this.active.direction,
          action: this.active.action,
          elapsedMs: Math.max(0, now - this.active.start),
        }
      : { kind: "locomotion" };
  }
}
