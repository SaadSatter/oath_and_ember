import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { io } from "socket.io-client";
import { mkdir } from "node:fs/promises";
import { shrinePoints, shrineComplete } from "../packages/shared/src/shrine.js";
const app = createApp({ startingScene: "GODDESS_SHRINE" });
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
    path: "docs/quests/bald-goddess/qa/shrine-entry.png",
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
  place(s, 608, 580);
  place(c, 688, 580);
  await pages[0].waitForTimeout(450);
  await pages[0].keyboard.press("e", { delay: 120 });
  await pages[0].waitForFunction(() =>
    document.querySelector("#notice")?.textContent?.includes("crown"),
  );
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/shrine-crying-clue.png",
  });
  // Isolate offering presentation with the future Griffin reward fixture.
  room.state.inventory!.counts.enchanted_shears = 1;
  room.state.inventory!.counts.griffin_wig = 1;
  room.state.inventory!.revision++;
  await pages[0].waitForTimeout(200);
  await pages[0].keyboard.press("i");
  await pages[0].locator('[data-item="enchanted_shears"]').click();
  await pages[0].locator("[data-use]").click();
  await pages[0].waitForFunction(() =>
    document.querySelector("#notice")?.textContent?.includes("trim"),
  );
  if (room.state.inventory!.counts.enchanted_shears !== 1)
    throw Error("Wrong offering consumed tool");
  await pages[0].locator('[data-item="griffin_wig"]').click();
  await pages[0].locator("[data-use]").click();
  for (const page of pages)
    await page.waitForFunction(() =>
      document
        .querySelector("#objective")
        ?.textContent?.includes("Quest complete"),
    );
  await pages[0].locator("[data-close]").click();
  await pages[0].waitForTimeout(250);
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/shrine-happy.png",
  });
  if (
    !shrineComplete(room.state) ||
    room.state.inventory!.counts.griffin_wig !== 0
  )
    throw Error("Offering not synchronized");
  for (const [point, destination] of [
    [shrinePoints.west, "MIRROR_POND"],
    [shrinePoints.east, "HEDGE_MAZE"],
  ] as const) {
    place(s, point.x, point.y);
    await pages[0].waitForTimeout(1150);
    await pages[0].keyboard.press("e", { delay: 120 });
    await pages[0].waitForFunction(
      (dest) =>
        document.querySelector<HTMLElement>("#game")?.dataset.scene === dest,
      destination,
    );
    room.transition("GODDESS_SHRINE", true);
    await pages[0].waitForTimeout(400);
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Shrine browser QA passed: two clients, real E dialogue, wrong offering preserved, inventory wig acceptance and happy statue, both puzzle entrances.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
