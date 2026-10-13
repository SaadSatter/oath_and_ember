import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

// Pack user-supplied transparent PNGs without recoloring, resizing or GIF chroma keying.
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/assets/import-mossling.mjs <export-folder> [gif-folder]');
const base = 'Images/Sprites/monster_sprites';
const source = `${base}/sources/mossling-user-export-v3`;
fs.mkdirSync(source, { recursive: true });
fs.cpSync(input, `${source}/export`, { recursive: true });
if (process.argv[3]) for (const dir of ['south', 'north', 'west', 'east']) {
  fs.copyFileSync(path.join(process.argv[3], `Idle_v3_walking_${dir}.gif`), `${source}/walking_${dir}.gif`);
}
const directions = ['south', 'north', 'west', 'east'];
const atlas = new PNG({ width: 256 * 9, height: 256 * 4 });
const files = [];
const offsets = {};
function bounds(p) {
  let b = [p.width, p.height, -1, -1];
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    if (p.data[(y * p.width + x) * 4 + 3]) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
  }
  return b;
}
for (const [row, dir] of directions.entries()) {
  const read = relative => {
    const bytes = fs.readFileSync(`${source}/export/Idle/${relative}`);
    files.push({ path: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    return PNG.sync.read(bytes);
  };
  const walk = Array.from({ length: 8 }, (_, i) => read(`animations/Walking/${dir}/frame_${String(i).padStart(3, '0')}.png`));
  const idle = read(`rotations/${dir}.png`);
  const wb = bounds(walk[0]), ib = bounds(idle);
  // Align the idle footprint to the first walk pose, preserving every walk pixel with centered transparent padding.
  const dx = Math.round((wb[0] + wb[2] - ib[0] - ib[2]) / 2) + Math.floor((256 - walk[0].width) / 2), dy = wb[3] - ib[3] + Math.floor((256 - walk[0].height) / 2);
  offsets[dir] = [dx, dy];
  for (const [col, p] of [...walk, idle].entries()) {
    const x = col === 8 ? dx : Math.floor((256 - p.width) / 2), y = col === 8 ? dy : Math.floor((256 - p.height) / 2);
    if (col < 8 && (p.width > 256 || p.height > 256)) throw new Error('Unexpected walk dimensions');
    if (x < 0 || y < 0 || x + p.width > 256 || y + p.height > 256) throw new Error('Idle clipping');
    PNG.bitblt(p, atlas, 0, 0, p.width, p.height, col * 256 + x, row * 256 + y);
  }
}
const preserved = `${base}/mossling/v3`;
fs.mkdirSync(preserved, { recursive: true });
const bytes = PNG.sync.write(atlas);
fs.writeFileSync(`${preserved}/atlas.png`, bytes);
fs.writeFileSync('apps/client/public/assets/enemies/mossling/top-down-v3.png', bytes);
const visual = {
  asset_id: 'mossling_sprites_v2',
  url: '/assets/enemies/mossling/top-down-v3.png',
  frame_dimensions: [256, 256], anchor: [128, 214], directions,
  x_edges: Array.from({ length: 10 }, (_, i) => i * 256),
  animation_frames: Object.fromEntries(directions.map(d => [d, [0, 1, 2, 3, 4, 5, 6, 7]])),
  standing_frames: Object.fromEntries(directions.map(d => [d, 8])),
  scale: 0.32, fps: 8, motion: 'walk'
};
const json = value => JSON.stringify(value, null, 2) + '\n';
fs.writeFileSync('apps/client/public/assets/enemies/mossling/visual.json', json(visual));
fs.writeFileSync(`${preserved}/visual.json`, json(visual));
fs.writeFileSync(`${preserved}/provenance.json`, json({
  revision: 3, authorization: 'User requested replacement with supplied Mossling walking GIFs and idle export on 2026-10-12.',
  source, files, atlas_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  idle_offsets: offsets, operations: ['Lossless PNG packing: eight walk frames then one idle pose per direction. North 252px canvases padded by 2px on each side.', 'Idle translated once per direction to match the first walk footprint; no scaling or pixel edits.', 'Original GIFs retained for reference; transparent PNG walking export used at runtime.'],
  runtime_key: 'mossling_sprites_v2 retained to avoid changing shared gameplay definitions',
  previous_approved: `${base}/mossling/atlas.png`
}));
console.log('Packed 32 walking frames and 4 idle poses:', offsets);
