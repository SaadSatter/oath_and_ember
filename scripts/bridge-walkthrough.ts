// Reproducible real-client walkthrough. Read server state; submit only keyboard/UI intent.
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { heavyOnPlate } from "../packages/shared/src/bridgePuzzle.js";
const dir = resolve(
  process.argv[2] ??
    "docs/puzzles/bridge-that-hates-cooperation/recording-boulder",
);
mkdirSync(dir, { recursive: true });
const app = createApp({ startingScene: "BRIDGE_RUINS" });
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const errors: string[] = [],
  events: any[] = [];
let room: any,
  heroes: any[],
  pages: Page[] = [];
const contexts: any[] = [];
const videoStarts: number[] = [];
const start = Date.now();
const mark = (label: string) => {
  const e = {
    label,
    time: (Date.now() - start) / 1000,
    tick: room.state.serverTick,
    stage: room.state.bridgePuzzle.stage,
    trapClock: room.state.bridgePuzzle.trapClock,
    slow: !!room.state.slowTime,
    sprint: heroes?.[0]?.sprintRemaining,
    boulder: { ...room.state.bridgePuzzle.boulder },
    players: heroes?.map((p) => ({ x: p.x, y: p.y })),
  };
  events.push(e);
  console.log(JSON.stringify(e));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = async (fn: () => boolean, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (!fn()) {
    if (Date.now() > end)
      throw Error(
        "Timed out " +
          JSON.stringify({
            s: room?.state.bridgePuzzle,
            players: heroes?.map((p) => ({ x: p.x, y: p.y })),
          }),
      );
    await sleep(33);
  }
};
const held = [new Set<string>(), new Set<string>()];
async function keyEvent(i: number, key: string, type: "keydown" | "keyup") {
  await pages[i].evaluate(
    ({ key, type }) =>
      document.body.dispatchEvent(
        new KeyboardEvent(type, { key, bubbles: true }),
      ),
    { key, type },
  );
}
async function keys(i: number, desired: string[]) {
  for (const k of [...held[i]])
    if (!desired.includes(k)) {
      await keyEvent(i, k, "keyup");
      held[i].delete(k);
    }
  for (const k of desired)
    if (!held[i].has(k)) {
      await keyEvent(i, k, "keydown");
      held[i].add(k);
    }
}
async function go(i: number, x: number, y: number, tolerance = 7) {
  const end = Date.now() + 45000;
  for (const [axis, goal] of [
    ["x", x],
    ["y", y],
  ] as const) {
    while (Math.abs(heroes[i][axis] - goal) > tolerance) {
      if (Date.now() > end)
        throw Error(
          `Blocked player ${i}: ${heroes[i].x},${heroes[i].y}, goal ${x},${y}`,
        );
      const gap = goal - heroes[i][axis],
        key = axis === "x" ? (gap > 0 ? "d" : "a") : gap > 0 ? "s" : "w";
      await keys(i, [key]);
      if (Math.abs(gap) > 70) {
        await wait(() => Math.abs(heroes[i][axis] - goal) < 60, 20000);
      } else await sleep(40);
      await keys(i, []);
      await sleep(350);
    }
  }
}
async function tap(i: number, k: string) {
  await keyEvent(i, k, "keydown");
  await sleep(70);
  await keyEvent(i, k, "keyup");
}
try {
  for (let i = 0; i < 2; i++) {
    const c = await browser.newContext({
      viewport: { width: 960, height: 720 },
      recordVideo: process.argv.includes("--no-video")
        ? undefined
        : { dir, size: { width: 960, height: 720 } },
    });
    contexts.push(c);
    videoStarts.push((Date.now() - start) / 1000);
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
        errors.push(`${r.status()} ${r.url()}`);
    });
    await p.goto(
      `http://127.0.0.1:${(app.http.address() as any).port}/?siegQA=1&recordingQA=1`,
    );
    pages.push(p);
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
  await pages[0].waitForFunction(
    () => !!document.querySelector<HTMLElement>("#game")?.dataset.playerVisuals,
  );
  room = app.manager.get(code);
  heroes = ["OATH", "EMBER"].map((role) =>
    Object.values(room.state.players).find((p: any) => p.role === role),
  );
  mark("Shared southern courtyard");
  await sleep(1400);
  await pages[0].screenshot({ path: resolve(dir, "01-start.png") });
  await Promise.all([go(0, 464, 1448), go(1, 728, 1408)]);
  await Promise.all([go(0, 288, 1448), go(1, 728, 1216)]);
  const pushPulse = async () => {
    await keys(0, ["1", "w"]);
    await sleep(80);
    await keys(0, []);
    await sleep(500);
  };
  for (let n = 0; n < 40 && !heavyOnPlate(room.state.bridgePuzzle, "A"); n++)
    await pushPulse();
  assert(heavyOnPlate(room.state.bridgePuzzle, "A"));
  mark("Stage 1: boulder physically pushed onto plate A");
  await pages[0].screenshot({ path: resolve(dir, "02-weight-plate.png") });
  await wait(() => Math.abs(heroes[1].facing + Math.PI / 2) < 0.1);
  await sleep(350);
  for (let shot = 0; shot < 5 && !room.state.bridgePuzzle.targetHit; shot++) {
    await wait(() => {
      const phase = room.state.bridgePuzzle.trapClock % 3;
      return phase > 0.4 && phase < 0.65;
    }, 4000);
    await tap(1, "j");
    await sleep(850);
  }
  await wait(() => room.state.bridgePuzzle.firstGateOpen);
  mark("Stage 1: frontal moving-target hit opens Coco's gate");
  await go(1, 672, 1088);
  await keys(1, ["e"]);
  await wait(() => room.state.bridgePuzzle.goldSwitchOpen);
  await keys(1, []);
  mark("Stage 2: Coco's golden switch opens the spike corridor");
  await go(1, 672, 832);
  await keys(0, ["1", "w"]);
  await wait(() => room.state.bridgePuzzle.boulder.y <= 1190);
  await keys(0, []);
  await sleep(350);
  for (let n = 0; n < 15 && room.state.bridgePuzzle.boulder.y > 1128; n++)
    await pushPulse();
  mark("Same boulder retrieved and pushed to spike-trial start");
  for (
    let attempt = 0;
    attempt < 3 && !heavyOnPlate(room.state.bridgePuzzle, "B");
    attempt++
  ) {
    await wait(
      () =>
        !(heroes[0].cooldowns.sprint > 0) &&
        !(heroes[1].cooldowns.slow_time > 0),
      23000,
    );
    await wait(() => {
      const phase = room.state.bridgePuzzle.trapClock % 2.4;
      return phase > 0.68 && phase < 0.78;
    }, 4000);
    await tap(1, "t");
    await tap(0, "Shift");
    await wait(() => !!room.state.slowTime && heroes[0].sprintRemaining > 0);
    mark("Stage 3: push through three sideways spikes with both abilities");
    const epoch = heroes[0].movementEpoch;
    await keys(0, ["1", "w"]);
    await wait(
      () =>
        room.state.bridgePuzzle.boulder.y <= 812 ||
        heroes[0].movementEpoch !== epoch,
      6000,
    );
    await keys(0, []);
    await sleep(350);
    await pages[0].screenshot({ path: resolve(dir, "03-boulder-spikes.png") });
    if (heroes[0].movementEpoch !== epoch) {
      mark("Spike reset preserves earlier gate and switch unlocks");
      continue;
    }
    for (let n = 0; n < 12 && !heavyOnPlate(room.state.bridgePuzzle, "B"); n++)
      await pushPulse();
  }
  assert(heavyOnPlate(room.state.bridgePuzzle, "B"));
  assert.equal(room.state.bridgePuzzle.spikeProgress, 3);
  mark("Stage 3: same boulder holds golden plate B and stabilizes bridge 2");
  await go(1, 480, 832, 5);
  await tap(1, "w");
  await wait(() => Math.abs(heroes[1].facing + Math.PI / 2) < 0.1);
  await sleep(350);
  await pages[1].screenshot({ path: resolve(dir, "04-bridge-pad.png") });
  await tap(1, "j");
  await wait(() => room.state.bridgePuzzle.finalTargetHit, 14000);
  mark("Long frontal shot from bridge center permanently opens final gates");
  await pages[1].screenshot({ path: resolve(dir, "05-final-target.png") });
  await go(1, 672, 832);
  await go(0, 336, heroes[0].y);
  await go(0, 336, 600);
  await go(0, 288, 600);
  await Promise.all([go(0, 288, 208), go(1, 672, 208)]);
  await wait(() => room.state.bridgePuzzle.complete);
  mark("Final: simultaneous opposite switches");
  await sleep(1000);
  await Promise.all([go(0, 456, 160), go(1, 504, 160)]);
  mark("Healthy boundaries: reunited at the temple");
  await sleep(2500);
  await pages[0].screenshot({ path: resolve(dir, "06-reunion.png") });
  assert.equal(errors.length, 0, errors.join("\n"));
  assert(room.state.bridgePuzzle.complete);
  writeFileSync(
    resolve(dir, "report.json"),
    JSON.stringify(
      {
        videoStarts,
        events,
        errors,
        state: room.state.bridgePuzzle,
        players: heroes.map((p) => ({
          role: p.role,
          x: p.x,
          y: p.y,
          hp: p.hp,
          unlockedSkills: p.unlockedSkills,
        })),
      },
      null,
      2,
    ),
  );
} catch (error) {
  writeFileSync(
    resolve(dir, "failure.json"),
    JSON.stringify(
      {
        error: String(error),
        state: room?.state.bridgePuzzle,
        players: heroes?.map((p) => ({
          x: p.x,
          y: p.y,
          movement: p.movementInput,
        })),
        errors,
      },
      null,
      2,
    ),
  );
  if (pages[0])
    await pages[0].screenshot({ path: resolve(dir, "failure.png") });
  throw error;
} finally {
  for (let i = 0; i < pages.length; i++) {
    await keys(i, []).catch(() => {});
    await contexts[i].close();
    const path = await pages[i].video()?.path();
    console.log(`VIDEO ${i} ${path}`);
  }
  await browser.close();
  await app.close();
}
