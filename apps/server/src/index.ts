import { createApp } from "./app.js";
const game = createApp({ encounter: process.env.ENEMY_ENCOUNTER === "1" });
game.http.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log(
    `Oath & Ember server: http://localhost:${Number(process.env.PORT) || 3000}`,
  ),
);
