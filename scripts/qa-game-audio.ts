import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createApp } from "../apps/server/src/app.js";
import type { GameRoom } from "../apps/server/src/GameRoom.js";
const dir = process.argv[2] ?? "/tmp/oath-game-audio-qa";
await mkdir(dir, { recursive: true });
const app = createApp({ encounter: true });
await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}/?audioQA`;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ viewport: { width: 1280, height: 800 } }),
    ),
  ),
  pages = await Promise.all(contexts.map((c) => c.newPage()));
const errors: string[] = [],
  failed: string[] = [],
  checks: string[] = [];
pages.forEach((p) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.url().includes("/assets/audio/") && !r.ok())
      failed.push(`${r.status()} ${r.url()}`);
  });
});
const info = async (p: any) =>
  p.evaluate(() => (window as any).__audioQA.inspect());
const wait = async (fn: () => boolean) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > 5000) throw Error("Server fixture timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
};
try {
  await Promise.all(pages.map((p) => p.goto(url)));
  const [a, b] = pages;
  await a.locator("#create").click();
  await wait(() => app.manager.rooms.size === 1);
  const room = [...app.manager.rooms.values()][0] as GameRoom;
  await b.locator("#code").fill(room.state.roomCode);
  await b.locator("#join").click();
  await a.locator("#oath").click();
  await b.locator("#ember").click();
  await a.locator("#ready").click();
  await b.locator("#ready").click();
  await a.locator("#inventory-toggle").waitFor({ state: "visible" });
  await b.locator("#inventory-toggle").waitFor({ state: "visible" });
  // The title always starts a story checkpoint. Isolate normal gameplay for this audio-only fixture.
  delete room.state.story;
  room.transition("FOREST_RUINS");
  room.state.enemies = {};
  await new Promise((r) => setTimeout(r, 150));
  for (const p of pages)
    await p.waitForFunction(
      () => (window as any).__audioQA?.inspect().unlocked,
    );
  checks.push(
    "Both real game clients unlock browser audio through UI gestures",
  );
  for (const p of pages)
    await p.evaluate(() => (window as any).__audioQA.clear());
  await a.keyboard.down("j");
  await a.waitForTimeout(100);
  await a.keyboard.up("j");
  for (const p of pages)
    await p.waitForFunction(() =>
      (window as any).__audioQA
        .inspect()
        .events.some((e: any) => e.name === "Sieg normal sword swing"),
    );
  await a.waitForTimeout(180);
  for (const p of pages)
    assert.equal(
      (await info(p)).events.filter(
        (e: any) => e.name === "Sieg normal sword swing",
      ).length,
      1,
    );
  checks.push("One accepted Sieg swing plays once on both clients");
  await b.keyboard.press("3");
  await b.waitForFunction(() =>
    (window as any).__audioQA
      .inspect()
      .events.some((e: any) => e.name === "Coco Black Hole launch"),
  );
  for (const p of pages)
    await p.waitForFunction(
      () => (window as any).__audioQA.inspect().loops > 0,
    );
  checks.push(
    "Black Hole launches distinctly and sustains an observed vortex on both clients",
  );
  await a.locator("#audio-settings summary").click();
  await a.locator("[data-audio-mute]").check();
  await a.waitForTimeout(150);
  assert.equal((await info(a)).muted, true);
  assert.equal((await info(a)).loops, 0);
  await a.reload();
  await a.waitForFunction(
    () => (window as any).__audioQA?.inspect().muted === true,
  );
  checks.push("Mute stops active loops and persists across reload");
  // Isolated presentation fixture: emotional scene must suppress combat/UI noise.
  room.state.story = {
    stage: "FUNERAL_PREP",
    flags: [],
    cutscene: {
      id: "funeral",
      line: 0,
      acks: [],
      since: room.state.serverTick,
    },
  };
  await b.waitForTimeout(250);
  await b.evaluate(() => (window as any).__audioQA.clear());
  const sieg = Object.values(room.state.players).find(
    (p) => p.role === "OATH",
  )!;
  sieg.combat = {
    kind: "sword",
    seq: 999999,
    startedTick: room.state.serverTick,
    facing: 0,
  };
  await b.waitForTimeout(200);
  assert.equal((await info(b)).loops, 0);
  assert.equal((await info(b)).events.length, 0);
  checks.push(
    "Funeral fixture remains silent, including suppressed combat and obsolete loops",
  );
  await a.screenshot({ path: `${dir}/settings.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  await writeFile(
    `${dir}/report.json`,
    JSON.stringify({ checks, errors, failed }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors, failed, dir }, null, 2));
} catch (error) {
  await writeFile(
    `${dir}/failure.json`,
    JSON.stringify(
      {
        error: String(error),
        errors,
        failed,
        clients: await Promise.all(pages.map((p) => info(p).catch(() => null))),
        rooms: [...app.manager.rooms.values()].map((r) => ({
          scene: r.state.sceneId,
          story: r.state.story,
          players: r.state.players,
        })),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
  await app.close();
}
