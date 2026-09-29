import { describe, it, expect } from "vitest";
import { selectAnimation } from "../src/animation/selectAnimation.js";
import {
  heroAssets,
  animationSets,
  animationKey,
} from "../src/animation/definitions.js";
import type { Player } from "../../../packages/shared/src/gameTypes.js";
const hero = (): Player => ({
  id: "test",
  role: "OATH",
  connected: true,
  ready: true,
  x: 100,
  y: 100,
  vx: 0,
  vy: 0,
  grounded: true,
  hp: 100,
  maxHp: 100,
  facing: 0,
  actionState: "idle",
  cooldowns: {},
  skillPoints: 1,
  unlockedSkills: [],
  lastProcessedInputSeq: 0,
});
describe("presentation animation selection", () => {
  it("selects all four top-down directions without mutating player state", () => {
    const p = hero();
    expect(selectAnimation(p, "TOP_DOWN")).toBe("idle");
    for (const [vx, vy, want] of [
      [0, -190, "walk_north"],
      [0, 190, "walk_south"],
      [190, 0, "walk_east"],
      [-190, 0, "walk_west"],
    ] as const) {
      const input = Object.freeze({ ...p, vx, vy });
      expect(selectAnimation(input, "TOP_DOWN")).toBe(want);
      expect(input.vx).toBe(vx);
    }
  });
  it("distinguishes grounded run, ascending jump, and descending fall", () => {
    const p = hero();
    expect(selectAnimation(p, "PLATFORMER")).toBe("idle");
    expect(selectAnimation({ ...p, vx: 190 }, "PLATFORMER")).toBe("run");
    expect(
      selectAnimation({ ...p, grounded: false, vy: -10 }, "PLATFORMER"),
    ).toBe("jump");
    expect(
      selectAnimation({ ...p, grounded: false, vy: 10 }, "PLATFORMER"),
    ).toBe("fall");
  });
  it("prioritizes hurt and actions over locomotion for both modes", () => {
    for (const mode of ["TOP_DOWN", "PLATFORMER"] as const) {
      const p = { ...hero(), vx: 190, actionState: "attack" };
      expect(selectAnimation(p, mode)).toBe("primary_attack");
      expect(selectAnimation(p, mode, { hurt: true })).toBe("hurt");
      expect(selectAnimation({ ...p, actionState: "guard" }, mode)).toBe(
        "secondary_ability",
      );
      expect(
        selectAnimation({ ...p, actionState: "idle" }, mode, {
          interacting: true,
        }),
      ).toBe("interact_channel");
    }
  });
  it("provides distinct, complete art manifests for both roles and perspectives", () => {
    const keys = new Set<string>();
    for (const role of ["OATH", "EMBER"] as const)
      for (const mode of ["TOP_DOWN", "PLATFORMER"] as const)
        for (const state of animationSets[mode]) {
          const clip = heroAssets[role].clips[mode][state]!;
          expect(clip).toBeDefined();
          expect(clip.start).toBeLessThanOrEqual(clip.end);
          expect(clip.end).toBeLessThan(68);
          const key = animationKey(role, mode, state);
          expect(keys.has(key)).toBe(false);
          keys.add(key);
        }
    expect(keys.size).toBe(34);
  });
});
