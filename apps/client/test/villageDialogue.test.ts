import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { typedText, DIALOGUE_CPS } from "../src/ui/dialogueBox.js";
import { npcs } from "../../../packages/shared/src/npcs.js";
import postTownMaps from "../src/environment/postTownMaps.json" with { type: "json" };
import { existsSync } from "node:fs";
import {
  villageInteriorIds,
  villageInteriors,
} from "../../../packages/shared/src/villageInteriors.js";
import villageRegions from "../src/environment/villageInteriorRegions.json" with { type: "json" };

const size = (file: string) => {
  const png = readFileSync(file);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

it("types dialogue at a steady rate and reports when the page is complete", () => {
  const page = "Sieg! Coco! There you are.";
  expect(typedText(page, 0)).toEqual({ text: "", done: false });
  expect(typedText(page, (1000 / DIALOGUE_CPS) * 5 + 1).text).toBe(
    page.slice(0, 5),
  );
  expect(typedText(page, 60000)).toEqual({ text: page, done: true });
});

it("ships a sheet for every villager: 4 facing rows of 96px cells, standing + 8-frame walk", () => {
  for (const npc of npcs) {
    const file = `apps/client/public/assets/npcs/${npc.sprite}.png`;
    const [w, h] = size(file);
    expect(h, file).toBe(4 * 96);
    expect([96, 9 * 96], file).toContain(w);
    if (npc.speed > 0) expect(w, file).toBe(9 * 96);
  }
});

it("renders Emberbrook Village from imported terrain and every authored object", () => {
  const map = postTownMaps.EMBERBROOK_VILLAGE;
  expect(map.tiles).toHaveLength(18 * 13);
  expect(map.objects).toHaveLength(28);
  const dir =
    "apps/client/public/assets/environment/post-town/emberbrook_village";
  for (const t of map.textures)
    expect(existsSync(`${dir}/${t.filename}`)).toBe(true);
  for (const o of map.objects)
    expect(existsSync(`${dir}/${o.filename}`)).toBe(true);
});

it("ships a well-formed Tiled map for every village house, with depth regions on real layers", () => {
  for (const id of villageInteriorIds) {
    const file = `apps/client/public/assets/environment/village-interiors/${id.toLowerCase()}.json`;
    const map = JSON.parse(readFileSync(file, "utf8"));
    const room = villageInteriors[id];
    expect(map.width * 32).toBe(room.width);
    expect(map.height * 32).toBe(room.height);
    for (const layer of map.layers)
      expect(layer.data).toHaveLength(map.width * map.height);
    // Same three user-supplied sheets as the main house interior.
    expect(map.tilesets.map((t: { image: string }) => t.image)).toEqual([
      "walls_floor.png",
      "Interior.png",
      "Doors_windows_animation.png",
    ]);
    const names = new Set(map.layers.map((l: { name: string }) => l.name));
    const { regions } = villageRegions[id];
    expect(regions.length).toBeGreaterThan(5);
    for (const r of regions) expect(names.has(r.layer), r.layer).toBe(true);
  }
});
