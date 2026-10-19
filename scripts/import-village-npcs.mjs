// Pack the village NPCs' PixelLab frames (Images/Sprites/Village_NPCs, see
// each provenance.json) into one sheet per character. Pixels are copied, never
// repainted. PixelLab walk frames use a larger canvas than the standing
// rotations with the character centred, so every frame is centred in a
// uniform cell. Rows: south, east, north, west. Column 0 is the standing
// rotation; columns 1..8 are the walk cycle (absent for stationary NPCs).
import fs from "node:fs";
import { PNG } from "pngjs";
const root = "Images/Sprites/Village_NPCs",
  out = "apps/client/public/assets/npcs";
const CELL = 96,
  DIRECTIONS = ["south", "east", "north", "west"],
  WALK = 8;
// The mother's generated west walk turns toward the camera mid-stride; her
// clean east walk, mirrored, reads correctly. Her source west frames are kept.
const MIRROR_WEST_WALK = new Set(["mother"]);
fs.mkdirSync(out, { recursive: true });
// Story NPCs packed the same way: [slug, folder, rotations subfolder].
const STORY = [
  // The stranger's face is shaded into her hood (scripts/stranger-hood-shadow.py).
  ["stranger", "Images/Sprites/Story_NPCs/stranger", "hooded"],
];
const sources = [
  ...fs
    .readdirSync(root)
    .sort()
    .map((slug) => [slug, `${root}/${slug}`, "rotations"]),
  ...STORY,
];
for (const [slug, dir, rotations] of sources) {
  if (!fs.existsSync(`${dir}/provenance.json`)) continue;
  const walks = fs.existsSync(`${dir}/walk`);
  const cols = walks ? 1 + WALK : 1;
  const sheet = new PNG({ width: cols * CELL, height: DIRECTIONS.length * CELL });
  const blit = (file, col, row, mirror = false) => {
    const png = PNG.sync.read(fs.readFileSync(file));
    const ox = col * CELL + Math.floor((CELL - png.width) / 2),
      oy = row * CELL + Math.floor((CELL - png.height) / 2);
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const a = ((oy + y) * sheet.width + ox + x) * 4,
          b = (y * png.width + (mirror ? png.width - 1 - x : x)) * 4;
        png.data.copy(sheet.data, a, b, b + 4);
      }
  };
  DIRECTIONS.forEach((direction, row) => {
    blit(`${dir}/${rotations}/${direction}.png`, 0, row);
    const mirror = direction === "west" && MIRROR_WEST_WALK.has(slug);
    if (walks)
      for (let i = 0; i < WALK; i++)
        blit(
          `${dir}/walk/${mirror ? "east" : direction}/${i}.png`,
          1 + i,
          row,
          mirror,
        );
  });
  fs.writeFileSync(`${out}/${slug}.png`, PNG.sync.write(sheet));
  console.log(`${slug}: ${cols}x${DIRECTIONS.length} cells of ${CELL}px`);
}
