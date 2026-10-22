// Two real browsers play Chapter 0's ending at the goddess's shrine: the wig
// offered, the goddess recalling "Sigurd", each hero's choice, the heroes
// leaving, the Mistress of the Mist, and the fade to CHAPTER 0 COMPLETE.
// Earlier chapters are skipped with a server fixture; every line is read
// with E (choices with 1).
//   node --import tsx scripts/qa-chapter0-ending.ts qa/<fresh>
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { FINALE } from "../packages/shared/src/chapter0Finale.js";
import { cutscenes } from "../packages/shared/src/prologue.js";
import {
  SHRINE_OFFERING,
  shrinePoints,
} from "../packages/shared/src/shrine.js";
const dir = resolve(process.argv[2] ?? "qa/chapter0-ending-v1");
if (existsSync(dir)) throw Error("Use a fresh evidence directory");
mkdirSync(dir, { recursive: true });
const app = createApp({ prologue: true });
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
  await sleep(1200);
  const room = app.manager.get(code);
  const w = room.state;
  const [sieg, coco] = ["OATH", "EMBER"].map(
    (role) => Object.values(w.players).find((p) => p.role === role)!,
  );
  // Fixture: Chapter 0 up to the goddess sending them after her wig.
  const story = w.story!;
  delete story.cutscene;
  delete story.walks;
  delete story.alden;
  story.flags.push(
    ...Object.values(cutscenes)
      .filter((c) => !["revelation", "resolve", "depart", "watcher"].includes(c.id))
      .map((c) => c.flag),
    FINALE.angelMeet,
    FINALE.blessing,
    FINALE.inscription,
    ...Object.values(FINALE.trials),
    FINALE.trialsPassed,
    FINALE.goddessMeet,
  );
  story.stage = "WIG";
  room.transition("GODDESS_SHRINE");
  await sleep(1500);
  const shot = async (name: string, who: number[] = [0]) => {
    for (const i of who)
      await pages[i].screenshot({
        path: `${dir}/${name}-${i ? "coco" : "sieg"}.png`,
      });
  };
  // Both have the backpack open, as when one of them drops the wig in.
  for (const page of pages) await page.keyboard.press("i");
  await sleep(400);
  const inventoryOpen = () =>
    Promise.all(
      pages.map((page) =>
        page.evaluate(() => !!document.querySelector(".inventory-panel[open]")),
      ),
    );
  log.push(`inventory open before offering: ${await inventoryOpen()}`);
  await shot("00-inventory-open", [0, 1]);
  // Coco offers the wig at the bowl.
  w.inventory!.counts.griffin_wig = 1;
  Object.assign(coco, {
    x: shrinePoints.offering.x,
    y: shrinePoints.offering.y + 40,
  });
  room.useItem(coco.id, {
    requestId: "qa-offer-wig",
    targetId: SHRINE_OFFERING,
    itemId: "griffin_wig",
  });
  const shots: Record<string, string> = {};
  const line = (id: string, test: (text: string, cue?: string) => boolean) =>
    cutscenes[id].lines.findIndex((l) => test(l.text, l.cue));
  shots[`revelation:${line("revelation", (t) => t === "And you...")}`] = "01-and-you";
  shots[`revelation:${line("revelation", (t) => t === "...Sigurd.")}`] = "02-sigurd";
  shots[`depart:0`] = "04-depart";
  shots[`watcher:0`] = "05-empty-entrance";
  shots[`watcher:${line("watcher", (_, c) => c === "mist-gather")}`] = "06-mist";
  shots[`watcher:${line("watcher", (_, c) => c === "stranger-appear")}`] = "07-she-appears";
  shots[`watcher:${line("watcher", (t) => t.startsWith("So... the oath"))}`] = "08-oath-lives-on";
  shots[`watcher:${line("watcher", (t) => t.startsWith("The goddess glances"))}`] = "09-offering";
  shots[`watcher:${cutscenes.watcher.lines.length - 1}`] = "10-pull-back";
  for (let i = 0; i < 100 && !(story.cutscene && story.cutscene.line >= 0); i++)
    await sleep(50);
  await sleep(600);
  const stillOpen = await inventoryOpen();
  log.push(`inventory open once the goddess speaks: ${stillOpen}`);
  if (stillOpen.some(Boolean))
    errors.push("the inventory stayed open over the goddess's scene");
  await shot("00b-wig-on", [0, 1]);
  const said: string[] = [];
  for (let guard = 0; guard < 900 && !story.flags.includes(FINALE.complete); guard++) {
    const run = story.cutscene;
    if (!run || run.line < 0) {
      await sleep(100);
      continue;
    }
    const key = `${run.id}:${run.line}`;
    const current = cutscenes[run.id].lines[run.line];
    if (said[said.length - 1] !== key) said.push(key);
    if (current.choose) {
      await pages[0].keyboard.press("1");
      await pages[1].keyboard.press("1");
      await sleep(400);
      await shot("03-choice", [0, 1]);
      continue;
    }
    if (shots[key]) {
      // Let the line type out and the camera settle first.
      await sleep(1900);
      await shot(shots[key], key === "watcher:0" ? [0, 1] : [0]);
      delete shots[key];
    }
    // One reader at a time: finish the typing, then move the line on.
    const reader = current.speaker === "COCO" ? 1 : 0;
    await pages[reader].keyboard.press("e");
    await sleep(90);
    await pages[reader].keyboard.press("e");
    for (let wait = 0; wait < 40; wait++) {
      await sleep(25);
      const now = story.cutscene;
      if (!now || `${now.id}:${now.line}` !== key) break;
    }
  }
  log.push(`scenes: ${[...new Set(said.map((k) => k.split(":")[0]))].join(" → ")}`);
  log.push(`complete: ${story.flags.includes(FINALE.complete)} stage ${story.stage}`);
  await sleep(2400);
  await shot("11-chapter-complete", [0, 1]);
  await sleep(7000);
  await shot("12-after", [0]);
  log.push(`after: stranger ${JSON.stringify(story.stranger)} sieg ${Math.round(sieg.x)},${Math.round(sieg.y)}`);
  const missed = Object.values(shots);
  if (missed.length) errors.push(`missed shots: ${missed.join(", ")}`);
} catch (e) {
  errors.push(`script: ${(e as Error).stack}`);
} finally {
  writeFileSync(`${dir}/qa.json`, JSON.stringify({ errors, log }, null, 2));
  console.log(log.join("\n"), "\nerrors:", errors);
  await browser.close();
  process.exit(0);
}
