import { expect, it } from "vitest";
import { externalAnimationFrames } from "../src/assets/externalAnimationFrames.js";
it("uses declared row-relative selections and leaves other directions intact", () => {
  const c = {
    x_edges: [0, 10, 20, 30, 40],
    directions: ["south", "north", "east", "west"],
    animation_frames: { west: [0, 2] },
  };
  expect(externalAnimationFrames(c, 3)).toEqual([12, 14]);
  expect(externalAnimationFrames(c, 2)).toEqual([8, 9, 10, 11]);
});

import {
  externalDirection,
  externalStandingFrame,
} from "../src/assets/externalAnimationFrames.js";
it("mirrors one canonical sequence without a second atlas or passing-frame stop", () => {
  const c = {
    x_edges: [0, 10, 20, 30, 40],
    directions: ["south", "north", "west", "east"],
    direction_aliases: { west: { source_direction: "east", flip_x: true } },
    standing_frames: { west: 0, east: 0 },
  };
  expect(externalAnimationFrames(c, 2)).toEqual([12, 13, 14, 15]);
  expect(externalAnimationFrames(c, 3)).toEqual([12, 13, 14, 15]);
  expect(externalDirection(c, "west")).toEqual({
    sourceDirection: "east",
    flipX: true,
  });
  expect(externalDirection(c, "north").flipX).toBe(false);
  expect(externalStandingFrame(c, "west")).toBe(12);
});
