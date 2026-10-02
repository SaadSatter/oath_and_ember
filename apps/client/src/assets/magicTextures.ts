import type Phaser from "phaser";
import { magicPalettes } from "../../../../packages/shared/src/appearance.js";
import {
  magicAssets,
  magicKey,
  type MagicLayer,
} from "../animation/projectile.js";
import { recolorPixels } from "./palettes.js";
const sources = new Map<
  MagicLayer,
  Promise<[HTMLImageElement, HTMLImageElement]>
>();
const canvases = new Map<string, HTMLCanvasElement>();
const pending = new WeakMap<Phaser.Textures.TextureManager, Set<string>>();
function image(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(Error("Magic texture unavailable"));
    i.src = url;
  });
}
export function preloadMagic(scene: Phaser.Scene) {
  for (const layer of Object.keys(magicAssets) as MagicLayer[]) {
    const a = magicAssets[layer];
    scene.load.spritesheet(magicKey(layer), a.url, {
      frameWidth: a.width,
      frameHeight: a.height,
    });
  }
}
export function ensureMagicTexture(
  scene: Phaser.Scene,
  layer: MagicLayer,
  palette = "ember",
) {
  const canonical = magicKey(layer),
    key = `${canonical}:palette:${palette}`;
  if (palette === "ember") return canonical;
  if (scene.textures.exists(key)) return key;
  let requests = pending.get(scene.textures);
  if (!requests) pending.set(scene.textures, (requests = new Set()));
  if (!requests.has(key)) {
    requests.add(key);
    void (async () => {
      let canvas = canvases.get(key);
      if (!canvas) {
        const a = magicAssets[layer];
        if (!sources.has(layer))
          sources.set(
            layer,
            Promise.all([
              image(a.url),
              image(a.url.replace(".png", "-mask.png")),
            ]),
          );
        const [source, mask] = await sources.get(layer)!;
        canvas = document.createElement("canvas");
        canvas.width = source.width;
        canvas.height = source.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(source, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(mask, 0, 0);
        const regions = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pixels.data.set(
          recolorPixels(pixels.data, regions.data, "purple", palette, "purple"),
        );
        ctx.putImageData(pixels, 0, 0);
        canvases.set(key, canvas);
      }
      if (scene.textures.exists(key)) return;
      const t = scene.textures.addCanvas(key, canvas),
        a = magicAssets[layer];
      if (t)
        for (let n = 0; n < a.count; n++)
          t.add(String(n), 0, n * a.width, 0, a.width, a.height);
    })().catch(() => {
      /* Canonical approved art remains available if mask loading fails. */
    });
  }
  return canonical;
}

// Warm the small cached effect palette set during scene creation, before firing.
export function warmMagicTextures(scene: Phaser.Scene) {
  for (const palette of magicPalettes)
    for (const layer of Object.keys(magicAssets) as MagicLayer[])
      ensureMagicTexture(scene, layer, palette);
}
