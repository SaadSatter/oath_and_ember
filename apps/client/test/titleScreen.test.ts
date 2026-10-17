import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import {
  TITLE_HERO,
  TITLE_LANE,
  TITLE_LINES,
  TITLE_TYPE_CPS,
  TITLE_HOLD_MS,
  TITLE_WALK_SPEED,
  heroStride,
  titleAssets,
  typewriter,
} from "../src/ui/titleScreen.js";
import { heroAssets } from "../src/animation/definitions.js";
import postTownMaps from "../src/environment/postTownMaps.json" with { type: "json" };
import { collisionRects } from "../../../packages/shared/src/maps.js";

it("draws the real village pieces and the in-game hero sheets, all shipped with the client", () => {
  const assets = titleAssets();
  for (const url of assets) expect(existsSync(`apps/client/public${url}`), url).toBe(true);
  // The current approved hero art, never the retired single-frame walks.
  expect(assets).toContain(heroAssets.OATH.url);
  expect(assets).toContain(heroAssets.EMBER.url);
  expect(assets.some((u) => u.includes("walk_right_"))).toBe(false);
  expect(assets.filter((u) => u.includes("/object-"))).toHaveLength(
    postTownMaps.EMBERBROOK_VILLAGE.objects.length,
  );
});
it("walks the heroes along a lane that never crosses a house, lamp, statue or the well", () => {
  const walls = collisionRects("EMBERBROOK_VILLAGE", {});
  // Hero-sized footprint at every point of the lane inside the village.
  for (let x = 40; x <= 1112; x += 2)
    expect(
      walls.some(
        (r) =>
          x + 13 > r.x &&
          x - 13 < r.x + r.w &&
          TITLE_LANE.y + 13 > r.y &&
          TITLE_LANE.y - 13 < r.y + r.h &&
          // The village's outer border walls are off-screen scenery.
          r.w < 1000 &&
          r.h < 800,
      ),
      `x=${x}`,
    ).toBe(false);
  // Anything whose art overlaps a hero and stands further south is drawn in
  // front of them (depth by ground line), so no object can appear "under".
  const heroTop = TITLE_LANE.y - TITLE_HERO.feet;
  for (const o of postTownMaps.EMBERBROOK_VILLAGE.objects)
    if (o.groundY > TITLE_LANE.y) expect(o.y, o.filename).toBeGreaterThanOrEqual(heroTop - 2);
});
it("types each narration line, holds it, then moves on and loops", () => {
  expect(typewriter(0)).toMatchObject({ index: 0, text: "", done: false });
  const first = TITLE_LINES[0];
  const typedAt = (first.length / TITLE_TYPE_CPS) * 1000;
  expect(typewriter(typedAt + 10)).toMatchObject({ text: first, done: true });
  expect(typewriter(typedAt + TITLE_HOLD_MS + 1)).toMatchObject({ index: 1 });
  const cycle = TITLE_LINES.reduce(
    (sum, line) => sum + (line.length / TITLE_TYPE_CPS) * 1000 + TITLE_HOLD_MS,
    0,
  );
  expect(typewriter(cycle + 5)).toMatchObject({ index: 0 });
});
it("walks at a steady pace through the 8-frame east walk, keeping its follower in step", () => {
  let previous = heroStride(0).x;
  for (let ms = 100; ms < 5000; ms += 100) {
    const { x, frame } = heroStride(ms);
    expect(x - previous).toBeCloseTo(TITLE_WALK_SPEED / 10, 5);
    expect(frame).toBeGreaterThanOrEqual(0);
    expect(frame).toBeLessThan(TITLE_HERO.frames);
    previous = x;
  }
  const road = { from: 300, to: 700 };
  for (let ms = 0; ms < 30000; ms += 250) {
    const { x } = heroStride(ms, -64, road);
    expect(x).toBeGreaterThanOrEqual(road.from);
    expect(x).toBeLessThan(road.to);
  }
});
