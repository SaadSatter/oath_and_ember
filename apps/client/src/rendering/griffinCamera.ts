import { griffinNest } from "../../../../packages/shared/src/griffin.js";
import type { CameraFocus } from "./viewport.js";

// Frame the northern stone bank and its nest before Coco leaves the walkway.
export function griffinNestFocus(
  hero: { x: number; y: number },
  viewWidth: number,
  viewHeight: number,
): CameraFocus | null {
  const northBank = hero.y <= 520;
  const approach = hero.y <= 672 && hero.x >= 512 && hero.x <= 768;
  if (!northBank && !approach) return null;
  const left = Math.min(hero.x - 64, griffinNest.x - 104);
  const right = Math.max(hero.x + 64, griffinNest.x + 104);
  const top = Math.min(hero.y - 72, griffinNest.y - 104);
  const bottom = Math.max(hero.y + 72, griffinNest.y + 72);
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    zoom: Math.min(1, viewWidth / (right - left), viewHeight / (bottom - top)),
  };
}
