import { createApp } from "./app.js";
const game = createApp();
game.http.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log("Oath & Ember server: http://localhost:3000"),
);
