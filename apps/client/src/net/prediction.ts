import { neutral } from "../../../../packages/shared/src/gameTypes.js";
import type {
  Player,
  InputFrame,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import { move } from "../../../../packages/shared/src/movement.js";
import { maps, collisionRects } from "../../../../packages/shared/src/maps.js";
import { DT } from "../../../../packages/shared/src/constants.js";
export class Prediction {
  player: Player | null = null;
  pending: InputFrame[] = [];
  error = 0;
  private tick = 0;
  private commandTicks = new Map<number, number>();
  private appliedInput: InputFrame = neutral();
  reset(p: Player, serverTick = 0) {
    this.player = structuredClone(p);
    this.pending = [];
    this.tick = serverTick;
    this.commandTicks.clear();
    this.appliedInput = {
      ...neutral(p.lastProcessedInputSeq),
      moveX: p.movementIntent?.x ?? 0,
      moveY: p.movementIntent?.y ?? 0,
    };
  }
  push(i: InputFrame, w: World, advance = true) {
    if (!this.player) return;
    this.tick = Math.max(this.tick, w.serverTick);
    this.commandTicks.set(i.seq, this.tick + 1);
    this.pending.push(i);
    if (this.pending.length > 120)
      this.commandTicks.delete(this.pending.shift()!.seq);
    // Immediate action packets change intent, but are not extra physics ticks.
    if (!advance) return;
    this.tick++;
    move(
      this.player,
      i,
      maps[this.player.sceneId ?? w.sceneId],
      collisionRects(this.player.sceneId ?? w.sceneId, w.puzzles),
      DT,
    );
  }
  // Restore truth, then replay future physics ticks using the held intent.
  reconcile(p: Player, w: World) {
    const old = this.player;
    for (const i of this.pending)
      if (i.seq <= p.lastProcessedInputSeq) this.appliedInput = i;
    this.pending = this.pending.filter((i) => {
      if (i.seq > p.lastProcessedInputSeq) return true;
      this.commandTicks.delete(i.seq);
      return false;
    });
    this.player = structuredClone(p);
    // A command the server has not acknowledged cannot be treated as a past
    // server tick. Keep its relative spacing while rebasing pending commands.
    const firstPendingTick = this.pending.length
      ? this.commandTicks.get(this.pending[0].seq)
      : undefined;
    if (firstPendingTick !== undefined && firstPendingTick <= w.serverTick) {
      const shift = w.serverTick + 1 - firstPendingTick;
      for (const i of this.pending)
        this.commandTicks.set(i.seq, this.commandTicks.get(i.seq)! + shift);
      this.tick = Math.max(this.tick, w.serverTick + 1);
    }
    // Timer skew must not accumulate acknowledged steps into a permanent lead.
    // Retain a single in-flight step for batched acknowledgements, plus enough
    // time for outstanding intent. Only new samples advance the local clock.
    this.tick = Math.min(
      Math.max(this.tick, w.serverTick),
      w.serverTick + Math.max(1, this.pending.length),
    );
    for (const i of this.pending)
      this.commandTicks.set(
        i.seq,
        Math.min(this.commandTicks.get(i.seq)!, this.tick),
      );
    // Sequence acknowledges intent, not elapsed physics. Replay the future
    // simulation ticks, holding the latest intent just as the server does.
    let input = this.appliedInput;
    for (let tick = w.serverTick + 1; tick <= this.tick; tick++) {
      for (const i of this.pending)
        if ((this.commandTicks.get(i.seq) ?? tick) <= tick) input = i;
      move(
        this.player,
        input,
        maps[this.player.sceneId ?? w.sceneId],
        collisionRects(this.player.sceneId ?? w.sceneId, w.puzzles),
        DT,
      );
    }
    this.error = old
      ? Math.hypot(old.x - this.player.x, old.y - this.player.y)
      : 0;
  }
}
