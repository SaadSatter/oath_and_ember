import { shoreFrame } from "../apps/client/src/environment/settlementShore.js";
import { settlementBuildingFrames } from "../apps/client/src/environment/settlementBuildings.js";
import { settlementTreeArt } from "../apps/client/src/environment/settlementTrees.js";
import { npcsIn, npcPose } from "../packages/shared/src/npcs.js";
import { isVillageInterior } from "../packages/shared/src/villageInteriors.js";
// Standalone nearest-neighbor map previews from the same shipped sheets and
// placement data as the game. No game state, source artwork or collisions change.
import fs from "node:fs";
import { PNG } from "pngjs";
import {
  settlements,
  settlementPortals,
  stairPairs,
  settlementWaterTiles,
} from "../packages/shared/src/settlements.js";
import {
  villageInteriorIds,
  villageInteriors,
} from "../packages/shared/src/villageInteriors.js";
import {
  classifyMapTile,
  mapElementDepth,
} from "../apps/client/src/environment/mapClassification.js";
import furniture from "../apps/client/src/environment/lpcVillageFurniture.json" with { type: "json" };
import postTown from "../apps/client/src/environment/postTownMaps.json" with { type: "json" };
const out = process.argv[2] ?? "qa/town-expansion/previews",
  base = "apps/client/public/assets/environment";
fs.mkdirSync(out, { recursive: true });
const cache = new Map<string, PNG>();
const read = (file: string) => {
  if (!cache.has(file)) cache.set(file, PNG.sync.read(fs.readFileSync(file)));
  return cache.get(file)!;
};
function blank(w: number, h: number, color = [45, 40, 39, 255]) {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < p.data.length; i += 4) p.data.set(color, i);
  return p;
}
function blit(
  dst: PNG,
  src: PNG,
  x: number,
  y: number,
  w = src.width,
  h = src.height,
  sx = 0,
  sy = 0,
  sw = src.width,
  sh = src.height,
) {
  const left = Math.round(x),
    top = Math.round(y),
    width = Math.max(1, Math.round(w)),
    height = Math.max(1, Math.round(h));
  for (let dy = 0; dy < height; dy++)
    for (let dx = 0; dx < width; dx++) {
      const px = left + dx,
        py = top + dy;
      if (px < 0 || py < 0 || px >= dst.width || py >= dst.height) continue;
      const i =
          ((sy + Math.floor((dy * sh) / height)) * src.width +
            sx +
            Math.floor((dx * sw) / width)) *
          4,
        j = (py * dst.width + px) * 4;
      const a = src.data[i + 3] / 255;
      if (!a) continue;
      for (let k = 0; k < 3; k++)
        dst.data[j + k] = Math.round(
          src.data[i + k] * a + dst.data[j + k] * (1 - a),
        );
      dst.data[j + 3] = 255;
    }
}
function rect(p: PNG, x: number, y: number, w: number, h: number, c: number[]) {
  for (let yy = Math.round(y); yy < y + h; yy++)
    for (let xx = Math.round(x); xx < x + w; xx++)
      if (xx >= 0 && yy >= 0 && xx < p.width && yy < p.height)
        p.data.set(c, (yy * p.width + xx) * 4);
}
function tile(
  p: PNG,
  r: { x: number; y: number; w: number; h: number },
  src: PNG,
  frame: [number, number, number, number],
) {
  for (let y = r.y; y < r.y + r.h; y += frame[3])
    for (let x = r.x; x < r.x + r.w; x += frame[2]) {
      const w = Math.min(frame[2], r.x + r.w - x),
        h = Math.min(frame[3], r.y + r.h - y);
      blit(p, src, x, y, w, h, frame[0], frame[1], w, h);
    }
}
function residents(id: any, p: PNG, jobs: { z: number; draw: () => void }[]) {
  for (const npc of npcsIn(id)) {
    const pose = npcPose(npc, 180),
      src = read(`apps/client/public/assets/npcs/${npc.sprite}.png`);
    const row = ["south", "east", "north", "west"].indexOf(pose.facing);
    jobs.push({
      z: pose.y,
      draw: () =>
        blit(p, src, pose.x - 48, pose.y - 63, 96, 96, 0, row * 96, 96, 96),
    });
  }
}
const portals = (id: string, p: PNG) => {
  for (const t of settlementPortals.filter((t) => t.from === id)) {
    const { x, y } = t.at;
    if (t.stairs) {
      rect(p, x - 26, y - 30, 52, 60, [53, 39, 33, 255]);
      for (let s = 0; s < 6; s++) {
        rect(p, x - 22, y - 26 + s * 9, 44, 7, [
          158 + s * 8,
          120 + s * 8,
          81 + s * 8,
          255,
        ]);
        rect(p, x - 22, y - 26 + s * 9, 44, 1, [229, 197, 148, 255]);
      }
    } else if (isVillageInterior(t.from) || isVillageInterior(t.to)) {
      rect(p, x - 22, y + 4, 44, 12, [185, 152, 102, 255]);
    } else {
      rect(p, x - 3, y - 18, 6, 36, [118, 83, 52, 255]);
      rect(p, x - 24, y - 24, 48, 25, [201, 161, 107, 255]);
    }
  }
};
for (const id of villageInteriorIds) {
  const m = JSON.parse(
      fs.readFileSync(
        `${base}/village-interiors/${id.toLowerCase()}.json`,
        "utf8",
      ),
    ),
    room = villageInteriors[id];
  const p = blank(room.width, room.height),
    jobs: { z: number; draw: () => void }[] = [];
  const sets = m.tilesets.map((t: any) => ({
    ...t,
    png: read(`${base}/main-house/${t.image}`),
  }));
  m.layers.forEach((l: any, li: number) => {
    if (furniture[id].some((o) => o.layer === l.name)) return;
    l.data.forEach((gid: number, i: number) => {
      if (!gid) return;
      const x = i % m.width,
        y = Math.floor(i / m.width);
      if (l.name === "Floor") {
        jobs.push({
          z: -100,
          draw: () =>
            blit(
              p,
              read(`${base}/lpc-interiors/interior.png`),
              x * 32,
              y * 32,
              32,
              32,
              0,
              96,
              32,
              32,
            ),
        });
        return;
      }
      const s = [...sets].reverse().find((s) => gid >= s.firstgid),
        n = gid - s.firstgid;
      const cls = classifyMapTile(id, l.name, x, y);
      jobs.push({
        z: mapElementDepth(cls, li),
        draw: () =>
          blit(
            p,
            s.png,
            x * 32,
            y * 32,
            32,
            32,
            (n % s.columns) * 16,
            Math.floor(n / s.columns) * 16,
            16,
            16,
          ),
      });
    });
  });
  for (const o of furniture[id]) {
    const [x, y, w, h] = o.frame,
      scale = Math.min(o.width / w, o.height / h);
    const file =
      o.sheet === "kenney"
        ? `${base}/kenney-indoors/indoors.png`
        : `${base}/lpc-interiors/${o.sheet}.png`;
    jobs.push({
      z: o.depth,
      draw: () =>
        blit(
          p,
          read(file),
          o.x - (w * scale) / 2,
          o.y - h * scale,
          w * scale,
          h * scale,
          x,
          y,
          w,
          h,
        ),
    });
  }
  residents(id, p, jobs);
  jobs.sort((a, b) => a.z - b.z).forEach((j) => j.draw());
  portals(id, p);
  fs.writeFileSync(`${out}/${id.toLowerCase()}.png`, PNG.sync.write(p));
}
for (const [id, m] of Object.entries(settlements)) {
  const p = blank(m.width, m.height, [41, 67, 44, 255]);
  const grass = read(
    `${base}/post-town/transition_trail/${postTown.TRANSITION_TRAIL.textures[1].filename}`,
  );
  tile(p, { x: 0, y: 0, w: m.width, h: m.height }, grass, [
    0,
    0,
    grass.width,
    grass.height,
  ]);
  const stone = read(`${base}/bridge-ruins/stone-tiles.png`),
    water = read(`${base}/bridge-ruins/water-tiles.png`);
  for (const r of m.paths)
    tile(p, r, stone, [
      (12 % (stone.width / 32)) * 32,
      Math.floor(12 / (stone.width / 32)) * 32,
      32,
      32,
    ]);
  for (const t of settlementWaterTiles(id as keyof typeof settlements)) {
    const f = shoreFrame(t.mask);
    blit(
      p,
      water,
      t.x,
      t.y,
      32,
      32,
      (f % (water.width / 32)) * 32,
      Math.floor(f / (water.width / 32)) * 32,
      32,
      32,
    );
  }
  const jobs: { z: number; draw: () => void }[] = [];
  for (const b of m.buildings) {
    const src = read(
      `${base}/post-town/emberbrook_village/${postTown.EMBERBROOK_VILLAGE.objects[b.art].filename}`,
    );
    jobs.push({
      z: b.y + b.h - 13,
      draw: () =>
        blit(p, src, b.x, b.y, b.w, b.h, ...settlementBuildingFrames[b.art]),
    });
  }
  for (const [i, t] of m.trees.entries()) {
    const art = settlementTreeArt(i);
    const src = read(`${base}/post-town/transition_trail/${art.filename}`);
    jobs.push({
      z: t.y,
      draw: () =>
        blit(
          p,
          src,
          t.x - art.size * art.originX,
          t.y - art.size * art.originY,
          art.size,
          art.size,
        ),
    });
  }
  const well = read(
    `${base}/post-town/emberbrook_village/${postTown.EMBERBROOK_VILLAGE.objects[0].filename}`,
  );
  jobs.push({
    z: 471,
    draw: () => blit(p, well, m.width / 2 - 48, 396, 96, 88),
  });
  for (const dx of [-110, 110])
    jobs.push({
      z: 450,
      draw: () =>
        blit(
          p,
          read(`${base}/kenney-indoors/indoors.png`),
          m.width / 2 + dx - 33,
          448,
          66,
          32,
          51,
          0,
          33,
          16,
        ),
    });
  residents(id, p, jobs);
  jobs.sort((a, b) => a.z - b.z).forEach((j) => j.draw());
  portals(id, p);
  fs.writeFileSync(`${out}/${id.toLowerCase()}.png`, PNG.sync.write(p));
}
for (const [lower, upper] of stairPairs) {
  const a = read(`${out}/${lower.toLowerCase()}.png`),
    b = read(`${out}/${upper.toLowerCase()}.png`);
  const p = blank(
    a.width + b.width + 16,
    Math.max(a.height, b.height),
    [16, 32, 43, 255],
  );
  blit(p, a, 0, 0);
  blit(p, b, a.width + 16, 0);
  fs.writeFileSync(
    `${out}/${lower.toLowerCase()}-floors.png`,
    PNG.sync.write(p),
  );
}
console.log(
  `Rendered full maps, ten home floors and five paired floor previews in ${out}`,
);
