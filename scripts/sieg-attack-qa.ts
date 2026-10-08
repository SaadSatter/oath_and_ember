// Local browser QA: actual J intent, normal room join, authoritative markers,
// and the real PlayerView on both clients. No gameplay debug path is bundled.
import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const dir = resolve(process.argv[2] ?? "qa/sieg-attacks-v1");
mkdirSync(dir, { recursive: true });
const app = createApp();
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: !process.argv.includes("--headed"),
});
const errors: string[] = [];
try {
  const pages = await Promise.all(
    [0, 1].map(async () => {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
          errors.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(`http://127.0.0.1:${port}/?siegQA=1`);
      return page;
    }),
  );
  await pages[0].locator("#create").click();
  await pages[0].locator("#oath").waitFor();
  const code = (await pages[0].locator("h1").textContent())!.split(" ")[1];
  await pages[1].locator("#code").fill(code);
  await pages[1].locator("#join").click();
  await pages[0].locator("#oath").click();
  await pages[1].locator("#ember").click();
  await pages[0].waitForTimeout(150);
  await pages[0].locator("#ready").click();
  await pages[1].locator("#ready").click();
  await pages[0].waitForFunction(
    () => !!document.querySelector<HTMLElement>("#game")?.dataset.playerVisuals,
  );
  const room = app.manager.get(code),
    hero = Object.values(room.state.players).find((p) => p.role === "OATH")!;
  // Reviewed empty outdoor location; fixtures affect only this QA server.
  hero.x = 420;
  hero.y = 440;
  const partner = Object.values(room.state.players).find(
    (p) => p.role === "EMBER",
  )!;
  partner.x = 460;
  partner.y = 440;
  const report: any[] = [];
  const directions = [
    ["right", 0, 0, 12],
    ["left", Math.PI, 0, 12],
    ["up", -Math.PI / 2, 12, 10],
    ["down", Math.PI / 2, 24, 12],
  ] as const;
  const repeats = Number(
    process.argv.find((a) => a.startsWith("--repeat="))?.split("=")[1] ?? 1,
  );
  assert(Number.isInteger(repeats) && repeats >= 1 && repeats <= 20);
  for (const [direction, facing, start, count] of Array.from(
    { length: repeats },
    () => directions,
  ).flat()) {
    hero.facing = facing;
    hero.cooldowns.attack = 0;
    await pages[0].waitForTimeout(700);
    for (const page of pages)
      await page.evaluate(() => {
        const w = window as any;
        w.siegSamples = [];
        w.siegTimer = setInterval(() => {
          const root = document.querySelector<HTMLElement>("#game")!;
          if (root.dataset.playerVisuals)
            w.siegSamples.push({
              time: performance.now(),
              visuals: JSON.parse(root.dataset.playerVisuals),
              actions: JSON.parse(root.dataset.combatActions!),
            });
        }, 8);
      });
    await pages[0].keyboard.down("j");
    await pages[0].waitForTimeout(40);
    await pages[0].keyboard.up("j");
    await Promise.all(
      pages.map((page) =>
        page.waitForFunction(
          ({ id, direction, frame }) => {
            const root = document.querySelector<HTMLElement>("#game")!;
            const v = JSON.parse(root.dataset.playerVisuals!)[id];
            return (
              v?.animation === `hero:OATH:basic:${direction}` &&
              Number(v.frame) >= frame
            );
          },
          {
            id: hero.id,
            direction,
            frame:
              start + (direction === "right" || direction === "left" ? 5 : 2),
          },
          { polling: "raf" },
        ),
      ),
    );
    const screenshotState = await Promise.all(
      pages.map((page) =>
        page.locator("#game").getAttribute("data-player-visuals"),
      ),
    );
    writeFileSync(
      `${dir}/${direction}-screenshot-state.json`,
      JSON.stringify(screenshotState),
    );
    await Promise.all(
      pages.map((p, i) =>
        p.screenshot({ path: `${dir}/${direction}-client-${i + 1}.png` }),
      ),
    );
    await pages[0].waitForTimeout(550);
    const samples = await Promise.all(
      pages.map((p) =>
        p.evaluate(() => {
          const w = window as any;
          clearInterval(w.siegTimer);
          return w.siegSamples;
        }),
      ),
    );
    const sequences: number[] = [];
    for (const trace of samples) {
      const attack = trace.filter(
        (s: any) =>
          s.visuals[hero.id]?.animation === `hero:OATH:basic:${direction}`,
      );
      assert(attack.length > 0, `${direction}: animation missing`);
      const frames = [
        ...new Set(attack.map((s: any) => Number(s.visuals[hero.id].frame))),
      ] as number[];
      assert(
        frames.every((f) => f >= start && f < start + count),
        `${direction}: wrong directional frame`,
      );
      assert(
        frames.includes(start + count - 1),
        `${direction}: missing recovery`,
      );
      assert(
        frames.every((f, i) => !i || f >= frames[i - 1]),
        `${direction}: loop or reordered frames`,
      );
      const first = attack[0].visuals[hero.id];
      for (const s of attack) {
        const v = s.visuals[hero.id];
        assert.equal(v.texture, "hero:OATH:basic");
        assert.equal(v.flipX, direction === "left");
        assert.equal(v.originX, 0.5);
        assert.equal(v.originY, 0.75);
        assert(
          Math.abs(v.x - first.x) < 0.1 && Math.abs(v.y - first.y) < 0.1,
          `${direction}: ground moved`,
        );
      }
      assert(
        trace.at(-1).visuals[hero.id].animation.includes("TOP_DOWN:idle"),
        `${direction}: failed return to idle`,
      );
      sequences.push(
        attack[0].actions.find((a: any) => a.id === hero.id).combat.seq,
      );
      report.push({
        direction,
        client: sequences.length,
        frames,
        anchor: first,
        sequence: sequences.at(-1),
      });
    }
    assert.equal(
      sequences[0],
      sequences[1],
      "clients saw different accepted attacks",
    );
    writeFileSync(
      `${dir}/${direction}-traces.json`,
      JSON.stringify(samples, null, 2),
    );
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${dir}/report.json`,
    JSON.stringify({ errors, checks: report }, null, 2),
  );
  console.log(`Passed four directions on both clients. Evidence: ${dir}`);
} finally {
  await browser.close();
  await app.close();
}
