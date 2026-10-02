import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import {
  cpSync,
  copyFileSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join, relative } from "node:path";
import { PNG } from "pngjs";
import type { World } from "../../packages/shared/src/gameTypes.js";
import type { Asset, Finding } from "./model.js";
export async function capture(
  root: string,
  dir: string,
  a: Asset,
): Promise<Finding[]> {
  const preview = join(dir, "preview");
  mkdirSync(join(preview, "dist"), { recursive: true });
  cpSync(join(root, "dist/client"), join(preview, "dist/client"), {
    recursive: true,
  });
  for (const [file, target] of [
    [a.runtime_files[0], a.target!],
    [a.runtime_files[1], a.mask_target!],
  ])
    copyFileSync(join(root, file), join(preview, "dist/client", target));
  // Contact sheet preserves exact frame pixels, without flattening transparency.
  const atlas = PNG.sync.read(readFileSync(join(root, a.runtime_files[0])));
  writeFileSync(join(dir, "contact-sheet.png"), PNG.sync.write(atlas));
  const port = Number(process.env.ART_QA_PORT) || 3015,
    url = `http://127.0.0.1:${port}`;
  try {
    await fetch(`${url}/healthz`);
    throw Error(`Port ${port} already occupied; set ART_QA_PORT.`);
  } catch (e) {
    if (String(e).includes("occupied")) throw e;
  }
  const server = spawn(
    process.execPath,
    [join(root, "scripts/art/fixture.mjs")],
    {
      cwd: preview,
      env: { ...process.env, ART_QA_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  server.stdout.on("data", (b) => (output += b));
  server.stderr.on("data", (b) => (output += b));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const errors: string[] = [];
  const checks: Finding[] = [];
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error(output);
      try {
        const response = await fetch(`${url}/healthz`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) throw Error("QA server startup timeout");
    process.env.PLAYWRIGHT_BROWSERS_PATH ||=
      "/private/tmp/oath-ember-playwright";
    const systemChrome =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.ART_QA_BROWSER_EXECUTABLE ||
        (existsSync(systemChrome) ? systemChrome : undefined),
    });
    for (const [width, height] of [
      [1920, 1080],
      [1440, 900],
      [390, 844],
      [844, 390],
    ]) {
      const contexts = await Promise.all([
        browser.newContext({ viewport: { width, height } }),
        browser.newContext({ viewport: { width, height } }),
      ]);
      try {
        const pages = await Promise.all(contexts.map((c) => c.newPage()));
        for (const p of pages) {
          p.on("pageerror", (e) => errors.push(e.message));
          p.on("response", (r) => {
            if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
          });
          await p.goto(url);
        }
        await pages[0].locator("#create").click();
        await pages[0].locator("#oath").waitFor();
        const heading = await pages[0].locator("h1").innerText(),
          code = heading.replace("Room ", "").trim();
        await pages[1].locator("#code").fill(code);
        await pages[1].locator("#join").click();
        await pages[1].locator("#ember").click();
        await pages[0].locator("#oath").click();
        await pages[1]
          .getByRole("button", {
            name: "Coco Magic: Emerald Green",
            exact: true,
          })
          .click();
        await pages[0].locator("#ready").click();
        await pages[1].locator("#ready").click();
        await Promise.all(pages.map((p) => p.locator("#stats").waitFor()));
        await pages[0].waitForTimeout(200);
        const evidence: string[] = [];
        const samples: { label: string; state: World[] }[] = [];
        const shots = async (label: string) => {
          const state: World[] = await (
            await fetch(`${url}/__art/state`)
          ).json();
          samples.push({ label, state });
          for (let i = 0; i < 2; i++) {
            const file = join(
              dir,
              `${width}x${height}-client-${i + 1}-${label}.png`,
            );
            await pages[i].screenshot({ path: file });
            evidence.push(relative(root, file));
          }
        };
        await fetch(`${url}/__art/phase/idle`, { method: "POST" });
        await pages[0].waitForTimeout(800);
        await shots("idle");
        await fetch(
          `${url}/__art/phase/${a.animation === "ward" ? "held" : "projectile"}`,
          { method: "POST" },
        );
        for (const [delay, label] of [
          [100, "start"],
          [250, "start-mid"],
          [500, "loop"],
          [220, "loop-next"],
        ] as const) {
          await pages[0].waitForTimeout(delay);
          await shots(label);
        }
        await fetch(`${url}/__art/phase/idle`, { method: "POST" });
        for (const [delay, label] of [
          [120, "end"],
          [250, "end-mid"],
          [500, "recovered"],
        ] as const) {
          await pages[0].waitForTimeout(delay);
          await shots(label);
        }
        writeFileSync(
          join(dir, `${width}x${height}-states.json`),
          JSON.stringify(samples, null, 2),
        );
        for (let i = 0; i < 2; i++) {
          const canvas = pages[i].locator("canvas");
          const box = await canvas.boundingBox();
          const fits =
            box &&
            box.width > 0 &&
            box.height > 0 &&
            box.x >= -1 &&
            box.y >= -1 &&
            box.x + box.width <= width + 1 &&
            box.y + box.height <= height + 1;
          checks.push({
            id: `viewport_${width}_${height}_client_${i + 1}`,
            result: fits ? "PASS" : "FAIL",
            category: fits ? undefined : "IMPLEMENTATION",
            evidence: evidence.find((file) =>
              file.endsWith(`client-${i + 1}-recovered.png`),
            ),
            feedback: fits ? undefined : "Game canvas clips outside viewport.",
          });
        }
        const current = samples
          .find((s) => s.label === "loop")
          ?.state.find((w) => w.roomCode === code);
        const players = Object.values(current?.players || {});
        const active =
          players.length === 2 &&
          players.every((p) => p.connected) &&
          (a.animation === "ward"
            ? players.some(
                (p) => p.role === "EMBER" && p.actionState === "guard",
              )
            : Object.keys(current?.projectiles || {}).length > 0);
        checks.push({
          id: `authoritative_mechanic_${width}_${height}`,
          result: active ? "PASS" : "FAIL",
          category: active ? undefined : "IMPLEMENTATION",
          evidence: relative(root, join(dir, `${width}x${height}-states.json`)),
          feedback: active
            ? undefined
            : "Two connected players and requested mechanic were not active during capture.",
        });
        checks.push({
          id: `two_clients_${width}_${height}`,
          result: "PASS",
          evidence: evidence[0],
        });
      } finally {
        await Promise.all(contexts.map((c) => c.close()));
      }
    }
    checks.push({
      id: "browser_errors",
      result: errors.length ? "FAIL" : "PASS",
      category: errors.length ? "IMPLEMENTATION" : undefined,
      evidence: relative(root, join(dir, "browser-log.json")),
      feedback: errors.length ? errors.join("\n") : undefined,
    });
    return checks;
  } finally {
    writeFileSync(
      join(dir, "browser-log.json"),
      JSON.stringify({ errors, server: output }, null, 2),
    );
    await browser?.close();
    server.kill("SIGTERM");
    await new Promise<void>((r) => {
      if (server.exitCode !== null) return r();
      server.once("exit", () => r());
      setTimeout(() => {
        server.kill("SIGKILL");
        r();
      }, 2000).unref();
    });
  }
}
