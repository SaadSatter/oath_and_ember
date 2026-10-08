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
