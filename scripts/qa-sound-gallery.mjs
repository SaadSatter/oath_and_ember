import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createGalleryServer } from "../tools/sound-gallery/server.mjs";
const directory = process.argv[2] || "/tmp/oath-sound-gallery-qa";
await mkdir(directory, { recursive: true });
const server = await createGalleryServer();
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  requests = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => requests.push(r.url()));
try {
  await page.goto(url);
  await page.locator("[data-play-mix]").waitFor();
  assert.match(await page.locator("#result-count").textContent(), /28/);
  assert.equal(await page.locator("[data-event]").count(), 28);
  checks.push("Default Phase 1 view contains 28 proposals");
  const decoded = await page.evaluate(async () => {
    const catalog = await (await fetch("/catalog.json")).json(),
      context = new AudioContext(),
      result = [];
    for (const a of catalog.assets) {
      const buffer = await context.decodeAudioData(
        await (await fetch(a.url)).arrayBuffer(),
      );
      if (!(buffer.duration > 0 && buffer.numberOfChannels > 0))
        throw Error(`Invalid audio: ${a.id}`);
      result.push({
        id: a.id,
        duration: buffer.duration,
        channels: buffer.numberOfChannels,
      });
    }
    await context.close();
    return result;
  });
  assert.equal(decoded.length, 63);
  checks.push("All 63 local originals decode in Chrome");
  await page.locator("[data-play-mix]").click();
  await page.waitForFunction(() =>
    document.querySelector("#message").textContent.startsWith("Auditioning"),
  );
  await page.locator("#stop").click();
  await page.locator('[data-approval="event"]').selectOption("Approved");
  await page.locator('[data-track="gain"]').fill("0.23");
  await page.locator('[data-track="gain"]').press("Tab");
  assert.equal(
    await page.locator('[data-approval="event"]').inputValue(),
    "Pending",
  );
  await page.locator('[data-approval="event"]').selectOption("Needs Revision");
  await page
    .locator('[data-notes="event"]')
    .fill("QA only — testing persistence.");
  await page.reload();
  assert.equal(
    await page.locator('[data-approval="event"]').inputValue(),
    "Needs Revision",
  );
  assert.equal(await page.locator('[data-track="gain"]').inputValue(), "0.23");
  assert.match(
    await page.locator('[data-notes="event"]').inputValue(),
    /QA only/,
  );
  checks.push("Audition, stop, decision persistence and edit invalidation");
  await page.locator('[data-group="Coco"]').click();
  await page
    .locator("[data-event]")
    .filter({ hasText: "Coco Fireball cast, level 1" })
    .click();
  await page.locator('[data-recipe-play="2"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector("#message")
      .textContent.startsWith("Auditioning Layer"),
  );
  await page.locator('[data-recipe-use="2"]').click();
  assert.equal(await page.locator(".layer").count(), 2);
  await page.locator('[data-track="loop"]').first().check();
  await page.locator("[data-play-mix]").click();
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  assert.match(await page.locator("#message").textContent(), /stopped/);
  checks.push(
    "Signature A/B layer preset selection, loop preview and Escape stop",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert(Object.keys(exported.events).length >= 2);
  const file = `${directory}/review-export.json`;
  await writeFile(file, JSON.stringify(exported));
  await page.locator("#import-file").setInputFiles(file);
  await page.waitForFunction(() =>
    document
      .querySelector("#message")
      .textContent.startsWith("Review imported"),
  );
  await page
    .locator("#import-file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...exported, planSha256: "wrong" })),
    });
  await page.waitForFunction(() =>
    document
      .querySelector("#message")
      .textContent.startsWith("Import rejected"),
  );
  checks.push("Export/reimport works; wrong-plan import rejected");
  await page.locator('[data-view="sources"]').click();
  assert.equal(await page.locator("[data-source]").count(), 63);
  await page.locator('[data-source="click"]').click();
  await page.locator("#detail audio").evaluate((a) => a.play());
  await page.waitForFunction(
    () => document.querySelector("#detail audio").currentTime > 0,
  );
  await page.locator("#stop").click();
  assert(await page.locator("#detail audio").evaluate((a) => a.paused));
  checks.push("All-source library, native media playback and Stop all");
  await page.locator('[data-view="events"]').click();
  assert.equal(await page.locator("[data-event]").count(), 204);
  await page.locator('[data-group="Story"]').click();
  await page.locator("#search").fill("hand falls still");
  await page.locator("[data-event]").first().click();
  assert.match(
    await page.locator(".silence-panel").textContent(),
    /Intentional silence/,
  );
  assert.equal(
    await page
      .locator("#detail audio, [data-play-mix], [data-add-layer]")
      .count(),
    0,
  );
  checks.push(
    "All 204 mappings present; Alden stillness has no audio/layer controls",
  );
  await page.locator('[data-view="gaps"]').click();
  assert.equal(await page.locator(".gap-card").count(), 7);
  checks.push("Protocol gaps and synchronization requirements visible");
  await page.locator('[data-view="phase1"]').click();
  await page.screenshot({ path: `${directory}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${directory}/mobile.png`, fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  checks.push("390px responsive layout without horizontal overflow");
  assert.equal(errors.length, 0, errors.join("\n"));
  assert(
    requests.every((r) => r.startsWith(url)),
    "Unexpected external or gameplay request",
  );
  checks.push("No browser errors or external/game network requests");
  await writeFile(
    `${directory}/report.json`,
    JSON.stringify(
      { checks, decoded, errors, requests: requests.length },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { checks, decoded: decoded.length, errors, directory },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
