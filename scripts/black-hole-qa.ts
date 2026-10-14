import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const app = createApp({ startingScene: "BRIDGE_RUINS" });
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const contexts = [],
  pages = [],
  errors: string[] = [];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 720 },
    });
    contexts.push(context);
    const p = await context.newPage();
    pages.push(p);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
        errors.push(`${r.status()} ${r.url()}`);
    });
    await p.goto(
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
  await pause(350);
  assert.equal(await pages[1].locator("#skills").count(), 0);
  const key = async (type: string) =>
    pages[1].evaluate(
      (type) =>
        document.body.dispatchEvent(
          new KeyboardEvent(type, { key: "3", bubbles: true }),
        ),
      type,
    );
  await key("keydown");
  await pause(80);
  await key("keyup");
  await pause(350);
  const room = app.manager.get(code)!,
    hole = Object.values(room.state.blackHoles ?? {})[0];
  assert(hole);
  assert.equal(hole.phase, "travel");
  mkdirSync("docs/black-hole", { recursive: true });
  await pages[1].screenshot({ path: "docs/black-hole/travel.png" });
  await pause(800);
  assert.equal(hole.phase, "vortex");
  const visuals = JSON.parse(
    (await pages[1].locator("#game").getAttribute("data-projectile-visuals")) ??
      "{}",
  );
  assert.equal(visuals.blackHoles?.length, 1);
  assert(visuals.blackHoles[0].frame >= 0);
  await pages[1].screenshot({ path: "docs/black-hole/vortex.png" });
  assert.equal(
    await pages[1]
      .locator('[data-ability="black-hole"]')
      .getAttribute("data-timer-phase"),
    "cooldown",
  );
  assert(await pages[1].locator('[data-ability="black-hole"]').isDisabled());
  assert.equal(errors.length, 0, errors.join("\n"));
  writeFileSync(
    "docs/black-hole/qa-report.json",
    JSON.stringify({ errors, hole, visuals }, null, 2),
  );
  console.log(
    "Black Hole cast with key 3; GIF travel, vortex, and circular cooldown verified in real clients.",
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await app.close();
}
