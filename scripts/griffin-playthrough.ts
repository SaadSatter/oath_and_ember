// Intent-only Griffin run; starts with tools earned on the two previous branches.
import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { GameRoom } from "../apps/server/src/GameRoom.js";
import { collisionRects } from "../packages/shared/src/maps.js";
import {
  neutral,
  type Player,
  type InputFrame,
} from "../packages/shared/src/gameTypes.js";
import { griffinState, GRIFFIN_NEST } from "../packages/shared/src/griffin.js";
import {
  shrineComplete,
  SHRINE_OFFERING,
} from "../packages/shared/src/shrine.js";
import { io } from "socket.io-client";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const folder = resolve("docs/quests/bald-goddess/recording-griffin");
await mkdir(folder, { recursive: true });
type Step = {
  inputs?: Partial<InputFrame>[];
  use?: {
    actor: number;
    targetId: string;
    itemId?: "vanity_mirror" | "enchanted_shears" | "griffin_wig";
  };
  chapter?: string;
};
function seedPriorRewards(room: GameRoom) {
  room.state.inventory!.counts = { vanity_mirror: 1, enchanted_shears: 1 };
  room.state.inventory!.revision++;
}
function plan(room: GameRoom, advance = room.tick.bind(room)) {
  const w = room.state,
    heroes = Object.values(w.players).sort((a, b) =>
      a.role === "OATH" ? -1 : 1,
    ),
    [s, c] = heroes,
    g = griffinState(w.puzzles)!,
    steps: Step[] = [];
  function tick(actor?: Player, patch: Partial<InputFrame> = {}) {
    const inputs = heroes.map((p) =>
      p === actor ? { ...patch } : ({} as Partial<InputFrame>),
    );
    // Dodge a locked eye beam with ordinary movement intent; no damage/position overrides.
    if (g.phase === "BEAM_CHARGE" && g.timer < 0.5)
      for (let i = 0; i < 2; i++) {
        const p = heroes[i],
          dx = p.x - g.x,
          dy = p.y - g.y,
          distance = Math.abs(
            dx * Math.sin(g.facing) - dy * Math.cos(g.facing),
          );
        if (
          distance < 70 &&
          dx * Math.cos(g.facing) + dy * Math.sin(g.facing) > 0
        ) {
          inputs[i].moveX = Math.sign(-Math.sin(g.facing));
          inputs[i].moveY = Math.sign(Math.cos(g.facing));
        }
      }
    for (let i = 0; i < 2; i++)
      room.receiveInput(heroes[i].id, {
        ...neutral(room.sessions.get(heroes[i].id)!.input.seq + 1),
        ...inputs[i],
      });
    advance();
    steps.push({ inputs });
    assert(
      s.hp > 0 && c.hp > 0,
      `Hero down at ${w.serverTick}: ${s.hp}/${c.hp} ${g.phase}`,
    );
  }
  function mark(chapter: string) {
    console.log(
      chapter,
      w.serverTick,
      JSON.stringify({
        g: [g.x, g.y, g.phase],
        s: [s.x, s.y, s.hp],
        c: [c.x, c.y, c.hp],
      }),
    );
    steps.push({ chapter });
    for (let i = 0; i < 15; i++) tick();
  }
  function move(p: Player, goal: { x: number; y: number }, limit = 1200) {
    let route: { x: number; y: number }[] = [];
    function path() {
      const width = 40,
        height = 36,
        walls = collisionRects(w.sceneId, w.puzzles).filter(
          (r) => !p.flightRemaining || !r.terrain,
        );
      const open = (x: number, y: number) =>
        x >= 1 &&
        x < width - 1 &&
        y >= 1 &&
        y < height - 1 &&
        !walls.some(
          (r) =>
            (x + 0.5) * 32 + 13 > r.x &&
            (x + 0.5) * 32 - 13 < r.x + r.w &&
            (y + 0.5) * 32 + 13 > r.y &&
            (y + 0.5) * 32 - 13 < r.y + r.h,
        );
      const start = Math.floor(p.y / 32) * width + Math.floor(p.x / 32),
        end = Math.floor(goal.y / 32) * width + Math.floor(goal.x / 32),
        prev = new Map([[start, -1]]),
        q = [start];
      for (let i = 0; i < q.length && !prev.has(end); i++) {
        const k = q[i],
          x = k % width,
          y = Math.floor(k / width);
        for (const [nx, ny] of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ]) {
          const n = ny * width + nx;
          if (open(nx, ny) && !prev.has(n)) {
            prev.set(n, k);
            q.push(n);
          }
        }
      }
      assert(prev.has(end), `No path ${p.x},${p.y} -> ${goal.x},${goal.y}`);
      const keys: number[] = [];
      for (let k = end; k !== start; k = prev.get(k)!) keys.push(k);
      return keys
        .reverse()
        .map((k) => ({
          x: ((k % width) + 0.5) * 32,
          y: (Math.floor(k / width) + 0.5) * 32,
        }))
        .concat([goal]);
    }
    for (let n = 0; n < limit; n++) {
      if (Math.hypot(p.x - goal.x, p.y - goal.y) < 6) {
        tick();
        return;
      }
      if (!route.length || n % 30 === 0) route = path();
      while (route.length && Math.hypot(p.x - route[0].x, p.y - route[0].y) < 6)
        route.shift();
      const next = route[0] ?? goal,
        dx = next.x - p.x,
        dy = next.y - p.y;
      tick(p, {
        moveX: Math.abs(dx) > 3 ? Math.sign(dx) : 0,
        moveY: Math.abs(dy) > 3 ? Math.sign(dy) : 0,
      });
    }
    throw Error(`Move timeout ${p.x},${p.y} -> ${goal.x},${goal.y}`);
  }
  function item(
    actor: number,
    targetId: string,
    itemId?: "vanity_mirror" | "enchanted_shears" | "griffin_wig",
  ) {
    room.useItem(heroes[actor].id, {
      requestId: `plan-${steps.length}`,
      targetId,
      itemId,
    });
    steps.push({ use: { actor, targetId, itemId } });
    tick();
  }
  mark("1 · Northern enclosure — mirror and shears earned on prior maps");
  move(s, { x: 1008, y: 720 });
  move(s, { x: 896, y: 720 });
  move(c, { x: 800, y: 404 });
  mark("2 · Dodge the Griffin's eye beams; prepare a shore-side Black Hole");
  let pulled = false;
  for (let attempt = 0; attempt < 4 && !pulled; attempt++) {
    let ready = false;
    for (let n = 0; n < 1200; n++) {
      const targetX = g.x - 192;
      if (
        Math.abs(c.x - targetX) < 16 &&
        Math.abs(c.y - 404) < 10 &&
        g.phase === "BEAM_CHARGE" &&
        g.timer > 1.02 &&
        !(c.cooldowns.blackHole > 0)
      ) {
        ready = true;
        break;
      }
      tick(c, {
        moveX: Math.abs(c.x - targetX) > 6 ? Math.sign(targetX - c.x) : 0,
        moveY: c.y > 410 ? -1 : c.y < 400 ? 1 : 0,
      });
    }
    assert(ready, `No cast window: ${g.x},${g.phase},${c.x},${c.y}`);
    tick(c, { moveX: 1 });
    tick(c, { blackHoleHeld: true });
    for (let n = 0; n < 220; n++) {
      tick();
      if (g.grounded > 0) pulled = true;
    }
  }
  assert(pulled, "Could not pull Griffin ashore");
  mark("3 · Black Hole drags it ashore — Sieg baits a headbutt into a pillar");
  for (let n = 0; n < 600 && !g.pillars.some(Boolean); n++) {
    if (g.phase === "HEADBUTT_CHARGE") tick(s, { moveX: 1 });
    else tick();
  }
  assert(g.pillars.some(Boolean), "No pillar stun");
  mark("4 · Pillar collapsed! Slow Time and Super Speed create a safe opening");
  tick(c, { slowTimeHeld: true });
  tick(s, { sprintHeld: true, moveX: -1 });
  tick(c, { flightHeld: true });
  move(c, { x: 640, y: 144 });
  mark("5 · Coco reaches the nest — offer the Vanity Mirror");
  item(1, GRIFFIN_NEST, "vanity_mirror");
  mark("6 · The Griffin is distracted — use the Enchanted Shears");
  item(1, GRIFFIN_NEST, "enchanted_shears");
  assert.equal(w.inventory!.counts.griffin_wig, 1);
  mark("7 · Magnificent Griffin Wig in the shared backpack — return south");
  move(c, { x: 640, y: 1088 });
  tick(c, { interactHeld: true });
  assert.equal(w.sceneId, "GODDESS_SHRINE");
  mark("8 · Reunited at the shrine — offer the wig to the Bald Goddess");
  move(c, { x: 640, y: 544 });
  item(1, SHRINE_OFFERING, "griffin_wig");
  assert(shrineComplete(w));
  mark("9 · Quest complete — the goddess has divine volume");
  for (let n = 0; n < 90; n++) tick();
  return steps;
}
if (process.argv.includes("--plan-only")) {
  const room = new GameRoom("ABC234", false, "GRIFFIN_ENCLOSURE"),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  seedPriorRewards(room);
  const steps = plan(room);
  await writeFile(`${folder}/plan.json`, JSON.stringify(steps));
  console.log(
    "Planned",
    steps.length,
    "steps; Griffin pillar stun, shared wig and shrine offering completed.",
  );
  process.exit(0);
}
const app = createApp({ startingScene: "GRIFFIN_ENCLOSURE" });
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
const sockets = [io(url), io(url)];
const req = (i: number, event: string, p: unknown) =>
  new Promise<any>((resolve, reject) =>
    sockets[i]
      .timeout(3000)
      .emit(event, p, (err: Error, result: any) =>
        err
          ? reject(err)
          : result.ok
            ? resolve(result.data)
            : reject(Error(result.error)),
      ),
  );
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await Promise.all(
    sockets.map((s) => new Promise<void>((r) => s.on("connect", r))),
  );
  const sessions = [await req(0, "room:create", {})];
  sessions.push(await req(1, "room:join", { roomCode: sessions[0].roomCode }));
  await req(0, "role:select", { role: "OATH" });
  await req(1, "role:select", { role: "EMBER" });
  await req(0, "lobby:ready", { ready: true });
  await req(1, "lobby:ready", { ready: true });
  const room = app.manager.get(sessions[0].roomCode),
    advance = room.tick.bind(room);
  room.tick = () => {};
  room.reset();
  room.state.phase = "PLAYING";
  room.state.serverTick = 0;
  seedPriorRewards(room);
  const steps = plan(room, advance);
  await writeFile(`${folder}/plan.json`, JSON.stringify(steps));
  room.reset();
  room.state.phase = "PLAYING";
  room.state.serverTick = 0;
  seedPriorRewards(room);
  sockets.forEach((s) => s.disconnect());
  browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
  const contexts = [],
    pages = [];
  const videoStarts: number[] = [];
  const errors: string[] = [];
  for (const session of sessions) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 720 },
      recordVideo: { dir: folder, size: { width: 960, height: 720 } },
    });
    contexts.push(context);
    await context.addInitScript(
      (s) => sessionStorage.setItem("oath-session", JSON.stringify(s)),
      session,
    );
    videoStarts.push(Date.now());
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${url}/?recordingQA=1`);
    pages.push(page);
  }
  for (const page of pages) {
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.id = "walkthrough-caption";
      el.style.cssText =
        "position:fixed;left:0;right:0;bottom:82px;text-align:center;background:#081a20e8;color:#f4d186;padding:10px;font:16px Arial;z-index:30";
      document.body.append(el);
    });
  }
  const heroes = sessions.map((s) => room.state.players[s.playerId]);
  const receive = room.receiveInput.bind(room);
  room.receiveInput = () => false; // Ignore neutral browser input; automated ordinary intents below drive this recording.
  const started = Date.now(),
    events: { chapter: string; time: number; tick: number }[] = [];
  let frame = 0;
  let due = performance.now();
  for (const step of steps) {
    if (step.chapter) {
      events.push({
        chapter: step.chapter,
        time: (Date.now() - started) / 1000,
        tick: room.state.serverTick,
      });
      console.log("Recording", step.chapter);
      await Promise.all(
        pages.map((p) =>
          p.evaluate((text) => {
            document.querySelector("#walkthrough-caption")!.textContent =
              `${text} · automated playthrough · 2× speed`;
          }, step.chapter),
        ),
      );
    }
    if (step.use)
      room.useItem(heroes[step.use.actor].id, {
        requestId: `replay-${frame}`,
        targetId: step.use.targetId,
        ...(step.use.itemId ? { itemId: step.use.itemId } : {}),
      });
    if (step.inputs) {
      for (let i = 0; i < 2; i++)
        receive(heroes[i].id, {
          ...neutral(room.sessions.get(heroes[i].id)!.input.seq + 1),
          ...step.inputs[i],
        });
      advance();
      frame++;
    }
    if (frame % 2 === 0) {
      app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
      due += 1000 / 30;
      await new Promise<void>((r) =>
        setTimeout(r, Math.max(0, due - performance.now())),
      );
    }
  }
  assert(shrineComplete(room.state));
  await pages[0].keyboard.press("i");
  await pages[0].waitForTimeout(1500);
  await pages[0].screenshot({ path: `${folder}/completed.png` });
  const videos = [];
  for (let i = 0; i < 2; i++) {
    const video = pages[i].video()!;
    await contexts[i].close();
    videos.push(await video.path());
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${folder}/report.json`,
    JSON.stringify(
      {
        videos,
        videoStarts,
        startedTimestamp: started,
        duration: (Date.now() - started) / 1000,
        events,
        frames: frame,
        playbackSpeed: 2,
        pillarStunned: griffinState(room.state.puzzles)!.pillars.some(Boolean),
        sharedWigAcquired: griffinState(room.state.puzzles)!.wigClaimed,
        goddessComplete: shrineComplete(room.state),
        priorBranchToolsFixture: ["vanity_mirror", "enchanted_shears"],
        noActorPositionOrHealthOverrides: true,
      },
      null,
      2,
    ),
  );
  console.log("Recorded", JSON.stringify(videos));
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
