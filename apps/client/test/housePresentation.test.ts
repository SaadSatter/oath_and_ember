import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { characterVisuals } from "../src/assets/characterVisuals.js";
import {
  ENVIRONMENT_SCALE,
  ENVIRONMENT_TILE_SIZE,
  maps,
} from "../../../packages/shared/src/maps.js";
import { Interpolation } from "../src/net/interpolation.js";
import type { World } from "../../../packages/shared/src/gameTypes.js";
it("retains authored house tiles and hero scale across both locations", () => {
  for (const [name, scene] of [
    ["exterior", "MAIN_HOUSE"],
    ["interior", "HOUSE_INTERIOR"],
  ] as const) {
    const m = JSON.parse(
      readFileSync(
        `apps/client/public/assets/environment/main-house/${name}-map.json`,
        "utf8",
      ),
    );
    expect(m.tilewidth).toBe(ENVIRONMENT_TILE_SIZE);
    expect(m.tileheight).toBe(ENVIRONMENT_TILE_SIZE);
    expect(m.width * m.tilewidth * ENVIRONMENT_SCALE).toBe(maps[scene].width);
    expect(m.height * m.tileheight * ENVIRONMENT_SCALE).toBe(
      maps[scene].height,
    );
  }
  for (const v of Object.values(characterVisuals)) {
    expect(v.scale).toBe(1);
    expect(v.origin).toEqual({ x: 0.5, y: 60 / 64 });
    expect(v.offset.y).toBe(13);
  }
});
it("never interpolates a remote hero across unrelated map coordinates", () => {
  const i = new Interpolation();
  const world = (sceneId: string, x: number) =>
    ({
      players: { hero: { sceneId, x, y: 454 } },
      enemies: {},
      projectiles: {},
    }) as unknown as World;
  const now = performance.now();
  i.buffer = [
    { time: now - 200, world: world("MAIN_HOUSE", 480) },
    { time: now, world: world("HOUSE_INTERIOR", 608) },
  ];
  expect(i.position("hero", "players")).toEqual({
    sceneId: "HOUSE_INTERIOR",
    x: 608,
    y: 454,
  });
});
