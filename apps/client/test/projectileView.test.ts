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
    destroy: chain(),
  };
  const images: any[] = [];
  const scene = {
    time: { now: 0 },
    textures: { exists: () => true },
    add: {
      graphics: () => graphics,
      image: vi.fn(() => {
        const s = {
          setDepth: chain(),
          setOrigin: chain(),
          setVisible: chain(),
          setPosition: chain(),
          setRotation: chain(),
          setTexture: chain(),
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
