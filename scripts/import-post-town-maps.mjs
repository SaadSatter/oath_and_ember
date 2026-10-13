// Recover authored terrain placement from the exported composite, excluding
// object pixels. Source PNGs are copied byte-for-byte; no artwork is repainted.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
const root = "Images/Sprites/Map Sprites, Top Down";
const entries = [
  ["TRANSITION_TRAIL", "Simple_transition_Map"],
  ["GRASSLANDS", "Standard_Grass_Lands"],
  ["PUZZLE_GLADE", "Puzzle_Map_1"],
  ["MONSTER_CLEARING", "Monster_Map_2"],
];
const result = {};
for (const [id, name] of entries) {
  const source = path.join(root, `${name}-export`);
  const out = `apps/client/public/assets/environment/post-town/${id.toLowerCase()}`;
  fs.mkdirSync(out, { recursive: true });
  const config = JSON.parse(fs.readFileSync(`${source}/map.json`));
  const composite = PNG.sync.read(
    fs.readFileSync(`${source}/map-composite.png`),
  );
  const objects = JSON.parse(
    fs.readFileSync(`${source}/objects/manifest.json`),
  ).objects.filter((o) => o.visible);
  const mask = new Uint8Array(composite.width * composite.height);
  for (const o of objects) {
    const png = PNG.sync.read(
      fs.readFileSync(`${source}/objects/${o.filename}`),
    );
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const wx = Math.round(o.boundingBox.x + 64 + x),
          wy = Math.round(o.boundingBox.y + 64 + y);
        if (
          wx >= 0 &&
          wy >= 0 &&
          wx < composite.width &&
          wy < composite.height &&
          png.data[(y * png.width + x) * 4 + 3]
        )
          mask[wy * composite.width + wx] = 1;
      }
  }
  // Overlays are not gameplay entities; exclude them from terrain matching.
  for (const o of config.overlays)
    for (
      let y = o.worldCoordinates.y;
      y < o.worldCoordinates.y + o.dimensions.height;
      y++
    )
      for (
        let x = o.worldCoordinates.x;
        x < o.worldCoordinates.x + o.dimensions.width;
        x++
      )
        mask[y * composite.width + x] = 1;
  const textures = [],
    candidates = [];
  function add(file, sheet = false) {
    const filename = `texture-${textures.length}.png`;
    fs.copyFileSync(`${source}/${file}`, `${out}/${filename}`);
    const png = PNG.sync.read(fs.readFileSync(`${source}/${file}`));
    const texture = textures.length;
    textures.push({ filename, sheet });
    const cols = png.width / 64,
      rows = png.height / 64;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++)
        candidates.push({ png, texture, frame: row * cols + col, col, row });
  }
  for (const t of config.terrains) add(`terrain-tiles/terrain-${t.id}.png`);
  for (const t of config.tilesets) add(`tilesets/${t.filename}`, true);
  const tiles = [];
  let worst = 0;
  for (let y = 32; y < 736; y += 64)
    for (let x = 32; x < 992; x += 64) {
      let best,
        score = Infinity;
      for (const c of candidates) {
        let error = 0,
          count = 0;
        for (let py = 0; py < 64; py += 2)
          for (let px = 0; px < 64; px += 2) {
            if (mask[(y + py) * composite.width + x + px]) continue;
            const a = ((y + py) * composite.width + x + px) * 4;
            const b = ((c.row * 64 + py) * c.png.width + c.col * 64 + px) * 4;
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
  // The grasslands reference includes a static hero. Live players replace it.
  const placed = objects
    .filter((o) => o.id !== "45f109a9-7e51-414f-b818-e9a88fab7be9")
    .map((o) => {
      const filename = `object-${o.id}.png`;
      fs.copyFileSync(`${source}/objects/${o.filename}`, `${out}/${filename}`);
      return {
        filename,
        x: o.boundingBox.x + 64,
        y: o.boundingBox.y + 64,
        groundY: o.groundBounds.y + o.groundBounds.height + 64,
      };
    });
  result[id] = { folder: id.toLowerCase(), textures, tiles, objects: placed };
  fs.copyFileSync(`${source}/map.json`, `${out}/source-map.json`);
  console.log(
    `${id}: ${tiles.length} tiles, ${placed.length} objects; largest matching error ${worst.toFixed(2)}`,
  );
}
fs.writeFileSync(
  "apps/client/src/environment/postTownMaps.json",
  JSON.stringify(result, null, 2) + "\n",
);
