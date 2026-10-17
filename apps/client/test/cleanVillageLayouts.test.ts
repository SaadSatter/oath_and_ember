import { expect, it } from "vitest";
import furniture from "../src/environment/lpcVillageFurniture.json" with { type: "json" };
import {
  settlementPortals,
  settlements,
  settlementWaterTiles,
} from "../../../packages/shared/src/settlements.js";
import { villageInteriorIds } from "../../../packages/shared/src/villageInteriors.js";
import { shoreFrame, shoreFrames } from "../src/environment/settlementShore.js";
import { settlementBuildingFrames } from "../src/environment/settlementBuildings.js";
import { settlementTreeArt } from "../src/environment/settlementTrees.js";
const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
it("gives homes human proportions without stretching or counting transparent padding", () => {
  for (const town of Object.values(settlements))
    for (const b of town.buildings) {
      const [, , width, height] = settlementBuildingFrames[b.art];
      expect(b.w / width).toBe(2);
      expect(b.h / height).toBe(2);
      // Villagers' visible bodies are about 60 world units tall. Even the
      // smallest cottage should rise at least five bodies above the ground.
      expect(b.h).toBeGreaterThanOrEqual(300);
      expect(b.x).toBeGreaterThanOrEqual(32);
      expect(b.y).toBeGreaterThanOrEqual(32);
      expect(b.x + b.w).toBeLessThanOrEqual(town.width - 32);
      expect(b.y + b.h).toBeLessThanOrEqual(town.height - 32);
    }
});
it("separates every furnishing from other objects and stairs, allowing only rugs beneath objects", () => {
  for (const id of villageInteriorIds) {
    const objects = furniture[id].filter((o) => o.category !== "path");
    for (let a = 0; a < objects.length; a++)
      for (let b = a + 1; b < objects.length; b++)
        expect(
          overlaps(objects[a].bounds, objects[b].bounds),
          `${id}: ${objects[a].id}/${objects[b].id}`,
        ).toBe(false);
    for (const t of settlementPortals.filter((t) => t.from === id && t.stairs))
      for (const o of objects)
        expect(
          overlaps(o.bounds, { x: t.at.x - 26, y: t.at.y - 30, w: 52, h: 60 }),
          `${id}: ${o.id}/stairs`,
        ).toBe(false);
    for (const o of objects)
      expect(
        o.bounds.y,
        `${id}: furniture below the windows`,
      ).toBeGreaterThanOrEqual(200);
  }
});
it("keeps the outdoor tree canopies, houses, well, and seating visually separate", () => {
  for (const [id, m] of Object.entries(settlements)) {
    const props = [
      ...m.buildings.map((b) => ({
        name: b.label,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
      })),
      ...m.trees.map((t, i) => {
        const art = settlementTreeArt(i);
        return {
          name: `tree-${i}`,
          x: t.x - art.size * art.originX,
          y: t.y - art.size * art.originY,
          w: art.size,
          h: art.size,
        };
      }),
      { name: "well", x: m.width / 2 - 48, y: 396, w: 96, h: 88 },
      ...[-110, 110].map((dx) => ({
        name: `seat${dx}`,
        x: m.width / 2 + dx - 33,
        y: 448,
        w: 66,
        h: 32,
      })),
    ];
    for (let a = 0; a < props.length; a++)
      for (let b = a + 1; b < props.length; b++)
        expect(
          overlaps(props[a], props[b]),
          `${id}: ${props[a].name}/${props[b].name}`,
        ).toBe(false);
  }
});
it("uses real transition tiles on rounded banks with all Wang corner combinations available", () => {
  expect(shoreFrames.size).toBe(16);
  for (const id of Object.keys(settlements) as (keyof typeof settlements)[]) {
    const tiles = settlementWaterTiles(id);
    expect(tiles.some((t) => t.mask !== 15)).toBe(true);
    expect(tiles.some((t) => t.mask === 15)).toBe(true);
    for (const tile of tiles)
      expect(shoreFrame(tile.mask)).toBeGreaterThanOrEqual(0);
  }
});
