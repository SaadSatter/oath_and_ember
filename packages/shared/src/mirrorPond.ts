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
  // The spiked approach: the gap through the outer wall plus the court lane
  // between the rails. The dry walkway west of it stays hazard-free.
  pondTrial = tile(40, 24, 4, 4);
export const pondCulvert = [tile(34, 30, 8, 2), tile(34, 26, 2, 6)];
// Where the culvert passes through the outer wall. Barred deep water: Flight
// crosses it, walkers cannot, so the spike entrance is Sieg's only way in.
export const pondCulvertMouth = tile(40, 30, 2, 2);
export const pondPads = [
  tile(24.5, 10.5, 5, 3),
  tile(14.5, 16.5, 3, 3),
  tile(20.5, 24, 3, 3),
];
export const pondCenter = tile(20, 15, 8, 8),
  pondBridge = tile(26, 23, 2, 7);
export const pondChest = { x: 24 * 32, y: 18.5 * 32 };
// Rails sit outside the stone entrance rather than occupying whole paved rows.
// The north rail starts at the outer wall so the dry east walkway stays open
// past the entrance; the south rail still seals the culvert from the walkway.
export const pondGuardrails: Rect[] = [
  { x: 40 * 32, y: 24 * 32 - 8, w: 4 * 32, h: 8 },
  { x: 37 * 32, y: 28 * 32, w: 7 * 32, h: 8 },
];
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
// Furthest reach of a mirror frame from its pivot while it rotates.
export const POND_MIRROR_REACH = 62.4 + 7;
// The fence stays open in front of each mirror: its frame sweeps across the
// fence line, and the shot lane from its firing pad passes through there.
// Gaps snap outward to the 32px post spacing so every rail ends on a post.
// Deep water still bars walkers from the open stretch.
export const pondMirrorGaps: Rect[] = pondStations.map((s) => {
  const snap = (v: number, up: boolean) =>
    256 + (up ? Math.ceil : Math.floor)((v - 256) / 32) * 32;
  const x = snap(s.x - POND_MIRROR_REACH, false),
    y = snap(s.y - POND_MIRROR_REACH, false);
  return {
    x,
    y,
    w: snap(s.x + POND_MIRROR_REACH, true) - x,
    h: snap(s.y + POND_MIRROR_REACH, true) - y,
  };
});
// Visible, solid inner-bank fencing. Leave the water culvert and the mirror
// fronts open, and open the sanctuary bridge gate only once its stone deck
// has risen.
export function pondFenceWalls(
  puzzles: Record<string, { pond?: MirrorPondState }>,
): Rect[] {
  const inner: Rect[] = [
    { x: 256, y: 256, w: 896, h: 8 },
    { x: 256, y: 256, w: 8, h: 640 },
    { x: 1144, y: 256, w: 8, h: 640 },
    { x: 256, y: 888, w: 896, h: 8 },
  ];
  return [
    ...subtractRects(inner, [
      ...pondCulvert,
      ...pondMirrorGaps,
      ...(mirrorPondState(puzzles)?.raised ? [pondBridge] : []),
    ]),
  ];
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
  const halfX = Math.abs(Math.cos(angle)) * (POND_MIRROR_REACH - 7) + 7,
    halfY = Math.abs(Math.sin(angle)) * (POND_MIRROR_REACH - 7) + 7;
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
  // The whole visible culvert is deep water for both walkers. Flight removes
  // these terrain walls; role wards below remain separate.
  const water = subtractRects(
    [pondWater, ...pondCulvert],
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
    ...pondFenceWalls(puzzles),
    ...water,
    ...wards,
    ...pondStations.map((_, i) =>
      pondMirrorWall(i, state?.mirrors[i] ?? pondStations[i].rest),
    ),
  ];
}
// Floor spike traps: four columns across the east entrance rise out of the
// paving on a staggered timer, rippling from the pond side toward the court.
// Each cycle: harmless warning (tips peek) -> raised (only this hurts) ->
// retracting -> down. Timing is in pond-clock seconds, so Slow Time scales it.
// Tuned so walking never crosses, Super Speed can with good timing, and Slow
// Time with Super Speed crosses comfortably.
export const pondSpikeColumns: Rect[] = [40, 41, 42, 43].map((x) =>
  tile(x, 24, 1, 4),
);
export const pondSpikeTiming = {
  period: 1.6,
  warning: 0.15,
  raised: 0.35,
  retract: 0.1,
  stagger: 0.06,
} as const;
export type PondSpikePhase = "down" | "warning" | "raised" | "retracting";
export function pondSpikeState(
  clock: number,
  index: number,
): { phase: PondSpikePhase; progress: number } {
  const { period, warning, raised, retract, stagger } = pondSpikeTiming;
  const at = (((clock / period - index * stagger) % 1) + 1) % 1;
  if (at < warning) return { phase: "warning", progress: at / warning };
  if (at < warning + raised)
    return { phase: "raised", progress: (at - warning) / raised };
  if (at < warning + raised + retract)
    return {
      phase: "retracting",
      progress: (at - warning - raised) / retract,
    };
  return {
    phase: "down",
    progress:
      (at - warning - raised - retract) / (1 - warning - raised - retract),
  };
}
// Only fully raised columns are dangerous; they are hazards, never walls.
export function pondSpikes(clock: number): Rect[] {
  return pondSpikeColumns.filter(
    (_, i) => pondSpikeState(clock, i).phase === "raised",
  );
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

export function pondMirrorContact(
  from: { x: number; y: number },
  to: { x: number; y: number },
  index: number,
  angle: number,
) {
  const s = pondStations[index],
    tangent = { x: Math.cos(angle), y: Math.sin(angle) },
    normal = { x: -tangent.y, y: tangent.x };
  const d0 = (from.x - s.x) * normal.x + (from.y - s.y) * normal.y,
    d1 = (to.x - s.x) * normal.x + (to.y - s.y) * normal.y;
  if (Math.abs(d0 - d1) < 1e-10) return Infinity;
  const t = d0 / (d0 - d1);
  if (t < 0 || t > 1) return Infinity;
  const x = from.x + (to.x - from.x) * t,
    y = from.y + (to.y - from.y) * t;
  return Math.abs((x - s.x) * tangent.x + (y - s.y) * tangent.y) <= 66.4
    ? t
    : Infinity;
}
