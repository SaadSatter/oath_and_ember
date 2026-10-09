import { it, expect } from "vitest";
import { recolorPixels } from "../src/assets/palettes.js";
it("keeps default RGB/alpha byte-identical and protects unmasked identity pixels", () => {
  const src = new Uint8ClampedArray([
    120, 40, 50, 255, 240, 180, 150, 240, 255, 180, 50, 200,
  ]);
  const mask = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 255,
  ]);
  expect(recolorPixels(src, mask, "crimson", undefined, "crimson")).toEqual(
    src,
  );
  const changed = recolorPixels(src, mask, "blue", "arcane", "crimson");
  expect(changed.slice(0, 3)).not.toEqual(src.slice(0, 3));
  expect(changed.slice(4, 8)).toEqual(src.slice(4, 8));
  expect(changed[3]).toBe(255);
  expect(changed[11]).toBe(200);
  expect(src[0]).toBe(120);
});
it("preserves shadow/highlight relationships within a selected region", () => {
  const source = new Uint8ClampedArray([40, 15, 20, 255, 120, 45, 60, 255]);
  const mask = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255]);
  const result = recolorPixels(source, mask, "green", undefined, "crimson");
  expect(result[5]).toBeGreaterThan(result[1]);
  expect(result[1]).toBeGreaterThan(result[0]);
});

it("renders ivory as light cloth while retaining folds, alpha and protected pixels", () => {
  const source = new Uint8ClampedArray([
    40, 15, 20, 255, 120, 40, 50, 240, 185, 64, 80, 255, 240, 180, 150, 255,
  ]);
  const mask = new Uint8ClampedArray([
    255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0,
  ]);
  const result = recolorPixels(source, mask, "ivory", undefined, "crimson");
  expect(result[4]).toBeGreaterThan(180);
  expect(result[8]).toBeGreaterThan(235);
  expect(result[0]).toBeLessThan(result[4]);
  expect(result[4]).toBeLessThan(result[8]);
  expect(result[7]).toBe(240);
  expect(result.slice(12)).toEqual(source.slice(12));
});

it("supports every Coco magic palette while keeping a protected bright core and alpha", () => {
  const source = new Uint8ClampedArray([255, 150, 30, 170, 255, 255, 240, 255]);
  const mask = new Uint8ClampedArray([0, 255, 0, 255, 0, 0, 0, 0]);
  for (const palette of ["ember", "arcane", "violet", "emerald", "rose"]) {
    const result = recolorPixels(source, mask, "purple", palette, "purple");
    expect(result.slice(4)).toEqual(source.slice(4));
    expect(result[3]).toBe(170);
    if (palette === "ember") expect(result).toEqual(source);
    else expect(result.slice(0, 3)).not.toEqual(source.slice(0, 3));
  }
});

it("keeps Sieg's chosen cloth palette in every attack frame and leaves sword/slash pixels untouched", async () => {
  const { readFileSync } = await import("node:fs");
  const { PNG } = await import("pngjs");
  const source = PNG.sync.read(
    readFileSync("apps/client/public/assets/characters/oath/basic.png"),
  );
  const mask = PNG.sync.read(
    readFileSync("apps/client/public/assets/characters/oath/basic-mask.png"),
  );
  expect([mask.width, mask.height]).toEqual([source.width, source.height]);
  const src = new Uint8ClampedArray(source.data),
    regions = new Uint8ClampedArray(mask.data);
  expect(
    Buffer.from(
      recolorPixels(src, regions, "crimson", undefined, "crimson"),
    ).equals(Buffer.from(src)),
  ).toBe(true);
  const ivory = recolorPixels(src, regions, "ivory", undefined, "crimson");
  // Front-facing collar beside the hair was previously excluded as face.
  const collar = ((256 + 67) * source.width + 53) * 4;
  expect(regions[collar]).toBe(255);
  expect(ivory[collar + 1]).toBeGreaterThan(ivory[collar] * 0.9);
  const counts = new Map<number, number>();
  let alphaChanges = 0,
    protectedChanges = 0,
    unlightenedCloth = 0;
  for (let i = 0; i < src.length; i += 4) {
    if (ivory[i + 3] !== src[i + 3]) alphaChanges++;
    if (regions[i]) {
      const pixel = i / 4,
        x = pixel % source.width,
        y = Math.floor(pixel / source.width);
      const frame = Math.floor(y / 128) * 12 + Math.floor(x / 128);
      counts.set(frame, (counts.get(frame) ?? 0) + 1);
      if (ivory[i + 1] <= src[i + 1]) unlightenedCloth++;
    } else if ([0, 1, 2, 3].some((c) => ivory[i + c] !== src[i + c]))
      protectedChanges++;
  }
  expect({
    alphaChanges,
    protectedChanges,

    unlightenedCloth,
  }).toEqual({
    alphaChanges: 0,
    protectedChanges: 0,

    unlightenedCloth: 0,
  });
  // Reviewed contact-trail patches: right crescent, back-facing overhead arc,
  // and front-facing lower arc. They remain red for every cloth palette.
  for (const [frame, x, y] of [
    [6, 99, 71],
    [14, 70, 39],
    [29, 64, 100],
  ]) {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const offset =
          ((Math.floor(frame / 12) * 128 + y + dy) * source.width +
            (frame % 12) * 128 +
            x +
            dx) *
          4;
        expect(regions[offset]).toBe(0);
        expect([...ivory.slice(offset, offset + 4)]).toEqual([
          ...src.slice(offset, offset + 4),
        ]);
      }
  }
  for (const frame of [
    ...Array.from({ length: 12 }, (_, i) => i),
    ...Array.from({ length: 10 }, (_, i) => 12 + i),
    ...Array.from({ length: 12 }, (_, i) => 24 + i),
  ])
    expect(counts.get(frame)).toBeGreaterThan(30);
});
