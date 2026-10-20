import type { Enemy } from "../../../../packages/shared/src/gameTypes.js";
import { enemyDefinitions } from "../../../../packages/shared/src/enemies.js";
import { ticksFor } from "../../../../packages/shared/src/constants.js";

export const mosslingRecoveryTicks = ticksFor(0.2);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function mosslingAttackPose(age: number, facing: number) {
  const windup = enemyDefinitions.mossling.windupTicks;
  const preparation = clamp(age / (windup * 0.7));
  const swing = clamp((age - windup * 0.7) / (windup * 0.3));
  const recovery = clamp((age - windup) / mosslingRecoveryTicks);
  const thrust = Math.sin((swing * Math.PI) / 2) * (1 - recovery);
  const crouch = preparation * (1 - swing);
  const offset = thrust * 9 - crouch * 4;
  return {
    phase: age < windup * 0.7 ? "windup" : age < windup ? "strike" : "recovery",
    facing,
    offsetX: Math.cos(facing) * offset,
    offsetY: Math.sin(facing) * offset,
    scaleX: 1 + crouch * 0.12 - thrust * 0.06,
    scaleY: 1 - crouch * 0.18 + thrust * 0.1,
    lean: Math.cos(facing) * (crouch * -0.08 + thrust * 0.12),
    crouch,
    swing,
    slashAlpha: swing * (1 - recovery),
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
