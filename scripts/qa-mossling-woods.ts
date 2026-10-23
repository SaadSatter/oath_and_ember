// Two real browsers play the prologue's Mossling Woods tutorial with the
// keyboard: every story line is read with E, and each lesson's skill is used
// with its own key (J, K, T, Shift, F, G). The road to the woods is skipped
// with a server fixture (the cart has been found); heroes are placed beside
// each lesson's mosslings to save walking.
//   node --import tsx scripts/qa-mossling-woods.ts qa/<fresh>
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { maps } from "../packages/shared/src/maps.js";
import {
  woodsCrate,
  woodsLesson,
  woodsMosslings,
  woodsObjective,
} from "../packages/shared/src/prologueWoods.js";
const dir = resolve(process.argv[2] ?? "qa/mossling-woods-v1");
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
    p.on("response", (r) => {
      if (r.status() >= 400) errors.push(`client ${i}: ${r.status()} ${r.url()}`);
    });
    p.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("favicon"))
        errors.push(`client ${i}: ${m.text()}`);
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
  const w = room.state;
  const [sieg, coco] = ["OATH", "EMBER"].map(
    (role) => Object.values(w.players).find((p) => p.role === role)!,
  );
  const shot = async (name: string, who: number[] = [0, 1]) => {
    for (const i of who)
      await pages[i].screenshot({
        path: `${dir}/${name}-${i ? "coco" : "sieg"}.png`,
      });
  };
  const hold = async (i: number, key: string, ms: number) => {
    await pages[i].keyboard.down(key);
    await sleep(ms);
    await pages[i].keyboard.up(key);
    await sleep(60);
  };
  const tap = async (i: number, key = "e") => {
    await pages[i].keyboard.press(key);
    await sleep(80);
  };
  /** Read every line of the playing scene with E (a screenshot at line 0). */
  const read = async (name?: string) => {
    for (let guard = 0; guard < 40 && !w.story?.cutscene; guard++)
      await sleep(100);
    if (name) {
      await sleep(500);
      await shot(name);
    }
    for (let guard = 0; guard < 300 && w.story?.cutscene; guard++) {
      for (const i of [0, 1]) await tap(i);
      await sleep(120);
    }
  };
  const place = (p: typeof sieg, at: { x: number; y: number }) =>
    Object.assign(p, at, { vx: 0, vy: 0 });
  const mosslings = () =>
    Object.values(w.enemies).filter(
      (e) => e.id.startsWith("woods-") && e.state !== "DEAD",
    );
  const did = () => JSON.stringify(w.story?.woods?.did ?? {});
  const objective = async (i: number) =>
    (await pages[i].locator("#goal, #objective").first().textContent()) ?? "";
  /** Swing and cast at the mosslings for a while; anything left is struck down. */
  const fight = async (ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end && mosslings().length) {
      const target = mosslings()[0];
      if (target) {
        place(sieg, { x: target.x - 40, y: target.y });
        place(coco, { x: target.x - 120, y: target.y });
      }
      await tap(0, "d");
      await tap(1, "d");
      await hold(0, "j", 120);
      await hold(1, "j", 120);
    }
    const left = mosslings().length;
    for (const e of mosslings()) e.hp = 0;
    await sleep(400);
    return left;
  };

  // To the end of the forest trail, the quick way, then E into the woods.
  const host = (
    room as unknown as {
      storyHost: {
        travel(scene: string): void;
        relocate(p: unknown, scene: string, at: { x: number; y: number }): void;
      };
    }
  ).storyHost;
  const story = w.story!;
  delete story.cutscene;
  delete story.walks;
  delete story.alden;
  story.flags.push("prologue.visit", "prologue.detour", "prologue.cart");
  story.stage = "TRAIL";
  host.travel("PROLOGUE_TRAIL");
  for (const [i, p] of [sieg, coco].entries())
    host.relocate(p, "PROLOGUE_TRAIL", {
      x: maps.PROLOGUE_TRAIL.spawn.x,
      y: maps.PROLOGUE_TRAIL.spawn.y + i * 36,
    });
  w.serverTick += 120;
  await sleep(1500);
  place(coco, maps.PROLOGUE_TRAIL.points.exit);
  await sleep(500);
  await hold(1, "e", 120);
  await sleep(1500);
  log.push(`arrived: ${w.sceneId} stage ${w.story?.stage}`);
  await read("01-woods-arrive");

  // 1. Attack.
  await read("02-attack-intro");
  await sleep(600);
  await shot("03-attack-mosslings");
  log.push(`attack: ${mosslings().length} mosslings`);
  const attackLeft = await fight(12000);
  log.push(`attack: did ${did()}, struck down by fixture: ${attackLeft}`);
  await sleep(400);

  // 2. Defend: hold K beside a mossling while it strikes.
  await read("04-defend-intro");
  await sleep(400);
  for (let n = 0; n < 120 && w.story?.woods?.step === 1; n++) {
    const e = mosslings()[0];
    if (e) {
      place(sieg, { x: e.x + 60, y: e.y });
      place(coco, { x: e.x - 60, y: e.y });
    }
    pages[0].keyboard.down("k");
    pages[1].keyboard.down("k");
    await sleep(300);
    if (n === 3) await shot("05-defend-guard");
    if (did() === '{"OATH":true,"EMBER":true}') {
      await pages[0].keyboard.up("k");
      await pages[1].keyboard.up("k");
      await fight(8000);
    }
  }
  await pages[0].keyboard.up("k");
  await pages[1].keyboard.up("k");
  log.push(`defend: step now ${w.story?.woods?.step}, hp ${sieg.hp}/${coco.hp}`);

  // 3. Slow Time (T) and Super Speed (Shift).
  await read("06-time-intro");
  await sleep(500);
  await shot("07-time-glow");
  await tap(1, "t");
  await sleep(300);
  await tap(0, "Shift");
  await sleep(300);
  log.push(`time: slowTime ${!!w.slowTime} sprint ${sieg.sprintRemaining} did ${did()}`);
  await shot("08-time-slowed");
  log.push(`time: left ${await fight(12000)}`);

  // 4. Flight: Coco flies from the bank to the islet, takes the crate, flies back.
  await read("09-flight-intro");
  place(sieg, { x: 740, y: woodsCrate.y });
  place(coco, { x: 740, y: woodsCrate.y + 40 });
  await sleep(500);
  await shot("10-flight-bank");
  await tap(1, "f");
  for (let n = 0; n < 40 && coco.x < woodsCrate.x - 16; n++) {
    await hold(1, "d", 60);
    if (coco.y > woodsCrate.y + 8) await hold(1, "w", 30);
  }
  await sleep(300);
  await shot("11-flight-islet");
  await hold(1, "e", 120);
  await sleep(300);
  log.push(
    `flight: coco ${Math.round(coco.x)},${Math.round(coco.y)} flying ${coco.flightRemaining?.toFixed(1)} crate ${w.story?.flags.includes("prologue.woods-crate")}`,
  );
  await shot("12-flight-crate-taken");
  for (
    let n = 0;
    n < 40 && woodsLesson(w.story) === "flight" && coco.x > sieg.x + 20;
    n++
  )
    await hold(1, "a", 80);
  await sleep(300);
  log.push(`flight: step now ${w.story?.woods?.step} coco ${Math.round(coco.x)},${Math.round(coco.y)}`);

  // 5. Black Hole (G), aimed down into the pack below the pond.
  await read("13-black-hole-intro");
  await sleep(300);
  place(coco, { x: 760, y: 540 });
  place(sieg, { x: 620, y: 600 });
  await hold(1, "s", 60);
  await tap(1, "g");
  for (let n = 0; n < 12; n++) {
    await sleep(250);
    if (n === 3) await shot("14-black-hole-pull");
  }
  log.push(`black hole: did ${did()} mosslings ${mosslings().length}`);
  log.push(`black hole: left ${await fight(10000)}`);

  // Done, and on into the clearing.
  await read("15-woods-done");
  log.push(`done: ${woodsObjective(w.story, "OATH")}`);
  log.push(`objective text: ${await objective(0)}`);
  w.serverTick += 120;
  place(coco, maps.PROLOGUE_WOODS.points.exit);
  await sleep(400);
  await shot("16-exit");
  await hold(1, "e", 120);
  await sleep(1200);
  log.push(`left: ${w.sceneId} stage ${w.story?.stage}`);
  await shot("17-clearing");
  void woodsMosslings;
} finally {
  writeFileSync(
    `${dir}/result.json`,
    JSON.stringify({ log, errors }, null, 2),
  );
  console.log(log.join("\n"));
  if (errors.length) console.log("ERRORS\n" + errors.join("\n"));
  await browser.close();
  app.http.close();
  process.exit(0);
}
