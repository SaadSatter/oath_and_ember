import type { SceneId } from "../../../../packages/shared/src/gameTypes.js";
import type { MapElementCategory } from "../../../../packages/shared/src/mapElements.js";

export interface TilePresentation {
  id: string;
  category: MapElementCategory;
  /** Hero depth is its simulation center; displayed feet are 13px below it. */
  groundY?: number;
}
interface Region extends TilePresentation {
  layer: string;
  bounds: [number, number, number, number]; // inclusive tile coordinates
}
const region = (
  id: string,
  category: MapElementCategory,
  layer: string,
  bounds: Region["bounds"],
  groundY?: number,
): Region => ({ id, category, layer, bounds, groundY });

// Explicit authored regions: adjacent objects do not inherit each other's depth.
const interior: Region[] = [
  // These wall-sheet tiles are the backing of the traversable stair opening.
  // Keep them in authored ground order so they cannot cover the treads above.
  region("stair-backing", "path", "Walls", [6, 6, 7, 10]),
  region("stairs", "path", "Objects1", [6, 6, 7, 10]),
  region("bed", "object", "Objects1", [9, 7, 10, 8], 298),
  region("nightstand", "object", "Objects2", [10, 7, 11, 8], 274),
  region("bookcase", "object", "Objects1", [14, 6, 15, 8], 278),
  region("couch", "object", "Objects2", [14, 8, 15, 10], 334),
  region("kitchen", "object", "Objects1", [17, 5, 20, 8], 276),
  region("hanging-herbs", "object", "Objects2", [16, 5, 17, 7], 276),
  region("kitchen-boxes", "object", "Boxes", [16, 9, 20, 10], 344),
  region("workbench", "object", "Objects1", [5, 13, 6, 15], 494),
  region("barrel", "object", "Objects1", [7, 14, 8, 15], 496),
  region("weapon-rack", "object", "Objects1", [16, 11, 18, 13], 430),
  region("west-chair", "object", "Objects2", [10, 11, 10, 13], 428),
  region("east-chair", "object", "Objects2", [14, 11, 14, 13], 428),
  region("north-chair", "object", "Objects2", [12, 11, 12, 11], 384),
  region("south-chair", "object", "Objects2", [11, 14, 12, 14], 462),
  region("dining-table", "object", "Objects2", [11, 11, 13, 13], 432),
  region("east-doorway", "door", "Walls", [18, 11, 19, 12], 414),
  region("east-room-front", "wall", "Walls", [15, 10, 20, 12], 414),
  region("east-room-back", "wall", "Walls", [16, 9, 20, 9], 344),
  region("west-door", "door", "Walls", [6, 12, 7, 13], 440),
  region("west-room-front", "wall", "Walls", [5, 11, 8, 13], 440),
  region("west-room-base", "wall", "Walls", [5, 15, 8, 15], 512),
  region("south-wall", "wall", "Walls", [9, 15, 20, 16], 512),
  region("stair-left-wall", "wall", "Walls", [5, 7, 5, 10], 320),
  region("stair-right-wall", "wall", "Walls", [8, 7, 9, 10], 320),
  region("east-partition", "wall", "Walls", [15, 5, 16, 12], 414),
  region("west-partition", "wall", "Walls", [9, 11, 9, 15], 512),
];
const exterior: Region[] = [
  region("Objects4-0", "object", "Objects4", [2, 8, 3, 9], 320),
  region("Objects4-1", "object", "Objects4", [17, 1, 18, 2], 96),
  region("Objects4-2", "object", "Objects4", [21, 1, 23, 3], 128),
  region("Objects1-0", "object", "Objects1", [4, 10, 5, 12], 416),
  region("Objects1-1", "object", "Objects1", [6, 6, 6, 9], 320),
  region("Objects1-2", "object", "Objects1", [8, 11, 10, 13], 448),
  region("Objects1-3", "object", "Objects1", [11, 1, 12, 2], 96),
  region("Objects1-4", "object", "Objects1", [12, 11, 13, 12], 416),
  region("Objects1-5", "object", "Objects1", [12, 16, 15, 18], 608),
  region("Objects1-6", "object", "Objects1", [17, 12, 17, 12], 416),
  region("Objects1-7", "object", "Objects1", [22, 3, 25, 6], 224),
  region("Objects1-8", "object", "Objects1", [4, 2, 6, 4], 160),
  region("Objects1-9", "object", "Objects1", [7, 1, 8, 3], 128),
  region("Objects1-10", "object", "Objects1", [20, 8, 22, 10], 352),
  region("Objects1-11", "object", "Objects1", [23, 9, 23, 9], 320),
  region("Objects1-12", "object", "Objects1", [22, 10, 23, 11], 384),
  region("Objects1-13", "object", "Objects1", [20, 11, 21, 12], 416),
  region("Objects2-0", "object", "Objects2", [1, 5, 3, 7], 256),
  region("Objects2-1", "object", "Objects2", [2, 12, 3, 13], 448),
  region("Objects2-2", "object", "Objects2", [4, 17, 7, 18], 608),
  region("Objects2-3", "object", "Objects2", [15, 3, 16, 4], 160),
  region("Objects2-4", "object", "Objects2", [21, 6, 22, 7], 256),
  region("Objects2-5", "object", "Objects2", [24, 1, 26, 3], 128),
  region("Objects3-0", "object", "Objects3", [0, 7, 1, 8], 288),
  region("Objects3-1", "object", "Objects3", [1, 16, 1, 16], 544),
  region("Objects3-2", "object", "Objects3", [2, 17, 3, 18], 608),
  region("Objects3-3", "object", "Objects3", [4, 14, 5, 15], 512),
  region("Objects3-4", "object", "Objects3", [5, 4, 6, 5], 192),
  region("Objects3-5", "object", "Objects3", [8, 9, 9, 11], 384),
  region("Objects3-6", "object", "Objects3", [11, 13, 13, 14], 480),
  region("Objects3-7", "object", "Objects3", [11, 17, 11, 17], 576),
  region("Objects3-8", "object", "Objects3", [16, 13, 17, 14], 480),
  region("Objects3-9", "object", "Objects3", [16, 16, 17, 18], 608),
  region("Objects3-10", "object", "Objects3", [17, 3, 17, 3], 128),
  region("Objects3-11", "object", "Objects3", [22, 13, 22, 13], 448),
  region("Objects3-12", "object", "Objects3", [24, 16, 25, 17], 576),
  region("Objects3-13", "object", "Objects3", [25, 7, 26, 7], 256),
  region("Objects3-14", "object", "Objects3", [26, 4, 26, 4], 160),
  region("Objects3-15", "object", "Objects3", [17, 8, 18, 9], 320),
  region("Objects3-16", "object", "Objects3", [16, 10, 17, 11], 384),
  region("cat-0", "object", "cat", [7, 14, 8, 15], 512),
  region("house-door", "door", "House_wall", [14, 8, 15, 9], 314),
  region("house", "wall", "House_wall", [9, 4, 16, 9], 314),
  region("roof", "wall", "House_roof", [0, 0, 26, 19], 314),
  region("house-windows", "wall", "windows1", [0, 0, 26, 19], 314),
  region("house-windows", "wall", "windows2", [0, 0, 26, 19], 314),
  region("garden-gateway", "door", "Fence", [14, 13, 15, 13], 440),
  region("garden-front-fence", "wall", "Fence", [6, 13, 19, 13], 440),
  region("garden-back-fence", "wall", "Fence", [6, 5, 19, 5], 200),
  region("garden-left-fence", "wall", "Fence", [6, 6, 6, 12], 440),
  region("garden-right-fence", "wall", "Fence", [19, 6, 19, 12], 440),
];

export function classifyMapTile(
  scene: SceneId,
  layer: string,
  x: number,
  y: number,
): TilePresentation {
  const found = (scene === "HOUSE_INTERIOR" ? interior : exterior).find(
    (r) =>
      r.layer === layer &&
      x >= r.bounds[0] &&
      y >= r.bounds[1] &&
      x <= r.bounds[2] &&
      y <= r.bounds[3],
  );
  if (found) return found;
  // Rugs, stair treads, thresholds, roads and floor details always remain below actors.
  if (scene === "HOUSE_INTERIOR") {
    if (layer === "Walls" || layer === "Windows")
      return { id: "room-shell", category: "wall", groundY: 224 };
    return { id: "floor-and-rugs", category: "path" };
  }
  return { id: "ground-and-paths", category: "path" };
}
export function mapElementDepth(
  element: TilePresentation,
  layerIndex: number,
): number {
  return element.category === "path"
    ? -100 + layerIndex
    : element.groundY! - 13;
}
