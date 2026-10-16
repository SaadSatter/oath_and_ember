import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { io } from "socket.io-client";
import { mkdir } from "node:fs/promises";
import {
  griffinState,
  griffinNest,
  GRIFFIN_NEST,
} from "../packages/shared/src/griffin.js";
const app = createApp({ startingScene: "GRIFFIN_ENCLOSURE" });
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
    timeout: 30000,
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
  const s = room.state.players[sessions[0].playerId],
    c = room.state.players[sessions[1].playerId],
    g = griffinState(room.state.puzzles)!;
  const advance = room.tick.bind(room);
  room.tick = () => {};
  Object.assign(s, {
    x: 592,
    y: 300,
    movementEpoch: (s.movementEpoch ?? 0) + 1,
  });
  Object.assign(c, {
    x: 688,
    y: 300,
    movementEpoch: (c.movementEpoch ?? 0) + 1,
  });
  async function render() {
    room.state.serverTick += 3;
    room.state.worldRevision++;
    app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
    await pages[0].waitForTimeout(200);
    app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
    await pages[0].waitForTimeout(300);
  }
  await render();
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-sleeping-nest.png",
  });
  for (let n = 0; n < 15; n++) advance();
  if (g.phase !== "WAKING") throw Error("Griffin failed to wake");
  await render();
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-waking.png",
  });
  for (let n = 0; n < 20; n++) advance();
  if (g.phase === "WAKING" || g.phase === "NEST")
    throw Error("Griffin failed to stand up");
  Object.assign(g, {
    phase: "DEFEATED",
    hp: 0,
    facing: Math.PI,
    x: 640,
    y: 200,
  });
  await render();
  await pages[1].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-defeated-sleep-west.png",
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Griffin sleep browser QA passed: two clients, nest sleep, timed wake-up, directional defeat. Isolated camera fixtures.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
