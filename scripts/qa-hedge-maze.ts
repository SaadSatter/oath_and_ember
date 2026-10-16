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
    await page.goto(url);
    pages.push(page);
  }
  for (const page of pages)
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
  await pages[0].waitForTimeout(1500);
  await mkdir("docs/quests/bald-goddess/qa", { recursive: true });
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/maze-entry.png",
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
  // Remove guards to isolate browser puzzle interaction; combat/spawns have separate tests.
  room.state.enemies = {};
  place(c, 17 * 32, 34 * 32);
  place(s, 15 * 32, 34 * 32);
  await pages[1].waitForTimeout(300);
  await pages[1].keyboard.press("j");
  await pages[1].waitForFunction(
    () =>
      document.querySelector("#objective")?.textContent?.includes("side bay"),
    undefined,
    { timeout: 5000 },
  );
  if (!maze.burned) throw Error("Fireball did not burn bush");
  place(c, 20.5 * 32, 25 * 32);
  place(s, 27 * 32, 30 * 32);
  await pages[1].waitForTimeout(300);
  await pages[1].screenshot({
    path: "docs/quests/bald-goddess/qa/maze-cow-before.png",
  });
  await pages[1].keyboard.press("g");
  await pages[1].waitForFunction(
    () =>
      document
        .querySelector("#objective")
        ?.textContent?.includes("chase the fleeing"),
    undefined,
    { timeout: 7000 },
  );
  if (!maze.cow.parked) throw Error("Cow did not park");
  await pages[1].screenshot({
    path: "docs/quests/bald-goddess/qa/maze-cow-parked.png",
  });
  place(s, 28 * 32, 14 * 32);
  place(c, 32 * 32, 18 * 32);
  await pages[0].waitForTimeout(300);
  await pages[1].keyboard.press("t");
  await pages[0].keyboard.press("2");
  await pages[0].waitForTimeout(300);
  if (!room.state.slowTime || !s.sprintRemaining)
    throw Error("Ability interaction failed");
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/maze-chase.png",
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Maze browser QA passed: two clients, assets/rendering, real fireball burns bush, real Black Hole parks cow, Slow Time + Super Speed activate together. Screenshots saved.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
