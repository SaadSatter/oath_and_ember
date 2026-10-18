import type { Rect, SceneId } from "./gameTypes.js";
import shop from "./magicShop.json" with { type: "json" };
import forest from "./prologueForest.json" with { type: "json" };

// Scenes composed by the Python builders (scripts/build-magic-shop.py and
// scripts/build-prologue-forest.py): one backdrop image, depth-sorted props
// from one atlas, and the collision that matches them.
export type ComposedScene =
  "HOUSE_INTERIOR" | "HOUSE_UPPER" | "PROLOGUE_TRAIL" | "PROLOGUE_CLEARING";
export type ComposedAtlas = "magic-shop" | "prologue-forest";
export interface ComposedProp {
  id: string;
  /** Frame name in the atlas. */
  art: string;
  /** World rectangle of the drawn image (2 world units per source pixel). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** World y of the prop's base, for depth sorting against heroes. */
  groundY: number;
}
export interface ComposedFloor {
  name: string;
  atlas: ComposedAtlas;
  backdrop: string;
  width: number;
  height: number;
  cameraBounds: Rect;
  spawn: { x: number; y: number };
  points: Record<string, { x: number; y: number }>;
  doorInteractionBounds?: Rect;
  solids: Rect[];
  props: ComposedProp[];
}
type Frames = Record<string, [number, number, number, number]>;
export const composedFrames: Record<ComposedAtlas, Frames> = {
  "magic-shop": shop.frames as unknown as Frames,
  "prologue-forest": forest.frames as unknown as Frames,
};
const withAtlas = (scenes: object, atlas: ComposedAtlas) =>
  Object.fromEntries(
    Object.entries(scenes).map(([id, floor]) => [id, { ...floor, atlas }]),
  );
export const composedScenes = {
  ...withAtlas(shop.scenes, "magic-shop"),
  ...withAtlas(forest.scenes, "prologue-forest"),
} as Record<ComposedScene, ComposedFloor>;
export const isComposedScene = (id: SceneId): id is ComposedScene =>
  Object.hasOwn(composedScenes, id);
