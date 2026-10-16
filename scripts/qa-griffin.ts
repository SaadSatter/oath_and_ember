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
  // Isolated camera/combat fixtures for artwork QA; intent-driven traversal is tested separately.
  function place(p: typeof s, x: number, y: number) {
    Object.assign(p, { x, y, movementEpoch: (p.movementEpoch ?? 0) + 1 });
    room.state.worldRevision++;
  }
  place(s, 640, 492);
  place(c, 688, 492);
  Object.assign(g, { x: 640, y: 312, cooldown: 5, phase: "FLY" });
  await pages[0].waitForTimeout(400);
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-shore.png",
  });
  // Bait the actual AI attack, rather than forcing a completed pillar trial.
  place(s, 384, 720);
  place(c, 600, 720);
  Object.assign(g, {
    x: 384,
    y: 440,
    phase: "LAND",
    grounded: 10,
    cooldown: 0,
    stationary: 2,
    lastSiegX: 384,
    lastSiegY: 720,
  });
  await pages[0].waitForTimeout(300);
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-headbutt-warning.png",
  });
  place(s, 500, 720);
  await pages[0].waitForTimeout(800);
  if (!g.pillars[0] || g.phase !== "STUNNED")
    throw Error("Griffin failed to collapse pillar and stun");
  place(c, 430, 560);
  await pages[1].waitForTimeout(200);
  await pages[1].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-pillar-stun.png",
  });
  place(c, griffinNest.x, griffinNest.y + 32);
  room.state.inventory!.counts = { vanity_mirror: 1, enchanted_shears: 1 };
  room.state.inventory!.revision++;
  await pages[1].waitForTimeout(300);
  await pages[1].keyboard.press("i");
  await pages[1].locator('[data-item="vanity_mirror"]').click();
  await pages[1].locator("[data-use]").click();
  await pages[1].waitForFunction(() =>
    document.querySelector("#notice")?.textContent?.includes("admires"),
  );
  if (g.phase !== "GROOMING") throw Error("Mirror failed to start grooming");
  await pages[1].locator('[data-item="enchanted_shears"]').click();
  await pages[1].locator("[data-use]").click();
  await pages[1].locator("[data-close]").click();
  for (const page of pages)
    await page.waitForFunction(() =>
      document
        .querySelector("#objective")
        ?.textContent?.includes("Griffin Wig acquired"),
    );
  await pages[1].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-nest-reward.png",
  });
  if (room.state.inventory!.counts.griffin_wig !== 1)
    throw Error("Invalid shared reward");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Griffin browser QA passed: two clients, supplied artwork, actual headbutt/pillar stun, inventory mirror/shears delivery and shared wig.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
