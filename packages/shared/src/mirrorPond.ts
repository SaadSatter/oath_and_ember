import type { Puzzle, Rect, Role } from "./gameTypes.js";
const tile = (x: number, y: number, w: number, h: number): Rect => ({
  x: x * 32,
  y: y * 32,
  w: w * 32,
  h: h * 32,
});
export interface MirrorPondState {
  mirrors: number[];
  torches: boolean[];
  raised: boolean;
  clock: number;
  entryPassed: boolean;
  failures: number;
}
export const newMirrorPond = (): MirrorPondState => ({
  mirrors: [Math.PI / 2, 0, Math.PI / 2, 0],
  torches: [false, false, false, false],
  raised: false,
  clock: 0,
  entryPassed: false,
  failures: 0,
});
export const mirrorPondState = (
  puzzles: Record<string, { pond?: MirrorPondState }>,
) => puzzles.mirrorPond?.pond;
export const pondStations = [
  {
    x: 38 * 32,
    y: 12 * 32,
    shot: { x: 28 * 32, y: 12 * 32 },
    torch: { x: 44 * 32, y: 6 * 32 },
    angle: -Math.PI / 8,
    rest: Math.PI / 2,
    incoming: { x: 1, y: 0 },
  },
  {
    x: 26 * 32,
    y: 6 * 32,
    shot: { x: 26 * 32, y: 12 * 32 },
    torch: { x: 21 * 32, y: 1 * 32 },
    angle: (3 * Math.PI) / 8,
    rest: 0,
    incoming: { x: 0, y: -1 },
  },
  {
    x: 6 * 32,
    y: 18 * 32,
    shot: { x: 16 * 32, y: 18 * 32 },
    torch: { x: 1.5 * 32, y: 13.5 * 32 },
    angle: Math.PI / 8,
    rest: Math.PI / 2,
    incoming: { x: -1, y: 0 },
  },
  {
    x: 22 * 32,
    y: 30 * 32,
    shot: { x: 22 * 32, y: 25 * 32 },
    torch: { x: 17 * 32, y: 35 * 32 },
    angle: (5 * Math.PI) / 8,
    rest: 0,
    incoming: { x: 0, y: 1 },
  },
] as const;
export const pondBounds = tile(4, 4, 36, 28),
  pondWater = tile(8, 8, 28, 20),
  pondCourt = tile(42, 24, 6, 14);
export const pondEntry = tile(36, 24, 8, 4),
  pondTrial = tile(37, 25, 5, 2);
export const pondCulvert = [tile(34, 30, 8, 2), tile(34, 26, 2, 6)];
export const pondPads = [
  tile(24.5, 10.5, 5, 3),
  tile(14.5, 16.5, 3, 3),
  tile(20.5, 24, 3, 3),
];
export const pondCenter = tile(20, 15, 8, 8),
  pondBridge = tile(26, 23, 2, 7);
export const pondChest = { x: 24 * 32, y: 18.5 * 32 };
export const pondGuardrails = [tile(37, 24, 7, 1), tile(37, 27, 7, 1)];
export const pondOuterBlocks = [
  tile(4, 2, 36, 2),
  tile(2, 4, 2, 28),
  tile(4, 32, 36, 2),
  tile(40, 4, 2, 20),
  tile(40, 28, 2, 2),
  tile(40, 32, 2, 2),
];
export const inside = (p: { x: number; y: number }, r: Rect) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
export function subtractRects(rectangles: Rect[], cuts: Rect[]): Rect[] {
  let result = rectangles;
  for (const cut of cuts) {
    const next: Rect[] = [];
    for (const r of result) {
      const x = Math.max(r.x, cut.x),
        y = Math.max(r.y, cut.y),
        right = Math.min(r.x + r.w, cut.x + cut.w),
        bottom = Math.min(r.y + r.h, cut.y + cut.h);
      if (x >= right || y >= bottom) {
        next.push(r);
        continue;
      }
      if (y > r.y) next.push({ ...r, h: y - r.y });
      if (bottom < r.y + r.h)
        next.push({ ...r, y: bottom, h: r.y + r.h - bottom });
      if (x > r.x) next.push({ ...r, y, h: bottom - y, w: x - r.x });
      if (right < r.x + r.w)
        next.push({ ...r, x: right, y, w: r.x + r.w - right, h: bottom - y });
    }
    result = next;
  }
  return result;
}
// Diagonal 24px spell slots through 64px walls. A 26px actor cannot fit.
export const pondStoneWalls: Rect[] = [];
for (const r of pondOuterBlocks)
  for (let y = r.y; y < r.y + r.h; y += 4) {
    let strips: Rect[] = [{ x: r.x, y, w: r.w, h: Math.min(4, r.y + r.h - y) }];
    for (const station of pondStations) {
      const minY = Math.min(station.y, station.torch.y),
        maxY = Math.max(station.y, station.torch.y);
      if (y + 2 < minY || y + 2 > maxY) continue;
      const x =
        station.x +
        ((y + 2 - station.y) * (station.torch.x - station.x)) /
          (station.torch.y - station.y);
      strips = subtractRects(strips, [{ x: x - 12, y, w: 24, h: 4 }]);
    }
    pondStoneWalls.push(...strips);
  }
const fields = [pondBounds, pondCourt, pondEntry, ...pondCulvert];
export const pondOutsideWalls: Rect[] = [];
for (let y = 0; y < 40; y++)
  for (let x = 0; x < 48;) {
    if (
      fields.some((r) => inside({ x: (x + 0.5) * 32, y: (y + 0.5) * 32 }, r))
    ) {
      x++;
      continue;
    }
    const begin = x;
    while (
      x < 48 &&
      !fields.some((r) => inside({ x: (x + 0.5) * 32, y: (y + 0.5) * 32 }, r))
    )
      x++;
    pondOutsideWalls.push(tile(begin, y, x - begin, 1));
  }
export const pondFixedWalls = [
  ...pondOutsideWalls,
  ...pondStoneWalls,
  ...pondGuardrails,
];
export const POND_ROTATION_STEP = Math.PI / 120; // 1.5 degrees per server tick: 45 degrees/second.
export const normalizeMirrorAngle = (angle: number) =>
  ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
export function pondMirrorWall(index: number, angle: number): Rect {
  const s = pondStations[index];
  const halfX = Math.abs(Math.cos(angle)) * 62.4 + 7,
    halfY = Math.abs(Math.sin(angle)) * 62.4 + 7;
  return { x: s.x - halfX, y: s.y - halfY, w: halfX * 2, h: halfY * 2 };
}
export function pondLand(state: MirrorPondState | undefined) {
  return [...pondPads, ...(state?.raised ? [pondCenter, pondBridge] : [])];
}
export function pondCollisionWalls(
  puzzles: Record<string, { pond?: MirrorPondState }>,
  role?: Role | null,
): Rect[] {
  const state = mirrorPondState(puzzles);
  const water = subtractRects(
    [pondWater, ...(role === "EMBER" ? pondCulvert : [])],
    pondLand(state),
  ).map((r) => ({ ...r, terrain: "water" as const }));
  const wards =
    role === "EMBER"
      ? [
          ...subtractRects(
            [
              tile(4, 4, 36, 4),
              tile(4, 8, 4, 20),
              tile(36, 8, 4, 20),
              tile(4, 28, 36, 4),
            ],
            pondCulvert,
          ),
          tile(37, 25, 7, 2),
        ]
      : [];
  return [
    ...water,
    ...wards,
    ...pondStations.map((_, i) =>
      pondMirrorWall(i, state?.mirrors[i] ?? pondStations[i].rest),
    ),
  ];
}
export function pondSpikes(clock: number): Rect[] {
  return [38 * 32, 39.5 * 32].map((x, i) => ({
    x: x - 10,
    y: 26 * 32 + Math.sin(clock * 3.2 + i * 0.35) * 88 - 24,
    w: 20,
    h: 48,
  }));
}
export const pondSpawn = (role: Role | null) =>
  role === "EMBER"
    ? { x: 44.5 * 32, y: 36 * 32 }
    : { x: 44.5 * 32, y: 33 * 32 };
export const pondPuzzle = (): Puzzle => ({
  id: "mirrorPond",
  physical: false,
  arcane: false,
  complete: false,
  progress: 0,
  pond: newMirrorPond(),
});
