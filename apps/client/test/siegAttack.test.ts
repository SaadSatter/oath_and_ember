import { expect, it } from "vitest";
import {
  siegBasicClip,
  actionFrame,
  siegAttackMetadata,
} from "../src/animation/siegAttack.js";
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
    expect(elapsed).toBe(c.durationMs);
    expect(actionFrame(c, 4500)).toBe(c.end);
  }
});
it("stores every explicit source rectangle and anatomical pivot without clipping its logical canvas", () => {
  const { canvas, pivot, scale, directions } = siegAttackMetadata;
  for (const d of ["right", "up", "down"] as const) {
    const source = PNG.sync.read(readFileSync(directions[d].source));
    expect([source.width, source.height]).toEqual([1536, 1024]);
    for (const frame of directions[d].frames) {
      const [x0, y0, x1, y1] = frame.rect,
        [ax, ay] = frame.pivot;
      expect(x1).toBeGreaterThan(x0);
      expect(y1).toBeGreaterThan(y0);
      expect(pivot[0] + (x0 - ax) * scale).toBeGreaterThanOrEqual(0);
      expect(pivot[1] + (y0 - ay) * scale).toBeGreaterThanOrEqual(0);
      expect(pivot[0] + (x1 - ax) * scale).toBeLessThanOrEqual(canvas[0]);
      expect(pivot[1] + (y1 - ay) * scale).toBeLessThanOrEqual(canvas[1]);
      expect(frame.durationMs).toBeGreaterThanOrEqual(40);
      expect(frame.durationMs).toBeLessThanOrEqual(80);
    }
  }
});
it("does not change authored colors/alpha while sampling each crop at the one global scale", () => {
  const packed = PNG.sync.read(
    readFileSync("apps/client/public/assets/characters/oath/basic.png"),
  );
  const { pivot, scale, directions } = siegAttackMetadata;
  for (const d of ["right", "up", "down"] as const) {
    const source = PNG.sync.read(readFileSync(directions[d].source));
    for (const frame of directions[d].frames) {
      const [x0, y0, x1, y1] = frame.rect,
        [ax, ay] = frame.pivot;
      for (let y = 0; y < 128; y += 7)
        for (let x = 0; x < 128; x += 7) {
          const sx = Math.floor((x + 0.5 - pivot[0]) / scale + ax),
            sy = Math.floor((y + 0.5 - pivot[1]) / scale + ay);
          const offset =
            ((Math.floor(frame.frame / 12) * 128 + y) * packed.width +
              (frame.frame % 12) * 128 +
              x) *
            4;
          const expected =
            sx >= x0 && sx < x1 && sy >= y0 && sy < y1
              ? [
                  ...source.data.subarray(
                    (sy * source.width + sx) * 4,
                    (sy * source.width + sx) * 4 + 4,
                  ),
                ]
              : [0, 0, 0, 0];
          expect([...packed.data.subarray(offset, offset + 4)]).toEqual(
            expected,
          );
        }
    }
  }
});
