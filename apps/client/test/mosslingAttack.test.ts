import { expect, it } from "vitest";
import {
  spawnEnemy,
  enemyDefinitions,
} from "../../../packages/shared/src/enemies.js";
import {
  MosslingAttackPresentation,
  mosslingAttackPose,
  mosslingRecoveryTicks,
} from "../src/animation/mosslingAttack.js";

const windup = enemyDefinitions.mossling.windupTicks;
const attack = (facing = 0) => ({
  ...spawnEnemy("moss", "mossling", 500, 500),
  state: "ATTACK" as const,
  attackSeq: 1,
  attackStartedTick: 100,
  attackFacing: facing,
  facing,
});

it("crouches away, lunges at the authoritative hit tick, then settles in all four directions", () => {
  for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const wind = mosslingAttackPose(windup / 2, facing);
    expect(wind.phase).toBe("windup");
    expect(wind.scaleY).toBeLessThan(1);
    expect(
      wind.offsetX * Math.cos(facing) + wind.offsetY * Math.sin(facing),
    ).toBeLessThan(0);
    expect(wind.slashAlpha).toBe(0);
    const strike = mosslingAttackPose(windup, facing);
    expect(strike.offsetX).toBeCloseTo(Math.cos(facing) * 9);
    expect(strike.offsetY).toBeCloseTo(Math.sin(facing) * 9);
    expect(strike.slashAlpha).toBe(1);
    const end = mosslingAttackPose(windup + mosslingRecoveryTicks, facing);
    expect(end.offsetX).toBeCloseTo(0);
    expect(end.offsetY).toBeCloseTo(0);
    expect(end.scaleX).toBe(1);
    expect(end.scaleY).toBe(1);
    expect(end.slashAlpha).toBe(0);
  }
});

it("finishes the swipe after the server leaves ATTACK without replaying the old sequence", () => {
  const enemy = attack();
  const view = new MosslingAttackPresentation();
  view.update(enemy, 100, true);
  const resolved = {
    ...enemy,
    state: "CHASE" as const,
    attackStartedTick: null,
  };
  expect(
    view.update(resolved, 100 + windup + 1, false)?.slashAlpha,
  ).toBeGreaterThan(0);
  expect(
    view.update(resolved, 100 + windup + mosslingRecoveryTicks, false),
  ).toBeNull();
  expect(view.update(resolved, 200, false)).toBeNull();
  expect(
    new MosslingAttackPresentation().update(resolved, 200, false),
  ).toBeNull();
});

it("cancels displaced and aborted attacks, allowing only a new sequence to restart", () => {
  const enemy = attack();
  const view = new MosslingAttackPresentation();
  expect(view.update(enemy, 101, true)).not.toBeNull();
  expect(view.update(enemy, 102, false)).toBeNull();
  expect(view.update(enemy, 103, true)).toBeNull();
  const next = { ...enemy, attackSeq: 2, attackStartedTick: 200 };
  expect(view.update(next, 200, true)).not.toBeNull();
  expect(
    view.update(
      { ...next, state: "IDLE", attackStartedTick: null },
      201,
      false,
    ),
  ).toBeNull();
});

it("removes the pose immediately on death and never animates a different enemy type", () => {
  const enemy = attack();
  const view = new MosslingAttackPresentation();
  view.update(enemy, 100, true);
  expect(
    view.update({ ...enemy, state: "DEAD", hp: 0 }, 101, false),
  ).toBeNull();
  expect(view.update({ ...enemy, type: "cinder_wisp" }, 101, true)).toBeNull();
});

it("uses the server's adjusted windup clock and locked aim identically on both clients", () => {
  const first = new MosslingAttackPresentation();
  const second = new MosslingAttackPresentation();
  const enemy = Object.freeze(attack(Math.PI));
  const original = structuredClone(enemy);
  expect(first.update(enemy, 102, true)).toEqual(
    second.update(enemy, 102, true),
  );
  const slowed = { ...enemy, attackStartedTick: 102, facing: 0 };
  const pose = first.update(slowed, 104, true);
  expect(pose).toEqual(second.update(slowed, 104, true));
  expect(pose).toEqual(mosslingAttackPose(2, Math.PI));
  expect(enemy).toEqual(original);
});

it("allows attacks again after a room reset reuses the mossling id and sequence numbers", () => {
  const enemy = attack();
  const view = new MosslingAttackPresentation();
  view.update(enemy, 100, true);
  view.update(enemy, 101, false);
  view.update(
    { ...enemy, attackSeq: 0, state: "IDLE", attackStartedTick: null },
    200,
    false,
  );
  expect(
    view.update({ ...enemy, attackStartedTick: 210 }, 210, true),
  ).not.toBeNull();
});
