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
// combat > held ability/channel fallback > locomotion. Input never starts combat.
export class PlayerPresentation {
  private seen = 0;
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
  private queued: CombatAction | null = null;
  private basicQueue: { action: CombatAction; playbackRate: number }[] = [];
  private lastBasicTick: number | null = null;
  private basicEnd: number | null = null;
  update(
    p: Readonly<Player>,
    mode: MovementMode,
    now: number,
    serverTick: number,
    hurt: boolean,
  ): Presentation {
    const guarding = p.actionState === "guard";
    if (guarding && !this.held) this.defense = { phase: "start", start: now };
    if (!guarding && this.held && this.defense)
      this.defense = { phase: "end", start: now };
    this.held = guarding;
    if (p.defensiveHit && p.defensiveHit.seq > this.hitSeen) {
      this.hitSeen = p.defensiveHit.seq;
      if (serverTick - p.defensiveHit.tick < 9) this.impactUntil = now + 250;
    }
    const d = combatDirection(p.facing);
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
      if (p.role === "OATH" && p.combat.kind === "sword") {
        const clip = actionClip(
          p.role,
          combatDirection(p.combat.facing),
          p.combat.kind,
        );
        const age = Math.max(
          0,
          ((serverTick - p.combat.startedTick) * 1000) / 30,
        );
        if (age < clip.durationMs) {
          const gap =
            this.lastBasicTick === null
              ? clip.durationMs
              : Math.max(
                  1,
                  ((p.combat.startedTick - this.lastBasicTick) * 1000) / 30,
                );
          // A standalone swing uses its authored rhythm. Repeated confirmed
          // swings compress their full sequence to the observed server cadence,
          // keeping visual backlog bounded without altering gameplay cooldowns.
          const playbackRate = clip.durationMs / Math.min(clip.durationMs, gap);
          this.basicQueue.push({ action: p.combat, playbackRate });
          this.lastBasicTick = p.combat.startedTick;
        }
      } else this.queued = p.combat;
    }
    if (mode !== "TOP_DOWN" || p.hp <= 0 || hurt || p.actionState === "hurt") {
      this.active = null;
      this.queued = null;
      this.basicQueue = [];
      this.basicEnd = null;
      this.lastBasicTick = null;
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
    if (
      !this.active &&
      this.basicQueue.length &&
      p.role === "OATH" &&
      (!this.queued ||
        this.basicQueue[0].action.startedTick <= this.queued.startedTick)
    ) {
      const { action, playbackRate } = this.basicQueue.shift()!;
      const direction = combatDirection(action.facing),
        clip = actionClip(p.role, direction, action.kind);
      const age = Math.max(0, ((serverTick - action.startedTick) * 1000) / 30);
      // Admit fresh markers once; queued clips start from their first frame,
      // using the prior authoritative schedule to align both client clocks.
      const start = Math.max(now - age, this.basicEnd ?? -Infinity);
      const end = start + clip.durationMs / playbackRate;
      this.active = { action, direction, start, end, playbackRate };
      this.basicEnd = end;
    }
    if (!this.active && this.queued && p.role) {
      const action = this.queued;
      this.queued = null;
      const direction = combatDirection(action.facing),
        clip = actionClip(p.role, direction, action.kind);
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
            direction: combatDirection(p.heavyCharge.facing),
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
