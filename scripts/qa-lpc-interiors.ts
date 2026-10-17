import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createApp } from "../apps/server/src/app.js";
import { villageInteriorIds } from "../packages/shared/src/villageInteriors.js";
const output = "qa/lpc-village-interiors";
mkdirSync(output, { recursive: true });
const app = createApp();
await new Promise<void>((resolve) => app.http.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors: string[] = [];
try {
  const pages = await Promise.all(
    [0, 1].map(async () => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
          errors.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(
        `http://127.0.0.1:${(app.http.address() as { port: number }).port}/?enemyQA=1`,
      );
      return page;
    }),
  );
  await pages[0].locator("#create").click();
  await pages[0].locator("#oath").waitFor();
  const code = (await pages[0].locator("h1").textContent())!.split(" ")[1];
  await pages[1].locator("#code").fill(code);
  await pages[1].locator("#join").click();
  await pages[0].locator("#oath").click();
  await pages[1].locator("#ember").click();
  await pages[0].waitForTimeout(200);
  await pages[0].locator("#ready").click();
  await pages[1].locator("#ready").click();
  await pages[0].waitForFunction(
    () =>
      document.querySelector<HTMLElement>("#game")?.dataset.scene ===
      "MAIN_HOUSE",
  );
  const room = app.manager.get(code);
  for (const id of villageInteriorIds) {
    room.transition(id, true);
    for (const [i, page] of pages.entries()) {
      await page.waitForFunction(
        (id) =>
          document.querySelector<HTMLElement>("#game")?.dataset.scene === id,
        id,
      );
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `${output}/${id.toLowerCase()}-${i + 1}.png`,
      });
    }
  }
  if (errors.length) throw Error(errors.join("\n"));
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify({ homes: villageInteriorIds, clients: 2, errors }, null, 2),
  );
  console.log(
    "LPC interiors rendered in all three homes for both clients without asset or browser errors.",
  );
} finally {
  await browser.close();
  await app.close();
}
