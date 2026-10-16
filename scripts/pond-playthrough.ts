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
import {
  mirrorPondState,
  pondStations,
  normalizeMirrorAngle,
} from "../packages/shared/src/mirrorPond.js";
import { POND_CHEST_TARGET } from "../apps/server/src/mirrorPond.js";
import { lineClear } from "../apps/server/src/enemySimulation.js";
import { io } from "socket.io-client";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { ticksFor, SPEED, DT } from "../packages/shared/src/constants.js";
const folder = resolve("docs/quests/bald-goddess/recording-pond");
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
    pond = mirrorPondState(w.puzzles)!,
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
    steps.push({ inputs });
  }
  function align(c: Player, station: (typeof pondStations)[number]) {
    const horizontal = !!station.incoming.x,
      key = horizontal ? "y" : "x",
      target = horizontal ? station.shot.y : station.shot.x;
    const step = SPEED * DT * (w.slowTime ? 0.2 : 1);
    let best = { a: 0, b: 0, error: Infinity, cost: Infinity };
    for (let a = -8; a <= 8; a++)
      for (let b = -8; b <= 8; b++) {
        const error = Math.abs(
            c[key] + a * step + (b * step) / Math.SQRT2 - target,
          ),
          cost = Math.abs(a) + Math.abs(b);
        if (
          (error < 0.2 && cost < best.cost) ||
          (best.error >= 0.2 && error < best.error)
        )
          best = { a, b, error, cost };
      }
    for (let n = 0; n < Math.abs(best.a); n++)
      tick(
        c,
        horizontal
          ? { moveY: Math.sign(best.a) }
          : { moveX: Math.sign(best.a) },
      );
    for (let n = 0; n < Math.abs(best.b); n++)
      tick(
        c,
        horizontal
          ? { moveY: Math.sign(best.b), moveX: n % 2 ? 1 : -1 }
          : { moveX: Math.sign(best.b), moveY: n % 2 ? 1 : -1 },
      );
  }
  function mark(chapter: string) {
    console.log(chapter, "tick", w.serverTick);
    steps.push({ chapter });
    for (let n = 0; n < ticksFor(0.5); n++) tick();
  }
  function path(player: Player, goal: { x: number; y: number }) {
    const walls = collisionRects(
        "MIRROR_POND",
        w.puzzles,
        undefined,
        undefined,
        w.players,
        w.serverTick,
        player.role,
      ),
      allowed = (x: number, y: number) =>
        x >= 0 &&
        x < 48 &&
        y >= 0 &&
        y < 40 &&
        !walls
          .filter((r) => !player.flightRemaining || !r.terrain)
          .some(
            (rect) =>
              (x + 0.5) * 32 + 13 > rect.x &&
              (x + 0.5) * 32 - 13 < rect.x + rect.w &&
              (y + 0.5) * 32 + 13 > rect.y &&
              (y + 0.5) * 32 - 13 < rect.y + rect.h,
          );
    const start = Math.floor(player.y / 32) * 48 + Math.floor(player.x / 32),
      end = Array.from({ length: 48 * 40 }, (_, k) => k)
        .filter((k) => allowed(k % 48, Math.floor(k / 48)))
        .sort(
          (a, b) =>
            Math.hypot(
              ((a % 48) + 0.5) * 32 - goal.x,
              (Math.floor(a / 48) + 0.5) * 32 - goal.y,
            ) -
            Math.hypot(
              ((b % 48) + 0.5) * 32 - goal.x,
              (Math.floor(b / 48) + 0.5) * 32 - goal.y,
            ),
        )[0],
      prev = new Map<number, number>([[start, -1]]),
      queue = [start];
    for (let i = 0; i < queue.length && !prev.has(end); i++) {
      const key = queue[i],
        x = key % 48,
        y = Math.floor(key / 48);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const next = ny * 48 + nx;
        if (allowed(nx, ny) && !prev.has(next)) {
          prev.set(next, key);
          queue.push(next);
        }
      }
    }
    if (!prev.has(end)) throw Error(`No route from ${start} to ${end}`);
    const route: number[] = [];
    for (let key = end; key !== start; key = prev.get(key)!) route.unshift(key);
    return route.map((key) => ({
      x: ((key % 48) + 0.5) * 32,
      y: (Math.floor(key / 48) + 0.5) * 32,
    }));
  }
  function go(p: Player, x: number, y: number) {
    for (const v of [...path(p, { x, y }), { x, y }]) {
      let n = 0;
      while (Math.hypot(p.x - v.x, p.y - v.y) > 4.3 && n++ < ticksFor(6)) {
        const dx = v.x - p.x,
          dy = v.y - p.y;
        tick(p, {
          moveX: Math.abs(dx) > 3 ? Math.sign(dx) : 0,
          moveY: Math.abs(dy) > 3 ? Math.sign(dy) : 0,
        });
      }
      if (n >= ticksFor(6))
        throw Error(`Blocked ${p.role} ${p.x},${p.y} -> ${v.x},${v.y}`);
    }
  }

  mark("1 · Coco flies through the water culvert to the firing island");
  tick(c, { flightHeld: true });
  go(c, 35 * 32, 31 * 32);
  go(c, 35 * 32, 27 * 32);
  go(c, 28 * 32, 12 * 32);
  mark("2 · Slow Time + Super Speed: Sieg crosses the east spikes");
  go(s, 43 * 32, 26 * 32);
  let crossed = false;
  for (let attempt = 0; attempt < 5 && !crossed; attempt++) {
    while (s.cooldowns.sprint) tick();
    go(s, 43 * 32, 26 * 32);
    while (Math.abs(Math.sin(pond.clock * 3.2)) < 0.85) tick();
    tick(c, { slowTimeHeld: true });
    tick(s, { sprintHeld: true });
    for (let n = 0; n < ticksFor(1.5) && s.x > 36.5 * 32; n++) tick(s, { moveX: -1 });
    crossed = s.x < 37 * 32;
  }
  assert(crossed);
  while (s.sprintRemaining) tick();
  const approaches = [
    [38, 15],
    [29, 6],
    [6, 15],
    [19, 30],
  ];
  for (let i = 0; i < 4; i++) {
    mark(
      `${i + 3} · Mirror ${i + 1}: Sieg aims, Coco reflects fire, Sieg restores`,
    );
    const p = pondStations[i],
      [x, y] = approaches[i];
    go(s, x * 32, y * 32);
    tick(s, {
      moveX:
        Math.abs(p.x - s.x) > Math.abs(p.y - s.y) ? Math.sign(p.x - s.x) : 0,
      moveY:
        Math.abs(p.y - s.y) >= Math.abs(p.x - s.x) ? Math.sign(p.y - s.y) : 0,
    });
    for (
      let n = 0;
      Math.abs(pond.mirrors[i] - normalizeMirrorAngle(p.angle)) > 1e-7 &&
      n < 241;
      n++
    )
      tick(s, { pushHeld: true });
    tick();
    assert(Math.abs(pond.mirrors[i] - normalizeMirrorAngle(p.angle)) < 1e-7);
    if (i >= 2) {
      while (c.cooldowns.flight) tick();
      tick(c, { flightHeld: true });
    }
    go(c, p.shot.x, p.shot.y);
    align(c, p);
    tick(c, { moveX: p.incoming.x, moveY: p.incoming.y });
    tick(c, { primaryHeld: true });
    for (let n = 0; n < ticksFor(25) && !pond.torches[i]; n++) tick();
    assert(pond.torches[i], `Torch ${i + 1}`);
    for (let n = 0; n < ticksFor(0.833); n++) tick();
    for (let n = 0; Math.abs(pond.mirrors[i] - p.rest) > 1e-7 && n < 241; n++)
      tick(s, { pushHeld: true });
    tick();
    assert(Math.abs(pond.mirrors[i] - p.rest) < 1e-7);
  }
  mark("7 · All four flames raise the central sanctuary and bridge");
  assert(pond.raised);
  go(s, 27 * 32, 29 * 32);
  go(s, 27 * 32, 21 * 32);
  go(s, 24 * 32, 20 * 32);
  while (c.cooldowns.flight) tick();
  tick(c, { flightHeld: true });
  go(c, 24 * 32, 19.5 * 32);
  mark("8 · Reunited: collect the shared Vanity Mirror");
  room.useItem(c.id, { requestId: "plan-chest", targetId: POND_CHEST_TARGET });
  steps.push({ use: { actor: 1, targetId: POND_CHEST_TARGET } });
  tick();
  assert.equal(w.inventory!.counts.vanity_mirror, 1);
  for (let n = 0; n < ticksFor(3); n++) tick();
  return steps;
}
if (process.argv.includes("--plan-only")) {
  const room = new GameRoom("ABC234", false, "MIRROR_POND"),
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
    "steps; all four torches lit; shared mirror acquired.",
  );
  process.exit(0);
}
const app = createApp({ startingScene: "MIRROR_POND" });
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
    if (frame % ticksFor(1 / 15) === 0) {
      app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
      due += 1000 / 30;
      await new Promise<void>((r) =>
        setTimeout(r, Math.max(0, due - performance.now())),
      );
    }
  }
  assert.equal(room.state.inventory!.counts.vanity_mirror, 1);
  assert(mirrorPondState(room.state.puzzles)!.raised);
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
        allFourTorchesLit: mirrorPondState(room.state.puzzles)!.torches.every(
          Boolean,
        ),
        noTeleports: true,
        sharedMirror: room.state.inventory!.counts.vanity_mirror,
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
