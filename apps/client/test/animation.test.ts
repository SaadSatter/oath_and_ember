import { describe, it, expect } from "vitest";
import {
  selectAnimation,
  directionalIdle,
  resolveHeroAnimation,
} from "../src/animation/selectAnimation.js";
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
    expect(selectAnimation(p, "TOP_DOWN")).toBe("idle_right");
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
  it("registers the approved idles and six-frame walks per hero and no side-view artwork", () => {
    for (const role of ["OATH", "EMBER"] as const) {
      expect(Object.keys(heroAssets[role].clips.TOP_DOWN)).toEqual([
        "idle_down",
        "idle_up",
        "idle_left",
        "idle_right",
        "walk_south",
        "walk_north",
        "walk_east",
        "walk_west",
      ]);
      expect(heroAssets[role].clips.PLATFORMER).toEqual({});
      const keys = ["idle_down", "idle_up", "idle_left", "idle_right"].map(
        (state) =>
          animationKey(
            role,
            "TOP_DOWN",
            state as (typeof animationSets.TOP_DOWN)[number],
          ),
      );
      expect(new Set(keys).size).toBe(4);
      for (const clip of Object.values(heroAssets[role].clips.TOP_DOWN)) {
        expect(clip!.end - clip!.start).toBe(clip!.start < 4 ? 0 : 5);
        expect(clip!.end).toBeLessThan(28);
        expect(clip!.repeat).toBe(-1);
      }
    }
  });
  it("preserves facing while stopped and falls back to directional idles for missing actions", () => {
    for (const [facing, direction] of [
      [0, "idle_right"],
      [Math.PI, "idle_left"],
      [-Math.PI / 2, "idle_up"],
      [Math.PI / 2, "idle_down"],
    ] as const) {
      expect(directionalIdle(facing)).toBe(direction);
      for (const role of ["OATH", "EMBER"] as const) {
        for (const state of [
          "primary_attack",
          "secondary_ability",
          "hurt",
          "interact_channel",
        ] as const)
          expect(resolveHeroAnimation(role, "TOP_DOWN", state, facing)).toBe(
            direction,
          );
        expect(
          resolveHeroAnimation(role, "PLATFORMER", "run", facing),
        ).toBeNull();
      }
    }
  });
});
