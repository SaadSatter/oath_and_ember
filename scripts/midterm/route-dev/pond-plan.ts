// DEVELOPMENT TOOL (not part of any route or player). It reads and sets engine state
// directly to plan the scripted route's constants offline. See docs/midterm/ROUTE_LOG.md.
// Run from the repository root: node --import tsx scripts/midterm/route-dev/pond-plan.ts ...
// Offline development tool: push plan per pond mirror with exact walking paths.
import { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { collisionRects } from "../../../packages/shared/src/maps.js";
import { mirrorPondState, pondStations, normalizeMirrorAngle } from "../../../packages/shared/src/mirrorPond.js";
import { pushPondMirror } from "../../../apps/server/src/mirrorPond.js";
const half = (a: number) => { const d = normalizeMirrorAngle(a) % Math.PI; return d > Math.PI / 2 ? d - Math.PI : d; };
const deg = (a: number) => Math.round(normalizeMirrorAngle(a) * 180 / Math.PI * 10) / 10;
function room(i: number, angle: number) { const r = new GameRoom("DEV007", false, "MIRROR_POND"); const a = r.add("a"), b = r.add("b");
  r.select(a.playerId, "OATH"); r.select(b.playerId, "EMBER"); r.ready(a.playerId, true); r.ready(b.playerId, true);
  const w = r.state; mirrorPondState(w.puzzles)!.mirrors[i] = angle; const c = w.players[b.playerId]; c.x = -999; c.y = -999;
  const s = w.players[a.playerId]; s.x = -999; return { w, s }; }
function wallsAt(i: number, angle: number) { const { w } = room(i, angle); return collisionRects("MIRROR_POND", w.puzzles, undefined, undefined, w.players, w.serverTick, "OATH"); }
function finePath(ws: any[], from: number[], to: number[]): number[][] | null {
  const G = 4, W = 1536 / G, H13 = 13.5;
  const free = (gx: number, gy: number) => { const x = gx * G, y = gy * G; return x > 16 && y > 16 && x < 1520 && y < 1264 && !ws.some((q: any) => x + H13 > q.x && x - H13 < q.x + q.w && y + H13 > q.y && y - H13 < q.y + q.h); };
  const k = (x: number, y: number) => y * W + x;
  const sx = Math.round(from[0] * 8), sy = Math.round(from[1] * 8), ex = Math.round(to[0] * 8), ey = Math.round(to[1] * 8);
  if (!free(sx, sy) || !free(ex, ey)) return null;
  const prev = new Map<number, number>([[k(sx, sy), -1]]); const q = [k(sx, sy)];
  for (let i = 0; i < q.length && !prev.has(k(ex, ey)); i++) { const c = q[i], x = c % W, y = Math.floor(c / W);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) { const nx = x + dx, ny = y + dy, n = k(nx, ny);
      if (prev.has(n) || !free(nx, ny) || (dx && dy && (!free(x + dx, y) || !free(x, y + dy)))) continue; prev.set(n, c); q.push(n); } }
  if (!prev.has(k(ex, ey))) return null;
  const pts: number[][] = []; for (let c = k(ex, ey); c !== -1; c = prev.get(c)!) pts.unshift([c % W, Math.floor(c / W)]);
  const turns: number[][] = [];
  for (let i = 1; i < pts.length; i++) { const p = pts[i], n = pts[i + 1], pr = pts[i - 1]; if (!n || n[0] - p[0] !== p[0] - pr[0] || n[1] - p[1] !== p[1] - pr[1]) turns.push([p[0] / 8, p[1] / 8]); }
  return turns;
}
const ARRIVE = [[38.5, 15.5], [29.5, 7.5], [5.5, 13.5], [18.5, 28.5]];
const NEXT = [[36.5, 7.5], [22.5, 6.5], [5.5, 22.5], [27.5, 29.5]];
const out: any = {};
for (let i = 0; i < 4; i++) {
  const st = pondStations[i]; let sieg = ARRIVE[i]; const steps: any[] = [];
  for (const [phase, from, target] of [["solve", st.rest, st.angle], ["rest", st.angle, st.rest]] as const) {
    let angle = normalizeMirrorAngle(from);
    for (let leg = 0; leg < 6 && Math.abs(half(target - angle)) > 1e-7; leg++) {
      const ws = wallsAt(i, angle);
      let best: any;
      for (let ty = -8; ty <= 8; ty++) for (let tx = -8; tx <= 8; tx++) {
        const x = st.x / 32 + tx * 0.5, y = st.y / 32 + ty * 0.5;
        if (Math.hypot(x - st.x / 32, y - st.y / 32) > 3.2) continue;
        const { w, s } = room(i, angle); const pond = mirrorPondState(w.puzzles)!;
        s.x = x * 32; s.y = y * 32; s.facing = Math.atan2(st.y - s.y, st.x - s.x);
        const before = Math.abs(half(target - pond.mirrors[i])); let n = 0, bad = false;
        while (n < 200 && Math.abs(half(target - pond.mirrors[i])) > 1e-7) { const pr = Math.abs(half(target - pond.mirrors[i])); if (!pushPondMirror(w, s)) break; if (Math.abs(half(target - pond.mirrors[i])) > pr + 1e-9) { bad = true; break; } n++; }
        if (bad || !n) continue;
        const rem = Math.abs(half(target - pond.mirrors[i]));
        if (rem >= before - 1e-9) continue;
        if (best && !(rem < best.rem - 1e-9 || (Math.abs(rem - best.rem) < 1e-9 && n < best.n))) continue;
        const path = finePath(ws, sieg, [x, y]); if (!path) continue;
        best = { x, y, n, a: pond.mirrors[i], rem, path };
      }
      if (!best) { steps.push({ phase, stuck: deg(angle) }); break; }
      steps.push({ phase, walk: best.path, push: best.n, to: deg(best.a) }); sieg = [best.x, best.y]; angle = best.a;
    }
  }
  const leave = finePath(wallsAt(i, st.rest), sieg, NEXT[i]);
  steps.push({ phase: "leave", walk: leave ?? "NO PATH" });
  out[`M${i + 1}`] = steps;
  console.log(`M${i + 1}:`, JSON.stringify(steps));
}
