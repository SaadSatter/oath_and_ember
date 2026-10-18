import type { SceneId } from "./gameTypes.js";
import { composedScenes } from "./composedScenes.js";

// Alden's magic shop: the ground floor (HOUSE_INTERIOR, the main house's
// interior) and its upstairs (HOUSE_UPPER), from scripts/build-magic-shop.py.
export type ShopScene = "HOUSE_INTERIOR" | "HOUSE_UPPER";
export const isShopScene = (id: SceneId): id is ShopScene =>
  id === "HOUSE_INTERIOR" || id === "HOUSE_UPPER";
const ground = composedScenes.HOUSE_INTERIOR;
/** Where a hero arrives coming down the stairs. */
export const shopStairsFoot = {
  x: ground.points.upstairs.x,
  y: ground.points.upstairs.y + 22,
};
