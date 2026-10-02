// Local visual QA only; not used by npm start or bundled into the game.
// Server fixture grants the existing skills to avoid replaying puzzles for each art check.
import { createApp } from "../dist/apps/server/src/app.js";
const game = createApp();
const seeded = new Set();
const fixtureTimer = setInterval(() => {
  for (const room of game.manager.rooms.values()) {
    if (room.state.phase !== "PLAYING" || seeded.has(room.state.roomCode))
      continue;
    for (const player of Object.values(room.state.players)) {
      if (player.role !== "OATH") continue;
      player.skillPoints = 2;
      room.unlock(player.id, "guard");
      room.unlock(player.id, "heavy");
    }
    seeded.add(room.state.roomCode);
  }
}, 50);
const port = Number(process.env.COMBAT_QA_PORT) || 3004;
game.http.listen(port, "127.0.0.1", () =>
  console.log(`Combat visual QA: http://localhost:${port}/?touch=1`),
);
process.once("SIGINT", async () => {
  clearInterval(fixtureTimer);
  await game.close();
});
