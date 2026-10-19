import { neutral } from "../../../../packages/shared/src/gameTypes.js";
import type {
  Player,
  InputFrame,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import { stepMovement } from "../../../../packages/shared/src/movement.js";
import { maps, collisionRects } from "../../../../packages/shared/src/maps.js";
import {
  WALK_ARRIVE,
  storyWalkInput,
} from "../../../../packages/shared/src/storyWalk.js";
import {
  DT,
  MAX_PREDICTION_LEAD,
  SERVER_HZ,
  ticksFor,
} from "../../../../packages/shared/src/constants.js";
interface TrailPoint {
  tick: number;
  x: number;
  y: number;
  facing: number;
  sceneId: Player["sceneId"];
  movementEpoch: Player["movementEpoch"];
}
const RENDER_BEHIND_TICKS = Math.max(1, ticksFor(1 / 30));
export class Prediction {
  player: Player | null = null;
  pending: InputFrame[] = [];
  error = 0;
  private tick = 0;
  // Presentation only: per-tick predicted positions, so rendering can glide
  // between simulation steps instead of chasing a staircase on faster screens.
  private trail: TrailPoint[] = [];
  private cursor: number | null = null;
  private cursorTime = 0;
  get simulationTick() {
    return this.tick;
  }
  // The fractional predicted tick currently on screen.
  get renderTick() {
    return this.cursor ?? this.trail.at(-1)?.tick ?? this.tick;
  }
  // Predicted state at a simulated tick, if it is still in the short trail.
  stateAt(tick: number) {
    return this.trail.find((point) => point.tick === tick) ?? null;
  }
  private appliedInput: InputFrame = neutral();
  reset(p: Player, serverTick = 0) {
    this.player = structuredClone(p);
    this.pending = [];
    this.tick = serverTick;
    this.error = 0;
    this.trail = [];
    this.cursor = null;
    this.record();
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
      // Walked into place by the story: the walk is worked out afresh each
      // tick from the predicted position, exactly as the server does it.
      const walk = storyWalkInput(w, this.player, this.tick);
      const mark = w.story?.walks?.[this.player.id];
      if (
        mark &&
        !mark.pending &&
        this.tick >= mark.start &&
        Math.hypot(mark.x - this.player.x, mark.y - this.player.y) <=
          WALK_ARRIVE
      )
        Object.assign(this.player, { x: mark.x, y: mark.y, vx: 0, vy: 0 });
      stepMovement(
        this.player,
        walk ? { ...neutral(input.seq), ...walk } : input,
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
      this.record();
    }
  }
  private record() {
    if (!this.player) return;
    const { x, y, facing, sceneId, movementEpoch } = this.player;
    while (this.trail.length && this.trail.at(-1)!.tick >= this.tick)
      this.trail.pop();
    this.trail.push({ tick: this.tick, x, y, facing, sceneId, movementEpoch });
    if (this.trail.length > ticksFor(1)) this.trail.shift();
  }
  // A playback cursor advances in real time ~33ms behind the newest
  // prediction. Uneven timer wakes then never reach the screen as speed wobble.
  renderPosition(now = performance.now()) {
    const newest = this.trail.at(-1);
    if (!newest) return null;
    const goal = newest.tick - RENDER_BEHIND_TICKS;
    if (this.cursor === null || Math.abs(goal - this.cursor) > ticksFor(0.1))
      this.cursor = goal;
    else {
      const dt = Math.max(0, Math.min(100, now - this.cursorTime));
      this.cursor += (dt * SERVER_HZ) / 1000;
      this.cursor += (goal - this.cursor) * Math.min(1, dt / 1000);
    }
    this.cursorTime = now;
    this.cursor = Math.max(this.trail[0].tick, Math.min(newest.tick, this.cursor));
    let a = this.trail[0],
      b = newest;
    for (const point of this.trail) {
      if (point.tick <= this.cursor) a = point;
      if (point.tick >= this.cursor) {
        b = point;
        break;
      }
    }
    // Teleports, respawns and scene changes appear at once, never tweened.
    if (a.sceneId !== b.sceneId || a.movementEpoch !== b.movementEpoch)
      return { x: b.x, y: b.y };
    const f = b.tick === a.tick ? 0 : (this.cursor - a.tick) / (b.tick - a.tick);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
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
      this.record();
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
    this.record();
    this.simulate(horizon, w);
    this.error = old
      ? Math.hypot(old.x - this.player.x, old.y - this.player.y)
      : 0;
  }
}
