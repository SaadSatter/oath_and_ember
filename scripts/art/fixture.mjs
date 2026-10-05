// Local-only server fixture; static root is isolated by the process cwd.
import { createApp } from "../../dist/apps/server/src/app.js";
const game = createApp();
let mode = "idle";
const seeded = new Set();
const history = [];
game.app.get("/__art/history", (_req, res) => res.json(history));
game.app.get("/__art/state", (_req, res) =>
  res.json([...game.manager.rooms.values()].map((r) => r.state)),
);
game.app.post("/__art/phase/:phase", (req, res) => {
  mode = req.params.phase;
  res.json({ mode });
});
const timer = setInterval(() => {
  for (const room of game.manager.rooms.values()) {
    if (room.state.phase !== "PLAYING" || seeded.has(room.state.roomCode))
      continue;
    for (const p of Object.values(room.state.players)) {
      p.skillPoints = 2;
      room.unlock(p.id, p.role === "EMBER" ? "ward" : "guard");
    }
    room.state.enemies = {};
    const tick = room.tick.bind(room);
    room.tick = () => {
      for (const s of room.sessions.values()) {
        s.input.secondaryHeld = mode === "held";
        s.input.primaryHeld = mode === "projectile";
        s.received = Date.now();
      }
      tick();
      history.push({roomCode: room.state.roomCode, serverTick: room.state.serverTick,
        players: Object.values(room.state.players).filter(p => p.role === "EMBER").map(p => ({id: p.id, actionState: p.actionState, combat: p.combat ?? null, hp: p.hp}))});
      if (history.length > 10000) history.shift();
    };
    seeded.add(room.state.roomCode);
  }
}, 20);
game.http.listen(Number(process.env.ART_QA_PORT) || 3015, "127.0.0.1");
async function close() {
  clearInterval(timer);
  await game.close();
  process.exit();
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
