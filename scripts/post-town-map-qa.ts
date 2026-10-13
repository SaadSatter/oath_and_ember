import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { postTownRoute } from "../packages/shared/src/maps.js";
import { mkdirSync } from "node:fs";
const out = "/tmp/oath-ember-post-town-qa";
mkdirSync(out, { recursive: true });
const app = createApp();
await new Promise<void>((resolve) => app.http.listen(0, "127.0.0.1", resolve));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors: string[] = [];
try {
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.location().url.endsWith("/favicon.ico")) return;
      if (
        message.type() === "error" ||
        /missing|not found/i.test(message.text())
      )
        errors.push(`${message.text()} ${message.location().url}`);
    });
    await page.goto(`http://127.0.0.1:${port}`);
    pages.push(page);
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
  await pages[0].waitForFunction(
    () => document.body.dataset.playing === "true",
  );
  const room = app.manager.get(code)!;
  for (const id of Object.keys(
    postTownRoute,
  ) as (keyof typeof postTownRoute)[]) {
    // QA fixture uses server-owned scene changes to inspect every map in both clients.
    room.transition(id);
    await Promise.all(
      pages.map((p) =>
        p
          .locator("#objective")
          .filter({ hasText: postTownRoute[id].name })
          .waitFor(),
      ),
    );
    await pages[0].waitForTimeout(250);
    for (let i = 0; i < 2; i++)
      await pages[i].screenshot({ path: `${out}/${id}-${i + 1}.png` });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    `Both clients rendered all four maps without browser errors. Screenshots: ${out}`,
  );
} finally {
  await browser.close();
  await app.close();
}
