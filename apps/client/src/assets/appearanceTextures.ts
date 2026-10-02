import { defenseAsset, defenseKey } from "../animation/defense.js";
import {
  heavyAsset,
  heavyKey,
  combatAssets,
  combatTextureKey,
} from "../animation/combat.js";
import type Phaser from "phaser";
import type { Role } from "../../../../packages/shared/src/gameTypes.js";
import {
  defaultAppearance,
  type CharacterAppearance,
} from "../../../../packages/shared/src/appearance.js";
import { heroAssets, textureKey } from "../animation/definitions.js";
import { recolorPixels } from "./palettes.js";
const sources = new Map<
  string,
  Promise<[HTMLImageElement, HTMLImageElement]>
>();
export type AppearanceLayer =
  "base" | "combat" | "effects" | "heavy" | "defense";
const layerKey = (role: Role, layer: AppearanceLayer) =>
  layer === "defense"
    ? defenseKey(role)
    : layer === "heavy"
      ? heavyKey
      : layer === "base"
        ? textureKey(role)
        : combatTextureKey(role, layer === "effects");
const cache = new Map<string, HTMLCanvasElement>();
function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(Error("Appearance asset unavailable"));
    i.src = url;
  });
}
export const appearanceKey = (
  role: Role,
  a: CharacterAppearance,
  layer: AppearanceLayer = "base",
) =>
  `${layerKey(role, layer)}:palette:${a.primaryPalette}:${a.effectPalette || ""}`;
export async function appearanceCanvas(
  role: Role,
  appearance?: CharacterAppearance,
  layer: AppearanceLayer = "base",
) {
  const a = appearance || defaultAppearance(role),
    key = appearanceKey(role, a, layer);
  if (cache.has(key)) return cache.get(key)!;
  const sourceKey = layerKey(role, layer);
  const asset =
    layer === "defense"
      ? defenseAsset(role)
      : layer === "heavy"
        ? heavyAsset
        : layer === "base"
          ? heroAssets[role]
          : combatAssets[role];
  const url =
    layer === "effects"
      ? "/assets/characters/ember/combat-effects.png"
      : asset.url;
  const maskName =
    layer === "defense"
      ? "defense-mask"
      : layer === "heavy"
        ? "heavy-mask"
        : layer === "base"
          ? "palette-mask"
          : layer === "combat"
            ? "combat-mask"
            : "combat-effects-mask";
  if (!sources.has(sourceKey))
    sources.set(
      sourceKey,
      Promise.all([
        image(url),
        image(`/assets/characters/${role.toLowerCase()}/${maskName}.png`),
      ]),
    );
  const [source, mask] = await sources.get(sourceKey)!;
  // Another simultaneous preview may already have filled the same cache entry.
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mask, 0, 0);
  const regions = ctx.getImageData(0, 0, canvas.width, canvas.height);
  data.data.set(
    recolorPixels(
      data.data,
      regions.data,
      a.primaryPalette,
      a.effectPalette,
      defaultAppearance(role).primaryPalette,
    ),
  );
  ctx.putImageData(data, 0, 0);
  cache.set(key, canvas);
  return canvas;
}
const pending = new WeakMap<Phaser.Textures.TextureManager, Set<string>>();
export function ensureAppearanceTexture(
  scene: Phaser.Scene,
  role: Role,
  appearance?: CharacterAppearance,
  layer: AppearanceLayer = "base",
): string {
  const a = appearance || defaultAppearance(role),
    key = appearanceKey(role, a, layer);
  if (
    a.primaryPalette === defaultAppearance(role).primaryPalette &&
    (!a.effectPalette || a.effectPalette === "ember")
  )
    return layerKey(role, layer);
  if (scene.textures.exists(key)) return key;
  let requests = pending.get(scene.textures);
  if (!requests) pending.set(scene.textures, (requests = new Set()));
  if (!requests.has(key)) {
    requests.add(key);
    void appearanceCanvas(role, a, layer)
      .then((canvas) => {
        if (scene.textures.exists(key)) return;
        const texture = scene.textures.addCanvas(key, canvas);
        if (!texture) return;
        const asset =
          layer === "defense"
            ? defenseAsset(role)
            : layer === "heavy"
              ? heavyAsset
              : layer === "base"
                ? heroAssets[role]
                : combatAssets[role];
        const columns = Math.floor(canvas.width / asset.frameWidth);
        const count = columns * Math.floor(canvas.height / asset.frameHeight);
        for (let n = 0; n < count; n++)
          texture.add(
            String(n),
            0,
            (n % columns) * asset.frameWidth,
            Math.floor(n / columns) * asset.frameHeight,
            asset.frameWidth,
            asset.frameHeight,
          );
      })
      .catch(() => {
        /* Missing mask/sheet retains canonical artwork. */
      });
  }
  return layerKey(role, layer);
}
