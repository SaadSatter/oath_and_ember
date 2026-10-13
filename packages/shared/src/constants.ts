export const SERVER_HZ = 30,
  DT = 1 / SERVER_HZ,
  SNAPSHOT_HZ = 15,
  SPEED = 190,
  GRAVITY = 1100,
  JUMP = 470,
  HALF = 13;
export const INTERPOLATION_MS = 100,
  CORRECTION_SNAP = 100;

// 267ms of scheduled intent absorbs batched delivery plus a short frame stall.
export const INPUT_LEAD_TICKS = 8,
  MAX_PREDICTION_LEAD = 12;

export const SLOW_TIME_SCALE = 0.2;
