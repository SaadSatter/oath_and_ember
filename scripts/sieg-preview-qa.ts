import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const dir = "qa/sieg-preview-v2";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage({
      viewport: { width: 1000, height: 1250 },
    }),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5174/sieg-preview.html");
  await page.waitForFunction(
    () => !!document.querySelector<HTMLElement>("#game")?.dataset.preview,
  );
  const read = () =>
    page.evaluate(() =>
      JSON.parse(
        document.querySelector<HTMLElement>("#game")!.dataset.preview!,
      ),
    );
  const report = [];
  await page.locator("#palette").selectOption("ivory");
  for (const [direction, count] of [
    ["right", 12],
    ["left", 12],
    ["up", 10],
    ["down", 12],
  ] as const) {
    await page.locator(`[data-direction=${direction}]`).click();
    await page.waitForFunction(
      (d) =>
        JSON.parse(
          document.querySelector<HTMLElement>("#game")!.dataset.preview!,
        ).direction === d,
      direction,
    );
    await page.locator("#turn").click();
    await page.waitForTimeout(150);
    const view = await read();
    assert.equal(view.direction, direction);
    assert.equal(view.texture, "hero:OATH:basic:palette:ivory:");
    assert.equal(view.flipX, direction === "left");
    assert.deepEqual(view.canvasPivot, [64, 96]);
    assert(view.elapsedMs > 0);
    await page.screenshot({ path: `${dir}/${direction}.png` });
    await page.waitForTimeout(800);
    assert((await read()).animation.includes("TOP_DOWN:idle"));
    report.push({ direction, count, view });
  }
  await page.locator("#walk").check();
  await page.locator("[data-direction=right]").click();
  await page.waitForTimeout(1000);
  assert.equal((await read()).animation, "hero:OATH:TOP_DOWN:walk_east");
  await page.locator("#walk").uncheck();
  await page.locator("#repeat").check();
  await page.locator("[data-direction=down]").click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector<HTMLElement>("#game")!.dataset.preview!)
        .direction === "down",
  );
  const seq = (await read()).acceptedSeq;
  await page.waitForFunction(
    (s) =>
      JSON.parse(document.querySelector<HTMLElement>("#game")!.dataset.preview!)
        .acceptedSeq > s,
    seq,
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    `${dir}/report.json`,
    JSON.stringify({ checks: report, errors }, null, 2),
  );
  console.log(
    "Preview controls, facing lock, repeat, walk return and readouts passed.",
  );
} finally {
  await browser.close();
}
