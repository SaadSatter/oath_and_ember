import { it, expect, vi } from "vitest";
import type Phaser from "phaser";
vi.mock("../src/assets/appearanceTextures.js", () => ({
  ensureAppearanceTexture: (
    _s: unknown,
    role: string,
    a?: { primaryPalette: string },
  ) => (a ? `hero:${role}:palette:${a.primaryPalette}` : `hero:${role}`),
}));
import { PlayerView } from "../src/entities/PlayerView.js";
import { heroAssets, animationKey } from "../src/animation/definitions.js";
import { characterVisuals } from "../src/assets/characterVisuals.js";
import type { Player } from "../../../packages/shared/src/gameTypes.js";
import { readFileSync } from "node:fs";
const player = (role: Player["role"] = "OATH"): Player => ({
  id: "hero",
  role,
  connected: true,
  ready: true,
  x: 120,
  y: 450,
  vx: 0,
  vy: 0,
  grounded: true,
  hp: 100,
  maxHp: 100,
  facing: 0,
  actionState: "idle",
  cooldowns: {},
  skillPoints: 1,
  unlockedSkills: [],
  lastProcessedInputSeq: 0,
});
function harness() {
  const chain = () => vi.fn().mockReturnThis();
  const graphics = {
    setDepth: chain(),
    clear: chain(),
    fillStyle: chain(),
    fillRoundedRect: chain(),
    fillCircle: chain(),
    lineStyle: chain(),
    lineBetween: chain(),
    strokeCircle: chain(),
    fillRect: chain(),
    destroy: vi.fn(),
  };
  const sprite = {
    on: chain(),
    setTexture: chain(),
    setFrame: chain(),
    texture: { key: "" },
    frame: { name: "0" },
    setOrigin: chain(),
    setScale: chain(),
    setVisible: chain(),
    setPosition: chain(),
    setFlipX: chain(),
    setDepth: chain(),
    setTint: chain(),
    clearTint: chain(),
    destroy: vi.fn(),
    anims: { currentAnim: null as null | { key: string } },
    play: vi.fn(function (this: any, key: string) {
      this.anims.currentAnim = { key };
      return this;
    }),
  };
  const scene = {
    time: { now: 0 },
    textures: { exists: () => true },
    anims: {
      exists: (key: string) =>
        /(TOP_DOWN:(idle_(down|up|left|right)|walk_(north|south|east|west))|combat:(down|up|left|right)|OATH:heavy(:charge)?)$/.test(
          key,
        ),
    },
    add: { graphics: () => graphics, sprite: vi.fn(() => sprite) },
  };
  return {
    scene,
    sprite,
    graphics,
    view: new PlayerView(scene as unknown as Phaser.Scene),
  };
}
it("shows the approved art for both heroes from immutable state and transitions to walking without restarting each render frame", () => {
  for (const role of ["OATH", "EMBER"] as const) {
    const h = harness(),
      p = Object.freeze(player(role));
    h.view.update(p, p, p, "TOP_DOWN", "sprite");
    expect(h.sprite.play).toHaveBeenLastCalledWith(
      animationKey(role, "TOP_DOWN", "idle_right"),
    );
    for (let n = 0; n < 20; n++)
      h.view.update(p, { ...p, vx: 190 }, p, "TOP_DOWN", "sprite");
    h.view.update({ ...p, actionState: "attack" }, p, p, "TOP_DOWN", "sprite");
    expect(h.sprite.play).toHaveBeenCalledTimes(3);
    expect(h.sprite.play.mock.calls[1][0]).toBe(
      animationKey(role, "TOP_DOWN", "walk_east"),
    );
    h.view.update(
      { ...p, facing: -Math.PI / 2 },
      { ...p, facing: -Math.PI / 2 },
      p,
      "TOP_DOWN",
      "sprite",
    );
    expect(h.sprite.play).toHaveBeenLastCalledWith(
      animationKey(role, "TOP_DOWN", "idle_up"),
    );
    expect(p.x).toBe(120);
    expect(p.hp).toBe(100);
  }
});
it("keeps F4 geometry and side-view fallback without passing top-down art off as side-view", () => {
  const h = harness(),
    p = player();
  h.view.update(p, p, p, "TOP_DOWN", "sprite");
  h.view.update(p, p, p, "TOP_DOWN", "geometric");
  expect(h.sprite.setVisible).toHaveBeenLastCalledWith(false);
  h.view.update(p, p, p, "TOP_DOWN", "sprite");
  expect(h.sprite.play).toHaveBeenCalledTimes(1);
  h.view.update(p, p, p, "PLATFORMER", "sprite");
  expect(h.sprite.setVisible).toHaveBeenLastCalledWith(false);
  expect(h.graphics.fillRoundedRect).toHaveBeenCalled();
});
it("allows visual scale changes without changing coordinates or restarting the clip", () => {
  const h = harness(),
    p = Object.freeze(player()),
    before = characterVisuals.OATH.scale;
  try {
    h.view.update(p, p, p, "TOP_DOWN", "sprite");
    characterVisuals.OATH.scale = 2;
    h.view.update(p, p, p, "TOP_DOWN", "sprite");
    expect(h.sprite.setScale).toHaveBeenLastCalledWith(2);
    expect(h.sprite.setPosition).toHaveBeenLastCalledWith(120, 463);
    expect(h.sprite.play).toHaveBeenCalledTimes(1);
    expect(p).toEqual(player());
  } finally {
    characterVisuals.OATH.scale = before;
  }
});
it("ships transparent normalized PNG sheets whose 28 frames match the manifest", () => {
  for (const role of ["OATH", "EMBER"] as const) {
    const a = heroAssets[role];
    const png = readFileSync(`apps/client/public${a.url}`);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(a.frameWidth * 28);
    expect(png.readUInt32BE(20)).toBe(a.frameHeight);
    expect(png[25]).toBe(6); // RGBA PNG, not a flattened matte.
    expect(characterVisuals[role].origin).toEqual({ x: 0.5, y: 60 / 64 });
  }
});

it("switches cosmetic textures without restarting animation or losing appearance through F4", () => {
  const h = harness(),
    p = Object.freeze({
      ...player(),
      appearance: { primaryPalette: "blue" as const },
    });
  h.view.update(p, p, p, "TOP_DOWN", "sprite");
  expect(h.sprite.setTexture).toHaveBeenLastCalledWith(
    "hero:OATH:palette:blue",
    "0",
  );
  h.view.update(p, p, p, "TOP_DOWN", "geometric");
  h.view.update(p, p, p, "TOP_DOWN", "sprite");
  expect(h.sprite.play).toHaveBeenCalledTimes(1);
  expect(h.sprite.setTexture).toHaveBeenLastCalledWith(
    "hero:OATH:palette:blue",
    "0",
  );
  h.view.update(
    { ...p, appearance: { primaryPalette: "ivory" } },
    p,
    p,
    "TOP_DOWN",
    "sprite",
  );
  expect(h.sprite.play).toHaveBeenCalledTimes(1);
  expect(h.sprite.setTexture).toHaveBeenLastCalledWith(
    "hero:OATH:palette:ivory",
    "0",
  );
  expect(p.appearance.primaryPalette).toBe("blue");
});

it("plays accepted combat once, locks direction and restores locomotion after recovery", () => {
  const h = harness(),
    p = {
      ...player(),
      combat: { seq: 1, startedTick: 1, facing: 0, kind: "sword" as const },
    };
  h.view.update(p, p, p, "TOP_DOWN", "sprite", { serverTick: 1 });
  expect(h.sprite.play).toHaveBeenLastCalledWith("hero:OATH:combat:right");
  h.scene.time.now = 200;
  h.view.update(
    { ...p, facing: Math.PI },
    { ...p, vx: -190, facing: Math.PI },
    p,
    "TOP_DOWN",
    "sprite",
    { serverTick: 6 },
  );
  expect(h.sprite.play).toHaveBeenCalledTimes(1);
  h.view.update(p, p, p, "TOP_DOWN", "geometric", { serverTick: 6 });
  h.view.update(p, p, p, "TOP_DOWN", "sprite", { serverTick: 6 });
  expect(h.sprite.play).toHaveBeenCalledTimes(1);
  h.scene.time.now = 501;
  h.view.update(p, { ...p, vx: 190 }, p, "TOP_DOWN", "sprite", {
    serverTick: 16,
  });
  expect(h.sprite.play).toHaveBeenLastCalledWith(
    "hero:OATH:TOP_DOWN:walk_east",
  );
  expect(h.sprite.setOrigin).toHaveBeenLastCalledWith(0.5, 60 / 64);
});

it("holds horizontal heavy wind-up, mirrors left, and plays release once without moving the anchor", () => {
  const h = harness(),
    p = {
      ...player(),
      heavyCharge: {
        startedTick: 1,
        facing: Math.PI,
        ticks: 20,
        progress: 20 / 33,
      },
    };
  h.view.update(p, p, p, "TOP_DOWN", "sprite", { serverTick: 20 });
  expect(h.sprite.play).toHaveBeenLastCalledWith("hero:OATH:heavy:charge");
  expect(h.sprite.setFrame).toHaveBeenLastCalledWith(1);
  expect(h.sprite.setFlipX).toHaveBeenLastCalledWith(true);
  h.view.update(p, { ...p, vx: 190, facing: 0 }, p, "TOP_DOWN", "sprite", {
    serverTick: 21,
  });
  expect(h.sprite.play).toHaveBeenCalledTimes(1);
  const release = {
    ...p,
    heavyCharge: undefined,
    combat: {
      seq: 22,
      startedTick: 22,
      kind: "heavy" as const,
      facing: Math.PI,
    },
  };
  h.view.update(release, release, p, "TOP_DOWN", "sprite", { serverTick: 22 });
  expect(h.sprite.play).toHaveBeenLastCalledWith("hero:OATH:heavy");
  expect(h.sprite.setPosition).toHaveBeenLastCalledWith(120, 463);
  expect(h.sprite.setOrigin).toHaveBeenLastCalledWith(0.5, 0.75);
  h.view.update(release, release, p, "TOP_DOWN", "geometric", {
    serverTick: 23,
  });
  h.view.update(release, release, p, "TOP_DOWN", "sprite", { serverTick: 23 });
  expect(h.sprite.play).toHaveBeenCalledTimes(2);
});
