import { expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import furniture from "../src/environment/lpcVillageFurniture.json" with { type: "json" };
import regions from "../src/environment/villageInteriorRegions.json" with { type: "json" };
import { villageInteriorIds } from "../../../packages/shared/src/villageInteriors.js";
it("ships every LPC replacement frame intact, within its source sheet and with original attribution", () => {
  const root = "apps/client/public/assets/environment/lpc-interiors";
  expect(existsSync(`${root}/CREDITS-original.txt`)).toBe(true);
  expect(readFileSync(`${root}/LICENSE-CC-BY-SA-3.0.txt`, "utf8")).toContain(
    "Attribution",
  );
  for (const id of villageInteriorIds) {
    expect(furniture[id].map((o) => o.layer).sort()).toEqual(
      regions[id].regions.map((o) => o.layer).sort(),
    );
    for (const o of furniture[id]) {
      const png = readFileSync(
        o.sheet === "kenney"
          ? "apps/client/public/assets/environment/kenney-indoors/indoors.png"
          : `${root}/${o.sheet}.png`,
      );
      const [x, y, w, h] = o.frame;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x + w).toBeLessThanOrEqual(png.readUInt32BE(16));
      expect(y + h).toBeLessThanOrEqual(png.readUInt32BE(20));
    }
  }
});
