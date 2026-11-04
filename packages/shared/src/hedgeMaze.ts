import type { Puzzle, Rect } from "./gameTypes.js";
export const MAZE_TILE = 32;
export const mazePaths = [
  [2, 32, 18, 4],
  [6, 24, 10, 4],
  [6, 18, 4, 14],
  [12, 20, 4, 12],
  [2, 18, 4, 4],
  [12, 18, 4, 2],
  [12, 36, 4, 2],
  [20, 30, 10, 8],
  [24, 12, 4, 18],
  [18, 23, 6, 4],
  [20, 27, 2, 5],
  [28, 16, 8, 4],
  [8, 4, 32, 4],
  [8, 12, 32, 4],
  [8, 4, 4, 12],
  [36, 4, 4, 12],
  [2, 4, 6, 4],
  [4, 12, 4, 4],
  [16, 8, 4, 2],
  [28, 10, 4, 2],
  [36, 16, 4, 6],
  [40, 12, 6, 4],
  [42, 2, 4, 14],
  [0, 32, 2, 4],
];
export const mazeBurnBush: Rect = {
  x: 18 * 32,
  y: 32 * 32,
  w: 2 * 32,
  h: 4 * 32,
};
/**
 * Stone posts across the lane just north and south of the cow. Their 56px gap
 * lets a hero (26px) through but never the 128px cow, so the cow can only be
 * pulled sideways into its grazing bay. The gap sits on the east side, in line
 * with the strip the cow leaves free once it is parked.
 */
export const MAZE_POST_GAP = { x: 830, w: 56 } as const;
export const mazeCowPosts: Rect[] = [22 * 32 + 8, 27 * 32 + 4].flatMap((y) => [
  { x: 24 * 32, y, w: MAZE_POST_GAP.x - 24 * 32, h: 20 },
  {
    x: MAZE_POST_GAP.x + MAZE_POST_GAP.w,
    y,
    w: 28 * 32 - (MAZE_POST_GAP.x + MAZE_POST_GAP.w),
    h: 20,
  },
]);
/** The furthest west the cow's centre can be pulled into the bay. */
export const MAZE_COW_PARKED_X = 23.8 * 32;
export const mazeGate: Rect = { x: 40 * 32, y: 12 * 32, w: 2 * 32, h: 4 * 32 };
export interface HedgeMazeState {
  burned: boolean;
  cow: { x: number; y: number; parked: boolean };
  runner: {
    x: number;
    y: number;
    facing: number;
    caught: boolean;
    waypoint?: { x: number; y: number };
    /** True while running from a hero who can reach it; otherwise it roams. */
    fleeing?: boolean;
    /** Current wander destination while no hero can reach the wolf. */
    roam?: { x: number; y: number };
  };
}
export const newHedgeMaze = (): HedgeMazeState => ({
  burned: false,
  cow: { x: 26 * 32, y: 25 * 32, parked: false },
  runner: { x: 20.5 * 32, y: 14.5 * 32, facing: Math.PI, caught: false },
});
export const hedgeMazeState = (
  puzzles: Record<string, { maze?: HedgeMazeState }>,
) => puzzles.hedgeMaze?.maze;
export const mazeCellOpen = (x: number, y: number) =>
  mazePaths.some(([a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h);
export const mazeHedges: Rect[] = [];
// Merge rows of blocked cells; collision matches the authored floor exactly.
for (let y = 0; y < 40; y++)
  for (let x = 0; x < 48;) {
    if (mazeCellOpen(x, y)) {
      x++;
      continue;
    }
    const start = x;
    while (x < 48 && !mazeCellOpen(x, y)) x++;
    mazeHedges.push({ x: start * 32, y: y * 32, w: (x - start) * 32, h: 32 });
  }
export function mazeCowRect(state: HedgeMazeState): Rect {
  return { x: state.cow.x - 64, y: state.cow.y - 64, w: 128, h: 128 };
}
export function mazeDynamicWalls(
  puzzles: Record<string, { complete: boolean; maze?: HedgeMazeState }>,
): Rect[] {
  const maze = hedgeMazeState(puzzles);
  return [
    ...(!maze?.burned ? [mazeBurnBush] : []),
    ...(!puzzles.hedgeGate?.complete ? [mazeGate] : []),
    ...(maze ? [mazeCowRect(maze)] : []),
  ];
}
export const mazeEnemySpawns = [
  { id: "maze-moss-before", type: "mossling", x: 9 * 32, y: 25.5 * 32 },
  { id: "maze-wisp-before", type: "cinder_wisp", x: 14 * 32, y: 30.5 * 32 },
  { id: "maze-moss-cow", type: "mossling", x: 24.9 * 32, y: 35.5 * 32 },
  { id: "maze-wisp-cow", type: "cinder_wisp", x: 28.5 * 32, y: 32 * 32 },
  { id: "maze-sentinel", type: "ironbound_sentinel", x: 26 * 32, y: 29 * 32 },
] as const;
export const mazePuzzle = (id: string): Puzzle => ({
  id,
  physical: false,
  arcane: false,
  complete: false,
  progress: 0,
});
