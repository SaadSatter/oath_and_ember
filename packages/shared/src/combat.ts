import { ticksFor } from "./constants.js";

// Server-owned charge timing in fixed simulation steps.
export const heavyTiming = {
  minimumTicks: ticksFor(0.467),
  fullTicks: ticksFor(1.1),
  capTicks: ticksFor(1.267),
} as const;

// Basic sword cadence remains 450 ms. Contact is a single server-owned event,
// independent of sprite dimensions, crop metadata, or the client frame clock.
export const swordTiming = {
  durationMs: 450,
  contactTicks: {
    horizontal: ticksFor(0.233),
    up: ticksFor(0.167),
    down: ticksFor(0.1),
  },
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
