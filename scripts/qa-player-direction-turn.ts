import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { io } from "socket.io-client";
import { mkdir } from "node:fs/promises";
import { spawnEnemy } from "../packages/shared/src/enemies.js";
const app = createApp({ startingScene: "FOREST_RUINS" });
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
    await page.goto(`${url}/?siegQA=1`);
    pages.push(page);
  }
  for (const page of pages)
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
  await pages[0].waitForTimeout(1500);
  await mkdir("docs/quests/bald-goddess/qa", { recursive: true });
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/direction-turn-entry.png",
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
  room.state.enemies = {};
  place(s, 600, 450);
  place(c, 700, 450);
  await pages[0].waitForTimeout(400);
  for (let actor = 0; actor < 2; actor++) {
    const page = pages[actor],
      id = sessions[actor].playerId;
    await page.keyboard.down("d");
    await page.waitForTimeout(80);
    await page.keyboard.up("d");
    await page.keyboard.down("j");
    await page.waitForTimeout(100);
    for (const [key, walk, cardinal] of [
      ["w", "north", "up"],
      ["a", "west", "left"],
      ["s", "south", "down"],
      ["d", "east", "right"],
    ] as const) {
      const started = Date.now();
      await page.keyboard.down(key);
      const expected = { id, walk, cardinal };
      const matches = ({
        id,
        walk,
        cardinal,
      }: {
        id: string;
        walk: string;
        cardinal: string;
      }) => {
        const v = JSON.parse(
          document.querySelector<HTMLElement>("#game")?.dataset.playerVisuals ||
            "{}",
        )[id];
        return (
          !!v &&
          (v.animation?.endsWith(`walk_${walk}`) ||
            v.animation?.endsWith(`:${cardinal}`) ||
            v.animation?.endsWith(`idle_${cardinal}`))
        );
      };
      await page.waitForFunction(matches, expected, {
        timeout: 1000,
        polling: "raf",
      });
      await pages[1 - actor].waitForFunction(matches, expected, {
        timeout: 1200,
        polling: "raf",
      });
      await page.keyboard.up(key);
      console.log(
        actor === 0 ? "Sieg" : "Coco",
        cardinal,
        "both views updated in",
        Date.now() - started,
        "ms",
      );
      await page.waitForTimeout(60);
    }
    await page.keyboard.up("j");
    await page.screenshot({
      path: `docs/quests/bald-goddess/qa/direction-turn-${actor}.png`,
    });
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Direction-turn browser QA passed for Sieg and Coco in local and remote views while attacking/casting.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
