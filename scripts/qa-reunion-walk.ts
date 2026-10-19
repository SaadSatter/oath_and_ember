import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "../apps/server/src/app.js";
import { cutscenes } from "../packages/shared/src/prologue.js";

const directory = resolve(process.argv[2] ?? "qa/reunion-walk-v1");
mkdirSync(directory, { recursive: true });
const app = createApp({ prologue: true });
await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const pages: Page[] = [];
const errors: string[] = [];
try {
  for (let index = 0; index < 2; index++) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    pages.push(page);
    await page.goto(`http://127.0.0.1:${port}/?siegQA&movementQA`);
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
  await pages[0].waitForTimeout(1000);
  const room = app.manager.get(code);
  const world = room.state;
  const sieg = Object.values(world.players).find(
    (player) => player.role === "OATH",
  )!;
  const coco = Object.values(world.players).find(
    (player) => player.role === "EMBER",
  )!;
  world.story!.stage = "FINDING";
  world.story!.flags.push(
    "chapter0.silent",
    "chapter0.last-words",
    "chapter0.glance",
  );
  delete world.story!.cutscene;
  delete world.story!.walks;
  Object.assign(coco, cutscenes.reunion.placement.EMBER, {
    sceneId: "HOUSE_INTERIOR",
    movementEpoch: coco.movementEpoch + 1,
  });
  Object.assign(sieg, {
    sceneId: "MAIN_HOUSE",
    x: 480,
    y: 344,
    movementEpoch: sieg.movementEpoch + 1,
  });
  world.story!.alden = {
    scene: "HOUSE_INTERIOR",
    x: 348,
    y: 398,
    facing: "east",
    action: "still",
  };
  await pages[0].waitForTimeout(700);
  const samples: {
    screen: number;
    animation?: string;
    frame?: string;
    x?: number;
    y?: number;
  }[] = [];
  const recordings = pages.map((page, screen) =>
    page.evaluate(`
        new Promise((done) => {
          const id = ${JSON.stringify(sieg.id)};
          const screen = ${screen};
          const frames = [];
          const until = performance.now() + 3500;
          const record = () => {
            const visuals =
              document.querySelector("#game")?.dataset
                .playerVisuals;
            const visual = JSON.parse(visuals || "{}")[id];
            if (visual) frames.push({ screen, ...visual });
            if (performance.now() < until) requestAnimationFrame(record);
            else done(frames);
          };
          requestAnimationFrame(record);
        })
    `),
  );
  await pages[0].waitForTimeout(100);
  await pages[0].keyboard.down("e");
  for (const frames of await Promise.all(recordings))
    samples.push(...(frames as typeof samples));
  await pages[0].keyboard.up("e");
  for (let screen = 0; screen < pages.length; screen++) {
    const walking = samples.filter(
      (sample) =>
        sample.screen === screen && sample.animation?.includes(":walk_"),
    );
    if (
      walking.length < 2 ||
      new Set(walking.map((sample) => sample.frame)).size < 2
    )
      errors.push(`Screen ${screen} did not show an advancing Sieg walk cycle`);
    await pages[screen].screenshot({
      path: `${directory}/${screen === 0 ? "sieg" : "coco"}.png`,
    });
  }
  writeFileSync(
    `${directory}/samples.json`,
    JSON.stringify({ samples, errors }, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Both clients show advancing walk frames while Sieg approaches Coco with E held.",
  );
} finally {
  await browser.close();
  await app.close();
}
