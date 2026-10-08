import { expect, it } from "vitest";
import { siegBasicClip, actionFrame } from "../src/animation/siegAttack.js";
import { swordContactTicks } from "../../../packages/shared/src/combat.js";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
it("uses the exact RIGHT frames for LEFT, and independent back/front rows", () => {
  expect(siegBasicClip("left")).toEqual(siegBasicClip("right"));
  expect(siegBasicClip("up")).toMatchObject({ start: 12, end: 21 });
  expect(siegBasicClip("down")).toMatchObject({ start: 24, end: 35 });
  const image = PNG.sync.read(
    readFileSync("apps/client/public/assets/characters/oath/basic.png"),
  );
  expect([image.width, image.height]).toEqual([1536, 384]);
  // Frame padding remains transparent, including UP's two empty cells.
  expect(image.data[(128 * image.width + 128 * 10) * 4 + 3]).toBe(0);
});
it("seeks variable frame durations by server age and holds recovery without looping", () => {
  for (const direction of ["right", "left", "up", "down"] as const) {
    const c = siegBasicClip(direction);
    let elapsed = 0;
    for (let i = 0; i < c.durations.length; i++) {
      expect(actionFrame(c, elapsed)).toBe(c.start + i);
      expect(actionFrame(c, elapsed + c.durations[i] - 1)).toBe(c.start + i);
      elapsed += c.durations[i];
    }
    expect(elapsed).toBe(450);
    expect(actionFrame(c, 4500)).toBe(c.end);
  }
});
it("server contact falls on a contact frame rather than anticipation or recovery", () => {
  for (const [direction, facing, first, last] of [
    ["right", 0, 5, 6],
    ["left", Math.PI, 5, 6],
    ["up", -Math.PI / 2, 2, 3],
    ["down", Math.PI / 2, 2, 3],
  ] as const) {
    const c = siegBasicClip(direction),
      frame = actionFrame(c, (swordContactTicks(facing) * 1000) / 30) - c.start;
    expect(frame).toBeGreaterThanOrEqual(first);
    expect(frame).toBeLessThanOrEqual(last);
  }
});
