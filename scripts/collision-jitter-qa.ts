import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(process.argv[2] ?? "qa/collision-investigation-v1");
if (existsSync(dir)) throw Error("Fresh directory required");
mkdirSync(dir, { recursive: true });
const app = createApp();
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const transportTimers: ReturnType<typeof setInterval>[] = [];
const contexts = [],
  pages = [];
const errors: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
try {
  for (let n = 0; n < 2; n++) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: process.env.QA_RECORD_VIDEO === "0" ? undefined : { dir: dir + "/raw", size: { width: 1280, height: 720 } },
    });
    contexts.push(ctx);
    const p = await ctx.newPage();
    pages.push(p);
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(
      "window.movementSamples=[]; function sampleMovement(){ const data=document.querySelector('#game')?.dataset.movementSample; if(data)window.movementSamples.push({...JSON.parse(data),time:performance.now()}); requestAnimationFrame(sampleMovement); } requestAnimationFrame(sampleMovement);",
    );
    if (process.env.BATCH_INPUT === "1")
      await p.routeWebSocket(/socket\.io/, (ws) => {
        const server = ws.connectToServer();
        const queued: (string | Buffer)[] = [];
        ws.onMessage((message) => {
          if (typeof message === "string" && message.includes("player:input"))
            queued.push(message);
          else server.send(message);
        });
        server.onMessage((message) => ws.send(message));
        transportTimers.push(
          setInterval(() => {
            for (const message of queued.splice(0)) server.send(message);
          }, 150),
        );
      });
    await p.goto(`http://127.0.0.1:${port}/?movementQA=1`);
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
  await sleep(800);
  const room = app.manager.get(code);
  const ids = await Promise.all(
    pages.map((p) => p.locator("#game").getAttribute("data-player-id")),
  );
  const stages = process.env.ROOM_FOOTPRINT_QA === "1" ? [
    { name: "rug-and-couch", scene: "HOUSE_INTERIOR", positions: [[320, 480], [488, 370]], keys: [["d"], ["w"]] },
    { name: "stairs-and-wall", scene: "HOUSE_INTERIOR", positions: [[224, 331], [400, 327]], keys: [["w"], ["w"]] },
    { name: "table-and-couch-side", scene: "HOUSE_INTERIOR", positions: [[400, 475], [430, 310]], keys: [["w"], ["d"]] },
  ] as const : [
    {
      name: "exterior-cardinal",
      scene: "MAIN_HOUSE",
      positions: [
        [400, 327],
        [603, 390],
      ],
      keys: [["w"], ["d"]],
    },
    {
      name: "exterior-corners",
      scene: "MAIN_HOUSE",
      positions: [
        [333, 327],
        [603, 419],
      ],
      keys: [
        ["w", "a"],
        ["d", "s"],
      ],
    },
    {
      name: "exterior-diagonal",
      scene: "MAIN_HOUSE",
      positions: [
        [400, 327],
        [603, 360],
      ],
      keys: [
        ["w", "d"],
        ["d", "s"],
      ],
    },
    {
      name: "interior-cardinal",
      scene: "HOUSE_INTERIOR",
      positions: [
        [400, 475],
        [659, 480],
      ],
      keys: [["w"], ["d"]],
    },
    {
      name: "interior-corners",
      scene: "HOUSE_INTERIOR",
      positions: [
        [491, 347],
        [327, 499],
      ],
      keys: [
        ["w", "d"],
        ["s", "a"],
      ],
    },
    {
      name: "interior-diagonal",
      scene: "HOUSE_INTERIOR",
      positions: [
        [491, 380],
        [400, 343],
      ],
      keys: [
        ["w", "d"],
        ["s", "a"],
      ],
    },
  ] as const;
  for (const stage of stages) {
    ids.forEach((id, n) =>
      Object.assign(room.state.players[id!], {
        sceneId: stage.scene,
        x: stage.positions[n][0],
        y: stage.positions[n][1],
        vx: 0,
        vy: 0,
      }),
    );
    // A setup teleport must reset prediction exactly like a real full sync.
    app.io.to(code).emit("state:sync", room.state);
    await sleep(600);
    for (const p of pages)
      await p.evaluate(() => {
        (window as any).movementSamples = [];
      });
    for (let n = 0; n < 2; n++)
      for (const key of stage.keys[n]) await pages[n].keyboard.down(key);
    await sleep(4000);
    for (let n = 0; n < 2; n++)
      for (const key of stage.keys[n]) await pages[n].keyboard.up(key);
    for (let n = 0; n < 2; n++) {
      const samples = await pages[n].evaluate(
        () => (window as any).movementSamples,
      );
      writeFileSync(
        `${dir}/${stage.name}-${n + 1}.json`,
        JSON.stringify(samples),
      );
      await pages[n].screenshot({ path: `${dir}/${stage.name}-${n + 1}.png` });
    }
    await sleep(300);
  }
  writeFileSync(
    `${dir}/qa.json`,
    JSON.stringify(
      {
        errors,
        stages: stages.map((s) => s.name),
        note: "Authoritative setup fixtures; normal keyboard movement; read-only authoritative/predicted/rendered trace",
      },
      null,
      2,
    ),
  );
  for (let n = 0; n < 2; n++) {
    await contexts[n].close();
    if (pages[n].video()) await pages[n].video()!.saveAs(`${dir}/client-${n + 1}.webm`);
  }
  console.log(JSON.stringify({ dir, errors }));
  if (errors.length) process.exitCode = 1;
} finally {
  transportTimers.forEach(clearInterval);
  await browser.close();
  await app.close();
}
