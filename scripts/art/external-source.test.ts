import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import {
  inspectExternalSource,
  requireTransparentExternalSource,
} from "./external-source.js";

describe("external sprite transparency gate", () => {
  it("rejects JPEG bytes even when renamed PNG and reads their dimensions", () => {
    const jpeg = Buffer.from([
      255, 216, 255, 192, 0, 17, 8, 0, 32, 0, 64, 3, 1, 17, 0, 2, 17, 0, 3, 17,
      0, 255, 217,
    ]);
    expect(inspectExternalSource(jpeg)).toMatchObject({
      format: "jpeg",
      width: 64,
      height: 32,
      ready: false,
    });
    expect(() => requireTransparentExternalSource(jpeg)).toThrow(
      "Transparent source PNG required",
    );
  });
  it("rejects opaque checkerboard PNGs without modifying pixels", () => {
    const p = new PNG({ width: 8, height: 8 });
    for (let i = 0; i < p.data.length; i += 4)
      p.data.set([i % 8 ? 220 : 255, 220, 220, 255], i);
    const bytes = PNG.sync.write(p),
      before = Buffer.from(bytes);
    expect(() => requireTransparentExternalSource(bytes)).toThrow(
      "opaque PNG conversion",
    );
    expect(bytes.equals(before)).toBe(true);
  });
  it("validates arbitrary grids, measures fixed-cell bounds and blocks an opaque individual frame", () => {
    const p = new PNG({ width: 12, height: 8 });
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++)
        p.data.set([10, 20, 30, 255], ((row * 4 + 2) * 12 + col * 4 + 1) * 4);
    const grid = { columns: 3, rows: 2, frame_count: 6 };
    const result = requireTransparentExternalSource(PNG.sync.write(p), grid);
    expect(result.frames).toHaveLength(6);
    expect(
      result.frames.every((f) => JSON.stringify(f.bounds) === "[1,2,2,3]"),
    ).toBe(true);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) p.data[(y * 12 + x) * 4 + 3] = 255;
    expect(() =>
      requireTransparentExternalSource(PNG.sync.write(p), grid),
    ).toThrow("Frame 0");
    expect(
      inspectExternalSource(PNG.sync.write(p), {
        columns: 5,
        rows: 2,
        frame_count: 10,
      }).ready,
    ).toBe(false);
  });
});
