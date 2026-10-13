import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  classifyMapTile,
  mapElementDepth,
} from "../src/environment/mapClassification.js";
import { interiorElements } from "../../../packages/shared/src/mapElements.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { constrainMotion } from "../../../packages/shared/src/movement.js";

it("keeps the authored stair treads above their wall-sheet backing and below heroes", () => {
  const map = JSON.parse(
    readFileSync(
      "apps/client/public/assets/environment/main-house/interior-map.json",
      "utf8",
    ),
  );
  const stairIndex = map.layers.findIndex(
    (l: { name: string }) => l.name === "Objects1",
  );
  const wallIndex = map.layers.findIndex(
    (l: { name: string }) => l.name === "Walls",
  );
  let overlaps = 0;
  for (let y = 6; y <= 10; y++)
    for (let x = 6; x <= 7; x++) {
      const cell = y * map.width + x;
      expect(map.layers[stairIndex].data[cell]).toBeGreaterThan(0);
      if (!map.layers[wallIndex].data[cell]) continue;
      overlaps++;
      const tread = classifyMapTile("HOUSE_INTERIOR", "Objects1", x, y);
      const backing = classifyMapTile("HOUSE_INTERIOR", "Walls", x, y);
      expect(backing.category).toBe("path");
      expect(mapElementDepth(tread, stairIndex)).toBeGreaterThan(
        mapElementDepth(backing, wallIndex),
      );
      expect(mapElementDepth(tread, stairIndex)).toBeLessThan(y * 32);
    }
  expect(overlaps).toBeGreaterThan(0);
  expect(classifyMapTile("HOUSE_INTERIOR", "Walls", 5, 8).category).toBe(
    "wall",
  );
  expect(classifyMapTile("HOUSE_INTERIOR", "Walls", 8, 8).category).toBe(
    "wall",
  );
});

it("sorts the dining table independently of all four chairs and the rug", () => {
  const table = classifyMapTile("HOUSE_INTERIOR", "Objects2", 12, 12);
  const south = classifyMapTile("HOUSE_INTERIOR", "Objects2", 12, 14);
  expect(table.id).toBe("dining-table");
  expect(mapElementDepth(table, 7)).toBe(419);
  expect(mapElementDepth(south, 7)).toBe(449);
  // On the floor below the table but behind the south chair.
  expect(mapElementDepth(table, 7)).toBeLessThan(435);
  expect(mapElementDepth(south, 7)).toBeGreaterThan(435);
  for (const [x, y, id] of [
    [12, 11, "north-chair"],
    [10, 12, "west-chair"],
    [14, 12, "east-chair"],
  ] as const)
    expect(classifyMapTile("HOUSE_INTERIOR", "Objects2", x, y).id).toBe(id);
  expect(classifyMapTile("HOUSE_INTERIOR", "Objects1", 12, 13).category).toBe(
    "path",
  );
  expect(classifyMapTile("HOUSE_INTERIOR", "Objects1", 6, 9).category).toBe(
    "path",
  );
});

it("draws an arch above a hero behind it and below a hero in front, retaining the opening", () => {
  const arch = classifyMapTile("HOUSE_INTERIOR", "Walls", 18, 11);
  expect(arch.category).toBe("door");
  expect(mapElementDepth(arch, 3)).toBeGreaterThan(375);
  expect(mapElementDepth(arch, 3)).toBeLessThan(430);
  const walls = collisionRects("HOUSE_INTERIOR", {});
  expect(
    constrainMotion(
      { x: 608, y: 430 },
      { x: 0, y: -70 },
      maps.HOUSE_INTERIOR,
      walls,
    ),
  ).toEqual({ x: 608, y: 360 });
  expect(
    constrainMotion(
      { x: 570, y: 430 },
      { x: 0, y: -70 },
      maps.HOUSE_INTERIOR,
      walls,
    ).y,
  ).toBeGreaterThan(414);
});

it("classifies all authored house tiles with finite depths and keeps paths non-solid", () => {
  for (const [name, scene] of [
    ["interior", "HOUSE_INTERIOR"],
    ["exterior", "MAIN_HOUSE"],
  ] as const) {
    const map = JSON.parse(
      readFileSync(
        `apps/client/public/assets/environment/main-house/${name}-map.json`,
        "utf8",
      ),
    );
    for (const [index, layer] of map.layers.entries())
      for (const [i, gid] of layer.data.entries()) {
        if (!gid) continue;
        const element = classifyMapTile(
          scene,
          layer.name,
          i % map.width,
          Math.floor(i / map.width),
        );
        expect(Number.isFinite(mapElementDepth(element, index))).toBe(true);
        if (name === "exterior" && layer.name.startsWith("Objects"))
          expect(element.category).toBe("object");
      }
  }
  for (const element of interiorElements.filter((e) => e.category === "path"))
    expect(element.solids).toEqual([]);
});

it("keeps each exterior object's tiles together and gateways above approaching heroes", () => {
  const top = classifyMapTile("MAIN_HOUSE", "Objects1", 12, 16);
  const bottom = classifyMapTile("MAIN_HOUSE", "Objects1", 12, 18);
  expect(top.id).toBe(bottom.id);
  expect(mapElementDepth(top, 0)).toBe(mapElementDepth(bottom, 0));
  expect(classifyMapTile("MAIN_HOUSE", "Fence", 14, 13).category).toBe("door");
  expect(
    mapElementDepth(classifyMapTile("MAIN_HOUSE", "Fence", 14, 13), 0),
  ).toBeGreaterThan(410);
});
