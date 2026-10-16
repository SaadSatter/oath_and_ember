import { it, expect } from "vitest";
import { golemBeamTipFrame } from "../src/animation/golem.js";
import { readFileSync } from "node:fs";
it("plays every endpoint frame once then loops only the last three occupied cells", () => {
  for (let i = 0; i < 11; i++)
    expect(golemBeamTipFrame((i + 0.1) * 0.09)).toBe(i);
  for (let i = 11; i < 100; i++)
    expect(golemBeamTipFrame((i + 0.1) * 0.09)).toBe(8 + ((i - 11) % 3));
  expect(golemBeamTipFrame(-10)).toBe(0);
  const png = readFileSync(
    "apps/client/public/assets/enemies/ironbound_sentinel/beam-tip.png",
  );
  expect(png.readUInt32BE(16)).toBe(512);
  expect(png.readUInt32BE(20)).toBe(384);
});
