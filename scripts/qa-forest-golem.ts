import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { io } from "socket.io-client";
import { mkdir } from "node:fs/promises";
import { hedgeMazeState } from "../packages/shared/src/hedgeMaze.js";
const app = createApp({ startingScene: "HEDGE_MAZE" });
await new Promise<void>((resolve) => app.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`,
  sockets = [io(url), io(url)];
const req = (i: number, event: string, p: unknown) =>
  new Promise<any>((resolve, reject) =>
    sockets[i]
      .timeout(3000)
      .emit(event, p, (error: Error, result: any) =>
        error
          ? reject(error)
          : result.ok
            ? resolve(result.data)
            : reject(Error(result.error)),
      ),
  );
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await Promise.all(
    sockets.map(
      (s) => new Promise<void>((resolve) => s.on("connect", resolve)),
    ),
  );
  const sessions = [await req(0, "room:create", {})];
  sessions.push(await req(1, "room:join", { roomCode: sessions[0].roomCode }));
  await req(0, "role:select", { role: "OATH" });
  await req(1, "role:select", { role: "EMBER" });
  await req(0, "lobby:ready", { ready: true });
  await req(1, "lobby:ready", { ready: true });
  const room = app.manager.get(sessions[0].roomCode),
    maze = hedgeMazeState(room.state.puzzles)!;
  sockets.forEach((s) => s.disconnect());
  browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const pages = [];
  const errors: string[] = [];
  for (const session of sessions) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(
      (s) => sessionStorage.setItem("oath-session", JSON.stringify(s)),
      session,
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${url}/?enemyQA=1`);
    pages.push(page);
  }
  for (const page of pages)
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
  await pages[0].waitForTimeout(1500);
  await mkdir("docs/quests/bald-goddess/qa", { recursive: true });
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/golem-entry.png",
  });
  // Server-side camera fixtures only. Puzzle states below are changed by real keyboard casts.
  const s = room.state.players[sessions[0].playerId],
    c = room.state.players[sessions[1].playerId];
  function place(player: typeof s, x: number, y: number, facing = 0) {
    Object.assign(player, {
      x,
      y,
      facing,
      movementEpoch: (player.movementEpoch ?? 0) + 1,
    });
    room.state.worldRevision++;
  }
  const golem = room.state.enemies["maze-sentinel"];
  if (!golem) throw Error("Missing maze sentinel");
  place(s, golem.x + 70, golem.y + 85);
  place(c, golem.x + 100, golem.y + 90);
  room.tick = () => {}; // Isolate presentation fixtures; gameplay behavior remains unchanged.
  const samples = [];
  for (let n = 0; n < 8; n++) {
    const angle = (n * Math.PI) / 4;
    Object.assign(golem, {
      facing: angle,
      vx: Math.cos(angle) * 45,
      vy: Math.sin(angle) * 45,
      state: "CHASE",
    });
    room.state.serverTick += 3;
    app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
    await pages[0].waitForTimeout(450);
    for (let i = 0; i < 2; i++) {
      const visuals = await pages[i]
        .locator("#game")
        .getAttribute("data-enemy-visuals");
      const v = JSON.parse(visuals || "{}")[golem.id];
      if (
        !v?.playing ||
        v.flipX ||
        v.frame % 9 === 0 ||
        !v.animation.endsWith(
          `walk_${["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][n]}`,
        )
      )
        throw Error(
          `Missing native golem walking animation: ${JSON.stringify(v)}`,
        );
      samples.push({ client: i, direction: n, ...v });
    }
    await pages[0].screenshot({
      path: `docs/quests/bald-goddess/qa/golem-direction-${n}.png`,
    });
  }
  Object.assign(golem, { vx: 0, vy: 0, state: "IDLE", facing: Math.PI / 2 });
  room.state.serverTick += 3;
  app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
  await pages[0].waitForTimeout(400);
  const idle = JSON.parse(
    (await pages[0].locator("#game").getAttribute("data-enemy-visuals")) ||
      "{}",
  )[golem.id];
  if (idle.playing || idle.frame !== 0)
    throw Error(`Incorrect golem idle pose: ${JSON.stringify(idle)}`);
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/golem-idle.png",
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Golem presentation QA passed in two clients: all 8 native walking directions, dedicated idle, no flipped alias.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
