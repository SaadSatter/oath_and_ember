import { expect, it } from "vitest";
import { griffinNestFocus } from "../src/rendering/griffinCamera.js";
import { viewportLayout } from "../src/rendering/viewport.js";
import { griffinNest } from "../../../packages/shared/src/griffin.js";

it("keeps the nest, Griffin head and local hero visible from the northern stone walkways on wide and portrait screens", () => {
  for (const [width, height] of [
    [1920, 1080],
    [390, 844],
    [844, 390],
  ]) {
    const v = viewportLayout(width, height, 2);
    for (const hero of [
      { x: 640, y: 640 },
      { x: 640, y: 480 },
      { x: 80, y: 432 },
      { x: 1200, y: 432 },
      { x: 640, y: 112 },
    ]) {
      const focus = griffinNestFocus(hero, v.logicalWidth, v.logicalHeight)!;
      expect(focus).not.toBeNull();
      const halfX = v.logicalWidth / (2 * focus.zoom);
      const halfY = v.logicalHeight / (2 * focus.zoom);
      for (const point of [
        hero,
        { x: griffinNest.x - 56, y: griffinNest.y - 100 },
        { x: griffinNest.x + 56, y: griffinNest.y + 40 },
      ]) {
        expect(Math.abs(point.x - focus.x)).toBeLessThanOrEqual(halfX + 0.001);
        expect(Math.abs(point.y - focus.y)).toBeLessThanOrEqual(halfY + 0.001);
      }
    }
  }
});
it("leaves the ordinary camera in control on the southern approach and combat shores", () => {
  expect(griffinNestFocus({ x: 640, y: 1000 }, 640, 360)).toBeNull();
  expect(griffinNestFocus({ x: 320, y: 750 }, 640, 360)).toBeNull();
});
