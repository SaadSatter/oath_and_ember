import type { PondSpikePhase } from "../../../../packages/shared/src/mirrorPond.js";
// Presentation only: maps the shared, server-timed spike state to a frame of
// spike-trap.png (0 retracted, 1 tips peeking, 2 half raised, 3 fully raised).
// Frame 3 appears exactly while the column is dangerous.
export const SPIKE_TRAP_FRAMES = 4;
export function spikeTrapFrame(state: {
  phase: PondSpikePhase;
  progress: number;
}) {
  switch (state.phase) {
    case "down":
      return 0;
    case "warning":
      return state.progress < 0.7 ? 1 : 2;
    case "raised":
      return 3;
    case "retracting":
      return state.progress < 0.5 ? 2 : 1;
  }
}
