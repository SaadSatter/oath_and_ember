import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { io } from "socket.io-client";
import { mkdir } from "node:fs/promises";
import {
  mirrorPondState,
  pondStations,
  normalizeMirrorAngle,
} from "../packages/shared/src/mirrorPond.js";
const app = createApp({ startingScene: "MIRROR_POND" });
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
    initialPond = mirrorPondState(room.state.puzzles)!;
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
    path: "docs/quests/bald-goddess/qa/pond-entry.png",
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
  const pond = mirrorPondState(room.state.puzzles)!;
  async function rotate(index: number, target: number) {
    const advance = room.tick.bind(room);
    room.tick = () => {};
    try {
      await pages[0].keyboard.down("1");
      await pages[0].waitForTimeout(120);
      for (
        let n = 0;
        Math.abs(pond.mirrors[index] - target) > 1e-7 && n < 244;
        n++
      ) {
        if (n % 5 === 0) await pages[0].waitForTimeout(120);
        advance();
      }
      if (Math.abs(pond.mirrors[index] - target) > 1e-7)
        throw Error(
          `Rotation stopped or snapped at ${index}: ${pond.mirrors[index]} -> ${target}`,
        );
      await pages[0].keyboard.up("1");
      await pages[0].waitForTimeout(120);
      advance();
    } finally {
      room.tick = advance;
    }
    await pages[0].waitForTimeout(150);
  }
  for (let i = 0; i < 4; i++) {
    const station = pondStations[i];
    const approaches = [
      { x: station.x, y: station.y + 96, f: -Math.PI / 2 },
      { x: station.x + 96, y: station.y, f: Math.PI },
      { x: station.x, y: station.y - 96, f: Math.PI / 2 },
      { x: station.x - 96, y: station.y, f: 0 },
    ];
    const approach = approaches[i];
    place(s, approach.x, approach.y, approach.f);
    place(
      c,
      station.shot.x,
      station.shot.y,
      Math.atan2(station.incoming.y, station.incoming.x),
    );
    await pages[0].waitForTimeout(350);
    await rotate(i, normalizeMirrorAngle(station.angle));
    await pages[1].keyboard.press("j", { delay: 120 });
    await pages[1].waitForFunction(
      (count) =>
        document
          .querySelector("#objective")
          ?.textContent?.includes(
            count === 4 ? "sanctuary" : `${count}/4 torches`,
          ),
      i + 1,
      { timeout: 6000 },
    );
    if (!pond.torches[i]) throw Error(`Torch ${i + 1} did not ignite`);
    await pages[1].screenshot({
      path: `docs/quests/bald-goddess/qa/pond-torch-${i + 1}.png`,
    });
    await rotate(i, station.rest);
  }
  place(c, 24 * 32, 19.5 * 32);
  await pages[1].waitForTimeout(400);
  await pages[1].keyboard.press("e", { delay: 120 });
  await pages[1].waitForTimeout(400);
  if (room.state.inventory?.counts.vanity_mirror !== 1)
    throw Error("Shared mirror not awarded");
  await pages[1].screenshot({
    path: "docs/quests/bald-goddess/qa/pond-sanctuary.png",
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Pond browser QA passed: two clients, four real held-Push rotations/Fireball reflections/restore sequences, center rises, shared mirror awarded. Camera placement fixtures only.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
