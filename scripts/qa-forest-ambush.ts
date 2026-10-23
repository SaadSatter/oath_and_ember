// Two real browsers play the prologue's forest ambush: the quiet clearing,
// the walk to its middle, monsters pushing out of the bushes, a golem beam,
// and Alden's water dragon eating every monster. The road to the clearing
// is skipped with placement fixtures; every story line is read with E.
//   node --import tsx scripts/qa-forest-ambush.ts qa/<fresh>
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { maps } from "../packages/shared/src/maps.js";
const dir = resolve(process.argv[2] ?? "qa/forest-ambush-v1");
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
  const shot = async (name: string, who: number[] = [0]) => {
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
  const tap = async (i: number) => {
    await pages[i].keyboard.press("e");
    await sleep(80);
  };
  const read = async (
    until: () => boolean,
    shots: Record<string, string> = {},
  ) => {
    for (let guard = 0; guard < 600 && !until(); guard++) {
      const run = w.story?.cutscene;
      if (!run) {
        await sleep(100);
        continue;
      }
      const key = `${run.id}:${run.line}`;
      if (shots[key]) {
        await sleep(400);
        for (const i of [0, 1]) await tap(i);
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
  };
  const place = (p: typeof sieg, at: { x: number; y: number }) =>
    Object.assign(p, at, { vx: 0, vy: 0 });

  // To the forest trail, the quick way: the scenes before it are skipped
  // with a server fixture (the cart has been found), then Coco takes the
  // trail on into the clearing with E as usual.
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
  // The Mossling Woods tutorial has its own QA (qa-mossling-woods.ts): its
  // lessons are marked done with a server fixture, then Coco walks on.
  {
    const s = w.story!;
    delete s.cutscene;
    s.flags.push("prologue.woods", "prologue.woods-done");
    s.woods = { step: 5, did: {}, raised: 0 };
    w.enemies = {};
    w.serverTick += 120;
    await sleep(500);
    place(coco, maps.PROLOGUE_WOODS.points.exit);
    await sleep(500);
    await hold(1, "e", 120);
    await sleep(1500);
  }

  // 1. The clearing is quiet until a hero walks into its middle.
  log.push(
    `arrived: ${w.sceneId} stage ${w.story?.stage} cutscene ${w.story?.cutscene?.id} enemies ${Object.keys(w.enemies).length}`,
  );
  await shot("01-quiet-clearing", [0, 1]);
  const centre = maps.PROLOGUE_CLEARING.points.centre;
  for (let n = 0; n < 200 && !w.story?.cutscene; n++) {
    const dx = centre.x - sieg.x,
      dy = centre.y - sieg.y;
    const across = dx < 0 ? "a" : "d",
      down = dy < 0 ? "w" : "s",
      before = { x: sieg.x, y: sieg.y };
    // Head for the middle; sidestep along the other axis when blocked.
    await hold(0, Math.abs(dx) > Math.abs(dy) ? across : down, 90);
    if (Math.hypot(sieg.x - before.x, sieg.y - before.y) < 2)
      await hold(0, Math.abs(dx) > Math.abs(dy) ? down : across, 200);
  }
  log.push(
    `walked in: cutscene ${w.story?.cutscene?.id} sieg ${Math.round(sieg.x)},${Math.round(sieg.y)} enemies ${Object.keys(w.enemies).length}`,
  );
  await read(() => (w.story?.cutscene?.line ?? -1) >= 1);
  for (let i = 0; i < 6; i++) {
    await sleep(500);
    await shot(`02-emerge-${i}`);
  }
  log.push(
    `emerged: ${Object.values(w.enemies)
      .map((e) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)}${e.march ? " marching" : ""}`)
      .join("; ")}`,
  );
  await read(() => w.story?.stage === "FIGHT");

  // 3. A golem beam.
  for (let n = 0; n < 400; n++) {
    for (const p of [sieg, coco]) p.hp = Math.max(p.hp, 80);
    const beam = Object.values(w.projectiles).find(
      (q) => q.effect === "golem_beam",
    );
    if (beam) {
      for (const [i, wait] of [0, 250, 500, 900, 1300].entries()) {
        await sleep(wait - (i ? [0, 250, 500, 900, 1300][i - 1] : 0));
        await shot(`03-beam-${i}`, [0, 1]);
      }
      break;
    }
    await sleep(50);
  }
  // 4. Alden and the dragon.
  room.damage(sieg, 500);
  await sleep(4000);
  log.push(
    `rescue: ${w.story?.stage} ${w.story?.cutscene?.id}:${w.story?.cutscene?.line} alden ${JSON.stringify(w.story?.alden)}`,
  );
  const began = Date.now();
  await read(() => w.story?.cutscene?.id === "rescue" && !!w.story.dragon);
  log.push(
    `read for ${Date.now() - began}ms: ${w.story?.cutscene?.id}:${w.story?.cutscene?.line} alden ${JSON.stringify(w.story?.alden)}`,
  );
  const dragon = w.story!.dragon!;
  log.push(
    `alden ${Math.round(w.story!.alden!.x)},${Math.round(w.story!.alden!.y)} dragon: start ${dragon.start} end ${dragon.end} prey ${dragon.prey.map((p) => p.at - dragon.start).join(",")}`,
  );
  // Timed on the server's clock: rising, the lap, bites, and the burst.
  const lastBite = dragon.prey[dragon.prey.length - 1].at - dragon.start,
    burstAt = dragon.end - dragon.start - 60;
  const moments = [20, 70, 130, 200, dragon.prey[0].at - dragon.start + 6]
    .concat([lastBite - 20, lastBite + 4, burstAt + 6, burstAt + 25, burstAt + 45])
    .sort((a, b) => a - b);
  for (const [i, at] of moments.entries()) {
    while (w.serverTick < dragon.start + at) await sleep(5);
    await shot(`04-dragon-${String(i).padStart(2, "0")}-t${at}`);
  }
  log.push(
    `after dragon: alive ${Object.values(w.enemies).filter((e) => e.state !== "DEAD").length}`,
  );
  await read(() => w.story?.cutscene?.id === "home");
  log.push(`home: ${w.story?.cutscene?.id}`);
} catch (e) {
  errors.push(`script: ${(e as Error).stack}`);
} finally {
  writeFileSync(`${dir}/qa.json`, JSON.stringify({ errors, log }, null, 2));
  console.log(log.join("\n"), "\nerrors:", errors);
  await browser.close();
  process.exit(0);
}
