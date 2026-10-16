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
    await page.goto(`${url}/?griffinQA=1`);
    pages.push(page);
  }
  for (const page of pages)
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
  await pages[0].waitForFunction(
    () => !!document.querySelector<HTMLElement>("#game")!.dataset.griffinVisual,
  );
  await mkdir("docs/quests/bald-goddess/qa", { recursive: true });
  const s = room.state.players[sessions[0].playerId],
    c = room.state.players[sessions[1].playerId],
    g = griffinState(room.state.puzzles)!;
  // Isolated encounter fixtures; actual attacks and hit resolution still run on the server.
  Object.assign(s, {
    x: 800,
    y: 459,
    hp: 100,
    movementEpoch: (s.movementEpoch ?? 0) + 1,
  });
  Object.assign(c, {
    x: 900,
    y: 459,
    hp: 100,
    movementEpoch: (c.movementEpoch ?? 0) + 1,
  });
  Object.assign(g, {
    x: 640,
    y: 500,
    facing: 0,
    grounded: 10,
    phase: "BEAM_CHARGE",
    timer: 1.2,
    cooldown: 5,
    attackHits: [],
  });
  room.state.worldRevision++;
  await pages[0].waitForFunction(
    () =>
      JSON.parse(
        document.querySelector<HTMLElement>("#game")!.dataset.griffinVisual ??
          "{}",
      ).charge === true,
  );
  await pages[0].waitForTimeout(250);
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-mouth-charge.png",
  });
  await pages[0].waitForFunction(
    () =>
      JSON.parse(
        document.querySelector<HTMLElement>("#game")!.dataset.griffinVisual ??
          "{}",
      ).beam === true,
  );
  const visual = await pages[0].evaluate(() =>
    JSON.parse(
      document.querySelector<HTMLElement>("#game")!.dataset.griffinVisual!,
    ),
  );
  if (visual.pose !== "griffin:mouth" || visual.impact)
    throw Error("Missing mouth beam artwork");
  if (g.beam?.contactId !== `player:${s.id}` || s.hp !== 74 || c.hp !== 100)
    throw Error("Beam did not stop at the front player");
  const sampled = await pages[0].evaluate(async () => {
    const values = {
      start: [] as unknown[],
      middle: [] as unknown[],
      tip: [] as unknown[],
    };
    for (let i = 0; i < 36; i++) {
      const v = JSON.parse(
        document.querySelector<HTMLElement>("#game")!.dataset.griffinVisual!,
      );
      if (v.beam) {
        values.start.push(v.startFrame);
        values.middle.push(v.beamFrame);
        values.tip.push(v.tipFrame);
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return values;
  });
  for (const [name, frames] of Object.entries(sampled))
    if (new Set(frames).size < 2)
      throw Error(`${name} frames did not cycle: ${JSON.stringify(frames)}`);
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-mouth-beam.png",
  });
  await pages[0].waitForFunction(
    () =>
      !JSON.parse(
        document.querySelector<HTMLElement>("#game")!.dataset.griffinVisual!,
      ).beam,
  );
  if (s.hp !== 74 || c.hp !== 100)
    throw Error("Looping beam duplicated damage or penetrated first player");
  const finished = await pages[0].evaluate(() =>
    JSON.parse(
      document.querySelector<HTMLElement>("#game")!.dataset.griffinVisual!,
    ),
  );
  if (finished.impact) throw Error("Griffin ground explosion was not removed");
  Object.assign(s, {
    x: 960,
    y: 600,
    movementEpoch: (s.movementEpoch ?? 0) + 1,
  });
  Object.assign(c, {
    x: 1120,
    y: 600,
    movementEpoch: (c.movementEpoch ?? 0) + 1,
  });
  Object.assign(g, {
    x: 880,
    y: 500,
    facing: 0,
    phase: "BEAM",
    timer: 2,
    grounded: 10,
    attackHits: [],
  });
  delete g.beam;
  delete g.beamStarted;
  room.state.worldRevision++;
  await pages[1].waitForTimeout(350);
  if (!g.beam?.contactId.startsWith("solid:"))
    throw Error("Long beam did not end at a wall");
  await pages[1].screenshot({
    path: "docs/quests/bald-goddess/qa/griffin-mouth-beam-wall.png",
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Mouth beam browser QA passed: two clients, charge, pose, continuous animated segments, nearest player impact and no repeated damage.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
