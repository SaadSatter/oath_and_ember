import { describe, it, expect } from "vitest";
import {
  viewportLayout,
  TARGET_AREA,
  smoothingFactor,
} from "../src/rendering/viewport.js";
describe("bounded presentation viewport", () => {
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [390, 844],
    [844, 390],
    [5120, 1440],
    [3840, 2160],
    [200, 200],
  ])
    it(`fits ${width}x${height} without distortion or extra world area`, () => {
      const v = viewportLayout(width, height);
      expect(v.displayWidth).toBeLessThanOrEqual(width);
      expect(v.displayHeight).toBeLessThanOrEqual(height);
      expect(v.logicalWidth).toBeLessThanOrEqual(640);
      expect(v.logicalHeight).toBeLessThanOrEqual(640);
      expect(
        Math.abs(v.logicalWidth * v.logicalHeight - TARGET_AREA),
      ).toBeLessThan(640);
      expect(v.displayWidth / v.logicalWidth).toBeCloseTo(
        v.displayHeight / v.logicalHeight,
      );
      if (v.scale >= 1) expect(Number.isInteger(v.scale)).toBe(true);
    });
  it("gives desktop and ultrawide the same world footprint", () => {
    const normal = viewportLayout(1920, 1080),
      ultra = viewportLayout(5120, 1440);
    expect([ultra.logicalWidth, ultra.logicalHeight]).toEqual([
      normal.logicalWidth,
      normal.logicalHeight,
    ]);
  });
  it("keeps portrait and landscape within the same visibility budget", () => {
    const p = viewportLayout(390, 844),
      l = viewportLayout(844, 390);
    expect(p.logicalWidth).toBe(l.logicalHeight);
    expect(p.logicalHeight).toBe(l.logicalWidth);
  });
  it("makes presentation convergence independent of 60Hz vs 120Hz", () => {
    const step60 = smoothingFactor(1000 / 60),
      step120 = smoothingFactor(1000 / 120);
    expect(1 - step60).toBeCloseTo((1 - step120) ** 2);
  });
});
