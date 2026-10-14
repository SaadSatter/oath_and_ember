import { blackHoleFrame } from "../src/animation/blackHole.js";
import { it, expect, vi } from "vitest";
import type Phaser from "phaser";
import type { World } from "../../../packages/shared/src/gameTypes.js";
vi.mock("../src/assets/magicTextures.js", () => ({
  ensureMagicTexture: (_scene: unknown, layer: string, palette: string) =>
    `coco:magic:${layer}:palette:${palette}`,
}));
import { ProjectileView } from "../src/entities/ProjectileView.js";
import {
  magicAssets,
  baseFireballFrame,
  flightFrame,
  impactDuration,
} from "../src/animation/projectile.js";
import { readFileSync } from "node:fs";
function harness() {
  const chain = () => vi.fn().mockReturnThis();
  const graphics = {
    setDepth: chain(),
    clear: chain(),
    fillStyle: chain(),
    fillCircle: chain(),
    fillRect: chain(),
    lineStyle: chain(),
    strokeCircle: chain(),
    destroy: chain(),
  };
  const images: any[] = [];
  const scene = {
    time: { now: 0 },
    textures: { exists: () => true, get: () => ({ setFilter: chain() }) },
    add: {
      graphics: () => graphics,
      image: vi.fn(() => {
        const s = {
          setDepth: chain(),
          setOrigin: chain(),
          setVisible: chain(),
          setScale: chain(),
          setPosition: chain(),
          setRotation: chain(),
          setTexture: chain(),
          setFrame: chain(),
          setAlpha: chain(),
          destroy: chain(),
        };
        images.push(s);
        return s;
      }),
    },
  };
  return {
    scene,
    images,
    graphics,
    view: new ProjectileView(scene as unknown as Phaser.Scene),
  };
}
const world = () =>
  ({
    serverTick: 10,
    players: { c: { appearance: { effectPalette: "arcane" } } },
    projectiles: {
      p: { id: "p", x: 10, y: 20, vx: 420, vy: 0, owner: "c", life: 1.6 },
    },
    projectileImpacts: [],
  }) as unknown as World;
it("loops for the entire projectile lifetime with stable core/interpolated position and velocity orientation", () => {
  const h = harness(),
    w = world(),
    before = JSON.stringify(w);
  h.view.update(w, () => ({ x: 99, y: 80 }), false);
  const [ribbons, core] = h.images;
  for (const time of [70, 145, 215, 300, 650, 1100, 1500]) {
    h.scene.time.now = time;
    h.view.update(w, () => ({ x: 99, y: 80 }), false);
    expect(ribbons.setTexture).toHaveBeenLastCalledWith(
      "coco:magic:flight:palette:arcane",
      flightFrame(time),
    );
    expect(core.setTexture).toHaveBeenLastCalledWith(
      "coco:magic:core:palette:arcane",
      0,
    );
    expect(core.setPosition).toHaveBeenLastCalledWith(99, 80);
    expect(ribbons.setRotation).toHaveBeenLastCalledWith(0);
  }
  expect(h.graphics.fillCircle).not.toHaveBeenCalled();
  expect(h.images).toHaveLength(2);
  expect(JSON.stringify(w)).toBe(before);
  for (const [vx, vy, angle] of [
    [420, 0, 0],
    [-420, 0, Math.PI],
    [0, -420, -Math.PI / 2],
    [0, 420, Math.PI / 2],
  ]) {
    h.view.update(
      { ...w, projectiles: { p: { ...w.projectiles.p, vx, vy } } },
      () => ({ x: 130, y: 100 }),
      false,
    );
    expect(ribbons.setRotation).toHaveBeenLastCalledWith(angle);
    expect(core.setRotation).not.toHaveBeenCalled();
  }
  h.view.update(
    {
      ...w,
      players: {
        c: {
          ...w.players.c,
          appearance: { primaryPalette: "purple", effectPalette: "rose" },
        },
      },
    },
    () => ({ x: 130, y: 100 }),
    true,
  );
  expect(ribbons.setVisible).toHaveBeenLastCalledWith(false);
  expect(core.setVisible).toHaveBeenLastCalledWith(false);
  h.view.update(w, () => ({ x: 130, y: 100 }), false);
  expect(ribbons.setTexture.mock.lastCall?.[1]).toBe(flightFrame(1500));
  h.view.destroy();
});
it("stops flight on removal, plays supplied collision sequence once, and never invents impact for expiry", () => {
  const h = harness(),
    w = world();
  h.view.update(w, () => null, false);
  const [ribbons, core] = h.images;
  h.view.update({ ...w, projectiles: {} }, () => null, false);
  expect(ribbons.destroy).toHaveBeenCalledOnce();
  expect(core.destroy).toHaveBeenCalledOnce();
  expect(h.images).toHaveLength(2);
  const hit = { id: "p", x: 112, y: 80, owner: "c", tick: 10 };
  const collision = { ...w, projectiles: {}, projectileImpacts: [hit] };
  h.view.update(collision, () => null, false);
  const impact = h.images[2];
  expect(h.scene.add.image).toHaveBeenLastCalledWith(
    112,
    80,
    "coco:magic:impact",
  );
  expect(impact.setTexture).toHaveBeenLastCalledWith(
    "coco:magic:impact:palette:arcane",
    0,
  );
  h.scene.time.now = 300;
  h.view.update(collision, () => null, false);
  expect(impact.setTexture).toHaveBeenLastCalledWith(
    "coco:magic:impact:palette:arcane",
    4,
  );
  h.scene.time.now = impactDuration + 1;
  h.view.update(collision, () => null, false);
  expect(impact.destroy).toHaveBeenCalledOnce();
  h.view.update(collision, () => null, false);
  expect(h.images).toHaveLength(3);
  const stale = harness();
  stale.view.update({ ...collision, serverTick: 60 }, () => null, false);
  expect(stale.images).toHaveLength(0);
  h.view.destroy();
  stale.view.destroy();
});
it("ships normalized transparent flight/core/impact sheets matching centralized semantic definitions", () => {
  for (const a of Object.values(magicAssets)) {
    const png = readFileSync(`apps/client/public${a.url}`);
    expect(png.readUInt32BE(16)).toBe(a.width * a.count);
    expect(png.readUInt32BE(20)).toBe(a.height);
    expect(png[25]).toBe(6);
  }
  expect(flightFrame(4000)).toBeGreaterThanOrEqual(0);
  expect(flightFrame(4000)).toBeLessThan(4);
  expect(magicAssets.flight.loop).toBe(true);
  expect(magicAssets.impact.loop).toBe(false);
});

import { effectPresentationProfiles } from "../src/assets/effectPresentation.js";
it("presentation scaling and offsets leave authoritative projectile coordinates unchanged", () => {
  const profile = effectPresentationProfiles.projectile;
  const before = { ...profile };
  const h = harness(),
    w = world(),
    original = JSON.stringify(w);
  try {
    Object.assign(profile, { scale: 1.15, offsetX: 4, offsetY: -4 });
    h.view.update(w, () => ({ x: 99, y: 80 }), false);
    for (const image of h.images) {
      expect(image.setScale).toHaveBeenLastCalledWith(1.15);
      expect(image.setPosition).toHaveBeenLastCalledWith(103, 76);
    }
    expect(JSON.stringify(w)).toBe(original);
  } finally {
    Object.assign(profile, before);
    h.view.destroy();
  }
});

it("uses the server-captured fireball tier, loops the correct artwork and hides the old core", () => {
  const h = harness();
  for (const level of [1, 2, 3, 4]) {
    const w = world();
    w.projectiles.p.fireballLevel = level;
    w.projectiles.p.damage = 20 + (level - 1) * 10;
    h.scene.time.now = 0;
    h.view.update(w, () => ({ x: 90, y: 100 }), false);
    for (const time of [0, 80, 650, 1100]) {
      h.scene.time.now = time;
      h.view.update(w, () => ({ x: 90, y: 100 }), false);
      expect(h.images[0].setTexture).toHaveBeenLastCalledWith(
        `coco:magic:${level === 1 ? "baseFireball" : "fireball"}:palette:arcane`,
        level === 1
          ? baseFireballFrame(time)
          : (level - 1) * 9 + (Math.floor(time / 130) % 9),
      );
      expect(h.images[1].setVisible).toHaveBeenLastCalledWith(false);
    }
    h.view.update({ ...w, projectiles: {} }, () => null, false);
    h.images.length = 0;
  }
});

it("uses the supplied sixteen-frame GIF only for Coco's level-one fireball", () => {
  for (const level of [1, 2, 3, 4]) {
    const h = harness(),
      w = world();
    w.projectiles.p.fireballLevel = level;
    h.view.update(w, () => null, false);
    h.scene.time.now = 130 * 12;
    h.view.update(w, () => null, false);
    expect(h.images[0].setTexture).toHaveBeenLastCalledWith(
      `coco:magic:${level === 1 ? "baseFireball" : "fireball"}:palette:arcane`,
      level === 1 ? 5 : (level - 1) * 9 + 3,
    );
  }
  expect(baseFireballFrame(0)).toBe(0);
  expect(baseFireballFrame(130 * 6)).toBe(6);
  expect(baseFireballFrame(130 * 7)).toBe(0);
});

it("plays the supplied explosion frames on level-one impact rather than exploding in midflight", () => {
  const h = harness(),
    w = world();
  w.projectiles.p.fireballLevel = 1;
  h.view.update(w, () => null, false);
  w.projectiles = {};
  w.projectileImpacts = [
    { id: "p", x: 40, y: 20, owner: "c", tick: w.serverTick },
  ];
  h.view.update(w, () => null, false);
  expect(h.images[2].setTexture).toHaveBeenLastCalledWith(
    "coco:magic:baseFireball:palette:arcane",
    7,
  );
  h.scene.time.now = 130 * 8;
  h.view.update(w, () => null, false);
  expect(h.images[2].setTexture).toHaveBeenLastCalledWith(
    "coco:magic:baseFireball:palette:arcane",
    15,
  );
});

it("shows the base explosion even when an immediate hit arrives before a projectile snapshot", () => {
  const h = harness(),
    w = world();
  Object.assign(w.players.c, { role: "EMBER", unlockedSkills: [] });
  w.projectiles = {};
  w.projectileImpacts = [
    { id: "instant", x: 40, y: 20, owner: "c", tick: w.serverTick },
  ];
  h.view.update(w, () => null, false);
  expect(h.images[0].setTexture).toHaveBeenLastCalledWith(
    "coco:magic:baseFireball:palette:arcane",
    7,
  );
});

it("orients a traveling black hole with its velocity and loops only the last three frames on impact", () => {
  for (const angle of [0, Math.PI, -Math.PI / 2, Math.PI / 2]) {
    const h = harness(),
      w = world();
    w.projectiles = {};
    const hole: NonNullable<World["blackHoles"]> = (w.blackHoles = {
      h: {
        id: "h",
        owner: "c",
        sceneId: "FOREST_RUINS",
        x: 100,
        y: 100,
        vx: Math.cos(angle) * 180,
        vy: Math.sin(angle) * 180,
        remainingRange: 192,
        phase: "travel",
        startedTick: w.serverTick,
        life: 4,
        damaged: [],
      },
    });
    h.view.update(w, () => null, false);
    expect(h.images[0].setRotation).toHaveBeenLastCalledWith(angle);
    expect(h.images[0].setFrame).toHaveBeenLastCalledWith(0);
    hole.h.phase = "vortex";
    hole.h.vx = hole.h.vy = 0;
    for (const [life, frame] of [
      [4, 13],
      [3.86, 14],
      [3.73, 15],
      [3.6, 13],
    ] as const) {
      hole.h.life = life;
      h.view.update(w, () => null, false);
      expect(h.images[0].setFrame).toHaveBeenLastCalledWith(frame);
      expect(h.images[0].setRotation).toHaveBeenLastCalledWith(0);
    }
  }
  expect(blackHoleFrame(10000, "travel")).toBe(12);
  for (let t = 0; t < 4000; t += 17)
    expect(blackHoleFrame(t, "vortex")).toBeGreaterThanOrEqual(13);
});
