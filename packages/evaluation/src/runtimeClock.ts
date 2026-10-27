import type { RoomRuntime } from "../../../apps/server/src/GameRoom.js";
/** Episode-local clock and deterministic identifiers, never a global clock override. */
export class EvaluationClock implements RoomRuntime {
  private ticks = 0;
  private ids = 0;
  constructor(readonly seed: number) {
    if (!Number.isSafeInteger(seed)) throw Error("Invalid seed");
  }
  now = () => (this.ticks * 1000) / 60;
  id = () => `evaluation-${this.seed}-${++this.ids}`;
  advance() {
    this.ticks++;
  }
}
