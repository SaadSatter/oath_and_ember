import type { World } from "../../../../packages/shared/src/gameTypes.js";
export class Interpolation {
  buffer: { time: number; world: World }[] = [];
  clear() {
    this.buffer = [];
  }
  push(world: World) {
    this.buffer.push({
      time: performance.now(),
      world: structuredClone(world),
    });
    if (this.buffer.length > 20) this.buffer.shift();
  }
  // Render remote entities 100ms behind receipt time. When packets stall, hold
  // the latest state rather than inventing unbounded remote movement.
  position(id: string, kind: "players" | "enemies" | "projectiles") {
    const t = performance.now() - 100;
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
    const f = Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time || 1)));
    return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
  }
}
