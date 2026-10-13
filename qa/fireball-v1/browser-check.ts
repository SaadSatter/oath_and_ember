import { chromium } from "@playwright/test";
import { createApp } from "../../apps/server/src/app.js";
import { writeFileSync } from "node:fs";
const app = createApp({ encounter: true });
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors: string[] = [];
try {
  const pages = await Promise.all(
    [0, 1].map(async () => {
      const p = await browser.newPage({
        viewport: { width: 1280, height: 720 },
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(
        `http://127.0.0.1:${(app.http.address() as any).port}/?enemyQA=1`,
      );
      return p;
    }),
  );
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
    () => document.body.dataset.playing === "true",
  );
  const room = app.manager.get(code);
  const coco = Object.values(room.state.players).find(
    (p) => p.role === "EMBER",
  )!;
  coco.skillPoints = 3;
  const evidence = [];
  for (let level = 1; level <= 4; level++) {
    if (level > 1) {
      await pages[1].keyboard.press("Tab");
      await pages[1]
        .getByRole("button", { name: new RegExp(`Fireball ${level} ·`) })
        .click();
      await pages[1]
        .getByRole("button", { name: "Close", exact: true })
        .click();
    }
    coco.cooldowns.attack = 0;
    await pages[1].keyboard.down("j");
    await new Promise((r) => setTimeout(r, 100));
    await pages[1].keyboard.up("j");
    await pages[1].screenshot({ path: `qa/fireball-v1/level-${level}.png` });
    evidence.push({
      level,
      projectiles: Object.values(room.state.projectiles).filter(
        (p) => p.owner === coco.id,
      ),
    });
  }
  await pages[1].keyboard.press("Tab");
  await pages[1].screenshot({ path: "qa/fireball-v1/skill-tree.png" });
  const icons = await pages[1]
    .locator(".fireball-skill-icon")
    .evaluateAll((els) =>
      els.map((e) => ({
        loaded: (e as HTMLImageElement).complete,
        width: (e as HTMLImageElement).naturalWidth,
      })),
    );
  if (icons.length !== 4 || icons.some((i) => i.width !== 48))
    throw Error("Missing skill icon");
  writeFileSync(
    "qa/fireball-v1/browser-result.json",
    JSON.stringify({ errors, evidence, icons }, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "All four fireball levels and skill icons rendered in two browser game sessions.",
  );
} finally {
  await browser.close();
  await app.close();
}
