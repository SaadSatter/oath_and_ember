// Two real browsers at the bridge: screenshots of the entry target area, with
// the boulder on plate A so the moving target shows.
//   node --import tsx scripts/qa-bridge-target.ts qa/<fresh>
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { bridgePoints } from "../packages/shared/src/bridgePuzzle.js";
const dir = resolve(process.argv[2] ?? "qa/bridge-target-v1");
if (existsSync(dir)) throw Error("Use a fresh evidence directory");
mkdirSync(dir, { recursive: true });
const app = createApp({ startingScene: "BRIDGE_RUINS", prologue: false });
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const pages: Page[] = [], errors: string[] = [], log: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 2; i++) {
    const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    pages.push(p);
    p.on("pageerror", (e) => errors.push(`client ${i}: ${e.message}`));
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
  await sleep(1500);
  const room = app.manager.get(code);
  if (room.state.sceneId !== "BRIDGE_RUINS") {
    delete room.state.story?.cutscene;
    room.transition("BRIDGE_RUINS");
    await sleep(1500);
  }
  const w = room.state, s = w.bridgePuzzle!;
  // The bridge on its own, with no story running.
  delete w.story;
  const coco = Object.values(w.players).find((p) => p.role === "EMBER")!;
  const sieg = Object.values(w.players).find((p) => p.role === "OATH")!;
  await pages[1].screenshot({ path: `${dir}/00-start-coco.png` });
  // Boulder onto plate A: the target appears.
  Object.assign(s.boulder, { x: bridgePoints.plateA.x, y: bridgePoints.plateA.y });
  Object.assign(sieg, { x: 288, y: 1300 });
  Object.assign(coco, { x: 672, y: 1290, facing: -Math.PI / 2 });
  await sleep(1200);
  await pages[1].screenshot({ path: `${dir}/01-target-coco.png` });
  // Coco fires north at the moving target a few times.
  for (let n = 0; n < 6 && !s.targetHit; n++) {
    await pages[1].keyboard.down("w");
    await sleep(40);
    await pages[1].keyboard.up("w");
    await pages[1].keyboard.press("j");
    for (let f = 0; f < 8; f++) {
      await sleep(30);
      await pages[1].screenshot({ path: `${dir}/02-shot${n}-${f}.png` });
    }
    await sleep(700);
    log.push(`shot ${n}: targetHit ${s.targetHit} message ${s.message}`);
  }
  await sleep(500);
  await pages[1].screenshot({ path: `${dir}/03-lit-coco.png` });
  await pages[0].screenshot({ path: `${dir}/03-lit-sieg.png` });
} catch (e) {
  errors.push(`script: ${(e as Error).stack}`);
} finally {
  writeFileSync(`${dir}/qa.json`, JSON.stringify({ errors, log }, null, 2));
  console.log(log.join("\n"), "\nerrors:", errors);
  await browser.close();
  process.exit(0);
}
