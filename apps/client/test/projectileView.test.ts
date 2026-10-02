import { it, expect, vi } from "vitest";
import type Phaser from "phaser";
import type { World } from "../../../packages/shared/src/gameTypes.js";
import { ProjectileView } from "../src/entities/ProjectileView.js";
import { effectColor } from "../src/assets/palettes.js";
it("uses interpolated position and palette, deduplicates only authoritative collision bursts", () => {
  const chain = () => vi.fn().mockReturnThis();
  const g = {
    setDepth: chain(),
    clear: chain(),
    fillStyle: chain(),
    fillCircle: chain(),
    fillRect: chain(),
    lineStyle: chain(),
    strokeCircle: chain(),
    destroy: chain(),
  };
  const image = {
    setDepth: chain(),
    setOrigin: chain(),
    setVisible: chain(),
    setPosition: chain(),
    setRotation: chain(),
    setTint: chain(),
    destroy: chain(),
  };
  const scene = {
    time: { now: 0 },
    textures: { exists: () => true },
    add: { graphics: () => g, image: vi.fn(() => image) },
  };
  const view = new ProjectileView(scene as unknown as Phaser.Scene);
  const world = {
    serverTick: 10,
    players: { c: { appearance: { effectPalette: "arcane" } } },
    projectiles: { p: { id: "p", x: 10, y: 20, vx: 420, vy: 0, owner: "c" } },
    projectileImpacts: [],
  } as unknown as World;
  const before = JSON.stringify(world);
  view.update(world, () => ({ x: 99, y: 80 }), false);
  expect(image.setPosition).toHaveBeenLastCalledWith(99, 80);
  expect(image.setTint).toHaveBeenLastCalledWith(effectColor("arcane"));
  expect(g.strokeCircle).not.toHaveBeenCalled();
  expect(JSON.stringify(world)).toBe(before);
  view.update({ ...world, projectiles: {} }, () => undefined, false);
  expect(image.destroy).toHaveBeenCalledOnce();
  expect(g.strokeCircle).not.toHaveBeenCalled();
  const hit = { id: "p", x: 112, y: 80, owner: "c", tick: 10 };
  const collision = { ...world, projectiles: {}, projectileImpacts: [hit] };
  view.update(collision, () => undefined, false);
  expect(g.strokeCircle).toHaveBeenCalled();
  scene.time.now = 400;
  g.strokeCircle.mockClear();
  view.update(collision, () => undefined, false);
  expect(g.strokeCircle).not.toHaveBeenCalled(); // Retained event cannot restart the expired burst.
  view.destroy();
});
