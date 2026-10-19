import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "../apps/server/src/app.js";
import {
  storyCheckpointIds,
  storyCheckpoints,
} from "../packages/shared/src/storyCheckpoints.js";

const directory = resolve(process.argv[2] ?? "qa/story-checkpoints-v1");
mkdirSync(directory, { recursive: true });
const app = createApp();
await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors: string[] = [];
const results: unknown[] = [];
try {
  for (const checkpoint of storyCheckpointIds) {
    const contexts = await Promise.all(
      [0, 1].map(() =>
        browser.newContext({ viewport: { width: 1280, height: 900 } }),
      ),
    );
    try {
      const pages = await Promise.all(
        contexts.map((context) => context.newPage()),
      );
      for (const page of pages) {
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${port}/?recordingQA`);
        await page.locator('#panel[data-loaded="true"]').waitFor();
      }
      const host = pages[0];
      const radio = host.locator(
        `input[name="story-start"][value="${checkpoint}"]`,
      );
      await host.locator("label.story-start").filter({ has: radio }).click();
      if (!(await radio.isChecked()))
        throw Error(`Could not select ${checkpoint}`);
      if (checkpoint === "prologue") {
        for (const [name, viewport] of Object.entries({
          desktop: { width: 1280, height: 900 },
          mobile: { width: 390, height: 844 },
          landscape: { width: 844, height: 390 },
        })) {
          await host.setViewportSize(viewport);
          await host.screenshot({ path: `${directory}/title-${name}.png` });
          for (const id of storyCheckpointIds) {
            const input = host.locator(
              `input[name="story-start"][value="${id}"]`,
            );
            await host
              .locator("label.story-start")
              .filter({ has: input })
              .click();
            if (!(await input.isChecked()))
              throw Error(`${id} inaccessible at ${name}`);
          }
          await host.locator("#create").scrollIntoViewIfNeeded();
          if (!(await host.locator("#create").isVisible()))
            throw Error(`Create button inaccessible at ${name}`);
        }
        await host.setViewportSize({ width: 1280, height: 900 });
        await host.locator("label.story-start").filter({ has: radio }).click();
      }
      await host.locator("#create").click();
      await host.locator("#oath").waitFor();
      const code = (await host.locator("h1").textContent())!.split(" ")[1];
      await pages[1].locator("#code").fill(code);
      await pages[1].locator("#join").click();
      for (const page of pages)
        await page
          .getByText(
            `Starting chapter · ${storyCheckpoints[checkpoint].title}`,
            { exact: true },
          )
          .waitFor();
      await host.screenshot({ path: `${directory}/${checkpoint}-lobby.png` });
      await host.locator("#oath").click();
      await pages[1].locator("#ember").click();
      await host.locator("#ready").click();
      await pages[1].locator("#ready").click();
      await host.waitForTimeout(1000);
      const room = app.manager.get(code);
      if (
        room.state.storyStart !== checkpoint ||
        room.state.phase !== "PLAYING"
      )
        throw Error(`Wrong start for ${checkpoint}`);
      results.push({
        checkpoint,
        stage: room.state.story?.stage,
        cutscene: room.state.story?.cutscene?.id,
        inventory: room.state.inventory?.counts,
      });
      for (let index = 0; index < pages.length; index++)
        await pages[index].screenshot({
          path: `${directory}/${checkpoint}-${index === 0 ? "sieg" : "coco"}.png`,
        });
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  }
  writeFileSync(
    `${directory}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "All four story starts work through the title UI for both players; desktop, mobile and landscape choices are accessible.",
  );
} finally {
  await browser.close();
  await app.close();
}
