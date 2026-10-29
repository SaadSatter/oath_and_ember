// DEVELOPMENT TOOL (not part of any route or player). It reads and sets engine state
// directly to plan the scripted route's constants offline. See docs/midterm/ROUTE_LOG.md.
// Run from the repository root: node --import tsx scripts/midterm/route-dev/pond-map.ts ...
import { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { collisionRects } from "../../../packages/shared/src/maps.js";
const r = new GameRoom("DEV002", false, "MIRROR_POND"); const a = r.add("a"), b = r.add("b");
r.select(a.playerId, "OATH"); r.select(b.playerId, "EMBER"); r.ready(a.playerId, true); r.ready(b.playerId, true);
const w = r.state;
for (const body of [14, 10]) {
  const walls = collisionRects("MIRROR_POND", w.puzzles, undefined, undefined, w.players, w.serverTick, "OATH");
  console.log("body", body);
  for (let y = 0; y < 40; y++) { let line = String(y).padStart(2) + " ";
    for (let x = 0; x < 48; x++) { const hit = walls.filter((q: any) => (x + .5) * 32 + body > q.x && (x + .5) * 32 - body < q.x + q.w && (y + .5) * 32 + body > q.y && (y + .5) * 32 - body < q.y + q.h);
      line += !hit.length ? "." : hit.every((q: any) => q.terrain) ? "~" : "#"; }
    console.log(line); }
}
