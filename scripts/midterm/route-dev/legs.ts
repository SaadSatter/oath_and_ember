// DEVELOPMENT TOOL (not part of any route or player). It reads and sets engine state
// directly to plan the scripted route's constants offline. See docs/midterm/ROUTE_LOG.md.
// Run from the repository root: node --import tsx scripts/midterm/route-dev/legs.ts ...
// Offline development tool: BFS over static collision to get waypoint turn points.
import { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
const scene = process.argv[2] as any;
const legs: [number, number, number, number][] = JSON.parse(process.argv[3]);
const r = new GameRoom("DEV001", false, scene); const a = r.add("a"), b = r.add("b");
r.select(a.playerId, "OATH"); r.select(b.playerId, "EMBER"); r.ready(a.playerId, true); r.ready(b.playerId, true);
const w = r.state;
const stage = process.argv[4] ?? "";
if (scene === "HEDGE_MAZE") { const { hedgeMazeState } = await import("../../../packages/shared/src/hedgeMaze.js"); const m: any = hedgeMazeState(w.puzzles); if (stage.includes("bush")) m.burned = true; if (stage.includes("cow")) { m.cow.parked = true; m.cow.x = 763; m.cow.y = 800; } if (stage.includes("gate") && w.puzzles.hedgeGate) (w.puzzles.hedgeGate as any).complete = true; }
const W = maps[scene].width / 32, H = maps[scene].height / 32;
const walls = collisionRects(scene, w.puzzles);
const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !walls.some((q: any) => (x + .5) * 32 + 14 > q.x && (x + .5) * 32 - 14 < q.x + q.w && (y + .5) * 32 + 14 > q.y && (y + .5) * 32 - 14 < q.y + q.h);
for (const [sx, sy, gx, gy] of legs) {
  const k = (x: number, y: number) => y * W + x; const st = k(Math.floor(sx), Math.floor(sy)), en = k(Math.floor(gx), Math.floor(gy));
  const prev = new Map<number, number>([[st, -1]]); const q = [st];
  for (let i = 0; i < q.length && !prev.has(en); i++) { const c = q[i], x = c % W, y = Math.floor(c / W);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) { const n = k(nx, ny); if (ok(nx, ny) && !prev.has(n)) { prev.set(n, c); q.push(n); } } }
  if (!prev.has(en)) { console.log("NO ROUTE", sx, sy, gx, gy); continue; }
  const path: number[] = []; for (let c = en; c !== st; c = prev.get(c)!) path.unshift(c);
  const pts = path.map((c) => [c % W, Math.floor(c / W)]);
  const turns: number[][] = []; for (let i = 0; i < pts.length; i++) { const p = pts[i], n = pts[i + 1], pr = pts[i - 1];
    if (!n || !pr || (n[0] - p[0]) !== (p[0] - pr[0]) || (n[1] - p[1]) !== (p[1] - pr[1])) turns.push([p[0] + .5, p[1] + .5]); }
  console.log(`[${sx},${sy}]->[${gx},${gy}] len ${pts.length}:`, JSON.stringify(turns));
}
console.log("enemies", JSON.stringify(Object.values(w.enemies).map((e: any) => [e.type, Math.round(e.x / 32 * 10) / 10, Math.round(e.y / 32 * 10) / 10])));
