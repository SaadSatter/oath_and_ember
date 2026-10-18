// Two real browsers visit Alden's magic shop: both walk in through the front
// door, Coco climbs the stairs, and each floor is screenshotted at desktop and
// phone sizes. Placement fixtures only skip the walk to each door/stair.
//   node --import tsx scripts/qa-magic-shop.ts qa/magic-shop-v1
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { maps } from "../packages/shared/src/maps.js";
const dir = resolve(process.argv[2] ?? "qa/magic-shop-v1");
if (existsSync(dir)) throw Error("Use a fresh evidence directory");
mkdirSync(dir, { recursive: true });
const app = createApp();
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const pages: Page[] = [],
  errors: string[] = [],
  log: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 2; i++) {
    const p = await (
      await browser.newContext({ viewport: { width: 1280, height: 720 } })
    ).newPage();
    pages.push(p);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400 && !r.url().endsWith("/favicon.ico"))
        errors.push(`${r.status()} ${r.url()}`);
    });
    await p.goto(`http://127.0.0.1:${port}/`);
  }
  await pages[0].locator("#create").click();
  await pages[0].locator("#oath").waitFor();
  const code = (await pages[0].locator("h1").textContent())!.split(" ")[1];
  await pages[1].locator("#code").fill(code);
  await pages[1].locator("#join").click();
  await pages[0].locator("#oath").click();
  await pages[1].locator("#ember").click();
  await sleep(150);
  await pages[0].locator("#ready").click();
  await pages[1].locator("#ready").click();
  await sleep(1200);
  const room = app.manager.get(code);
  const [sieg, coco] = ["OATH", "EMBER"].map(
    (role) => Object.values(room.state.players).find((p) => p.role === role)!,
  );
  const press = async (i: number, key: string) => {
    await pages[i].keyboard.down(key);
    await sleep(120);
    await pages[i].keyboard.up(key);
    await sleep(500);
  };
  // The regular campaign comes after Chapter 0's burial: the grave shows.
  Object.assign(sieg, { x: 150, y: 420 });
  await sleep(900);
  await pages[0].screenshot({ path: `${dir}/grave-sieg.png` });
  for (const [i, p] of [
    [0, sieg],
    [1, coco],
  ] as const) {
    Object.assign(p, maps.MAIN_HOUSE.points.door);
    await sleep(200);
    await press(i, "e");
  }
  log.push(`inside: ${sieg.sceneId} ${coco.sceneId}`);
  // Walk both heroes into the shop with ordinary keys.
  await pages[0].keyboard.down("w");
  await pages[1].keyboard.down("a");
  await sleep(700);
  await pages[0].keyboard.up("w");
  await pages[1].keyboard.up("a");
  await sleep(800);
  for (let i = 0; i < 2; i++)
    await pages[i].screenshot({ path: `${dir}/ground-${i ? "coco" : "sieg"}.png` });
  Object.assign(coco, maps.HOUSE_INTERIOR.points.upstairs);
  await sleep(200);
  await press(1, "e");
  log.push(`coco after stairs: ${coco.sceneId}`);
  await pages[1].keyboard.down("d");
  await sleep(500);
  await pages[1].keyboard.up("d");
  await sleep(800);
  await pages[1].screenshot({ path: `${dir}/upper-coco.png` });
  for (const [w, h] of [
    [1920, 1080],
    [390, 844],
  ]) {
    for (let i = 0; i < 2; i++) {
      await pages[i].setViewportSize({ width: w, height: h });
      await sleep(500);
      await pages[i].screenshot({
        path: `${dir}/${i ? "upper" : "ground"}-${w}x${h}.png`,
      });
    }
  }
} finally {
  writeFileSync(`${dir}/qa.json`, JSON.stringify({ errors, log }, null, 2));
  console.log(log.join("\n"), "\nerrors:", errors);
  await browser.close();
  process.exit(0);
}
