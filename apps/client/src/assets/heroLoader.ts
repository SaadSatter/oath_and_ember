import {
  heavyAsset,
  heavyKey,
  combatAssets,
  combatTextureKey,
  combatKey,
  combatClip,
} from "../animation/combat.js";
import type Phaser from "phaser";
import {
  heroAssets,
  textureKey,
  animationKey,
  animationSets,
} from "../animation/definitions.js";
export function preloadHeroes(scene: Phaser.Scene) {
  scene.load.spritesheet(heavyKey, heavyAsset.url, {
    frameWidth: 128,
    frameHeight: 128,
  });
  for (const role of ["OATH", "EMBER"] as const) {
    const a = heroAssets[role];
    const combat = combatAssets[role];
    scene.load.spritesheet(combatTextureKey(role), combat.url, {
      frameWidth: combat.frameWidth,
      frameHeight: combat.frameHeight,
    });
    if (role === "EMBER")
      scene.load.spritesheet(
        combatTextureKey(role, true),
        "/assets/characters/ember/combat-effects.png",
        { frameWidth: 128, frameHeight: 128 },
      );
    scene.load.spritesheet(textureKey(role), a.url, {
      frameWidth: a.frameWidth,
      frameHeight: a.frameHeight,
    });
  }
}
export function registerHeroes(scene: Phaser.Scene) {
  if (scene.textures.exists(heavyKey) && !scene.anims.exists(heavyKey))
    scene.anims.create({
      key: heavyKey,
      frames: Array.from({ length: 5 }, (_, i) => ({
        key: heavyKey,
        frame: i + 2,
      })),
      frameRate: 10,
      repeat: 0,
    });
  if (
    scene.textures.exists(heavyKey) &&
    !scene.anims.exists(`${heavyKey}:charge`)
  )
    scene.anims.create({
      key: `${heavyKey}:charge`,
      frames: [
        { key: heavyKey, frame: 0 },
        { key: heavyKey, frame: 1 },
      ],
      frameRate: 8,
      repeat: 0,
    });
  for (const role of ["OATH", "EMBER"] as const) {
    for (const direction of combatAssets[role].directions) {
      const c = combatClip(role, direction),
        key = combatTextureKey(role),
        name = combatKey(role, direction);
      if (scene.textures.exists(key) && !scene.anims.exists(name))
        scene.anims.create({
          key: name,
          frames: Array.from({ length: c.end - c.start + 1 }, (_, i) => ({
            key,
            frame: c.start + i,
          })),
          frameRate: c.fps,
          repeat: 0,
        });
    }
    const a = heroAssets[role],
      key = textureKey(role);
    if (!scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key);
    for (const mode of ["TOP_DOWN", "PLATFORMER"] as const)
      for (const state of animationSets[mode]) {
        const clip = a.clips[mode][state],
          name = animationKey(role, mode, state);
        if (!clip || scene.anims.exists(name)) continue;
        const frames = Array.from(
          { length: clip.end - clip.start + 1 },
          (_, i) => clip.start + i,
        );
        if (!frames.length || frames.some((f) => !texture.has(String(f))))
          continue;
        scene.anims.create({
          key: name,
          frames: frames.map((frame) => ({ key, frame })),
          frameRate: clip.fps,
          repeat: clip.repeat,
        });
      }
  }
}
