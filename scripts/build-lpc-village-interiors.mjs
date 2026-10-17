// Keep original LPC sheets intact. Record native-resolution frames and align
// each replacement to the existing furniture's visible bounds and ground anchor.
import fs from "node:fs";

const base = "apps/client/public/assets/environment";
const definitions = {
  pantry: ["interior", 64, 96, 64, 64],
  shelfBig: ["house_inside", 416, 128, 64, 64],
  shelf: ["house_inside", 448, 128, 64, 64],
  bookcase: ["house_inside", 416, 128, 32, 64],
  bed: ["house_inside", 72, 176, 48, 80],
  wardrobe: ["interior", 0, 192, 32, 64],
  cabinet: ["house_inside", 256, 32, 32, 64],
  barrel: ["interior", 32, 256, 64, 64],
  barrels: ["interior", 32, 256, 64, 64],
  crate: ["interior", 96, 256, 32, 32],
  stairs: ["house_inside", 384, 32, 32, 64],
  potionTable: ["interior", 0, 352, 64, 64],
  table: ["house_inside", 136, 176, 48, 80],
  dining: ["house_inside", 136, 176, 48, 80],
  armchair: ["house_inside", 224, 104, 32, 40],
  weaponRack: ["interior", 96, 288, 64, 32],
  ovalTable: ["house_inside", 136, 176, 48, 80],
  sideChairL: ["house_inside", 288, 104, 32, 40],
  sideChairR: ["house_inside", 320, 104, 32, 40],
  garlic: ["interior", 320, 64, 32, 32],
  herbs: ["interior", 320, 64, 32, 32],
  rug: ["house_inside", 64, 272, 128, 96],
  vase: ["house_inside", 288, 272, 32, 16],
  plant: ["house_inside", 224, 224, 32, 64],
  sack: ["interior", 320, 64, 32, 32],
};
const regions = JSON.parse(
  fs.readFileSync("apps/client/src/environment/villageInteriorRegions.json"),
);
const result = {};
for (const [id, room] of Object.entries(regions)) {
  result[id] = [];
  for (const region of room.regions) {
    const kind = region.id.replace(/-\d+$/, "");
    const frame = definitions[kind];
    if (!frame) throw Error(`Missing LPC replacement for ${kind}`);
    const box = region.layoutBounds;
    if (!box)
      throw Error(`Missing reviewed layout bounds for ${id}/${region.id}`);
    const left = box.x,
      right = box.x + box.w,
      top = box.y,
      bottom = box.y + box.h;
    const themedFrame = ["ovalTable", "dining", "table"].includes(kind)
      ? ["kenney", 51, 0, 33, 16]
      : ["armchair", "sideChairL", "sideChairR"].includes(kind)
        ? ["kenney", 0, 34, 16, 16]
        : frame;
    const [sheet, x, y, w, h] = themedFrame;
    result[id].push({
      id: region.id,
      layer: region.layer,
      sheet,
      frame: [x, y, w, h],
      x: (left + right) / 2,
      y: bottom,
      width: right - left,
      height: bottom - top,
      category: region.category,
      bounds: box,
      depth: region.category === "path" ? -90 : region.groundY - 13,
    });
  }
}
fs.writeFileSync(
  "apps/client/src/environment/lpcVillageFurniture.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  `LPC furniture: ${Object.values(result).reduce((n, a) => n + a.length, 0)} placements across ${Object.keys(result).length} homes`,
);
