// Automated walkthrough: full normal encounter, only movement/ability/item intents.
// Plan once against the authoritative simulation, reset, then replay the same intents
// while recording both real clients. No actor teleports, removed enemies or granted items.
import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { GameRoom } from "../apps/server/src/GameRoom.js";
import { collisionRects } from "../packages/shared/src/maps.js";
import {
  neutral,
  type Player,
  type InputFrame,
} from "../packages/shared/src/gameTypes.js";
import { hedgeMazeState } from "../packages/shared/src/hedgeMaze.js";
import {
  MAZE_CHEST_TARGET,
  MAZE_GATE_TARGET,
  MAZE_RUNNER_TARGET,
} from "../apps/server/src/hedgeMaze.js";
import { lineClear } from "../apps/server/src/enemySimulation.js";
import { io } from "socket.io-client";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const folder = resolve("docs/quests/bald-goddess/recording-maze");
const combatEvidence = { beamSeen: false, punchSeen: false };
await mkdir(folder, { recursive: true });
type Step = {
  inputs?: Partial<InputFrame>[];
  use?: { actor: number; targetId: string; itemId?: "hedge_gate_key" };
  chapter?: string;
};
function plan(room: GameRoom, advance = room.tick.bind(room)) {
  const w = room.state,
    heroes = Object.values(w.players).sort((a, b) =>
      a.role === "OATH" ? -1 : 1,
    ),
    [s, c] = heroes,
    maze = hedgeMazeState(w.puzzles)!,
    steps: Step[] = [];
  const receive = room.receiveInput.bind(room);
  function tick(actor?: Player, patch: Partial<InputFrame> = {}) {
    const inputs = heroes.map((p) => (p === actor ? patch : {}));
    for (let i = 0; i < 2; i++)
      receive(heroes[i].id, {
        ...neutral(room.sessions.get(heroes[i].id)!.input.seq + 1),
        ...inputs[i],
      });
    advance();
    combatEvidence.beamSeen ||= Object.values(w.projectiles).some(
      (q) => q.effect === "golem_beam",
    );
    combatEvidence.punchSeen ||= Object.values(w.enemies).some(
      (e) =>
        e.type === "ironbound_sentinel" &&
        e.state === "ATTACK" &&
        e.attackKind === "melee",
    );
    steps.push({ inputs });
  }
  function mark(chapter: string) {
    console.log(chapter, "tick", w.serverTick);
    steps.push({ chapter });
    for (let n = 0; n < 15; n++) tick();
  }
  function path(player: Player, goal: { x: number; y: number }) {
    const walls = collisionRects("HEDGE_MAZE", w.puzzles),
      allowed = (x: number, y: number) =>
        x >= 0 &&
        x < 48 &&
        y >= 0 &&
        y < 40 &&
        !walls.some(
          (r) =>
            (x + 0.5) * 32 + 13 > r.x &&
            (x + 0.5) * 32 - 13 < r.x + r.w &&
            (y + 0.5) * 32 + 13 > r.y &&
            (y + 0.5) * 32 - 13 < r.y + r.h,
        );
    const start = Math.floor(player.y / 32) * 48 + Math.floor(player.x / 32),
      end = Math.floor(goal.y / 32) * 48 + Math.floor(goal.x / 32),
      prev = new Map([[start, -1]]),
      q = [start];
    for (let i = 0; i < q.length && !prev.has(end); i++) {
      const k = q[i],
        x = k % 48,
        y = Math.floor(k / 48);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const n = ny * 48 + nx;
        if (allowed(nx, ny) && !prev.has(n)) {
          prev.set(n, k);
          q.push(n);
        }
      }
    }
    if (!prev.has(end)) throw Error(`No route to ${end} from ${start}`);
    const route: number[] = [];
    for (let k = end; k !== start; k = prev.get(k)!) route.unshift(k);
    return route.map((k) => ({
      x: ((k % 48) + 0.5) * 32,
      y: (Math.floor(k / 48) + 0.5) * 32,
    }));
  }
  function steer(
    player: Player,
    goal: { x: number; y: number },
    extra: Partial<InputFrame> = {},
  ) {
    const dx = goal.x - player.x,
      dy = goal.y - player.y;
    tick(player, {
      moveX: Math.abs(dx) > 3 ? Math.sign(dx) : 0,
      moveY: Math.abs(dy) > 3 ? Math.sign(dy) : 0,
      ...extra,
    });
  }
  function move(player: Player, goal: { x: number; y: number }) {
    for (const waypoint of path(player, goal)) {
      let n = 0;
      while (
        Math.hypot(player.x - waypoint.x, player.y - waypoint.y) > 5 &&
        n++ < 100
      )
        steer(player, waypoint);
      if (n >= 100) throw Error("Movement stuck");
    }
    tick();
  }
  function fight(id: string) {
    let route: { x: number; y: number }[] = [];
    for (let n = 0; n < 2400; n++) {
      const e = w.enemies[id];
      if (!e || e.hp <= 0) {
        tick();
        return;
      }
      const distance = Math.hypot(s.x - e.x, s.y - e.y);
      if (
        distance < 75 &&
        lineClear(s, e, collisionRects("HEDGE_MAZE", w.puzzles))
      ) {
        route = [];
        tick(s, {
          moveX: Math.sign(e.x - s.x),
          moveY: Math.sign(e.y - s.y),
          primaryHeld: true,
          secondaryHeld: true,
        });
      } else {
        if (!route.length) route = path(s, e);
        while (
          route.length &&
          Math.hypot(s.x - route[0].x, s.y - route[0].y) <= 5
        )
          route.shift();
        steer(s, route[0] ?? e, { secondaryHeld: true });
      }
    }
    throw Error(`Could not defeat ${id}`);
  }
  function use(actor: Player, targetId: string, itemId?: "hedge_gate_key") {
    room.useItem(actor.id, {
      requestId: `walk-${steps.length}`,
      targetId,
      ...(itemId ? { itemId } : {}),
    });
    steps.push({ use: { actor: heroes.indexOf(actor), targetId, itemId } });
    tick();
  }
  mark("1 · Clear the first Mossling and Cinder Wisp");
  fight("maze-moss-before");
  fight("maze-wisp-before");
  mark("2 · Coco burns the marked hedge");
  move(c, { x: 16.5 * 32, y: 34.5 * 32 });
  tick(c, { moveX: 1 });
  tick(c, { primaryHeld: true });
  for (let n = 0; n < 90 && !maze.burned; n++) tick();
  assert(maze.burned);
  mark("3 · Clear the three guards before the cow");
  fight("maze-moss-cow");
  fight("maze-wisp-cow");
  fight("maze-sentinel");
  mark("4 · Coco pulls the cow into its grazing bay");
  move(c, { x: 20.5 * 32, y: 25.5 * 32 });
  tick(c, { moveX: 1 });
  tick(c, { blackHoleHeld: true });
  for (let n = 0; n < 150 && !maze.cow.parked; n++) tick();
  assert(maze.cow.parked);
  mark("5 · Regroup for the fleeing key carrier");
  move(s, { x: 27.5 * 32, y: 15.5 * 32 });
  move(c, { x: 32.5 * 32, y: 18.5 * 32 });
  mark("6 · Slow Time + Super Speed chase");
  tick(c, { slowTimeHeld: true });
  tick(s, { sprintHeld: true });
  let route: { x: number; y: number }[] = [];
  for (let n = 0; n < 295 && !maze.runner.caught; n++) {
    if (Math.hypot(s.x - maze.runner.x, s.y - maze.runner.y) <= 40) {
      use(s, MAZE_RUNNER_TARGET);
      break;
    }
    if (!route.length) route = path(s, maze.runner);
    while (route.length && Math.hypot(s.x - route[0].x, s.y - route[0].y) <= 5)
      route.shift();
    steer(s, route[0] ?? maze.runner);
  }
  assert(maze.runner.caught, "Runner not captured");
  mark("7 · Shared key opens the chest gate");
  move(s, { x: 39.5 * 32, y: 14.5 * 32 });
  use(s, MAZE_GATE_TARGET, "hedge_gate_key");
  assert(w.puzzles.hedgeGate.complete);
  mark("8 · Coco collects the shared Enchanted Shears");
  move(c, { x: 44.5 * 32, y: 6.5 * 32 });
  use(c, MAZE_CHEST_TARGET);
  assert.equal(w.inventory!.counts.enchanted_shears, 1);
  mark("9 · Return through the cleared maze");
  move(c, { x: 4.5 * 32, y: 34.5 * 32 });
  move(s, { x: 4.5 * 32, y: 33.5 * 32 });
  for (let n = 0; n < 60; n++) tick();
  return steps;
}
if (process.argv.includes("--plan-only")) {
  const room = new GameRoom("ABC234", false, "HEDGE_MAZE"),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  const steps = plan(room);
  await writeFile(`${folder}/plan.json`, JSON.stringify(steps));
  console.log(
    "Planned",
    steps.length,
    "steps; all five guards defeated; shears acquired.",
    combatEvidence,
  );
  process.exit(0);
}
const app = createApp({ startingScene: "HEDGE_MAZE" });
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
  const steps = plan(room, advance);
  await writeFile(`${folder}/plan.json`, JSON.stringify(steps));
  room.reset();
  room.state.phase = "PLAYING";
  room.state.serverTick = 0;
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
  assert.equal(room.state.inventory!.counts.enchanted_shears, 1);
  assert.equal(
    Object.values(room.state.enemies).filter((e) => e.hp > 0).length,
    0,
  );
  assert(hedgeMazeState(room.state.puzzles)!.runner.caught);
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
        allFiveGuardsDefeated: true,
        golemBeamSeen: combatEvidence.beamSeen,
        golemPunchSeen: combatEvidence.punchSeen,
        noTeleports: true,
        sharedShears: room.state.inventory!.counts.enchanted_shears,
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
