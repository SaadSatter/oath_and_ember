import type { Rect, SceneId, StoryState } from "./gameTypes.js";
import { BURIAL_FLAG, stageReached } from "./prologue.js";
import { FUNERAL, flowerSpots, stoneSpots } from "./chapter0.js";
import { oldTree } from "./environmentSolids.js";
import { WOODS_CRATE_FLAG, woodsCrate } from "./prologueWoods.js";

// Story set dressing: images under /assets/environment/story placed in a
// scene, shown only at the points of the story where they belong. The server
// never loads art; the only solids here are the market stalls', which are
// always present.

export interface StoryProp {
  id: string;
  scene: SceneId;
  /** File in /assets/environment/story. */
  image: string;
  /** World position of the image's top-left corner. */
  x: number;
  y: number;
  /** World units per source pixel. */
  scale: number;
  /** World y of the prop's base, for depth sorting against heroes. */
  groundY: number;
  /** Absent: always shown. */
  shown?: (story: StoryState | undefined) => boolean;
}

/** From the moment Coco walks in until the funeral, the shop is in disarray. */
const disturbed = (story: StoryState | undefined) =>
  stageReached(story, "SILENT_SHOP") && !story!.flags.includes(BURIAL_FLAG);
/** Coco drops the shopping bag when she finds him (Part 1, Act II). */
export const BAG_FLAG = "chapter0.bag";
const bagDropped = (story: StoryState | undefined) =>
  !!story?.flags.includes(BAG_FLAG) && !story.flags.includes(BURIAL_FLAG);

export const storyProps: StoryProp[] = [
  // Emberbrook's market: the General Store and Bakery stalls.
  {
    id: "stall-general",
    scene: "EMBERBROOK_VILLAGE",
    image: "stall_general.png",
    x: 180,
    y: 636,
    scale: 1,
    groundY: 744,
  },
  {
    id: "stall-bakery",
    scene: "EMBERBROOK_VILLAGE",
    image: "stall_bakery.png",
    x: 476,
    y: 650,
    scale: 1,
    groundY: 766,
  },
  // Alden's shop, disturbed: books on the floor, a chair knocked over.
  {
    id: "shop-book-1",
    scene: "HOUSE_INTERIOR",
    image: "book-open-1.png",
    x: 296,
    y: 372,
    scale: 2,
    groundY: 380,
    shown: disturbed,
  },
  {
    id: "shop-book-2",
    scene: "HOUSE_INTERIOR",
    image: "book-open-2.png",
    x: 470,
    y: 298,
    scale: 2,
    groundY: 306,
    shown: disturbed,
  },
  {
    id: "shop-book-3",
    scene: "HOUSE_INTERIOR",
    image: "book-open-3.png",
    x: 214,
    y: 312,
    scale: 2,
    groundY: 320,
    shown: disturbed,
  },
  {
    id: "shop-chair",
    scene: "HOUSE_INTERIOR",
    image: "chair-toppled.png",
    x: 500,
    y: 300,
    scale: 2,
    groundY: 324,
    shown: disturbed,
  },
  {
    id: "shop-bag",
    scene: "HOUSE_INTERIOR",
    image: "shopping_bag.png",
    x: 318,
    y: 410,
    scale: 1,
    groundY: 441,
    shown: bagDropped,
  },
  // The Mossling Woods: the merchants' crates on the pond's islet, until
  // Coco flies out and takes them (the same crates as on the trail, at 2×).
  {
    id: "woods-crates",
    scene: "PROLOGUE_WOODS",
    image: "woods_crates.png",
    x: woodsCrate.x - 27,
    y: woodsCrate.y - 70,
    scale: 2,
    groundY: woodsCrate.y + 8,
    shown: (story) => !story?.flags.includes(WOODS_CRATE_FLAG),
  },
];

// Act V. Stones and flowers to gather (while preparing), the dug site, and
// what stays at the grave for good: the stones around it, Coco's flowers and
// Sieg's wooden sword. The regular campaign happens after the funeral, so with
// no story running the grave is dressed as the funeral left it.
const preparing = (story: StoryState | undefined) =>
  story?.stage === "FUNERAL_PREP";
const kept = (flag: string) => (story: StoryState | undefined) =>
  !story || story.flags.includes(flag);
storyProps.push(
  ...stoneSpots.map((s) => ({
    id: `pickup-${s.id}`,
    scene: "MAIN_HOUSE" as SceneId,
    image: "stone.png",
    x: s.x - 10,
    y: s.y - 10,
    scale: 1,
    groundY: s.y + 9,
    shown: (story: StoryState | undefined) =>
      preparing(story) && !story!.flags.includes(`chapter0.${s.id}`),
  })),
  ...flowerSpots.map((s) => ({
    id: `pickup-${s.id}`,
    scene: "MAIN_HOUSE" as SceneId,
    image: "flower_patch.png",
    x: s.x - 10,
    y: s.y - 10,
    scale: 1,
    groundY: s.y + 10,
    shown: (story: StoryState | undefined) =>
      preparing(story) && !story!.flags.includes(`chapter0.${s.id}`),
  })),
  {
    id: "grave-site",
    scene: "MAIN_HOUSE",
    image: "grave_pit.png",
    x: 66,
    y: 360,
    scale: 2,
    groundY: 380,
    shown: (story) =>
      preparing(story) && !story!.flags.includes(BURIAL_FLAG),
  },
  // The grave's keepsakes: three stones around the mound, Coco's flowers at
  // the foot of the headstone and Sieg's wooden sword planted beside it.
  // Drawn in front of the grave mound (its groundY is 440).
  ...[
    { x: 40, y: 404 },
    { x: 141, y: 404 },
    { x: 90, y: 420 },
  ].map((at, i) => ({
    id: `grave-stone-${i + 1}`,
    scene: "MAIN_HOUSE" as SceneId,
    image: "stone.png",
    ...at,
    scale: 1,
    groundY: 441 + i,
    shown: kept(FUNERAL.siteReady),
  })),
  {
    id: "grave-flowers",
    scene: "MAIN_HOUSE",
    image: "bouquet.png",
    x: 62,
    y: 384,
    scale: 1,
    groundY: 444,
    shown: kept(FUNERAL.flowers),
  },
  {
    id: "grave-sword",
    scene: "MAIN_HOUSE",
    image: "sword_planted.png",
    x: 119,
    y: 352,
    scale: 2,
    groundY: 445,
    shown: kept(FUNERAL.sword),
  },
  // The old tree the grave lies beneath (it replaces three of the yard's
  // ordinary trees; see oldTree in environmentSolids.ts). Always there.
  {
    id: "old-tree",
    scene: "MAIN_HOUSE",
    image: "old_tree.png",
    x: oldTree.x - 80 * 2,
    y: oldTree.y - 135 * 2,
    scale: 2,
    groundY: oldTree.y,
  },
);

export const storyPropsIn = (scene: SceneId) =>
  storyProps.filter((p) => p.scene === scene);

/** The market stalls' footprints (their counters and awning posts). */
export const stallSolids: Rect[] = [
  { x: 186, y: 690, w: 114, h: 56 },
  { x: 482, y: 712, w: 108, h: 56 },
];
