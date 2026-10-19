import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "../apps/server/src/app.js";
import { BURIAL_FLAG } from "../packages/shared/src/prologue.js";

const directory = resolve(process.argv[2] ?? "qa/ruined-shop-v1");
mkdirSync(directory, { recursive: true });
const app = createApp({ prologue: true });
await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const pages: Page[] = [];
const errors: string[] = [];
try {
  for (let index = 0; index < 2; index++) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    pages.push(page);
    await page.goto(`http://127.0.0.1:${port}/`);
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
  await pages[0].waitForTimeout(1000);
  const room = app.manager.get(code);
  const world = room.state;
  world.story!.stage = "LEAVING";
  delete world.story!.cutscene;
  for (const player of Object.values(world.players)) {
    player.sceneId = "HOUSE_INTERIOR";
    player.x = player.role === "OATH" ? 306 : 274;
    player.y = 350;
    player.movementEpoch++;
  }
  const shot = async (name: string) => {
    await pages[0].waitForTimeout(1000);
    for (let index = 0; index < pages.length; index++)
      await pages[index].screenshot({
        path: `${directory}/${name}-${index === 0 ? "sieg" : "coco"}.png`,
      });
  };
  await shot("before");
  world.story!.stage = "MOURNING";
  world.story!.alden!.action = "still";
  await shot("after");
  world.story!.flags.push(BURIAL_FLAG);
  world.story!.stage = "DONE";
  await shot("after-burial");
  world.story!.stage = "LEAVING";
  world.story!.flags = [];
  await shot("restored-fixture");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    `Before, aftermath, burial and reset screenshots saved to ${directory}`,
  );
} finally {
  await browser.close();
  await app.close();
}
