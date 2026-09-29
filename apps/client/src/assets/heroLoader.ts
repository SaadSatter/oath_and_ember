import type Phaser from "phaser";
import {
  heroAssets,
  textureKey,
  animationKey,
  animationSets,
} from "../animation/definitions.js";
// Tiny original geometric test sheets are generated in memory, not final art.
// Both sheets share the exact grid contract used by professionally supplied PNGs.
function placeholder(role: "OATH" | "EMBER", width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width * 4;
  canvas.height = height * 17;
  const ctx = canvas.getContext("2d")!;
  for (let row = 0; row < 17; row++)
    for (let frame = 0; frame < 4; frame++) {
      ctx.save();
      ctx.translate(frame * width + width / 2, row * height + height / 2);
      const bob = frame % 2 ? 1 : -1;
      ctx.fillStyle = role === "OATH" ? "#e4b56b" : "#c5a1f5";
      if (role === "OATH") ctx.fillRect(-13, -17 + bob, 26, 34);
      else {
        ctx.beginPath();
        ctx.arc(0, bob, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      const direction =
        row === 1
          ? -Math.PI / 2
          : row === 2
            ? Math.PI / 2
            : row === 4
              ? Math.PI
              : 0;
      ctx.beginPath();
      ctx.moveTo(0, bob);
      ctx.lineTo(Math.cos(direction) * 25, Math.sin(direction) * 25 + bob);
      ctx.stroke();
      ctx.fillStyle = "#10202b";
      ctx.fillRect(-5, -8 + bob, 3, 3);
      ctx.fillRect(3, -8 + bob, 3, 3);
      ctx.restore();
    }
  return canvas;
}
export function preloadHeroes(scene: Phaser.Scene) {
  for (const role of ["OATH", "EMBER"] as const) {
    const a = heroAssets[role];
    if (a.source === "file")
      scene.load.spritesheet(textureKey(role), a.url, {
        frameWidth: a.frameWidth,
        frameHeight: a.frameHeight,
      });
  }
}
export function registerHeroes(scene: Phaser.Scene) {
  for (const role of ["OATH", "EMBER"] as const) {
    const a = heroAssets[role],
      key = textureKey(role);
    if (a.source === "generated" && !scene.textures.exists(key)) {
      const source = scene.textures.addCanvas(
        key,
        placeholder(role, a.frameWidth, a.frameHeight),
      );
      if (source)
        scene.textures.addSpriteSheet(key, source, {
          frameWidth: a.frameWidth,
          frameHeight: a.frameHeight,
        });
    }
    if (!scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key);
    for (const mode of ["TOP_DOWN", "PLATFORMER"] as const)
      for (const state of animationSets[mode]) {
        const clip = a.clips[mode][state];
        const name = animationKey(role, mode, state);
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
