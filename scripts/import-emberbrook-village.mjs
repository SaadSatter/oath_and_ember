// Import the Emberbrook Village PixelLab export as a post-town scene.
// Same method as import-post-town-maps.mjs: terrain is recovered by matching
// the composite against the original 64px terrain/Wang tiles with authored
// object pixels masked out, and objects are copied byte-for-byte. Unlike the
// small post-town exports, this map is a 101x101-tile canvas with the village
// in the middle, so only an 18x13-tile window around it becomes the scene.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
const ID = "EMBERBROOK_VILLAGE";
const source = "Images/Sprites/Pixel Lab Emberbrook_Village-export";
const out = `apps/client/public/assets/environment/post-town/${ID.toLowerCase()}`;
// Scene window in composite pixels. PixelLab composites lay the 64px tile
// grid at a 32px offset (as in the post-town exports), so the window starts
// on that grid for terrain to match exactly.
const ORIGIN = { x: 2720, y: 2912 },
  SIZE = { w: 1152, h: 832 };
const config = JSON.parse(fs.readFileSync(`${source}/map.json`));
const tile = config.mapConfig.tileSize;
// Object coordinates are relative to the map's tile (0, 0).
const mapOrigin = {
  x: -config.mapConfig.boundingBox.minX * tile,
  y: -config.mapConfig.boundingBox.minY * tile,
};
const offset = { x: mapOrigin.x - ORIGIN.x, y: mapOrigin.y - ORIGIN.y };
fs.mkdirSync(out, { recursive: true });
const composite = PNG.sync.read(fs.readFileSync(`${source}/map-composite.png`));
const objects = JSON.parse(
  fs.readFileSync(`${source}/objects/manifest.json`),
).objects.filter((o) => o.visible);
const mask = new Uint8Array(composite.width * composite.height);
for (const o of objects) {
  const png = PNG.sync.read(fs.readFileSync(`${source}/objects/${o.filename}`));
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const cx = Math.round(mapOrigin.x + o.boundingBox.x + x),
        cy = Math.round(mapOrigin.y + o.boundingBox.y + y);
      if (
        cx >= 0 &&
        cy >= 0 &&
        cx < composite.width &&
        cy < composite.height &&
        png.data[(y * png.width + x) * 4 + 3]
      )
        mask[cy * composite.width + cx] = 1;
    }
}
const textures = [],
  candidates = [];
function add(file, sheet = false) {
  const filename = `texture-${textures.length}.png`;
  fs.copyFileSync(`${source}/${file}`, `${out}/${filename}`);
  const png = PNG.sync.read(fs.readFileSync(`${source}/${file}`));
  const texture = textures.length;
  textures.push({ filename, sheet });
  for (let row = 0; row < png.height / tile; row++)
    for (let col = 0; col < png.width / tile; col++)
      candidates.push({ png, texture, frame: row * (png.width / tile) + col, col, row });
}
for (const t of config.terrains) add(`terrain-tiles/terrain-${t.id}.png`);
for (const t of config.tilesets) add(`tilesets/${t.filename}`, true);
const tiles = [];
let worst = 0;
for (let y = 0; y < SIZE.h; y += tile)
  for (let x = 0; x < SIZE.w; x += tile) {
    const cx = ORIGIN.x + x,
      cy = ORIGIN.y + y;
    let best,
      score = Infinity;
    for (const c of candidates) {
      let error = 0,
        count = 0;
      for (let py = 0; py < tile; py += 2)
        for (let px = 0; px < tile; px += 2) {
          if (mask[(cy + py) * composite.width + cx + px]) continue;
          const a = ((cy + py) * composite.width + cx + px) * 4;
          const b = ((c.row * tile + py) * c.png.width + c.col * tile + px) * 4;
          for (let k = 0; k < 3; k++)
            error += Math.abs(composite.data[a + k] - c.png.data[b + k]);
          count++;
        }
      const next = count ? error / count : Infinity;
      if (next < score) {
        score = next;
        best = c;
      }
    }
    if (!best) best = candidates[0];
    worst = Math.max(worst, Number.isFinite(score) ? score : 0);
    tiles.push({ x, y, texture: best.texture, frame: best.frame });
  }
const placed = objects.map((o) => {
  const filename = `object-${o.id}.png`;
  fs.copyFileSync(`${source}/objects/${o.filename}`, `${out}/${filename}`);
  return {
    filename,
    x: o.boundingBox.x + offset.x,
    y: o.boundingBox.y + offset.y,
    groundY: o.groundBounds.y + o.groundBounds.height + offset.y,
  };
});
fs.copyFileSync(`${source}/map.json`, `${out}/source-map.json`);
const file = "apps/client/src/environment/postTownMaps.json";
const maps = JSON.parse(fs.readFileSync(file));
maps[ID] = { folder: ID.toLowerCase(), textures, tiles, objects: placed };
fs.writeFileSync(file, JSON.stringify(maps, null, 2) + "\n");
console.log(
  `${ID}: ${tiles.length} tiles, ${placed.length} objects; largest matching error ${worst.toFixed(2)}`,
);
// Reviewed collision footprints derive from each object's authored ground
// bounds; print them for review rather than writing gameplay data blindly.
console.log(
  JSON.stringify(
    objects.map((o) => ({
      x: Math.round(o.groundBounds.x + offset.x),
      y: Math.round(o.groundBounds.y + offset.y),
      w: Math.round(o.groundBounds.width),
      h: Math.round(o.groundBounds.height),
    })),
  ),
);
