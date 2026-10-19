// Two real browsers play Chapter 0, Part 1 from the prologue's last morning
// to the road north (the Forgotten Shrine unlocked).
// Every story line is read with E; villagers are talked to with E. Long walks
// use placement fixtures (they only skip walking). Screenshots of each beat,
// from both heroes' screens, go to a fresh evidence directory.
//   node --import tsx scripts/qa-chapter0.ts qa/chapter0-v1
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { startCutscene, type StoryHost } from "../apps/server/src/prologue.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { maps } from "../packages/shared/src/maps.js";
import { npcs, npcPose } from "../packages/shared/src/npcs.js";
const dir = resolve(process.argv[2] ?? "qa/chapter0-v1");
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
  const host = (room as unknown as { storyHost: StoryHost }).storyHost;
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
  /** Read running scenes until `until` holds; screenshot chosen lines. */
  const read = async (
    until: () => boolean,
    shots: Record<string, string> = {},
  ) => {
    for (let guard = 0; guard < 400 && !until(); guard++) {
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
    log.push(`read until ${w.story?.stage} ${w.story?.cutscene?.id ?? ""}`);
  };
  // A new movement epoch tells the client's prediction to snap to it.
  const place = (p: typeof sieg, at: object) =>
    Object.assign(p, at, {
      vx: 0,
      vy: 0,
      movementEpoch: (p.movementEpoch ?? 0) + 1,
    });
  /** Coco walks up to a villager (fixture) and presses E for real. */
  const visit = async (npcId: string) => {
    // Close any ordinary chat the last scene's extra E presses opened.
    await hold(1, "Escape", 100);
    const npc = npcs.find((n) => n.id === npcId)!;
    const pose = npcPose(npc, w.serverTick, w);
    place(coco, { sceneId: npc.scene, x: pose.x + 24, y: pose.y + 6 });
    await sleep(700);
    await tap(1);
    await sleep(600);
    log.push(`talk ${npcId}: ${w.story?.cutscene?.id ?? "none"}`);
  };

  // The prologue's last morning (tested in full by qa-prologue.ts).
  w.story!.stage = "HOME";
  startCutscene(w, "morning", host);
  await sleep(600);
  await read(() => w.story?.cutscene?.id === "errand", {
    "morning:6": "01-morning-list",
  });
  await read(() => w.story?.stage === "ERRAND" && !w.story.cutscene, {
    "errand:0": "02-errand-opening",
  });
  log.push(`errand: sieg ${sieg.sceneId}, coco ${coco.sceneId}`);
  // Coco walks to the road's east end with real keys and takes it.
  for (let n = 0; n < 120 && coco.x < 790; n++) await hold(1, "d", 80);
  await hold(1, "e", 120);
  await sleep(1200);
  log.push(`coco to ${coco.sceneId}; party ${w.sceneId}`);
  await shot("03-emberbrook-arrival");
  await visit("healer");
  await read(() => w.story?.flags.includes("chapter0.moonleaf") ?? false, {
    "errand-brynn:0": "04-brynn",
    "errand-brynn:7": "05-brynn-paying",
  });
  await visit("shopkeeper");
  await read(() => w.story?.flags.includes("chapter0.store") ?? false, {
    "errand-store:0": "06-general-store",
  });
  await visit("baker");
  await read(() => w.story?.stage === "HOMEWARD" && !w.story.cutscene, {
    "errand-bakery:5": "07-bakery-happiness",
    "errand-done:0": "08-quest-complete",
  });
  log.push(`inventory: ${JSON.stringify(w.inventory?.counts)}`);
  await pages[1].keyboard.press("i");
  await sleep(500);
  await shot("09-inventory", [1]);
  await pages[1].keyboard.press("Escape");
  await sleep(300);
  // Home by the west road (E at RETURN), then up the garden path.
  await hold(1, "Escape", 100);
  place(coco, maps.EMBERBROOK_VILLAGE.points.back);
  await sleep(500);
  await hold(1, "e", 120);
  await sleep(1200);
  log.push(`coco home: ${coco.sceneId} at ${Math.round(coco.x)},${Math.round(coco.y)}`);
  place(coco, { x: 480, y: 470 });
  await sleep(400);
  for (let n = 0; n < 60 && !w.story?.cutscene; n++) await hold(1, "w", 80);
  await read(() => w.story?.stage === "SILENT_SHOP" && !w.story.cutscene, {
    "homecoming:0": "10-homecoming",
    "homecoming:3": "11-door-open",
  });
  // She stopped where the homecoming began; she walks up to the door.
  await hold(1, "Escape", 100);
  for (let n = 0; n < 30 && coco.y > 350; n++) await hold(1, "w", 60);
  await hold(1, "e", 120);
  await sleep(1200);
  await read(() => w.story?.flags.includes("chapter0.silent") ?? false, {
    "silent:1": "12-silent-shop",
  });
  await sleep(800);
  // A brief look around: Coco walks toward the desk.
  for (let n = 0; n < 10; n++) await hold(1, "w", 80);
  for (let n = 0; n < 6; n++) await hold(1, "a", 80);
  await shot("13-look-around");
  // Phase 3: Coco walks to Papa with real keys.
  for (let n = 0; n < 60 && !w.story?.cutscene; n++) {
    const a = w.story!.alden!;
    const key =
      Math.abs(coco.x - a.x) > 50 ? (coco.x > a.x ? "a" : "d") : coco.y > a.y ? "w" : "s";
    await hold(1, key, 60);
  }
  log.push(`discovery: ${w.story?.cutscene?.id}`);
  await read(() => w.story?.cutscene?.id === "sets-out", {
    "discovery:1": "14-papa",
    "discovery:6": "15-barely-opens-eyes",
    "discovery:16": "16-healing-attempt",
    "discovery:25": "17-your-oath",
    "discovery:28": "18-hand-falls-still",
    "discovery:32": "19-healing-again",
    "discovery:36": "20-bag-beside-workbench",
  });
  await read(() => w.story?.stage === "STRANGER" && !w.story.cutscene, {
    "sets-out:1": "21-mother",
  });
  log.push(`sieg: ${sieg.sceneId}; stranger ${JSON.stringify(w.story?.stranger)}`);
  // Sieg heads for the west road with real keys; she waits at the entrance.
  await shot("22a-mother-done");
  // Close the ordinary chat the scene's extra E presses opened with Mother.
  await hold(0, "Escape", 100);
  for (let n = 0; n < 60 && !w.story?.cutscene; n++) {
    await hold(0, "a", 80);
  }
  await read(() => w.story?.stage === "RUSHING" && !w.story.cutscene, {
    "stranger:2": "22-someone-waiting",
    "stranger:4": "23-fire-warning",
  });
  // He runs for the west road (E at RETURN) and out of town...
  await hold(0, "Escape", 100);
  place(sieg, maps.EMBERBROOK_VILLAGE.points.back);
  await sleep(500);
  await hold(0, "e", 120);
  await sleep(1200);
  log.push(`sieg road: ${sieg.sceneId} party ${w.sceneId}`);
  // ...and only on the road does he wonder, and glance back.
  for (let n = 0; n < 80 && !w.story?.cutscene; n++) await hold(0, "a", 80);
  await read(() => w.story?.flags.includes("chapter0.glance") ?? false, {
    "glance:0": "24-how-did-she-know",
    "glance:2": "25-vanished",
  });
  await sleep(400);
  place(sieg, { x: 480, y: 470 });
  await sleep(400);
  for (let n = 0; n < 60 && !w.story?.cutscene; n++) await hold(0, "w", 80);
  await read(() => w.story?.stage === "FINDING" && !w.story.cutscene, {
    "no-fire:0": "26-no-fire",
  });
  // He stopped where he first saw the shop; he walks up to the door.
  await hold(0, "Escape", 100);
  for (let n = 0; n < 30 && sieg.y > 350; n++) await hold(0, "w", 60);
  await hold(0, "e", 120);
  await sleep(1500);
  await read(() => w.story?.cutscene?.id === "next-day", {
    "reunion:4": "27-master-alden",
    "reunion:17": "28-everything-on-his-list",
    "reunion:28": "29-memory",
    "reunion:32": "30-not-going-anywhere",
  });
  // Phase 4: the following day, and the funeral beneath the old tree.
  await read(() => w.story?.stage === "FUNERAL_PREP" && !w.story.cutscene, {
    "next-day:1": "31-following-day",
  });
  for (const i of [0, 1]) await hold(i, "Escape", 100);
  await shot("32-preparing");
  const spot = async (i: number, at: { x: number; y: number }) => {
    const p = i ? coco : sieg;
    place(p, { sceneId: "MAIN_HOUSE", x: at.x, y: at.y + 18 });
    await sleep(500);
    await hold(i, "e", 120);
    await sleep(300);
  };
  const { stoneSpots, flowerSpots, graveFront } = await import(
    "../packages/shared/src/chapter0.js"
  );
  for (const s of stoneSpots) await spot(0, s);
  for (const s of flowerSpots) await spot(1, s);
  await shot("33-gathered");
  log.push(`gathered: ${JSON.stringify(w.inventory?.counts)}`);
  await spot(0, graveFront);
  await shot("34-stones-laid");
  await spot(0, graveFront);
  await spot(1, { x: graveFront.x - 30, y: graveFront.y });
  log.push(`funeral: ${w.story?.cutscene?.id}`);
  await read(() => w.story?.stage === "INVESTIGATION" && !w.story.cutscene, {
    "funeral:0": "35-laid-to-rest",
    "funeral:2": "36-coco-flowers",
    "funeral:9": "37-sieg-sword",
    "funeral:20": "38-goodbye",
  });
  await sleep(800);
  await shot("39-after-funeral");
  // The grave as the funeral left it, with the heroes stepped aside.
  place(sieg, { x: 250, y: 500 });
  place(coco, { x: 300, y: 500 });
  await sleep(900);
  await shot("40-grave", [0]);
  // The old tree over the grave, framed whole.
  place(sieg, { x: 230, y: 260 });
  await sleep(900);
  await shot("40b-old-tree", [0]);
  log.push(`after: flags ${w.story?.flags.filter((f) => f.startsWith("chapter0.")).join(",")}`);
  // Phase 5: asking around Emberbrook, then Papa's desk.
  for (const i of [0, 1]) {
    await hold(i, "Escape", 100);
    place(i ? coco : sieg, { sceneId: "MAIN_HOUSE", ...maps.MAIN_HOUSE.points.exit });
    await sleep(400);
    await hold(i, "e", 120);
    await sleep(900);
  }
  log.push(`to town: ${sieg.sceneId} ${coco.sceneId} party ${w.sceneId}`);
  const askAs = async (i: number, npcId: string) => {
    await hold(i, "Escape", 100);
    const npc = npcs.find((n) => n.id === npcId)!;
    const pose = npcPose(npc, w.serverTick, w);
    place(i ? coco : sieg, { sceneId: npc.scene, x: pose.x + 24, y: pose.y + 6 });
    await sleep(700);
    // Walking villagers move on while the screen settles: step up again, on
    // a side away from any door (E beside a door opens the door instead).
    const now = npcPose(npc, w.serverTick, w);
    const side =
      [
        { x: 24, y: 6 },
        { x: -24, y: 6 },
        { x: 0, y: 30 },
        { x: 0, y: -30 },
      ]
        .map((d) => ({ x: now.x + d.x, y: now.y + d.y }))
        .find((at) =>
          Object.values(maps[npc.scene].points).every(
            (q) => Math.hypot(q.x - at.x, q.y - at.y) > 60,
          ),
        ) ?? { x: now.x + 24, y: now.y + 6 };
    const hero = i ? coco : sieg;
    place(hero, { sceneId: npc.scene, ...side });
    await sleep(700); // the client's view of the hero catches up
    await tap(i);
    await sleep(600);
    const then = npcPose(npc, w.serverTick, w);
    log.push(
      `ask ${npcId}: ${w.story?.cutscene?.id ?? "none"}` +
        (w.story?.cutscene
          ? ""
          : ` (hero ${Math.round(hero.x)},${Math.round(hero.y)} npc ${Math.round(then.x)},${Math.round(then.y)} talks ${JSON.stringify(w.npcTalks ?? {})} walks ${JSON.stringify(w.story?.walks ?? {})})`),
    );
  };
  await askAs(1, "merchant");
  await read(() => w.story?.flags.includes("chapter0.clue-merchant") ?? false, {
    "ask-merchant:2": "41-merchant",
    "ask-merchant:7": "42-stopped-answering",
  });
  await askAs(0, "elder");
  await read(() => w.story?.flags.includes("chapter0.clue-bertram") ?? false, {
    "ask-bertram:6": "43-bertram-baby",
  });
  await askAs(1, "healer");
  await read(() => w.story?.stage === "JOURNAL" && !w.story.cutscene, {
    "ask-brynn:6": "44-brynn-the-ember",
    "ask-brynn:8": "45-brynn-only-a-name",
    "clues-done:1": "45-search-belongings",
  });
  const { storySpots } = await import("../packages/shared/src/chapter0.js");
  for (const [i, id] of [
    [0, "force-drawer"],
    [1, "undo-seal"],
  ] as const) {
    await hold(i, "Escape", 100);
    const sp = storySpots.find((q) => q.id === id)!;
    place(i ? coco : sieg, { sceneId: "HOUSE_INTERIOR", x: sp.x, y: sp.y + 16 });
    await sleep(600);
    if (i === 0) await shot("46-desk", [0]);
    await hold(i, "e", 120);
    await sleep(500);
  }
  log.push(`journal: ${w.story?.cutscene?.id}`);
  await read(() => w.story?.stage === "DECISION" && !w.story.cutscene, {
    "journal:0": "47-compartment",
    "journal:6": "48-journal-entry",
    "journal:13": "49-cloth",
    "journal:21": "50-afraid-youd-say",
  });
  await hold(1, "Escape", 100);
  await pages[1].keyboard.press("i");
  await sleep(500);
  await shot("51-inventory", [1]);
  await pages[1].keyboard.press("Escape");
  log.push(`decision: ${w.story?.stage}; items ${JSON.stringify(w.inventory?.counts)}`);
  // Phase 6: out to the old tree; Coco gets there first and Sieg comes over.
  await pages[1].keyboard.press("Escape");
  place(sieg, { sceneId: "MAIN_HOUSE", x: 480, y: 360 });
  place(coco, { sceneId: "MAIN_HOUSE", x: 300, y: 480 });
  await sleep(800);
  for (let n = 0; n < 40 && !w.story?.cutscene; n++) await hold(1, "a", 80);
  log.push(`decision scene: ${w.story?.cutscene?.id}`);
  await read(() => w.story?.stage === "DONE" && !w.story.cutscene, {
    "decision:5": "52-papa-isnt-here",
    "decision:15": "53-keep-my-promise",
    "decision:22": "54-find-a-goddess",
    "decision:23": "55-quest-unlocked",
  });
  await sleep(800);
  for (const i of [0, 1]) await hold(i, "Escape", 100);
  await shot("56-quest");
  // The road north: to Emberbrook together, and out by the north road.
  place(sieg, { sceneId: "MAIN_HOUSE", ...maps.MAIN_HOUSE.points.exit });
  await sleep(600);
  await hold(0, "e", 200);
  await sleep(1500);
  log.push(`road: party ${w.sceneId}`);
  place(sieg, { ...maps.EMBERBROOK_VILLAGE.points.exit });
  await sleep(600);
  await shot("57-north-road", [0]);
  await hold(0, "e", 200);
  await sleep(1500);
  log.push(`north: party ${w.sceneId}; flags ${w.story?.flags.filter((f) => f === "chapter0.shrine-quest").length}`);
  await shot("58-on-the-road");
  // Neither client may have fallen back to the title screen along the way.
  for (const [i, pg] of pages.entries())
    if (await pg.locator("#create").isVisible())
      errors.push(`client ${i}: back on the title screen`);
  log.push(
    `end: stage ${w.story?.stage}, coco ${coco.sceneId} ${Math.round(coco.x)},${Math.round(coco.y)}, alden ${JSON.stringify(w.story?.alden)}`,
  );
} finally {
  writeFileSync(`${dir}/qa.json`, JSON.stringify({ errors, log }, null, 2));
  console.log(log.join("\n"), "\nerrors:", errors);
  await browser.close();
  process.exit(0);
}
