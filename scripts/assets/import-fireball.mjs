import fs from "node:fs";
import { PNG } from "pngjs";
import crypto from "node:crypto";
const file = process.argv[2];
const root = "Images/Sprites/coco_fireball/v1";
fs.mkdirSync(root, { recursive: true });
fs.copyFileSync(file, `${root}/source.png`);
if (process.argv[3]) fs.copyFileSync(process.argv[3], `${root}/source.gif`);
const src = PNG.sync.read(fs.readFileSync(file));
const atlas = new PNG({ width: 48 * 36, height: 40 });
const edges = [0, 45, 88, 132, 174],
  rows = [3, 54, 106];
for (let level = 0; level < 4; level++)
  for (let frame = 0; frame < 9; frame++) {
    const col = frame % 3,
      row = Math.floor(frame / 3),
      w = edges[level + 1] - edges[level];
    const cell = new PNG({ width: w, height: 32 });
    PNG.bitblt(src, cell, col * 174 + edges[level], rows[row], w, 32, 0, 0);
    // Remove only neutral background connected to cell edges; retain enclosed bright cores.
    const backdrop = [...cell.data.subarray(0, 3)];
    const seen = new Set(),
      queue = [];
    const visit = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= 32) return;
      let i = y * w + x;
      if (seen.has(i)) return;
      seen.add(i);
      let o = i * 4;
      let [r, g, b, a] = cell.data.subarray(o, o + 4);
      if (
        a === 0 ||
        Math.max(r, g, b) - Math.min(r, g, b) <= 3 ||
        [r, g, b].every((v, i) => Math.abs(v - backdrop[i]) <= 3)
      ) {
        cell.data[o + 3] = 0;
        queue.push([x, y]);
      }
    };
    for (let x = 0; x < w; x++) {
      visit(x, 0);
      visit(x, 31);
    }
    for (let y = 0; y < 32; y++) {
      visit(0, y);
      visit(w - 1, y);
    }
    for (let i = 0; i < queue.length; i++) {
      let [x, y] = queue[i];
      visit(x - 1, y);
      visit(x + 1, y);
      visit(x, y - 1);
      visit(x, y + 1);
    }
    PNG.bitblt(
      cell,
      atlas,
      0,
      0,
      w,
      32,
      (level * 9 + frame) * 48 + Math.floor((48 - w) / 2),
      4,
    );
  }
const output = "apps/client/public/assets/effects/coco";
fs.writeFileSync(`${output}/fireball.png`, PNG.sync.write(atlas));
fs.writeFileSync(`${root}/atlas.png`, PNG.sync.write(atlas));
const mask = new PNG({ width: atlas.width, height: atlas.height });
for (let i = 0; i < atlas.data.length; i += 4) {
  const [r, g, b, a] = atlas.data.subarray(i, i + 4);
  if (a && !(r > 220 && g > 200)) {
    mask.data[i] = 0;
    mask.data[i + 1] = 0;
    mask.data[i + 2] = 255;
    mask.data[i + 3] = a;
  }
}
fs.writeFileSync(`${output}/fireball-mask.png`, PNG.sync.write(mask));
for (let level = 0; level < 4; level++) {
  let icon = new PNG({ width: 48, height: 40 });
  PNG.bitblt(atlas, icon, level * 9 * 48, 0, 48, 40, 0, 0);
  fs.writeFileSync(
    `${output}/fireball-level-${level + 1}.png`,
    PNG.sync.write(icon),
  );
}
fs.writeFileSync(
  `${root}/provenance.json`,
  JSON.stringify(
    {
      source_sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex"),
      levels: 4,
      frames_per_level: 9,
      order:
        "Same position within each four-sprite group, groups left to right then top to bottom",
      operations: [
        "Crop and pad without rescaling",
        "Remove edge-connected neutral backdrop",
        "Protect bright cores in palette mask",
      ],
      authorization:
        "User supplied PNG and GIF and specified four strength levels, one per frame position.",
    },
    null,
    2,
  ),
);
