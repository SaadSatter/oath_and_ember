import { describe, it, expect } from "vitest";
import {
  viewportLayout,
  TARGET_AREA,
  MAX_REVEAL,
  smoothingFactor,
} from "../src/rendering/viewport.js";
describe("bounded presentation viewport", () => {
  for (const ratio of [1, 2, 3])
    for (const [width, height] of [
      [1920, 1080],
      [1440, 900],
      [390, 844],
      [844, 390],
      [5120, 1440],
      [3840, 2160],
      [200, 200],
    ])
      it(`fits ${width}x${height}@${ratio}x with whole-number art pixels`, () => {
        const v = viewportLayout(width, height, ratio);
        expect(Number.isInteger(v.zoom)).toBe(true);
        expect(v.zoom).toBeGreaterThanOrEqual(1);
        // One canvas pixel is one physical pixel.
        expect(v.scale).toBeCloseTo(1 / ratio);
        expect(v.displayWidth).toBeLessThanOrEqual(width + 0.5);
        expect(v.displayHeight).toBeLessThanOrEqual(height + 0.5);
        // The fitted box fills the limiting axis.
        expect(
          Math.min(width - v.displayWidth, height - v.displayHeight),
        ).toBeLessThan(1);
        // Whole-number zoom never reveals much more world than the target.
        const area = v.logicalWidth * v.logicalHeight;
        expect(area).toBeLessThanOrEqual(TARGET_AREA * MAX_REVEAL ** 2 + 1);
        expect(v.logicalWidth).toBeLessThanOrEqual(640 * MAX_REVEAL + 1);
        expect(v.logicalHeight).toBeLessThanOrEqual(640 * MAX_REVEAL + 1);
      });
  it("renders the common 1080p desktop at an exact 3x", () => {
    expect(viewportLayout(1920, 1080)).toMatchObject({
      zoom: 3,
      logicalWidth: 640,
      logicalHeight: 360,
    });
    expect(viewportLayout(960, 540, 2)).toMatchObject({
      zoom: 3,
      canvasWidth: 1920,
      canvasHeight: 1080,
      logicalWidth: 640,
    });
  });
  it("gives desktop and ultrawide the same world footprint", () => {
    const normal = viewportLayout(1920, 1080),
      ultra = viewportLayout(5120, 1440);
    expect(ultra.logicalWidth / normal.logicalWidth).toBeCloseTo(1, 1);
    expect(ultra.logicalHeight / normal.logicalHeight).toBeCloseTo(1, 1);
  });
  it("shows a high-DPI screen the same world, in sharper pixels", () => {
    const standard = viewportLayout(1280, 720, 1),
      retina = viewportLayout(1280, 720, 2);
    expect(retina.zoom).toBe(standard.zoom * 2);
    expect(retina.logicalWidth).toBeCloseTo(standard.logicalWidth);
  });
  it("keeps portrait and landscape within the same visibility budget", () => {
    const p = viewportLayout(390, 844),
      l = viewportLayout(844, 390);
    expect(p.logicalWidth).toBeCloseTo(l.logicalHeight, 0);
    expect(p.logicalHeight).toBeCloseTo(l.logicalWidth, 0);
  });
  it("makes presentation convergence independent of 60Hz vs 120Hz", () => {
    const step60 = smoothingFactor(1000 / 60),
      step120 = smoothingFactor(1000 / 120);
    expect(1 - step60).toBeCloseTo((1 - step120) ** 2);
  });
});
