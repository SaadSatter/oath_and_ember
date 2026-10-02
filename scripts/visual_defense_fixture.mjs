// Local-only art QA fixture; production gameplay is unchanged.
import { createApp } from "../dist/apps/server/src/app.js";
const game = createApp();
const seeded = new Set();
const timer = setInterval(() => {
  for (const room of game.manager.rooms.values()) {
    if (room.state.phase !== "PLAYING" || seeded.has(room.state.roomCode))
      continue;
    for (const p of Object.values(room.state.players)) {
      p.skillPoints = 2;
      room.unlock(p.id, p.role === "OATH" ? "guard" : "ward");
    }
    room.state.enemies = {};
    const tick = room.tick.bind(room);
    room.tick = () => {
      const phase = room.state.serverTick % 300;
      for (const session of room.sessions.values()) {
        session.input.secondaryHeld = phase < 240;
        session.received = Date.now();
      }
      tick();
      if (phase === 100)
        for (const p of Object.values(room.state.players)) room.damage(p, 4);
    };
    seeded.add(room.state.roomCode);
  }
}, 50);
game.http.listen(3005, "127.0.0.1", () =>
  console.log("Defense QA http://localhost:3005/?touch=1"),
);
process.once("SIGINT", async () => {
  clearInterval(timer);
  await game.close();
});
