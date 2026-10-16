// 60Hz simulation: one step per display frame on common screens, so local
// prediction advances every frame instead of every other one.
export const SERVER_HZ = 60,
  DT = 1 / SERVER_HZ,
  // Snapshots carry remote players and enemies; at 30Hz interpolation has a
  // fresh pair inside every 100ms window, so remote motion stays even.
  SNAPSHOT_HZ = 30,
  SNAPSHOT_INTERVAL_TICKS = Math.max(1, Math.round(SERVER_HZ / SNAPSHOT_HZ)),
  SPEED = 190,
  GRAVITY = 1100,
  JUMP = 470,
  HALF = 13;
export const INTERPOLATION_MS = 100,
  CORRECTION_SNAP = 100;

// Durations are authored in seconds and stored as whole simulation ticks, so
// timing is unchanged when the simulation rate changes.
export function ticksFor(seconds: number) {
  return Math.round(seconds * SERVER_HZ);
}

// 267ms of scheduled intent absorbs batched delivery plus a short frame stall.
export const INPUT_LEAD_TICKS = ticksFor(0.267),
  MAX_PREDICTION_LEAD = ticksFor(0.4);

export const SLOW_TIME_SCALE = 0.2;

// Sieg's super speed multiplies walking SPEED. Coco's fireballs travel at that
// same pace so they always outrun her; slowed time scales them like any shot.
export const SPRINT_MULTIPLIER = 2,
  FIREBALL_SPEED = SPEED * SPRINT_MULTIPLIER,
  FIREBALL_RANGE = 672;
