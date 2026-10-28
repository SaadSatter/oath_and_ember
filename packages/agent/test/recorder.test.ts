// Gameplay recording for eval:live (packages/agent/src/recorder.ts,
// scripts/midterm/live.ts). Offline: no model or network call. The unit
// tests use a fake browser driver; the launcher tests that need a real
// headless Chromium are skipped when Playwright's browser is not installed.
// A broken browser install is simulated with PLAYWRIGHT_BROWSERS_PATH
// pointing at an empty folder.
import { afterEach, describe, expect, it } from "vitest";
import { execFile, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { runSuite } from "../src/harness.js";
import { RECORDING_FILE, RECORDING_META, startRecorder, type RecordingDriver } from "../src/recorder.js";
import { repoInfo } from "../src/repo.js";
import { verifyTrace, type TraceLine } from "../src/trace.js";

const ROOT = repoInfo().root;
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "rec-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const readTrace = (path: string) => readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l) as TraceLine);
const semantic = (lines: TraceLine[]) =>
  lines.map(({ type, tick, player, data }) => {
    const d = structuredClone(data) as Record<string, unknown>;
    if (type === "step") delete d.waitMs;
    return { type, tick, player, data: d };
  });

/** A fake browser: records calls and writes a stand-in video on close. */
function fakeDriver(o: { launch?: Error; render?: "ok" | "timeout" | "hang"; finish?: "ok" | "timeout" | "hang"; save?: "ok" | "throw" | "empty" } = {}) {
  const calls = { open: [] as Parameters<RecordingDriver>[0][], waits: 0, finishes: 0, closes: 0, closedAt: 0 };
  const driver: RecordingDriver = async (args) => {
    calls.open.push(args);
    if (o.launch) throw o.launch;
    return {
      label: "fake browser",
      warnings: ["fake warning"],
      async waitFinished() {
        calls.finishes++;
        if (o.finish === "timeout") throw Error("Timeout 15000ms exceeded.");
        if (o.finish === "hang") await new Promise(() => {});
      },
      async waitRendered() {
        calls.waits++;
        if (o.render === "timeout") throw Error("Timeout 60000ms exceeded.");
        if (o.render === "hang") await new Promise(() => {});
      },
      async close(target) {
        calls.closes++;
        calls.closedAt = Date.now();
        if (o.save === "throw") throw Error("Target page, context or browser has been closed");
        writeFileSync(target, o.save === "empty" ? "" : "webm-bytes");
      },
    };
  };
  return { driver, calls };
}

describe("recorder (fake browser)", () => {
  it("starts at 1920×1080, waits for the render, then saves the video once and cleans up", async () => {
    const out = tmp();
    const { driver, calls } = fakeDriver();
    const rec = await startRecorder({ url: "http://127.0.0.1:1/watch", outDir: out, driver });
    expect(calls.open).toHaveLength(1);
    expect(calls.open[0]).toMatchObject({ url: "http://127.0.0.1:1/watch", size: { width: 1920, height: 1080 } });
    expect(calls.open[0]!.videoDir.startsWith(out)).toBe(true);
    expect(rec.result.status).toBe("recording");
    await rec.ready();
    expect(rec.result.readyConfirmed).toBe(true);
    expect(rec.result.readyAt).not.toBeNull();
    const [a, b] = await Promise.all([rec.stop(), rec.stop()]);
    expect(a).toBe(b);
    expect(calls.closes).toBe(1);
    expect(a).toMatchObject({ status: "saved", path: join(out, RECORDING_FILE), bytes: 10, error: null, browser: "fake browser", warnings: ["fake warning"] });
    // No end wait was asked for.
    expect(calls.finishes).toBe(0);
    expect(a.finalConfirmed).toBe(false);
    expect(a.wallSeconds).toBeGreaterThanOrEqual(0);
    expect(existsSync(join(out, ".recording-tmp"))).toBe(false);
  });

  it("reports a browser that cannot start, never blocks the run and never claims a video", async () => {
    const out = tmp();
    const { driver } = fakeDriver({ launch: Error("Executable doesn't exist at /nowhere\nmore") });
    const rec = await startRecorder({ url: "http://x/watch", outDir: out, driver });
    expect(rec.result.status).toBe("failed");
    expect(rec.result.error).toBe("Could not start the recording browser: Executable doesn't exist at /nowhere");
    await rec.ready();
    const r = await rec.stop();
    expect(r).toMatchObject({ status: "failed", path: null, bytes: null, readyConfirmed: false });
    expect(readdirSync(out)).toEqual([]);
  });

  it("lets the episode start when the viewer never confirms, and says so", async () => {
    const { driver } = fakeDriver({ render: "timeout" });
    const rec = await startRecorder({ url: "http://x/watch", outDir: tmp(), driver });
    await expect(rec.ready()).resolves.toBeUndefined();
    expect(rec.result.readyConfirmed).toBe(false);
    expect(rec.result.warnings.at(-1)).toMatch(/not confirmed ready.*Timeout/);
    expect((await rec.stop()).status).toBe("saved");
  });

  it("stops waiting for the viewer on Ctrl-C even if the browser hangs", async () => {
    const { driver } = fakeDriver({ render: "hang" });
    const rec = await startRecorder({ url: "http://x/watch", outDir: tmp(), driver });
    const ctl = new AbortController();
    const waiting = rec.ready(ctl.signal);
    setTimeout(() => ctl.abort(), 20);
    await waiting;
    expect(rec.result.warnings).toEqual(["fake warning", "Stopped before the viewer was confirmed ready."]);
    expect((await rec.stop()).status).toBe("saved");
  });

  it("waits for the viewer to show the end, then holds the final screen before closing", async () => {
    const { driver, calls } = fakeDriver();
    const rec = await startRecorder({ url: "http://x/watch", outDir: tmp(), driver });
    await rec.ready();
    const before = Date.now();
    const r = await rec.stop({ finalTimeoutMs: 1000, holdMs: 150 });
    expect(calls.finishes).toBe(1);
    expect(calls.closedAt - before).toBeGreaterThanOrEqual(140);
    expect(r).toMatchObject({ status: "saved", finalConfirmed: true });
  });

  it("still saves the video when the end is not shown in time, and says so", async () => {
    const rec = await startRecorder({ url: "http://x/watch", outDir: tmp(), driver: fakeDriver({ finish: "timeout" }).driver });
    await rec.ready();
    const r = await rec.stop({ finalTimeoutMs: 1000, holdMs: 0 });
    expect(r).toMatchObject({ status: "saved", finalConfirmed: false });
    expect(r.warnings.at(-1)).toMatch(/did not show the episode's end.*Timeout/);
  });

  it("cuts the end wait and the hold short on Ctrl-C", async () => {
    const { driver, calls } = fakeDriver({ finish: "hang" });
    const rec = await startRecorder({ url: "http://x/watch", outDir: tmp(), driver });
    await rec.ready();
    const ctl = new AbortController();
    const before = Date.now();
    setTimeout(() => ctl.abort(), 30);
    const r = await rec.stop({ finalTimeoutMs: 60_000, holdMs: 60_000, signal: ctl.signal });
    expect(calls.closedAt - before).toBeLessThan(5000);
    expect(r).toMatchObject({ status: "saved", finalConfirmed: false });
    expect(r.warnings.at(-1)).toBe("Stopped before the viewer showed the episode's end.");
  });

  it("reports a video that could not be saved, or was empty, as failed with no path", async () => {
    for (const save of ["throw", "empty"] as const) {
      const out = tmp();
      const rec = await startRecorder({ url: "http://x/watch", outDir: out, driver: fakeDriver({ save }).driver });
      await rec.ready();
      const r = await rec.stop();
      expect(r.status, save).toBe("failed");
      expect(r.path, save).toBeNull();
      expect(r.error, save).toMatch(save === "throw" ? /has been closed/ : /no video data/);
    }
  });
});

describe("environment ready hook", () => {
  it("runs once after reset and before any observation, and leaves the episode unchanged", async () => {
    const [plain] = await runSuite({ player: "baseline-quest", situations: ["S1"], seeds: [0], outDir: join(tmp(), "plain"), gitHash: "test" });
    const order: string[] = [];
    const [gated] = await runSuite({
      player: "baseline-quest", situations: ["S1"], seeds: [0], outDir: join(tmp(), "gated"), gitHash: "test",
      onTrace: (l) => order.push(l.type),
      environment: { ready: async () => { order.push("ready"); await new Promise((r) => setTimeout(r, 200)); } },
    });
    expect(order.slice(0, 3)).toEqual(["reset", "ready", "run"]);
    expect(order.filter((t) => t === "ready")).toHaveLength(1);
    expect(gated!.endHash).toBe(plain!.endHash);
    expect(semantic(readTrace(gated!.trace))).toEqual(semantic(readTrace(plain!.trace)));
  }, 120_000);
});

// ── The launcher ─────────────────────────────────────────────────────────────
const run = promisify(execFile);
async function launch(args: string[], env: Record<string, string> = {}) {
  try {
    const r = await run(process.execPath, ["--import", "tsx", "scripts/midterm/live.ts", ...args], { cwd: ROOT, env: { ...process.env, ...env }, timeout: 180_000 });
    return { code: 0, out: r.stdout + r.stderr };
  } catch (e) {
    const err = e as { code: number; stdout: string; stderr: string };
    return { code: err.code, out: err.stdout + err.stderr };
  }
}
const QUICK = ["--scenario", "S1", "--seed", "0", "--player", "baseline-quest", "--speed", "0", "--port", "0", "--no-open", "--linger-seconds", "0"];
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hasChromium = existsSync(chromium.executablePath());

describe("live launcher recording", () => {
  it("records nothing with --no-record or --no-viewer", async () => {
    const out = join(tmp(), "off");
    const r = await launch([...QUICK, "--no-record", "--out", out]);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/Recording off \(--no-record\)/);
    expect(existsSync(join(out, RECORDING_META))).toBe(false);
    expect(existsSync(join(out, RECORDING_FILE))).toBe(false);
    const headless = join(tmp(), "headless");
    const h = await launch(["--scenario", "S1", "--player", "baseline-quest", "--no-viewer", "--out", headless]);
    expect(h.code, h.out).toBe(0);
    expect(readdirSync(headless).some((f) => f.startsWith("recording"))).toBe(false);
  }, 240_000);

  it("keeps the evaluation and reports the failure when Chromium cannot start", async () => {
    const out = join(tmp(), "nobrowser");
    const r = await launch([...QUICK, "--out", out], { PLAYWRIGHT_BROWSERS_PATH: join(tmp(), "empty") });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/RECORDING FAILED: Could not start the recording browser/);
    expect(r.out).not.toMatch(/^Video:/m);
    const meta = json(join(out, RECORDING_META));
    expect(meta).toMatchObject({ status: "failed", path: null, scenario: "S1", seed: 0, completion: "success", passive: true });
    expect(existsSync(join(out, RECORDING_FILE))).toBe(false);
    const summary = json(join(out, "S1-seed0", "summary.json"));
    expect(summary.success).toBe(true);
    verifyTrace(readTrace(summary.trace));
  }, 240_000);

  it.skipIf(!hasChromium)("records a watchable 1920×1080 video and leaves the trace identical to a headless run", async () => {
    const headless = join(tmp(), "headless");
    expect((await launch(["--scenario", "S1", "--player", "baseline-quest", "--no-viewer", "--out", headless])).code).toBe(0);
    const out = join(tmp(), "recorded");
    const r = await launch([...QUICK, "--out", out]);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain(`Video:   ${join(out, RECORDING_FILE)} (1920×1080`);
    const meta = json(join(out, RECORDING_META));
    expect(meta).toMatchObject({
      runId: "recorded", scenario: "S1", seed: 0, player: "baseline-quest", model: null, status: "saved",
      path: join(out, RECORDING_FILE), resolution: "1920x1080", readyConfirmed: true, finalConfirmed: true, completion: "success", passive: true, error: null,
    });
    expect(meta.browser).toMatch(/^chromium/);
    expect(meta.bytes).toBeGreaterThan(10_000);
    expect(meta.wallSeconds).toBeGreaterThan(0);
    expect(Date.parse(meta.readyAt)).toBeLessThan(Date.parse(meta.stoppedAt));
    // WebM (EBML) header.
    expect(readFileSync(join(out, RECORDING_FILE)).subarray(0, 4).toString("hex")).toBe("1a45dfa3");
    expect(existsSync(join(out, ".recording-tmp"))).toBe(false);
    const a = json(join(headless, "S1-seed0", "summary.json"));
    const b = json(join(out, "S1-seed0", "summary.json"));
    expect(b.endHash).toBe(a.endHash);
    expect(semantic(readTrace(b.trace))).toEqual(semantic(readTrace(a.trace)));
  }, 240_000);

  it.skipIf(!hasChromium)("saves the video and the partial records on Ctrl-C", async () => {
    const out = join(tmp(), "interrupted");
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/midterm/live.ts", "--scenario", "S2", "--seed", "0", "--player", "model-history", "--gateway", "mock", "--mock-delay-ms", "40", "--port", "0", "--no-open", "--out", out], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    child.stderr!.on("data", (b: Buffer) => (text += b.toString()));
    const exited = new Promise<number | null>((d) => child.on("exit", (code) => d(code)));
    await new Promise<void>((d) => {
      const onData = (b: Buffer) => {
        text += b.toString();
        if ((text.match(/model call #/g) ?? []).length >= 3) { child.stdout!.off("data", onData); d(); }
      };
      child.stdout!.on("data", onData);
    });
    child.kill("SIGINT");
    expect(await exited, text).toBe(130);
    const meta = json(join(out, RECORDING_META));
    expect(meta).toMatchObject({ status: "saved", completion: "interrupted", readyConfirmed: true, finalConfirmed: true, gateway: "mock:random-legal@0" });
    expect(meta.bytes).toBeGreaterThan(0);
    const summary = json(join(out, "S2-seed0", "summary.json"));
    expect(summary.reason).toBe("manual_stop");
    verifyTrace(readTrace(summary.trace));
    expect(json(join(out, "live.json")).interrupted).toBe(true);
  }, 240_000);

  it("keeps recordings out of Git wherever --out puts them", () => {
    for (const p of ["evaluation-runs/live/x/recording.webm", "elsewhere/run/recording.webm", "elsewhere/run/recording.json", "elsewhere/run/.recording-tmp/a.webm"])
      expect(() => execFileSync("git", ["check-ignore", "-q", p], { cwd: ROOT }), p).not.toThrow();
  });
});
