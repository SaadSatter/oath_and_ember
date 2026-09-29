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
  reset(p: Player) {
    this.player = structuredClone(p);
    this.pending = [];
  }
  push(i: InputFrame, w: World) {
    if (!this.player) return;
    this.pending.push(i);
    if (this.pending.length > 120) this.pending.shift();
    move(
      this.player,
      i,
      maps[w.sceneId],
      collisionRects(w.sceneId, w.puzzles),
      DT,
    );
  }
  // Restore truth then replay only inputs the server has not acknowledged.
  reconcile(p: Player, w: World) {
    const old = this.player;
    this.pending = this.pending.filter((i) => i.seq > p.lastProcessedInputSeq);
    this.player = structuredClone(p);
    for (const i of this.pending)
      move(
        this.player,
        i,
        maps[w.sceneId],
        collisionRects(w.sceneId, w.puzzles),
        DT,
      );
    this.error = old
      ? Math.hypot(old.x - this.player.x, old.y - this.player.y)
      : 0;
  }
}
