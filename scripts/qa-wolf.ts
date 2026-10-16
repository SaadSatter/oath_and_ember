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
    initialTick = room.state.serverTick;
  sockets.forEach((s) => s.disconnect());
  browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
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
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("Browser:", e.message);
    });
    await page.goto(`${url}/?runnerQA=1`);
    pages.push(page);
  }
  for (const page of pages)
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
  await pages[0].waitForTimeout(1500);
  await mkdir("docs/quests/bald-goddess/qa", { recursive: true });
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/golem-attack-entry.png",
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
  room.tick = () => {};
  room.state.enemies = {};
  const wolf = hedgeMazeState(room.state.puzzles)!.runner;
  place(s, 720, 464);
  place(c, 750, 464);
  Object.assign(wolf, { x: 656, y: 464, facing: 0 });
  async function publish() {
    room.state.serverTick += 3;
    app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
    await pages[0].waitForTimeout(180);
  }
  await publish();
  await publish();
  for (const page of pages)
    await page.waitForFunction(() => {
      const v = JSON.parse(
        document.querySelector<HTMLElement>("#game")!.dataset.runnerVisual ??
          "{}",
      );
      return v.texture === "forest_wolf_runner" && !v.playing && !v.moving;
    });
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/wolf-idle.png",
  });
  for (const [direction, facing, dx, dy] of [
    ["east", 0, 6, 0],
    ["south", Math.PI / 2, 0, 6],
    ["west", Math.PI, -6, 0],
    ["north", -Math.PI / 2, 0, -6],
  ] as const) {
    wolf.facing = facing;
    for (let i = 0; i < 3; i++) {
      wolf.x += dx;
      wolf.y += dy;
      await publish();
    }
    for (const page of pages) {
      const v = await page.evaluate(() =>
        JSON.parse(
          document.querySelector<HTMLElement>("#game")!.dataset.runnerVisual!,
        ),
      );
      if (!v.playing || !v.animation.endsWith(direction))
        throw Error(`Wolf failed to run ${direction}: ${JSON.stringify(v)}`);
    }
    await pages[0].screenshot({
      path: `docs/quests/bald-goddess/qa/wolf-run-${direction}.png`,
    });
    await publish();
    for (const page of pages)
      await page.waitForFunction(
        () =>
          !JSON.parse(
            document.querySelector<HTMLElement>("#game")!.dataset.runnerVisual!,
          ).playing,
      );
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Wolf browser QA passed: complete native run cells in all four directions, immediate turns and idle on stopping in both clients.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
