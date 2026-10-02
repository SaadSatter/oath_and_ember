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
