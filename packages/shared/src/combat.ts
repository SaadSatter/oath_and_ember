// Server-owned charge timing at the existing 30 Hz fixed simulation step.
export const heavyTiming = {
  minimumTicks: 14,
  fullTicks: 33,
  capTicks: 38,
} as const;

// Basic sword cadence remains 450 ms. Contact is a single server-owned event,
// independent of sprite dimensions, crop metadata, or the client frame clock.
export const swordTiming = {
  durationMs: 450,
  contactTicks: { horizontal: 7, up: 5, down: 3 },
} as const;
export function swordContactTicks(facing: number) {
  return Math.abs(Math.cos(facing)) >= Math.abs(Math.sin(facing))
    ? swordTiming.contactTicks.horizontal
    : Math.sin(facing) < 0
      ? swordTiming.contactTicks.up
      : swordTiming.contactTicks.down;
}

// A 120-degree forward swing. Strictly excludes the sides, rear and coincident centers.
export function inSwordArc(
  origin: { x: number; y: number },
  target: { x: number; y: number },
  facing: number,
  range: number,
) {
  const dx = target.x - origin.x,
    dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  return (
    distance > 0 &&
    distance < range &&
    dx * Math.cos(facing) + dy * Math.sin(facing) >= distance * 0.5
  );
}
