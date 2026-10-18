// Pack Alden's PixelLab frames (Images/Sprites/Story_NPCs/alden, see its
// provenance.json) into apps/client/public/assets/npcs/alden.png. Pixels are
// copied, never repainted; every frame is centred across a 112px cell.
// Rows 0-3: south, east, north, west. Column 0 is standing, columns 1-8 the
// walk. West is east mirrored. Row 4: the south spellcast, 9 frames, staff
// raised.
// Standing: south and north use stand/ (the rotations with the staff erased,
// see scripts/alden-unstaff.py), so both legs show; east uses a planted walk
// frame. Each pose set is placed so its planted feet end on the same cell row.
import fs from "node:fs";
import { PNG } from "pngjs";
const dir = "Images/Sprites/Story_NPCs/alden",
  out = "apps/client/public/assets/npcs/alden.png";
const CELL = 112,
  COLS = 9,
  FEET = 89, // first row below the feet; matches AldenView's ORIGIN_Y
  DIRECTIONS = ["south", "east", "north", "west"],
  STAND = {
    south: `${dir}/stand/south.png`,
    east: `${dir}/walk/east/0.png`,
    north: `${dir}/stand/north.png`,
  };
const read = (file) => PNG.sync.read(fs.readFileSync(file));
/** One past the lowest opaque row: where this frame's feet end. */
const feetOf = (png) => {
  for (let y = png.height - 1; y >= 0; y--)
    for (let x = 0; x < png.width; x++)
      if (png.data[(y * png.width + x) * 4 + 3]) return y + 1;
  return png.height;
};
const sheet = new PNG({ width: COLS * CELL, height: 5 * CELL });
/** `top` is the frame's row inside the cell; by default it is centred. */
const blit = (png, col, row, mirror = false, top) => {
  const ox = col * CELL + Math.floor((CELL - png.width) / 2),
    oy = row * CELL + (top ?? Math.floor((CELL - png.height) / 2));
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const a = ((oy + y) * sheet.width + ox + x) * 4,
        b = (y * png.width + (mirror ? png.width - 1 - x : x)) * 4;
      png.data.copy(sheet.data, a, b, b + 4);
    }
};
DIRECTIONS.forEach((direction, row) => {
  const mirror = direction === "west",
    source = mirror ? "east" : direction,
    stand = read(STAND[source]),
    walk = [...Array(8)].map((_, i) => read(`${dir}/walk/${source}/${i}.png`));
  blit(stand, 0, row, mirror, FEET - feetOf(stand));
  // The walk's first frame has both feet planted; the rest share its offset.
  const top = FEET - feetOf(walk[0]);
  walk.forEach((png, i) => blit(png, 1 + i, row, mirror, top));
});
for (let i = 0; i < 9; i++) blit(read(`${dir}/cast/south/${i}.png`), i, 4);
fs.writeFileSync(out, PNG.sync.write(sheet));
console.log(`alden: ${COLS}x5 cells of ${CELL}px`);
