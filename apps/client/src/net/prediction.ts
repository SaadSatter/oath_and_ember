import { neutral } from "../../../../packages/shared/src/gameTypes.js";
import type {
  Player,
  InputFrame,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import { stepMovement } from "../../../../packages/shared/src/movement.js";
import { maps, collisionRects } from "../../../../packages/shared/src/maps.js";
import {
  DT,
  MAX_PREDICTION_LEAD,
} from "../../../../packages/shared/src/constants.js";
export class Prediction {
  player: Player | null = null;
  pending: InputFrame[] = [];
  error = 0;
  private tick = 0;
  get simulationTick() {
    return this.tick;
  }
  private appliedInput: InputFrame = neutral();
  reset(p: Player, serverTick = 0) {
    this.player = structuredClone(p);
    this.pending = [];
    this.tick = serverTick;
    this.error = 0;
    this.appliedInput = p.movementInput ?? {
      ...neutral(p.lastProcessedInputSeq),
      moveX: p.movementIntent?.x ?? 0,
      moveY: p.movementIntent?.y ?? 0,
    };
  }
  private simulate(until: number, w: World) {
    if (!this.player) return;
    let input = this.appliedInput;
    for (const i of this.pending)
      if (i.targetTick! <= this.tick && i.seq > input.seq) input = i;
    while (this.tick < until) {
      this.tick++;
      for (const i of this.pending)
        if (i.targetTick! <= this.tick && i.seq > input.seq) input = i;
      const scene = this.player.sceneId ?? w.sceneId;
      stepMovement(
        this.player,
        input,
        maps[scene],
        collisionRects(
          scene,
          w.puzzles,
          w.pushableOffsets,
          w.bridgePuzzle,
          w.players,
          w.serverTick,
          this.player.role,
        ),
        DT,
        !!w.slowTime && this.tick < w.slowTime.endsTick,
      );
    }
  }
  push(i: InputFrame, w: World, advance = true) {
    if (!this.player) return;
    const goal = Math.max(
      this.tick,
      Math.min(
        i.targetTick ?? this.tick + 1,
        w.serverTick + MAX_PREDICTION_LEAD - 1,
      ),
    );
    // Reserve the next tick for changed intent even while prediction is at its
    // ceiling. Otherwise commands were sent beyond the server acceptance window.
    // Sending a packet never adds simulation time.
    i.targetTick = Math.max(this.tick + 1, goal);
    i.movementEpoch = this.player.movementEpoch;
    this.pending.push({ ...i });
    if (this.pending.length > 120) this.pending.shift();
    if (advance) this.simulate(goal, w);
  }
  reconcile(p: Player, w: World) {
    const old = this.player;
    for (const i of this.pending)
      if (i.seq <= p.lastProcessedInputSeq) this.appliedInput = i;
    this.pending = this.pending.filter((i) => i.seq > p.lastProcessedInputSeq);
    this.appliedInput = p.movementInput ?? this.appliedInput;
    if (
      w.phase !== "PLAYING" ||
      Object.values(w.players).some((q) => !q.connected)
    ) {
      this.pending = [];
      this.player = structuredClone(p);
      this.tick = w.serverTick;
      this.error = old ? Math.hypot(old.x - p.x, old.y - p.y) : 0;
      return;
    }
    // Late commands become next-tick intent, never a shifted replay horizon.
    for (const i of this.pending)
      i.targetTick = Math.max(w.serverTick + 1, i.targetTick!);
    const horizon = Math.min(
      Math.max(this.tick, w.serverTick + (this.pending.length ? 1 : 0)),
      w.serverTick + MAX_PREDICTION_LEAD - 1,
    );
    this.player = structuredClone(p);
    this.tick = w.serverTick;
    this.simulate(horizon, w);
    this.error = old
      ? Math.hypot(old.x - this.player.x, old.y - this.player.y)
      : 0;
  }
}
