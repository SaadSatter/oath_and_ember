import { defenseClip, type DefensePhase } from "./defense.js";
import type {
  Player,
  CombatAction,
} from "../../../../packages/shared/src/gameTypes.js";
import { combatDirection, actionClip, type CombatDirection } from "./combat.js";
import type { MovementMode } from "./definitions.js";
export type Presentation =
  | {
      kind: "defense";
      phase: DefensePhase;
      direction: CombatDirection;
      elapsedMs: number;
      impact: boolean;
    }
  | { kind: "defeated" | "hurt" | "locomotion" }
  | {
      kind: "charge";
      direction: CombatDirection;
      progress: number;
      ticks: number;
    }
  | {
      kind: "combat";
      direction: CombatDirection;
      action: CombatAction;
      elapsedMs: number;
      playbackRate?: number;
    };
// Presentation-only state machine. Highest priority: defeat > hurt > accepted
// combat > held ability/channel fallback > locomotion. Turning interrupts old
// visual clips; accepted gameplay actions and their locked aim stay untouched.
export class PlayerPresentation {
  private seen = 0;
  private lastDirection: CombatDirection | null = null;
  private defense: { phase: DefensePhase; start: number } | null = null;
  private hitSeen = 0;
  private impactUntil = 0;
  private held = false;
  private active: {
    action: CombatAction;
    direction: CombatDirection;
    start: number;
    end: number;
    playbackRate?: number;
  } | null = null;

  update(
    p: Readonly<Player>,
    mode: MovementMode,
    now: number,
    serverTick: number,
    hurt: boolean,
    motion: Pick<Player, "facing"> = p,
  ): Presentation {
    const d = combatDirection(motion.facing);
    if (this.lastDirection !== null && this.lastDirection !== d) {
      this.active = null;
    }
    this.lastDirection = d;
    const guarding = p.actionState === "guard";
    if (guarding && !this.held) this.defense = { phase: "start", start: now };
    if (!guarding && this.held && this.defense)
      this.defense = { phase: "end", start: now };
    this.held = guarding;
    if (p.defensiveHit && p.defensiveHit.seq > this.hitSeen) {
      this.hitSeen = p.defensiveHit.seq;
      if (serverTick - p.defensiveHit.tick < 9) this.impactUntil = now + 250;
    }
    if (
      this.defense &&
      p.role &&
      now - this.defense.start >=
        defenseClip(p.role, this.defense.phase, d).durationMs
    ) {
      if (this.defense.phase === "start")
        this.defense = { phase: "loop", start: now };
      else if (this.defense.phase === "end") this.defense = null;
    }
    if (p.combat && p.combat.seq > this.seen) {
      this.seen = p.combat.seq;
      if (combatDirection(p.combat.facing) !== d) {
        // Consume delayed accepted markers without replaying the direction we left.
      } else if (p.role) {
        const clip = actionClip(p.role, d, p.combat.kind);
        const duration =
          p.role === "EMBER" ? 200 : p.combat.kind === "heavy" ? 250 : 300;
        const age = Math.max(
          0,
          ((serverTick - p.combat.startedTick) * 1000) / 30,
        );
        // Only the newest confirmed action is relevant. Never build a visual
        // backlog behind an older swing/cast when repeated inputs are accepted.
        this.active =
          age < duration
            ? {
                action: p.combat,
                direction: d,
                start: now - age,
                end: now - age + duration,
                playbackRate: clip.durationMs / duration,
              }
            : null;
      }
    }
    if (mode !== "TOP_DOWN" || p.hp <= 0 || hurt || p.actionState === "hurt") {
      this.active = null;
      if (
        mode !== "TOP_DOWN" &&
        p.hp > 0 &&
        !hurt &&
        p.actionState !== "hurt" &&
        this.defense
      )
        return {
          kind: "defense",
          phase:
            now < this.impactUntil && p.role === "OATH"
              ? "impact"
              : this.defense.phase,
          direction: d,
          elapsedMs:
            now < this.impactUntil && p.role === "OATH"
              ? now - (this.impactUntil - 250)
              : now - this.defense.start,
          impact: now < this.impactUntil,
        };
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
    return this.active
      ? {
          kind: "combat",
          direction: this.active.direction,
          action: this.active.action,
          elapsedMs:
            Math.max(0, now - this.active.start) *
            (this.active.playbackRate ?? 1),
          ...(this.active.playbackRate
            ? { playbackRate: this.active.playbackRate }
            : {}),
        }
      : p.heavyCharge
        ? {
            kind: "charge",
            direction: d,
            progress: p.heavyCharge.progress,
            ticks: p.heavyCharge.ticks,
          }
        : this.defense
          ? {
              kind: "defense",
              phase:
                now < this.impactUntil && p.role === "OATH"
                  ? "impact"
                  : this.defense.phase,
              direction: d,
              elapsedMs:
                now < this.impactUntil && p.role === "OATH"
                  ? now - (this.impactUntil - 250)
                  : now - this.defense.start,
              impact: now < this.impactUntil,
            }
          : { kind: "locomotion" };
  }
}
