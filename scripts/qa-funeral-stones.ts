// Two real browsers at the start of the funeral errand (the "funeral"
// checkpoint): screenshots of where Sieg starts and of each river stone.
//   node --import tsx scripts/qa-funeral-stones.ts qa/<fresh>
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { stoneSpots } from "../packages/shared/src/chapter0.js";
const dir = resolve(process.argv[2] ?? "qa/funeral-stones-v1");
if (existsSync(dir)) throw Error("Use a fresh evidence directory");
mkdirSync(dir, { recursive: true });
const app = createApp({ prologue: true });
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
  await pages[0].locator('input[name="story-start"][value="funeral"]').check({ force: true });
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
  const w = room.state;
  log.push(`start ${w.storyStart} stage ${w.story?.stage} scene ${w.sceneId}`);
  // Read through the opening scene, if any, with E.
  for (let guard = 0; guard < 200 && w.story?.cutscene; guard++) {
    const run = w.story.cutscene;
    if (run.line < 0) { await sleep(100); continue; }
    for (const p of pages) { await p.keyboard.press("e"); await sleep(60); await p.keyboard.press("e"); }
    await sleep(150);
  }
  await sleep(1200);
  const sieg = Object.values(w.players).find((p) => p.role === "OATH")!;
  log.push(`stage ${w.story?.stage} sieg ${Math.round(sieg.x)},${Math.round(sieg.y)} scene ${sieg.sceneId}`);
  await pages[0].screenshot({ path: `${dir}/00-sieg-start.png` });
  for (const s of stoneSpots) {
    Object.assign(sieg, { x: s.x + 40, y: s.y + 30 });
    await sleep(900);
    await pages[0].screenshot({ path: `${dir}/01-${s.id}.png` });
  }
} catch (e) {
  errors.push(`script: ${(e as Error).stack}`);
} finally {
  writeFileSync(`${dir}/qa.json`, JSON.stringify({ errors, log }, null, 2));
  console.log(log.join("\n"), "\nerrors:", errors);
  await browser.close();
  process.exit(0);
}
