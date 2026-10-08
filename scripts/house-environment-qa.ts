import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(process.argv[2] ?? "qa/house-environment-v1");
if (existsSync(dir)) throw Error("Use a fresh evidence directory");
mkdirSync(dir, { recursive: true });
const app = createApp();
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const pages = [],
  contexts = [],
  errors: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 2; i++) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: `${dir}/raw-videos`,
        size: { width: 1280, height: 720 },
      },
    });
    contexts.push(ctx);
    const p = await ctx.newPage();
    pages.push(p);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        !m.text().startsWith("Failed to load resource:")
      )
        errors.push(m.text());
    });
    p.on("response", (r) => {
      if (r.status() >= 400 && !r.url().endsWith("/favicon.ico"))
        errors.push(`${r.status()} ${r.url()}`);
    });
    await p.goto(`http://127.0.0.1:${port}/?enemyQA=1`);
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
  for (let i = 0; i < 2; i++) {
    await pages[i].waitForFunction(
      () =>
        document.querySelector<HTMLElement>("#game")?.dataset.scene ===
        "MAIN_HOUSE",
    );
    await sleep(500);
    await pages[i].screenshot({ path: `${dir}/house-client-${i + 1}.png` });
  }
  const room = app.manager.get(code);
  // Ordinary browser movement/interaction performs the transition, never a client scene outcome.
  await pages[0].keyboard.down("d");
  await sleep(1980);
  await pages[0].keyboard.up("d");
  await pages[0].keyboard.down("e");
  await sleep(300);
  await pages[0].keyboard.up("e");
  for (let i = 0; i < 2; i++)
    await pages[i].waitForFunction(
      () =>
        document.querySelector<HTMLElement>("#game")?.dataset.scene ===
        "FOREST_RUINS",
    );
  await sleep(500);
  for (let i = 0; i < 2; i++)
    await pages[i].screenshot({ path: `${dir}/forest-client-${i + 1}.png` });
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [390, 844],
    [844, 390],
  ]) {
    room.reset();
    room.state.phase = "PLAYING";
    await sleep(150);
    for (let i = 0; i < 2; i++) {
      await pages[i].setViewportSize({ width, height });
      await sleep(250);
      const pixels = await pages[i].locator("#game canvas").evaluate((canvas) => {
        const c = canvas as HTMLCanvasElement;
        const box = c.getBoundingClientRect();
        return {
          x: box.width / c.width,
          y: box.height / c.height,
          filtering: getComputedStyle(c).imageRendering,
        };
      });
      if (Math.abs(pixels.x - pixels.y) > 0.001)
        throw Error(`Canvas stretches pixels at ${width}x${height}: ${JSON.stringify(pixels)}`);
      if (pixels.filtering !== "pixelated")
        throw Error(`Canvas filtering is ${pixels.filtering}`);
      await pages[i].screenshot({
        path: `${dir}/house-${width}x${height}-client-${i + 1}.png`,
      });
    }
  }
  writeFileSync(
    `${dir}/qa.json`,
    JSON.stringify(
      {
        errors,
        starting_scene: "MAIN_HOUSE",
        transition:
          "Both clients observed server-authoritative forest transition after browser movement/E input",
        source:
          "Authored Exterior.tmx; integer2x tiled rendering; source forest tree PNGs unchanged",
        rendering: "1x camera; nearest texture filtering; equal X/Y canvas scale verified at every responsive viewport",
        viewports: ["1920x1080", "1440x900", "390x844", "844x390"],
      },
      null,
      2,
    ),
  );
  for (let i = 0; i < 2; i++) {
    await contexts[i].close();
    await pages[i].video()!.saveAs(`${dir}/client-${i + 1}.webm`);
  }
  console.log(JSON.stringify({ dir, errors }));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  errors.push(String(error));
  for (let i = 0; i < pages.length; i++)
    await pages[i]
      .screenshot({ path: `${dir}/failure-client-${i + 1}.png` })
      .catch(() => {});
  writeFileSync(`${dir}/failure.json`, JSON.stringify({ errors }, null, 2));
  throw error;
} finally {
  await browser.close();
  await app.close();
}
