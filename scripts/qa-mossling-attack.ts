import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "../apps/server/src/app.js";
import { spawnEnemy } from "../packages/shared/src/enemies.js";

const directory = resolve(process.argv[2] ?? "qa/mossling-attack-v1");
mkdirSync(directory, { recursive: true });
const app = createApp({ encounter: true });
await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const contexts = await Promise.all(
  [0, 1].map(() =>
    browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: `${directory}/video`,
        size: { width: 1280, height: 720 },
      },
    }),
  ),
);
const errors: string[] = [];
const results: unknown[] = [];
try {
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  for (const page of pages) {
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/?enemyQA&recordingQA`);
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
  const room = app.manager.get(code);
  delete room.state.story;
  room.transition("FOREST_RUINS");
  room.state.enemies = {};
  await pages[0].waitForTimeout(700);
  for (const [direction, facing] of [
    ["east", 0],
    ["south", Math.PI / 2],
    ["west", Math.PI],
    ["north", -Math.PI / 2],
  ] as const) {
    const id = `moss-${direction}`;
    const enemy = spawnEnemy(id, "mossling", 550, 450);
    enemy.facing = facing;
    room.state.enemies = { [id]: enemy };
    Object.values(room.state.players).forEach((player, index) =>
      Object.assign(player, {
        sceneId: "FOREST_RUINS",
        x: 550 + Math.cos(facing) * 38 - Math.sin(facing) * index * 48,
        y: 450 + Math.sin(facing) * 38 + Math.cos(facing) * index * 48,
        hp: 100,
        vx: 0,
        vy: 0,
        movementEpoch: player.movementEpoch + 1,
      }),
    );
    const recordings = pages.map((page) =>
      page.evaluate(`new Promise((done) => {
      const samples = [];
      const until = performance.now() + 2100;
      const record = () => {
        const root = document.querySelector("#game");
        const visual = JSON.parse(root.dataset.enemyVisuals || "{}")[${JSON.stringify(id)}];
        const state = JSON.parse(root.dataset.enemyState || "{}");
        if (visual) samples.push({ tick: state.serverTick, ...visual });
        if (performance.now() < until) requestAnimationFrame(record);
        else done(samples);
      };
      requestAnimationFrame(record);
    })`),
    );
    await Promise.all(
      pages.map((page) =>
        page.waitForFunction(
          (id) => {
            const visual = JSON.parse(
              document.querySelector<HTMLElement>("#game")?.dataset
                .enemyVisuals || "{}",
            )[id];
            return (visual?.attackPose?.slashAlpha ?? 0) > 0.5;
          },
          id,
          { timeout: 10000 },
        ),
      ),
    );
    await Promise.all(
      pages.map((page, index) =>
        page.screenshot({
          path: `${directory}/${direction}-${index === 0 ? "sieg" : "coco"}.png`,
        }),
      ),
    );
    const pair = (await Promise.all(recordings)) as {
      tick: number;
      attackPose: {
        phase: string;
        slashAlpha: number;
        scaleY: number;
        facing: number;
      } | null;
    }[][];
    for (let index = 0; index < pair.length; index++) {
      const poses = pair[index].flatMap((sample) =>
        sample.attackPose ? [sample.attackPose] : [],
      );
      for (const phase of ["windup", "strike", "recovery"])
        if (!poses.some((pose) => pose.phase === phase))
          errors.push(`${direction} client ${index} missed ${phase}`);
      if (!poses.some((pose) => pose.scaleY < 0.9))
        errors.push(`${direction} client ${index} did not crouch`);
    }
    const first = new Map(
      pair[0]
        .filter((sample) => sample.attackPose)
        .map((sample) => [sample.tick, sample.attackPose]),
    );
    let matched = 0;
    for (const sample of pair[1]) {
      if (!sample.attackPose || !first.has(sample.tick)) continue;
      matched++;
      if (
        JSON.stringify(first.get(sample.tick)) !==
        JSON.stringify(sample.attackPose)
      )
        errors.push(`${direction} pose differed at tick ${sample.tick}`);
    }
    if (!matched) errors.push(`${direction}: no common attack ticks`);
    results.push({ direction, matched, samples: pair });
  }
  const videos = pages.map((page) => page.video()!);
  await Promise.all(pages.map((page) => page.close()));
  for (let index = 0; index < videos.length; index++)
    await videos[index].saveAs(
      `${directory}/${index === 0 ? "sieg" : "coco"}.webm`,
    );
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
  await app.close();
  writeFileSync(
    `${directory}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
}
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "All four directional attacks show crouch, strike and recovery with identical poses on both clients.",
);
