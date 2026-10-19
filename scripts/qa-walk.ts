// Measures how smoothly the story walks heroes into place. Two browsers start
// the prologue; Sieg steps into the shop, which starts the visit scene, and
// both heroes are walked to their marks. Every animation frame, each page
// records where it draws its own hero. Reports the largest single-frame step,
// and any frame where the hero moved backwards (a visible jump).
//   node --import tsx scripts/qa-walk.ts
import { chromium, type Page } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { maps } from "../packages/shared/src/maps.js";
const app = createApp({ prologue: true });
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pages: Page[] = [];
try {
  for (let i = 0; i < 2; i++) {
    const p = await (
      await browser.newContext({ viewport: { width: 1280, height: 720 } })
    ).newPage();
    await p.goto(`http://127.0.0.1:${port}/?storyQA`);
    pages.push(p);
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
  await sleep(1500);
  const room = app.manager.get(code);
  const sieg = Object.values(room.state.players).find(
    (p) => p.role === "OATH",
  )!;
  // Record both screens' heroes for a while, every animation frame.
  // Plain JavaScript text, so the TypeScript runner adds nothing to it.
  const record = (p: Page, ms: number) =>
    p.evaluate(`new Promise((done) => {
      const out = [];
      const end = performance.now() + ${ms};
      const frame = () => {
        out.push(document.querySelector("#game").dataset.hero || "");
        if (performance.now() < end) requestAnimationFrame(frame);
        else done(out);
      };
      requestAnimationFrame(frame);
    })`) as Promise<string[]>;
  const runs = pages.map((p) => record(p, 3500));
  await sleep(200);
  // Sieg walks up to the door and in (real E), which starts the visit.
  Object.assign(sieg, maps.MAIN_HOUSE.points.door, {
    movementEpoch: sieg.movementEpoch + 1,
  });
  await sleep(400);
  await pages[0].keyboard.down("e");
  await sleep(120);
  await pages[0].keyboard.up("e");
  const [siegFrames, cocoFrames] = await Promise.all(runs);
  // Second case: Coco runs for the road with the key held down and crosses
  // the fork's trigger mid-stride. She must stop there, never snap back.
  const w = room.state;
  for (let i = 0; i < 80 && w.story?.cutscene; i++) {
    await pages[0].keyboard.press("e");
    await sleep(120);
  }
  await pages[1].keyboard.press("Escape");
  const coco = Object.values(w.players).find((p) => p.role === "EMBER")!;
  Object.assign(coco, maps.HOUSE_INTERIOR.spawn, {
    movementEpoch: coco.movementEpoch + 1,
  });
  await sleep(500);
  await pages[1].keyboard.down("e");
  await sleep(120);
  await pages[1].keyboard.up("e");
  await sleep(800);
  const forkRun = record(pages[1], 2600);
  await pages[1].keyboard.down("s");
  await sleep(1800);
  await pages[1].keyboard.up("s");
  const forkFrames = await forkRun;
  for (const [name, frames] of [
    ["sieg", siegFrames],
    ["coco", cocoFrames],
    ["coco-fork", forkFrames],
  ] as const) {
    const pts = frames
      .filter(Boolean)
      .map((f) => f.split(","))
      .map(([x, y, scene]) => ({ x: +x, y: +y, scene }));
    let maxStep = 0,
      reversals = 0,
      moving = 0;
    let last: { dx: number; dy: number } | null = null;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].scene !== pts[i - 1].scene) {
        last = null;
        continue;
      }
      const dx = pts[i].x - pts[i - 1].x,
        dy = pts[i].y - pts[i - 1].y,
        step = Math.hypot(dx, dy);
      if (step > 0.01) moving++;
      maxStep = Math.max(maxStep, step);
      if (last && step > 0.5 && dx * last.dx + dy * last.dy < 0) reversals++;
      if (step > 0.5) last = { dx, dy };
    }
    if (process.env.DUMP === name)
      console.log(
        pts
          .map((q, i) => `${i}:${q.x.toFixed(1)},${q.y.toFixed(1)}`)
          .join(" "),
      );
    const first = pts[0],
      final = pts.at(-1)!;
    console.log(
      `${name}: frames ${pts.length}, moving ${moving}, max step ${maxStep.toFixed(1)}px, reversals ${reversals}, from ${first.x},${first.y} ${first.scene} to ${final.x},${final.y} ${final.scene}`,
    );
  }
  console.log("story:", JSON.stringify(room.state.story?.cutscene));
} finally {
  await browser.close();
  process.exit(0);
}
