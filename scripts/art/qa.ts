import { resolveContract } from "./contracts.js";
import { paletteLabel } from "../../apps/client/src/assets/palettes.js";
import { heroNames } from "../../apps/client/src/assets/heroNames.js";
import type { chromium as Chromium } from "@playwright/test";
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
import { cadence } from "./temporal.js";
export async function capture(
  root: string,
  dir: string,
  a: Asset,
): Promise<Finding[]> {
  const contract = resolveContract(a, root);
  const defense = contract.qa.mechanism === "defense";
  const preview = join(dir, "preview");
  mkdirSync(join(preview, "dist"), { recursive: true });
  cpSync(join(root, "dist/client"), join(preview, "dist/client"), {
    recursive: true,
  });
  for (const [file, target] of [
    [a.runtime_files[0], a.target!],
    [a.runtime_files[1], a.mask_target!],
  ])
    if (target)
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
      env: {
        ...process.env,
        ART_QA_PORT: String(port),
        ART_QA_ROLE: contract.qa.role,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  server.stdout.on("data", (b) => (output += b));
  server.stderr.on("data", (b) => (output += b));
  let browser: Awaited<ReturnType<typeof Chromium.launch>> | undefined;
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
    const { chromium } = await import("@playwright/test");
    const systemChrome =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    browser = await chromium.launch({
      headless: true,
      args:
        process.env.ART_QA_SOFTWARE_RENDERING === "1" ? ["--disable-gpu"] : [],
      executablePath:
        process.env.ART_QA_BROWSER_EXECUTABLE ||
        (existsSync(systemChrome) ? systemChrome : undefined),
    });
    const recordings: {
      client: number;
      viewport: string;
      path: string;
      scope: string;
    }[] = [];
    for (const [width, height] of [
      [1920, 1080],
      [1440, 900],
      [390, 844],
      [844, 390],
    ]) {
      const contexts = await Promise.all([
        browser.newContext({
          viewport: { width, height },
          recordVideo: { dir: join(dir, "temporal"), size: { width, height } },
        }),
        browser.newContext({
          viewport: { width, height },
          recordVideo: { dir: join(dir, "temporal"), size: { width, height } },
        }),
      ]);
      // Plain browser JavaScript avoids tsx/esbuild's injected __name helper.
      for (const context of contexts)
        await context.addInitScript(`
        let wardPending = null;
        window.__artWardEvidence = {samples: [], truncated: false};
        window.__artWardUpdate = sample => {wardPending = sample;};
        window.__artWardRendered = () => {
          if (!wardPending) return;
          const evidence = window.__artWardEvidence;
          const sample = {...wardPending, browserMs: performance.now(), renderId: evidence.samples.length};
          if (evidence.samples.length >= 10000) {evidence.truncated = true; return;}
          evidence.samples.push(sample);
          let marker = document.getElementById("art-ward-sync");
          if (!marker) {
            marker = document.createElement("div"); marker.id = "art-ward-sync";
            marker.style.cssText = "position:fixed;bottom:0;left:0;z-index:99999;background:black;color:white;font:12px monospace;pointer-events:none";
            document.body.appendChild(marker);
          }
          marker.textContent = "QA F=" + sample.renderId + " T=" + sample.serverTick + " " + sample.ward.phase + " V=" + Number(sample.ward.visible) + " A=" + sample.ward.alpha.toFixed(3);
          marker.dataset.renderId = String(sample.renderId);
          wardPending = null;
        };
        const telemetry = {timestamps: [], phases: [], visibility: [], truncated: false};
        window.__artCadence = telemetry;
        document.addEventListener("visibilitychange", () => telemetry.visibility.push({state: document.visibilityState, atMs: performance.now()}));
        function sample(t) {
          if (telemetry.timestamps.length < 10000) telemetry.timestamps.push(t);
          else telemetry.truncated = true;
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      `);
      const pages = await Promise.all(contexts.map((c) => c.newPage()));
      const phaseEvents: { phase: string; atMs: number }[] = [];
      const started = performance.now();
      try {
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
            name: `${heroNames.EMBER} Magic: ${paletteLabel("emerald", "EMBER")}`,
            exact: true,
          })
          .click();
        await pages[0]
          .getByRole("button", {
            name: `${heroNames.OATH} Scarf: ${paletteLabel("blue", "OATH")}`,
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
            const before = await pages[i]
              .locator("#art-ward-sync")
              .getAttribute("data-render-id");
            await pages[i].screenshot({ path: file });
            const after = await pages[i]
              .locator("#art-ward-sync")
              .getAttribute("data-render-id");
            writeFileSync(
              file.replace(/\.png$/, "-sync.json"),
              JSON.stringify(
                {
                  screenshot: relative(root, file),
                  beforeRenderId: Number(before),
                  afterRenderId: Number(after),
                  correlation:
                    "Read the visible QA F marker in the screenshot/video and look up that exact renderId in client presentation samples; bracketing IDs alone do not claim atomic capture.",
                },
                null,
                2,
              ),
            );
            evidence.push(relative(root, file));
          }
        };
        const markPhase = async (phase: string) =>
          Promise.all(
            pages.map((p) =>
              p.evaluate((phase) => {
                const telemetry = (
                  window as unknown as {
                    __artCadence: { phases: { phase: string; atMs: number }[] };
                  }
                ).__artCadence;
                telemetry.phases.push({ phase, atMs: performance.now() });
              }, phase),
            ),
          );
        await markPhase("idle-request");
        phaseEvents.push({ phase: "idle", atMs: performance.now() - started });
        await fetch(`${url}/__art/phase/idle`, { method: "POST" });
        await pages[0].waitForTimeout(800);
        await shots("idle");
        await markPhase(defense ? "held-request" : "projectile-request");
        phaseEvents.push({
          phase: defense ? "held" : "projectile",
          atMs: performance.now() - started,
        });
        await fetch(`${url}/__art/phase/${defense ? "held" : "projectile"}`, {
          method: "POST",
        });
        for (const [delay, label] of [
          [100, "start"],
          [250, "start-mid"],
          [500, "loop"],
          [220, "loop-next"],
        ] as const) {
          await pages[0].waitForTimeout(delay);
          await shots(label);
        }
        await markPhase("release-request");
        phaseEvents.push({ phase: "idle", atMs: performance.now() - started });
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
          (defense
            ? players.some(
                (p) => p.role === contract.qa.role && p.actionState === "guard",
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
        for (let i = 0; i < pages.length; i++) {
          const telemetry = await pages[i]
            .evaluate(
              () =>
                (
                  window as unknown as {
                    __artCadence?: {
                      timestamps: number[];
                      phases: { phase: string; atMs: number }[];
                      visibility: { state: string; atMs: number }[];
                      truncated: boolean;
                    };
                  }
                ).__artCadence,
            )
            .catch(() => undefined);
          if (telemetry)
            writeFileSync(
              join(
                dir,
                "temporal",
                `${width}x${height}-client-${i + 1}-cadence.json`,
              ),
              JSON.stringify(
                {
                  ...telemetry,
                  summary: cadence(telemetry.timestamps),
                  clock:
                    "Browser performance time origin; phase-request markers share RAF clock, but are not video PTS or confirmed rendered phase transitions",
                  limitations:
                    "Headless instrumented capture including screenshots; scheduling and capture overhead affect callback cadence. No render-completion/FPS assertion or automatic pacing PASS.",
                },
                null,
                2,
              ),
            );
        }
        for (let i = 0; i < pages.length; i++) {
          const wardEvidence = await pages[i].evaluate(
            () =>
              (window as unknown as { __artWardEvidence: unknown })
                .__artWardEvidence,
          );
          writeFileSync(
            join(
              dir,
              "temporal",
              `${width}x${height}-client-${i + 1}-presentation.json`,
            ),
            JSON.stringify(wardEvidence, null, 2),
          );
        }
        writeFileSync(
          join(dir, "temporal", `${width}x${height}-authority.json`),
          JSON.stringify(
            await (await fetch(`${url}/__art/history`)).json(),
            null,
            2,
          ),
        );
        await Promise.all(contexts.map((c) => c.close()));
        for (let i = 0; i < pages.length; i++) {
          const video = pages[i].video();
          if (video) {
            const destination = join(
              dir,
              "temporal",
              `${width}x${height}-client-${i + 1}.webm`,
            );
            await video.saveAs(destination);
            recordings.push({
              client: i + 1,
              viewport: `${width}x${height}`,
              path: relative(root, destination),
              scope:
                "Continuous browser recording including lobby, start/held/end and recovery; not frame-accurate simulation telemetry.",
            });
          }
        }
        writeFileSync(
          join(dir, "temporal", `${width}x${height}-timeline.json`),
          JSON.stringify(
            {
              phaseEvents,
              durationMs: performance.now() - started,
              clock:
                "Node performance.now relative to browser setup; approximate request timing, not video presentation timestamps",
            },
            null,
            2,
          ),
        );
      }
    }
    writeFileSync(
      join(dir, "temporal", "index.json"),
      JSON.stringify(
        {
          recordings,
          captureEnvironment: {
            softwareRendering: process.env.ART_QA_SOFTWARE_RENDERING === "1",
          },
          limitations:
            "Videos are continuous human-review evidence. Current Responses adapter consumes PNG inputs, not WebM. Use art:temporal to extract ordered PNG evidence with native timestamps. Browser callback cadence telemetry is separate from video FPS; no automatic animation PASS inferred.",
        },
        null,
        2,
      ),
    );
    checks.push({
      id: "temporal_recordings",
      result: recordings.length === 8 ? "PASS" : "FAIL",
      category: recordings.length === 8 ? undefined : "IMPLEMENTATION",
      feedback:
        recordings.length === 8
          ? undefined
          : "Expected eight continuous client recordings.",
      evidence: relative(root, join(dir, "temporal", "index.json")),
    });
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
