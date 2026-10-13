import type { Rect } from "./gameTypes.js";

export type MapElementCategory = "wall" | "object" | "path" | "door";
export interface MapElement {
  id: string;
  category: MapElementCategory;
  /** Reviewed world-space solid bases; artwork never determines collision. */
  solids: Rect[];
}

/** Interior elements retain the existing authoritative collision footprints. */
export const interiorElements: MapElement[] = [
  {
    id: "room-boundary",
    category: "wall",
    solids: [
      { x: 0, y: 0, w: 832, h: 224 },
      { x: 0, y: 192, w: 160, h: 512 },
      { x: 672, y: 192, w: 160, h: 512 },
      { x: 160, y: 512, w: 512, h: 192 },
    ],
  },
  { id: "stairs", category: "path", solids: [] },
  {
    id: "stair-walls",
    category: "wall",
    solids: [
      { x: 160, y: 224, w: 40, h: 96 },
      { x: 248, y: 224, w: 40, h: 96 },
    ],
  },
  {
    id: "west-room-wall",
    category: "wall",
    solids: [
      { x: 160, y: 344, w: 128, h: 96 },
      { x: 280, y: 352, w: 16, h: 160 },
    ],
  },
  {
    id: "east-room-wall",
    category: "wall",
    solids: [
      { x: 504, y: 192, w: 16, h: 222 },
      { x: 520, y: 320, w: 152, h: 24 },
    ],
  },
  {
    id: "east-doorway",
    category: "door",
    solids: [
      { x: 520, y: 344, w: 72, h: 70 },
      { x: 624, y: 344, w: 48, h: 70 },
    ],
  },
  { id: "bed", category: "object", solids: [{ x: 296, y: 226, w: 42, h: 72 }] },
  {
    id: "nightstand",
    category: "object",
    solids: [{ x: 344, y: 240, w: 24, h: 34 }],
  },
  {
    id: "bookcase",
    category: "object",
    solids: [{ x: 456, y: 192, w: 48, h: 86 }],
  },
  {
    id: "couch",
    category: "object",
    solids: [{ x: 472, y: 274, w: 32, h: 60 }],
  },
  {
    id: "dining-table",
    category: "object",
    solids: [{ x: 360, y: 384, w: 72, h: 48 }],
  },
  {
    id: "north-chair",
    category: "object",
    solids: [{ x: 388, y: 356, w: 24, h: 28 }],
  },
  {
    id: "west-chair",
    category: "object",
    solids: [{ x: 340, y: 384, w: 16, h: 44 }],
  },
  {
    id: "east-chair",
    category: "object",
    solids: [{ x: 444, y: 384, w: 16, h: 44 }],
  },
  {
    id: "south-chair",
    category: "object",
    solids: [{ x: 388, y: 432, w: 24, h: 30 }],
  },
  {
    id: "workbench",
    category: "object",
    solids: [{ x: 164, y: 440, w: 60, h: 54 }],
  },
  {
    id: "barrel",
    category: "object",
    solids: [{ x: 250, y: 454, w: 28, h: 42 }],
  },
  {
    id: "kitchen",
    category: "object",
    solids: [{ x: 568, y: 214, w: 88, h: 62 }],
  },
  { id: "floor-and-rugs", category: "path", solids: [] },
  { id: "exit", category: "door", solids: [] },
];
