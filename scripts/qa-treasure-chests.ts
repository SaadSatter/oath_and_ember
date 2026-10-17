import { chromium } from "@playwright/test";
import { io } from "socket.io-client";
import { mkdir, writeFile } from "node:fs/promises";
import { createApp } from "../apps/server/src/app.js";
import {
  mirrorPondState,
  pondChest,
} from "../packages/shared/src/mirrorPond.js";
import { hedgeMazeState } from "../packages/shared/src/hedgeMaze.js";
import { ensureHedgeMaze } from "../apps/server/src/hedgeMaze.js";

// Server-only fixtures exercise the real shared claim path in two browsers.
const app = createApp({ startingScene: "MIRROR_POND" });
await new Promise<void>((resolve) => app.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
const sockets = [io(url), io(url)];
const req = (i: number, event: string, data: unknown) =>
  new Promise<any>((resolve, reject) =>
    sockets[i]
      .timeout(3000)
      .emit(event, data, (error: Error, result: any) =>
        error
          ? reject(error)
          : result.ok
            ? resolve(result.data)
            : reject(Error(result.error)),
      ),
  );
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const output = "qa/treasure-chests";
try {
  await mkdir(output, { recursive: true });
  await Promise.all(
    sockets.map(
      (socket) => new Promise<void>((resolve) => socket.on("connect", resolve)),
    ),
  );
  const sessions = [await req(0, "room:create", {})];
  sessions.push(await req(1, "room:join", { roomCode: sessions[0].roomCode }));
  await req(0, "role:select", { role: "OATH" });
  await req(1, "role:select", { role: "EMBER" });
  await req(0, "lobby:ready", { ready: true });
  await req(1, "lobby:ready", { ready: true });
  const room = app.manager.get(sessions[0].roomCode);
  const pond = mirrorPondState(room.state.puzzles)!;
  pond.raised = true;
  pond.torches = [true, true, true, true];
  sockets.forEach((socket) => socket.disconnect());
  browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const errors: string[] = [];
  const pages = [];
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
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(url);
    pages.push(page);
  }
  for (const page of pages)
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
  const place = (
    sceneId: "MIRROR_POND" | "HEDGE_MAZE",
    x: number,
    y: number,
  ) => {
    for (const [i, session] of sessions.entries()) {
      const p = room.state.players[session.playerId];
      Object.assign(p, {
        sceneId,
        x: x + i * 44,
        y: y + 40,
        vx: 0,
        vy: 0,
        movementEpoch: (p.movementEpoch ?? 0) + 1,
      });
    }
    room.state.worldRevision++;
    room.state.enemies = {};
  };
  for (const chest of [
    {
      scene: "MIRROR_POND" as const,
      id: "pond-vanity-mirror-chest",
      ...pondChest,
      item: "vanity_mirror" as const,
    },
    {
      scene: "HEDGE_MAZE" as const,
      id: "hedge-shears-chest",
      x: 44 * 32,
      y: 5 * 32,
      item: "enchanted_shears" as const,
    },
  ]) {
    if (chest.scene === "HEDGE_MAZE") ensureHedgeMaze(room.state, room.inventory);
    place(chest.scene, chest.x, chest.y);
    await pages[0].waitForTimeout(1200);
    if (chest.scene === "HEDGE_MAZE") {
      hedgeMazeState(room.state.puzzles)!.runner.caught = true;
      room.state.puzzles.hedgeGate.complete = true;
    }
    await pages[0].screenshot({ path: `${output}/${chest.item}-closed.png` });
    room.useItem(sessions[0].playerId, {
      requestId: `qa-${chest.item}`,
      targetId: chest.id,
    });
    await pages[0].waitForTimeout(350);
    await pages[0].screenshot({ path: `${output}/${chest.item}-opening.png` });
    await pages[0].waitForTimeout(650);
    await Promise.all(
      pages.map((page, i) =>
        page.screenshot({
          path: `${output}/${chest.item}-reward-client-${i}.png`,
        }),
      ),
    );
    await pages[0].waitForTimeout(1600);
    await pages[0].screenshot({ path: `${output}/${chest.item}-open.png` });
    if (room.state.inventory!.counts[chest.item] !== 1)
      throw Error(`Incorrect shared reward: ${chest.item}`);
    await pages[0].reload();
    await pages[0].waitForTimeout(1600);
    await pages[0].screenshot({ path: `${output}/${chest.item}-rejoined.png` });
  }
  if (errors.length) throw Error(errors.join("\n"));
  await writeFile(
    `${output}/result.json`,
    JSON.stringify(
      {
        errors,
        claims: room.state.inventory?.claimed,
        counts: room.state.inventory?.counts,
        checks:
          "two observers; both chests; opening, rising reward, final open and rejoin screenshots",
      },
      null,
      2,
    ),
  );
  console.log(`Treasure QA passed: ${output}`);
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
