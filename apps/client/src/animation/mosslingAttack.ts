import type { Enemy } from "../../../../packages/shared/src/gameTypes.js";
import {
  enemyDefinitions,
  mosslingSpike,
} from "../../../../packages/shared/src/enemies.js";

/** The spike stays out a moment, then pulls back into an arm. */
export const mosslingRecoveryTicks =
  mosslingSpike.holdTicks + mosslingSpike.retractTicks;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
/** Length of the arm once it has turned to wood, before it shoots out. */
export const MOSSLING_ARM_LENGTH = 22;

/**
 * The Mossling's spike attack at `age` ticks into it. It crouches while its arm
 * hardens into a thorny wooden spike, then the spike shoots out to its full
 * reach exactly on the server's hit tick (the end of the windup), holds, and
 * pulls back. Presentation only: the server decides who is struck.
 */
export function mosslingAttackPose(age: number, facing: number) {
  const windup = enemyDefinitions.mossling.windupTicks,
    launch = windup - mosslingSpike.extendTicks;
  // Winding up: crouch, and the arm turns to wood.
  const preparation = clamp(age / launch);
  // Shooting out, fast at first and settling at full reach on the hit tick.
  const extend = clamp((age - launch) / mosslingSpike.extendTicks),
    shot = 1 - (1 - extend) ** 3;
  // Pulling back after the hold.
  const back = clamp(
    (age - windup - mosslingSpike.holdTicks) / mosslingSpike.retractTicks,
  );
  const crouch = preparation * (1 - extend);
  const thrust = extend * (1 - back);
  const offset = thrust * 6 - crouch * 4;
  // How far the spike's point is from the Mossling's feet, along its aim.
  const length =
    MOSSLING_ARM_LENGTH * (0.6 + 0.4 * preparation) +
    (mosslingSpike.reach - MOSSLING_ARM_LENGTH) * shot * (1 - back);
  return {
    phase:
      age < launch
        ? "windup"
        : age < windup
          ? "strike"
          : age < windup + mosslingSpike.holdTicks
            ? "hold"
            : "recovery",
    facing,
    offsetX: Math.cos(facing) * offset,
    offsetY: Math.sin(facing) * offset,
    scaleX: 1 + crouch * 0.1 - thrust * 0.05,
    scaleY: 1 - crouch * 0.15 + thrust * 0.08,
    lean: Math.cos(facing) * (crouch * -0.08 + thrust * 0.1),
    crouch,
    /** 0 while it is an arm, 1 once it is a full wooden spike. */
    wood: Math.min(1, preparation * 1.4) * (1 - clamp((back - 0.6) / 0.4)),
    length,
    /** A faint line on the ground warns where the spike will go. */
    telegraph: preparation * (1 - extend),
    /** Splinters and leaves burst off as it lands. */
    burst: extend >= 1 ? clamp(1 - (age - windup) / mosslingSpike.holdTicks) : 0,
  };
}

export class MosslingAttackPresentation {
  private attack: { sequence: number; start: number; facing: number } | null =
    null;
  private cancelled: number | null = null;
  private sequence = 0;

  update(enemy: Readonly<Enemy>, tick: number, attacking: boolean) {
    if (enemy.attackSeq < this.sequence) {
      this.attack = null;
      this.cancelled = null;
    }
    this.sequence = enemy.attackSeq;
    if (enemy.state === "DEAD" || enemy.type !== "mossling") {
      this.attack = null;
      return null;
    }
    if (enemy.state === "ATTACK" && !attacking) {
      this.cancelled = enemy.attackSeq;
      this.attack = null;
    }
    if (
      attacking &&
      enemy.attackStartedTick !== null &&
      enemy.attackSeq !== this.cancelled
    )
      this.attack = {
        sequence: enemy.attackSeq,
        start: enemy.attackStartedTick,
        facing: enemy.attackFacing,
      };
    const attack = this.attack;
    if (!attack || enemy.attackSeq !== attack.sequence) return null;
    const age = Math.max(0, tick - attack.start);
    if (
      enemy.state !== "ATTACK" &&
      age < enemyDefinitions.mossling.windupTicks
    ) {
      this.attack = null;
      return null;
    }
    if (age >= enemyDefinitions.mossling.windupTicks + mosslingRecoveryTicks) {
      this.attack = null;
      return null;
    }
    return mosslingAttackPose(age, attack.facing);
  }
}
