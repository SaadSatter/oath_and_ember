import { expect, it } from "vitest";
import { griffinProps } from "../src/animation/griffinProps.js";
import {
  newGriffin,
  griffinNest,
} from "../../../packages/shared/src/griffin.js";

it("lifts the mirror to the Griffin and keeps both tools visible during use after inventory consumption", () => {
  const g = {
    ...newGriffin(),
    phase: "GROOMING" as const,
    groomingStage: "STAND" as const,
    timer: 1,
    mirrorDelivered: true,
    shearsDelivered: true,
  };
  const ground = griffinProps(g);
  const lifting = griffinProps({ ...g, timer: 0.65 });
  const held = griffinProps({ ...g, groomingStage: "SOUTH", timer: 2.7 });
  expect(ground.mirror.y).toBe(griffinNest.y);
  expect(lifting.mirror.y).toBeLessThan(ground.mirror.y);
  expect(lifting.mirror.y).toBeGreaterThan(held.mirror.y);
  expect(lifting.shears.y).toBe(griffinNest.y);
  const cutting = griffinProps({
    ...g,
    groomingStage: "CUT",
    toolsTaken: true,
    timer: 0.5,
  });
  expect(cutting.mirror.visible).toBe(true);
  expect(cutting.shears.visible).toBe(true);
  expect(cutting.shears.y).toBeLessThan(griffinNest.y - 50);
  expect(
    griffinProps({ ...g, groomingStage: "DEPART", toolsTaken: true, timer: 2 })
      .shears.visible,
  ).toBe(false);
});

it("shows the wig falling during departure before the server marks it dropped, lands continuously and hides after collection", () => {
  const g = {
    ...newGriffin(),
    phase: "GROOMING" as const,
    groomingStage: "DEPART" as const,
    timer: 2,
  };
  const before = structuredClone(g);
  const release = griffinProps(g).wig;
  const falling = griffinProps({ ...g, timer: 1.55 }).wig;
  const landed = griffinProps({ ...g, timer: 1, wigDropped: true }).wig;
  expect(release.visible).toBe(true);
  expect(falling.y).toBeGreaterThan(release.y);
  expect(falling.y).toBeLessThan(landed.y);
  expect(falling.rotation).not.toBe(0);
  expect(landed).toEqual({ ...griffinNest, visible: true, rotation: 0 });
  const done = griffinProps({
    ...g,
    groomingStage: "DONE",
    wigDropped: true,
  }).wig;
  expect(done).toEqual(landed);
  expect(
    griffinProps({ ...g, wigDropped: true, wigClaimed: true }).wig.visible,
  ).toBe(false);
  expect(g).toEqual(before);
});
