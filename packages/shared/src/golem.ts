export const golemBeam = { duration: 2, range: 640 } as const;
export const golemPalm = {
  east: { x: 32, y: -45 },
  west: { x: -32, y: -45 },
  north: { x: 20, y: -66 },
  south: { x: 28, y: -40 },
};
export function golemDirection(angle: number): keyof typeof golemPalm {
  return Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle))
    ? Math.cos(angle) >= 0
      ? "east"
      : "west"
    : Math.sin(angle) >= 0
      ? "south"
      : "north";
}
export function golemPalmOrigin(e: {
  x: number;
  y: number;
  attackFacing: number;
}) {
  const p = golemPalm[golemDirection(e.attackFacing)];
  return { x: e.x + p.x, y: e.y + p.y };
}
