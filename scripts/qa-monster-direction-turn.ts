import {
  spawnEnemy,
  enemyDefinitions,
} from "../packages/shared/src/enemies.js";
import { enemyVisuals } from "../apps/client/src/assets/enemyVisuals.js";
import { externalDirection } from "../apps/client/src/assets/externalAnimationFrames.js";
import { enemyDirection } from "../apps/client/src/animation/EnemyPresentation.js";
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
  const at = room.state.enemies["maze-sentinel"];
  place(s, at.x + 70, at.y + 85);
  place(c, at.x + 100, at.y + 90);
  room.tick = () => {};
  room.state.enemies = {};
  async function present() {
    room.state.serverTick += 3;
    app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
    await pages[0].waitForTimeout(250);
  }
  for (const type of [
    "mossling",
    "cinder_wisp",
    "ironbound_sentinel",
  ] as const) {
    const e = spawnEnemy(type, type, at.x, at.y),
      visual = enemyVisuals.find(
        (v) => v.asset_id === enemyDefinitions[type].sprite,
      )!;
    room.state.enemies = { [e.id]: e };
    for (let n = 0; n < visual.directions.length; n++) {
      const angle = (n * Math.PI * 2) / visual.directions.length;
      Object.assign(e, {
        facing: 0,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 40,
        state: "CHASE",
      });
      const expected = externalDirection(
        visual,
        enemyDirection(angle, visual.directions.length),
      );
      await present();
      for (const page of pages) {
        const v = JSON.parse(
          (await page.locator("#game").getAttribute("data-enemy-visuals")) ||
            "{}",
        )[e.id];
        if (
          !v?.playing ||
          v.flipX !== expected.flipX ||
          !v.animation?.endsWith(`${visual.motion}_${expected.sourceDirection}`)
        )
          throw Error(`Stale ${type} direction: ${JSON.stringify(v)}`);
      }
    }
    await pages[0].screenshot({
      path: `docs/quests/bald-goddess/qa/monster-turn-${type}.png`,
    });
  }
  const e = room.state.enemies.ironbound_sentinel;
  Object.assign(e, {
    state: "ATTACK",
    vx: 0,
    vy: 0,
    facing: 0,
    attackFacing: 0,
    attackSeq: 1,
    attackKind: "beam",
    attackStartedTick: room.state.serverTick,
  });
  await present();
  e.y -= 16;
  await present();
  for (const page of pages) {
    const v = JSON.parse(
      (await page.locator("#game").getAttribute("data-enemy-visuals")) || "{}",
    )[e.id];
    if (v.charging || !v.animation?.endsWith("walk_north"))
      throw Error("Golem charge stayed locked while displaced");
  }
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/monster-displaced-golem.png",
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "All-monster direction QA passed in two clients: immediate turns with stale facing, native/aliased directions, interrupted displaced golem charge.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
