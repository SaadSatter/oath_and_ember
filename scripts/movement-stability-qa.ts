import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { collisionRects } from "../packages/shared/src/maps.js";
import type { SceneId } from "../packages/shared/src/gameTypes.js";
const dir = resolve(process.argv[2]);
if (existsSync(dir)) throw Error("Use a fresh evidence directory");
mkdirSync(dir, { recursive: true });
const jitter = process.env.JITTER === "1";
const app =
  process.env.BASELINE === "1"
    ? (await import("../dist/apps/server/src/app.js")).createApp()
    : createApp();
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const contexts = [],
  pages: Page[] = [],
  timers: ReturnType<typeof setInterval>[] = [];
const errors: string[] = [],
  stages: unknown[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
try {
  for (let n = 0; n < 2; n++) {
    const ctx = await browser.newContext({
      viewport: { width: 960, height: 540 },
      recordVideo: {
        dir: dir + "/raw-videos",
        size: { width: 960, height: 540 },
      },
    });
    contexts.push(ctx);
    const p = await ctx.newPage();
    pages.push(p);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
        errors.push(`${r.status()} ${r.url()}`);
    });
    await p.addInitScript("window.__name = (fn) => fn;");
    await p.addInitScript(
      ({ jitter }) => {
        const w = window as any;
        w.samples = [];
        w.qaKeys = [];
        const capture = () => {
          const data =
            document.querySelector<HTMLElement>("#game")?.dataset
              .movementSample;
          if (data)
            w.samples.push({
              ...JSON.parse(data),
              capturedAt: performance.now(),
              keys: [...w.qaKeys],
            });
          requestAnimationFrame(capture);
        };
        requestAnimationFrame(capture);
        if (jitter) {
          // Event-loop stalls affect both render cadence and the ordinary input timer.
          setInterval(() => {
            const end = performance.now() + 85;
            while (performance.now() < end) {}
          }, 1350);
        }
      },
      { jitter },
    );
    if (process.env.CLOCK_JITTER === "1")
      await p.addInitScript(() => {
        const NativeSocket = window.WebSocket;
        class ClockDelayedSocket extends NativeSocket {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            const replies = new Set<string>();
            const forwarded = new WeakSet<MessageEvent>();
            let probes = 0;
            const stats = ((window as any).clockStats = {
              probes: 0,
              delayed: 0,
            });
            const send = super.send.bind(this);
            this.send = (data) => {
              if (typeof data === "string" && data.includes("clock:probe")) {
                stats.probes++;
                const id = /^42(\d+)\[/.exec(data)?.[1];
                if (id && ++probes % 3 === 0) replies.add(id);
              }
              send(data);
            };
            this.addEventListener("message", (event) => {
              const id =
                typeof event.data === "string"
                  ? /^43(\d+)\[/.exec(event.data)?.[1]
                  : undefined;
              if (!forwarded.has(event) && id && replies.delete(id)) {
                stats.delayed++;
                event.stopImmediatePropagation();
                setTimeout(() => {
                  const reply = new MessageEvent("message", {
                    data: event.data,
                  });
                  forwarded.add(reply);
                  this.dispatchEvent(reply);
                }, 770);
              }
            });
          }
        }
        window.WebSocket = ClockDelayedSocket;
      });
    if (jitter)
      await p.addInitScript(() => {
        const NativeSocket = window.WebSocket;
        // Run latency inside the browser. Routing every packet through the
        // automation bridge introduced unrequested multi-second delivery gaps.
        class DelayedSocket extends NativeSocket {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            const outgoing: Parameters<WebSocket["send"]>[0][] = [];
            const incoming: MessageEvent[] = [];
            const forwarded = new WeakSet<MessageEvent>();
            let sent = 0;
            const stats = ((window as any).transportStats = {
              inputs: 0,
              dropped: 0,
              snapshots: 0,
              maxInputDelayMs: 0,
            });
            const enqueued = new Map<
              Parameters<WebSocket["send"]>[0],
              number
            >();
            const nativeSend = super.send.bind(this);
            this.send = (data) => {
              if (typeof data === "string" && data.includes("player:input")) {
                stats.inputs++;
                if (++sent % 11 !== 0) {
                  outgoing.push(data);
                  enqueued.set(data, performance.now());
                } else stats.dropped++;
              } else nativeSend(data);
            };
            this.addEventListener("message", (event) => {
              if (
                !forwarded.has(event) &&
                typeof event.data === "string" &&
                event.data.includes("game:snapshot")
              ) {
                stats.snapshots++;
                event.stopImmediatePropagation();
                incoming.push(event);
              }
            });
            const out = setInterval(() => {
              if (this.readyState === NativeSocket.OPEN)
                for (const data of outgoing.splice(0)) {
                  stats.maxInputDelayMs = Math.max(
                    stats.maxInputDelayMs,
                    performance.now() - enqueued.get(data)!,
                  );
                  enqueued.delete(data);
                  nativeSend(data);
                }
            }, 150);
            const inc = setInterval(() => {
              for (const original of incoming.splice(0)) {
                const event = new MessageEvent("message", {
                  data: original.data,
                });
                forwarded.add(event);
                this.dispatchEvent(event);
              }
            }, 110);
            this.addEventListener("close", () => {
              clearInterval(out);
              clearInterval(inc);
            });
          }
        }
        window.WebSocket = DelayedSocket;
      });
    await p.goto(
      `http://127.0.0.1:${(app.http.address() as { port: number }).port}/?movementQA=1`,
    );
  }
  await pages[0].locator("#create").click();
  await pages[0].locator("#oath").waitFor();
  const code = (await pages[0].locator("h1").textContent())!.split(" ")[1];
  await pages[1].locator("#code").fill(code);
  await pages[1].locator("#join").click();
  await pages[0].locator("#oath").click();
  await pages[1].locator("#ember").click();
  await pages[0].locator("#ready").click();
  await pages[1].locator("#ready").click();
  await sleep(1000);
  const room = app.manager.get(code);
  const ids = await Promise.all(
    pages.map((p) => p.locator("#game").getAttribute("data-player-id")),
  );
  const keys = async (n: number, next: string[]) => {
    const old = await pages[n].evaluate(
      () => (window as any).qaKeys as string[],
    );
    for (const k of old.filter((k) => !next.includes(k)))
      await pages[n].keyboard.up(k);
    for (const k of next.filter((k) => !old.includes(k)))
      await pages[n].keyboard.down(k);
    await pages[n].evaluate((k) => {
      (window as any).qaKeys = k;
    }, next);
  };
  const both = async (a: string[], b = a) => {
    await keys(0, a);
    await keys(1, b);
  };
  const setup = async (
    scene: SceneId,
    positions: number[][],
    abilities = false,
  ) => {
    await both([]);
    await sleep(500);
    room.state.sceneId = scene === "HOUSE_INTERIOR" ? "MAIN_HOUSE" : scene;
    room.state.enemies = {};
    room.state.projectiles = {};
    for (const puzzle of Object.values(room.state.puzzles))
      puzzle.complete = true;
    if (scene === "FOREST_RUINS") room.state.puzzles.bridge.complete = false;
    ids.forEach((id, n) => {
      Object.assign(room.state.players[id!], {
        movementEpoch: (room.state.players[id!].movementEpoch ?? 0) + 1,
        movementInput: undefined,
        sceneId: scene,
        x: positions[n][0],
        y: positions[n][1],
        vx: 0,
        vy: 0,
        facing: 0,
        movementIntent: { x: 0, y: 0 },
        cooldowns: {},
        unlockedSkills: abilities ? [n ? "blink" : "dash"] : [],
      });
    });
    // Fixture teleports invalidate already queued intent just like relocate().
    for (const id of ids) {
      const session = room.sessions.get(id!)!;
      session.input = {
        seq: session.input.seq,
        moveX: 0,
        moveY: 0,
        jumpHeld: false,
        primaryHeld: false,
        secondaryHeld: false,
        interactHeld: false,
      };
      session.movementInput = { ...session.input };
      session.movementQueue?.clear();
      session.primaryEdges = [];
      session.received = Date.now();
      session.receivedTick = room.state.serverTick;
      room.state.players[id!].movementInput = { ...session.input };
    }
    app.io.to(code).emit("state:sync", room.state);
    await sleep(1000);
    for (const p of pages)
      await p.evaluate(() => {
        (window as any).samples = [];
      });
  };
  const save = async (name: string) => {
    console.log(`Measured ${name}`);
    const traces = await Promise.all(
      pages.map((p) => p.evaluate(() => (window as any).samples)),
    );
    for (let n = 0; n < 2; n++) {
      writeFileSync(`${dir}/${name}-${n + 1}.json`, JSON.stringify(traces[n]));
      await pages[n].screenshot({ path: `${dir}/${name}-${n + 1}.png` });
    }
    stages.push({
      name,
      walls: collisionRects(
        room.state.players[ids[0]!].sceneId!,
        room.state.puzzles,
      ),
    });
  };
  await setup("FOREST_RUINS", [
    [100, 400],
    [100, 480],
  ]);
  await both(["d"]);
  await sleep(10000);
  await both([]);
  await sleep(1500);
  await save("continuous-release");
  await setup("FOREST_RUINS", [
    [300, 400],
    [300, 480],
  ]);
  room.state.puzzles.bridge.complete = true;
  app.io.to(code).emit("state:sync", room.state);
  await both(["d"]);
  await sleep(5000);
  await both(["a"]);
  await sleep(5000);
  await both([]);
  await sleep(1500);
  await save("continuous-loop-release");
  if (process.env.CLOCK_JITTER === "1") {
    await setup("HOUSE_INTERIOR", [
      [320, 480],
      [488, 480],
    ]);
    await sleep(20000); // Keep the same scene and clock for the entire idle/tap run.
    for (let n = 0; n < 30; n++) {
      await both(["d"], ["a"]);
      await sleep(65);
      await both([]);
      await sleep(350);
    }
    await sleep(1500);
    await save("long-idle-small-taps");
    for (const p of pages) {
      const stats = await p.evaluate(() => (window as any).clockStats);
      if (!stats?.delayed)
        errors.push("Clock reply delay injection did not run");
      console.log(JSON.stringify(stats));
    }
  }
  if (process.env.ONLY_SUSTAINED !== "1") {
    await setup("HOUSE_INTERIOR", [
      [320, 480],
      [488, 480],
    ]);
    for (let n = 0; n < 24; n++) {
      await both([n % 2 ? "a" : "d"], [n % 2 ? "d" : "a"]);
      await sleep(140);
    }
    await both([]);
    await sleep(1500);
    await save("rapid-directions");
    await setup("MAIN_HOUSE", [
      [400, 327],
      [603, 390],
    ]);
    await both(["w"], ["d"]);
    await sleep(10000);
    await both([]);
    await sleep(1000);
    await save("walls");
    await setup("HOUSE_INTERIOR", [
      [491, 380],
      [400, 475],
    ]);
    await both(["w", "d"], ["w", "a"]);
    await sleep(4500);
    await both([]);
    await sleep(1000);
    await save("furniture-slide");
    await setup("MAIN_HOUSE", [
      [90, 307],
      [754, 371],
    ]);
    await both(["d"]);
    await sleep(1800);
    await both(["d", "w"], ["d", "s"]);
    await sleep(2200);
    await both([]);
    await sleep(1000);
    await save("tree-contact");
    await setup("HOUSE_INTERIOR", [
      [491, 347],
      [327, 499],
    ]);
    await both(["w", "d"], ["s", "a"]);
    await sleep(4500);
    await both([]);
    await sleep(1000);
    await save("corners");
    await setup(
      "HOUSE_INTERIOR",
      [
        [320, 480],
        [488, 480],
      ],
      true,
    );
    await both(["d", "k"], ["a", "k"]);
    await sleep(5000);
    await both([]);
    await sleep(1500);
    await save("abilities");
    await setup("HOUSE_INTERIOR", [
      [320, 480],
      [320, 490],
    ]);
    for (const [key, duration] of [
      ["w", 800],
      ["d", 800],
      ["s", 200],
      ["d", 250],
      ["s", 700],
      ["a", 900],
    ] as const) {
      await both([key]);
      await sleep(duration);
    }
    await both([]);
    await sleep(1000);
    await save("furniture-circuit");
    await setup("MAIN_HOUSE", [
      [90, 370],
      [420, 170],
    ]);
    for (const key of ["w", "d", "s", "a"]) {
      await both([key]);
      await sleep(600);
    }
    await both([]);
    await sleep(1000);
    await save("tree-circuit");
    await setup(
      "HOUSE_INTERIOR",
      [
        [320, 480],
        [488, 480],
      ],
      true,
    );
    await both(["Shift"]);
    await sleep(600);
    await both([]);
    await sleep(600);
    ids.forEach((id, n) => {
      const p = room.state.players[id!];
      if (p.x !== (n ? 488 : 320) || p.y !== 480 || p.cooldowns.dash)
        errors.push(`Shift bound for client ${n + 1}`);
    });
    await save("shift-unbound");
    await setup("MAIN_HOUSE", [
      [456, 354],
      [506, 354],
    ]);
    await keys(0, ["e"]);
    await sleep(800);
    await keys(0, []);
    await sleep(300);
    if (
      room.state.players[ids[0]!].sceneId !== "HOUSE_INTERIOR" ||
      room.state.players[ids[1]!].sceneId !== "MAIN_HOUSE"
    )
      errors.push("Independent entry failed");
    await keys(1, ["e"]);
    await sleep(800);
    await keys(1, []);
    await sleep(300);
    if (room.state.players[ids[1]!].sceneId !== "HOUSE_INTERIOR")
      errors.push("Partner entry failed");
    await keys(0, ["e"]);
    await sleep(800);
    await keys(0, []);
    await sleep(300);
    if (
      room.state.players[ids[0]!].sceneId !== "MAIN_HOUSE" ||
      room.state.players[ids[1]!].sceneId !== "HOUSE_INTERIOR"
    )
      errors.push("Independent exit failed");
    await save("scene-transitions");
  }
  writeFileSync(
    `${dir}/qa.json`,
    JSON.stringify(
      {
        jitter,
        transport: await Promise.all(
          pages.map((p) =>
            p.evaluate(() => (window as any).transportStats ?? null),
          ),
        ),
        errors,
        stages,
        note: "Two concurrent browser clients; setup fixtures are server-side only; keyboard movement, batched loss, snapshot jitter, periodic 85ms stalls; recordings include all stages.",
      },
      null,
      2,
    ),
  );
  for (let n = 0; n < 2; n++) {
    await contexts[n].close();
    await pages[n].video()!.saveAs(`${dir}/client-${n + 1}.webm`);
  }
  console.log(JSON.stringify({ dir, errors }));
  if (errors.length) process.exitCode = 1;
} finally {
  timers.forEach(clearInterval);
  await browser.close();
  await app.close();
}
