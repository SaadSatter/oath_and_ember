// Two real browsers play the whole Chapter 0 prologue. Every story line is
// read with the E key on both clients; Sieg walks into the shop with ordinary
// keys. Long forest walks use placement fixtures (they only skip walking),
// and the ambush is shortened by dealing server damage once the fight has
// been seen. Screenshots of each beat go to a fresh evidence directory.
//   node --import tsx scripts/qa-prologue.ts qa/prologue-v2
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { maps } from "../packages/shared/src/maps.js";
const dir = resolve(process.argv[2] ?? "qa/prologue-v2");
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
    p.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("favicon"))
        errors.push(`client ${i}: ${m.text()}`);
    });
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
    await sleep(150);
  };
  const tap = async (i: number) => {
    await pages[i].keyboard.press("e");
    await sleep(80);
  };
  /** Read the running scene(s) until `until` holds; screenshot chosen lines. */
  const read = async (
    until: () => boolean,
    shots: Record<string, string> = {},
  ) => {
    for (let guard = 0; guard < (process.env.QUICK ? 20 : 400) && !until(); guard++) {
      const run = w.story?.cutscene;
      if (!run) {
        await sleep(100);
        continue;
      }
      const key = `${run.id}:${run.line}`;
      if (shots[key]) {
        await sleep(400);
        for (const i of [0, 1]) await tap(i); // finish typing
        await sleep(300);
        await shot(shots[key]);
        delete shots[key];
      }
      for (const i of [0, 1]) {
        await tap(i);
        await tap(i);
      }
      await sleep(120);
    }
    log.push(`read until ${w.story?.stage} ${w.story?.cutscene?.id ?? ""}`);
  };
  const place = (p: typeof sieg, at: { x: number; y: number }) =>
    Object.assign(p, at, { vx: 0, vy: 0 });

  await shot("01-arrival");
  // Sieg walks to the garden gate and up to the shop door with real keys.
  for (let n = 0; n < 120 && sieg.x > 560; n++) await hold(0, "a", 80);
  for (let n = 0; n < 120 && sieg.x > 484; n++) await hold(0, "a", 30);
  for (let n = 0; n < 120 && sieg.x < 476; n++) await hold(0, "d", 30);
  for (let n = 0; n < 120 && sieg.y > 340; n++) await hold(0, "w", 80);
  await hold(0, "e", 120);
  await sleep(600);
  log.push(`visit: ${w.story?.cutscene?.id}`);
  await read(() => w.story?.stage === "LEAVING", {
    "visit:0": "02-visit",
    "visit:11": "03-visit-look-after-her",
  });
  // Coco heads out; the fork plays at the road.
  place(coco, maps.HOUSE_INTERIOR.spawn);
  await sleep(300);
  await hold(1, "e", 120);
  await sleep(400);
  for (let n = 0; n < 80 && !w.story?.cutscene; n++) await hold(1, "s", 80);
  await read(() => w.story?.stage === "FOREST_BOUND", {
    "fork:0": "04-fork",
    "fork:10": "05-fork-sieg-thoughts",
  });
  place(coco, { x: 150, y: 500 });
  await sleep(400);
  await hold(1, "e", 120);
  await sleep(1500);
  log.push(`trail: ${w.sceneId} ${w.story?.stage}`);
  await shot("06-trail");
  place(sieg, maps.PROLOGUE_TRAIL.points.cart);
  await sleep(1200);
  await read(() => w.story?.flags.includes("prologue.cart") ?? false, {
    "cart:1": "07-cart",
  });
  await sleep(600);
  place(coco, maps.PROLOGUE_TRAIL.points.crates);
  await sleep(500);
  await hold(1, "e", 120);
  await sleep(1500);
  await shot("08-inspect", [1]);
  await hold(1, "Escape", 120);
  place(coco, maps.PROLOGUE_TRAIL.points.exit);
  await sleep(500);
  await hold(1, "e", 120);
  await sleep(1500);
  log.push(`clearing: ${w.sceneId} ${w.story?.cutscene?.id}`);
  await read(() => w.story?.stage === "FIGHT", {
    "ambush:1": "09-ambush",
    "ambush:2": "10-ambush-plan",
  });
  // Let the fight run for real for a few seconds.
  await pages[0].keyboard.down("j");
  await sleep(3500);
  await pages[0].keyboard.up("j");
  await shot("11-fight");
  log.push(
    `fight hp: ${Math.round(sieg.hp)} ${Math.round(coco.hp)}; enemies ${Object.keys(w.enemies).length}`,
  );
  room.damage(sieg, 500);
  // The rest of the eight march in around the heroes before Alden comes.
  await sleep(1600);
  await shot("11b-march-in");
  await sleep(2500);
  await shot("11c-surrounded");
  log.push(`rescue: ${w.story?.cutscene?.id} sieg hp ${sieg.hp}`);
  await read(() => w.story?.cutscene?.id === "home", {
    "rescue:0": "12-rescue-glow",
    "rescue:2": "13-rescue-cast",
    "rescue:4": "14-rescue-after",
    "rescue:7": "15-hello-papa",
  });
  log.push(
    `home: ${w.sceneId} ${sieg.sceneId} hp ${sieg.hp}/${coco.hp}, enemies ${Object.keys(w.enemies).length}`,
  );
  await read(() => w.story?.cutscene?.id === "farewell", {
    "home:13": "16-home-thank-you",
    "home:20": "17-home-papa",
  });
  await read(() => w.story?.cutscene?.id === "morning", {
    "farewell:5": "18-farewell",
  });
  await read(() => w.story?.stage === "DONE", {
    "morning:3": "19-morning-third-rule",
    "morning:9": "20-morning-papa",
  });
  await sleep(1200);
  await shot("21-done");
  log.push(`done: flags ${w.story?.flags.join(",")}`);
} finally {
  writeFileSync(`${dir}/qa.json`, JSON.stringify({ errors, log }, null, 2));
  console.log(log.join("\n"), "\nerrors:", errors);
  await browser.close();
  process.exit(0);
}
