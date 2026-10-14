import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const app = createApp({ startingScene: "BRIDGE_RUINS" });
await new Promise<void>((res) => app.http.listen(0, "127.0.0.1", res));
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const errors: string[] = [];
const pages = [];
const contexts = [];
const pause = (ms: number) => new Promise((res) => setTimeout(res, ms));
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 720 },
    });
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
        errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(
      `http://127.0.0.1:${(app.http.address() as any).port}/?recordingQA=1`,
    );
  }
  await pages[0].locator("#create").click();
  await pages[0].locator("#oath").waitFor();
  const code = (await pages[0].locator("h1").textContent())!.split(" ")[1];
  await pages[1].locator("#code").fill(code);
  await pages[1].locator("#join").click();
  await pages[0].locator("#oath").click();
  await pages[1].locator("#ember").click();
  await pages[0].locator("#ready").click();
  await pages[1].locator("#ready").click();
  await pause(500);
  assert.equal(await pages[0].locator("#skills").count(), 0);
  assert.equal(await pages[1].locator("#skills").count(), 0);
  const key = async (i: number, k: string, type: string) =>
    pages[i].evaluate(
      ({ k, type }) =>
        document.body.dispatchEvent(
          new KeyboardEvent(type, { key: k, bubbles: true }),
        ),
      { k, type },
    );
  await key(1, "2", "keydown");
  await pause(80);
  await key(1, "2", "keyup");
  await key(0, "2", "keydown");
  await pause(80);
  await key(0, "2", "keyup");
  await pause(800);
  const room = app.manager.get(code)!;
  const coco = Object.values(room.state.players).find(
    (p) => p.role === "EMBER",
  )!;
  const sieg = Object.values(room.state.players).find(
    (p) => p.role === "OATH",
  )!;
  assert((coco.flightRemaining ?? 0) > 18);
  assert((sieg.sprintRemaining ?? 0) > 8);
  assert(await pages[1].locator('[data-ability="black-hole"]').isEnabled());
  assert(await pages[1].locator('[data-ability="flight"]').isVisible());
  assert(await pages[0].locator('[data-ability="push"]').isVisible());
  mkdirSync("docs/flight", { recursive: true });
  for (const [direction, k] of [
    ["south", "s"],
    ["north", "w"],
    ["east", "d"],
    ["west", "a"],
  ]) {
    await key(1, k, "keydown");
    await pause(120);
    await key(1, k, "keyup");
    await pause(220);
    await pages[1].screenshot({ path: `docs/flight/${direction}.png` });
  }
  await pages[1].keyboard.press("Tab");
  assert.equal(await pages[1].locator("#skills").count(), 0);
  assert(
    !((await pages[1].locator("#stats").textContent()) ?? "").includes(
      "points",
    ),
  );
  await key(0, "1", "keydown");
  await pause(100);
  assert.equal(sieg.actionState, "push");
  await key(0, "1", "keyup");
  await key(1, "1", "keydown");
  await pause(100);
  await key(1, "1", "keyup");
  assert.equal(room.state.slowTime?.owner, coco.id);
  await key(1, "3", "keydown");
  await pause(100);
  await key(1, "3", "keyup");
  assert.equal(Object.keys(room.state.blackHoles ?? {}).length, 1);
  assert.equal(coco.skillPoints, 0);
  assert.equal(sieg.skillPoints, 0);
  assert.equal(errors.length, 0, errors.join("\n"));
  writeFileSync(
    "docs/flight/qa-report.json",
    JSON.stringify(
      {
        errors,
        cocoFlight: coco.flightRemaining,
        siegSprint: sieg.sprintRemaining,
        keys: {
          Sieg: ["1 Push", "2 Super Speed"],
          Coco: ["1 Slow Time", "2 Flight", "3 Black Hole"],
        },
      },
      null,
      2,
    ),
  );
  console.log(
    "Flight artwork and keys verified in both clients; no browser or asset errors.",
  );
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
  await app.close();
}
