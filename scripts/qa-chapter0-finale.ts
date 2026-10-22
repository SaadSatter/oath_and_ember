import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "../apps/server/src/app.js";
import type { GameRoom } from "../apps/server/src/GameRoom.js";
import { FINALE } from "../packages/shared/src/chapter0Finale.js";
import { cutscenes } from "../packages/shared/src/prologue.js";
import { gladeState } from "../packages/shared/src/statueGlade.js";
import { bridgePoints } from "../packages/shared/src/bridgePuzzle.js";
import {
  SHRINE_OFFERING,
  shrinePoints,
} from "../packages/shared/src/shrine.js";

// Two real browsers play Chapter 0's finale scenes: the "Forgotten Shrine"
// start from the title screen, every line moved on with E, each hero's choice
// made with their own keys. Travel and puzzle latches are set on the server
// as fixtures (the puzzles have their own walkthroughs: bridge-walkthrough,
// qa-hedge-maze, qa-mirror-pond, qa-griffin, qa-shrine).
//
// npm run build && node --import tsx scripts/qa-chapter0-finale.ts [dir]

const directory = resolve(process.argv[2] ?? "qa/chapter0-finale");
mkdirSync(directory, { recursive: true });
const app = createApp();
await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors: string[] = [];
const log: unknown[] = [];
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

try {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ viewport: { width: 1280, height: 800 } }),
    ),
  );
  const [sieg, coco] = await Promise.all(contexts.map((c) => c.newPage()));
  for (const page of [sieg, coco]) {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/?recordingQA`);
    await page.locator('#panel[data-loaded="true"]').waitFor();
  }
  const radio = sieg.locator('input[name="story-start"][value="shrine"]');
  await sieg.locator("label.story-start").filter({ has: radio }).click();
  await sieg.locator("#create").click();
  await sieg.locator("#oath").waitFor();
  const code = (await sieg.locator("h1").textContent())!.split(" ")[1];
  await coco.locator("#code").fill(code);
  await coco.locator("#join").click();
  await sieg.locator("#oath").click();
  await coco.locator("#ember").click();
  await sieg.locator("#ready").click();
  await coco.locator("#ready").click();
  await wait(1200);
  const room: GameRoom = app.manager.get(code)!;
  const story = () => room.state.story!;
  if (story().stage !== "SHRINE_ROAD") throw Error("Wrong start stage");
  const shot = (name: string) =>
    Promise.all([
      sieg.screenshot({ path: `${directory}/${name}-sieg.png` }),
      coco.screenshot({ path: `${directory}/${name}-coco.png` }),
    ]);
  // The whole line (the box may still be typing it).
  const boxText = (page: Page) =>
    page
      .locator(".story-box:not([hidden]) .dialogue-text")
      .getAttribute("aria-label");
  /** Wait for a scene, then read it through with E (alternating heroes). */
  async function play(id: string, shots: Record<number, string> = {}) {
    for (let i = 0; i < 100 && story().cutscene?.id !== id; i++)
      await wait(50);
    if (story().cutscene?.id !== id)
      throw Error(`Scene ${id} did not start (at ${story().cutscene?.id})`);
    let turn = 0;
    for (let guard = 0; story().cutscene?.id === id && guard < 400; guard++) {
      const run = story().cutscene!;
      if (run.line < 0) {
        await wait(100);
        continue;
      }
      await wait(250);
      const [a, b] = await Promise.all([boxText(sieg), boxText(coco)]);
      if (a !== b) errors.push(`${id}:${run.line} differs: "${a}" / "${b}"`);
      if (shots[run.line]) await shot(shots[run.line]);
      // A choosing line waits for each hero's own choice (made by the caller).
      if (await sieg.locator(".story-choices:not([hidden])").count())
        return run.line;
      const line = run.line;
      const page = turn++ % 2 ? coco : sieg;
      const moved = () =>
        story().cutscene?.line !== line || story().cutscene?.id !== id;
      for (let press = 0; press < 6 && !moved(); press++) {
        await page.keyboard.press("e");
        for (let i = 0; i < 8 && !moved(); i++) await wait(50);
      }
      if (story().cutscene?.id === id && story().cutscene?.line === line) {
        // A line that waits on something else (a choice); anything else is a
        // stuck line.
        errors.push(`${id}:${line} did not move on (${await boxText(page)})`);
        return line;
      }
    }
    log.push({ scene: id, stage: story().stage });
    return -1;
  }

  // Act II: the glade.
  room.transition("PUZZLE_GLADE");
  await play("angel-meet", { 0: "01-angel-meet", 2: "02-angel-speaks" });
  gladeState(room.state.puzzles)!.seatedTick = room.state.serverTick;
  const stuck = await play("angel-blessing", { 19: "03-blessing-objective" });
  if (stuck >= 0) throw Error(errors.join("\n"));
  // Act III: the trials.
  room.transition("BRIDGE_RUINS");
  await play("trials-inscription", { 1: "04-inscription" });
  const bridge = room.state.bridgePuzzle!;
  bridge.firstGateOpen = bridge.goldSwitchOpen = true;
  await wait(500);
  await shot("05-trial-banner");
  Object.assign(bridge.boulder, bridgePoints.plateB);
  await wait(300);
  bridge.finalTargetHit = bridge.complete = true;
  await play("trials-done", { 0: "06-sealed-gate" });
  // Act IV: the goddess.
  room.transition("GODDESS_SHRINE");
  await play("goddess-meet", { 0: "07-goddess", 2: "08-is-she-bald" });
  // Act V: one of the branches.
  room.transition("HEDGE_MAZE");
  await play("maze-banter", { 0: "09-maze" });
  room.transition("GODDESS_SHRINE");
  // Act VI: the wig, offered through the existing interaction.
  room.state.inventory!.counts.griffin_wig = 1;
  story().flags.push(FINALE.mirror, FINALE.griffin, FINALE.wig);
  const offerer = Object.values(room.state.players).find(
    (p) => p.role === "EMBER",
  )!;
  Object.assign(offerer, {
    x: shrinePoints.offering.x,
    y: shrinePoints.offering.y + 40,
  });
  room.useItem(offerer.id, {
    requestId: "qa-offer",
    targetId: SHRINE_OFFERING,
    itemId: "griffin_wig",
  });
  const said = (id: string, start: string) =>
    cutscenes[id].lines.findIndex((l) => l.text.startsWith(start));
  await play("revelation", {
    0: "10-beauty-returned",
    [said("revelation", "...Sigurd.")]: "10b-sigurd",
    [said("revelation", "Many years ago")]: "11-baby",
  });
  // Act VII: each hero chooses with their own keys.
  const choosing = await play("resolve");
  if (choosing !== 0) throw Error("Choice line did not wait");
  await shot("12-choices");
  await sieg.keyboard.press("1");
  await wait(400);
  await shot("13-sieg-waiting");
  if (story().cutscene?.line !== 0) throw Error("Moved on before Coco chose");
  await coco.keyboard.press("3");
  for (let i = 0; i < 40 && story().cutscene?.line === 0; i++) await wait(50);
  if (JSON.stringify(story().motivations) !== '{"OATH":"promise","EMBER":"scared"}')
    throw Error(`Wrong motivations ${JSON.stringify(story().motivations)}`);
  await play("resolve", { 1: "14-coco-reason", 2: "15-sieg-reason" });
  await play("depart", { 0: "16-depart" });
  await play("watcher", {
    [said("watcher", "Pale mist")]: "16b-mist",
    [said("watcher", "So... the oath lives on.")]: "17-oath-lives-on",
    [cutscenes.watcher.lines.length - 1]: "17b-pull-back",
  });
  await wait(2600);
  await shot("18-chapter-complete");
  await wait(6500);
  await shot("19-after");
  if (story().stage !== "DONE" || !story().flags.includes(FINALE.complete))
    throw Error("Chapter 0 did not complete");
  const titles = await Promise.all(
    [sieg, coco].map((p) => p.locator(".chapter-curtain-title").textContent()),
  );
  log.push({ curtain: titles, motivations: story().motivations });
  writeFileSync(
    `${directory}/results.json`,
    JSON.stringify({ log, errors, flags: story().flags }, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Both browsers played the finale's scenes in step, chose independently and reached CHAPTER 0 COMPLETE.",
  );
} finally {
  await browser.close();
  await app.close();
}
