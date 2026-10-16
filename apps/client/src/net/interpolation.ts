import {
  constrainMotion,
  flightWalls,
} from "../../../../packages/shared/src/movement.js";
import { maps, collisionRects } from "../../../../packages/shared/src/maps.js";
import type { World } from "../../../../packages/shared/src/gameTypes.js";
import {
  INTERPOLATION_MS,
  SERVER_HZ,
} from "../../../../packages/shared/src/constants.js";
// Beyond this backlog the playhead speeds up, by at most MAX_CATCH_UP, so it
// drifts back toward the delay budget without a visible change of pace.
const CATCH_UP_AFTER_MS = INTERPOLATION_MS * 2,
  MAX_CATCH_UP = 0.06,
  REANCHOR_AFTER_MS = 600;
export class Interpolation {
  buffer: { time: number; world: World }[] = [];
  private playbackTime: number | null = null;
  private renderTime = 0;
  private origin: { tick: number; time: number } | null = null;
  clear() {
    this.buffer = [];
    this.origin = null;
    this.playbackTime = null;
  }
  push(world: World, now = performance.now()) {
    const last = this.buffer.at(-1)?.world;
    if (last && world.serverTick <= last.serverTick) return;
    if (!this.origin) {
      this.origin = { tick: world.serverTick, time: now };
      this.playbackTime = now - INTERPOLATION_MS;
      this.renderTime = now;
    }
    this.buffer.push({
      time:
        this.origin.time + ((world.serverTick - this.origin.tick) * 1000) / SERVER_HZ,
      world: structuredClone(world),
    });
    if (this.buffer.length > 20) this.buffer.shift();
  }
  // Render remote entities on simulation time, 100ms behind the initial clock.
  // Receipt bursts do not compress several physics ticks into one frame. Hold
  // the latest state rather than inventing unbounded remote movement.
  position(
    id: string,
    kind: "players" | "enemies" | "projectiles",
    now = performance.now(),
  ) {
    if (!this.buffer.length) return null;
    if (this.playbackTime === null) {
      this.playbackTime = now - INTERPOLATION_MS;
      this.renderTime = now;
    }
    // Pause the playhead when the buffer runs dry. Absolute wall time used to
    // run beyond available snapshots, then jump across a whole receipt burst.
    // Each pause used to add permanent delay, so remote heroes drifted further
    // behind over a session. Play up to 6% faster while beyond the budget, and
    // re-anchor after a long outage instead of scrubbing through stale history.
    const latest = this.buffer.at(-1)!.time;
    const lag = latest - this.playbackTime;
    if (lag > REANCHOR_AFTER_MS) this.playbackTime = latest - INTERPOLATION_MS;
    const rate =
      lag > CATCH_UP_AFTER_MS
        ? 1 + Math.min(MAX_CATCH_UP, (lag - CATCH_UP_AFTER_MS) / 2000)
        : 1;
    this.playbackTime = Math.min(
      this.playbackTime + Math.max(0, now - this.renderTime) * rate,
      latest,
    );
    this.renderTime = Math.max(this.renderTime, now);
    const t = this.playbackTime;
    let a = this.buffer[0],
      b = a;
    for (const s of this.buffer) {
      if (s.time <= t) a = s;
      if (s.time >= t) {
        b = s;
        break;
      }
      b = s;
    }
    if (!a || !b) return null;
    const p = a.world[kind][id],
      q = b.world[kind][id];
    if (!p || !q) return q ?? p ?? null;
    if (kind === "players") {
      const latest = this.buffer.at(-1)?.world.players[id];
      if (
        latest &&
        (latest.sceneId !==
          (p as import("../../../../packages/shared/src/gameTypes.js").Player)
            .sceneId ||
          latest.movementEpoch !==
            (p as import("../../../../packages/shared/src/gameTypes.js").Player)
              .movementEpoch)
      )
        return latest;
    }
    if (
      kind === "players" &&
      ((p as import("../../../../packages/shared/src/gameTypes.js").Player)
        .sceneId !==
        (q as import("../../../../packages/shared/src/gameTypes.js").Player)
          .sceneId ||
        (p as import("../../../../packages/shared/src/gameTypes.js").Player)
          .movementEpoch !==
          (q as import("../../../../packages/shared/src/gameTypes.js").Player)
            .movementEpoch)
    )
      return q;
    const f = Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time || 1)));
    const delta = { x: (q.x - p.x) * f, y: (q.y - p.y) * f };
    if (kind === "players") {
      const player =
        p as import("../../../../packages/shared/src/gameTypes.js").Player;
      const scene = player.sceneId ?? a.world.sceneId;
      return constrainMotion(
        p,
        delta,
        maps[scene],
        flightWalls(
          collisionRects(
            scene,
            a.world.puzzles,
            a.world.pushableOffsets,
            a.world.bridgePuzzle,
            a.world.players,
            a.world.serverTick,
            (p as import("../../../../packages/shared/src/gameTypes.js").Player)
              .role,
          ),
          !!player.flightRemaining,
        ),
      );
    }
    return { x: p.x + delta.x, y: p.y + delta.y };
  }
}
