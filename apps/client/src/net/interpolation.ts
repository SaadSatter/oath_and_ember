import { constrainMotion } from "../../../../packages/shared/src/movement.js";
import { maps, collisionRects } from "../../../../packages/shared/src/maps.js";
import type { World } from "../../../../packages/shared/src/gameTypes.js";
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
      this.playbackTime = now - 100;
      this.renderTime = now;
    }
    this.buffer.push({
      time:
        this.origin.time + ((world.serverTick - this.origin.tick) * 1000) / 30,
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
      this.playbackTime = now - 100;
      this.renderTime = now;
    }
    // Pause the playhead when the buffer runs dry. Absolute wall time used to
    // run beyond available snapshots, then jump across a whole receipt burst.
    this.playbackTime = Math.min(
      this.playbackTime + Math.max(0, now - this.renderTime),
      this.buffer.at(-1)!.time,
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
        collisionRects(scene, a.world.puzzles, a.world.pushableOffsets),
      );
    }
    return { x: p.x + delta.x, y: p.y + delta.y };
  }
}
