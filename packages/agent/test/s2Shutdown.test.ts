// Shutdown after an interrupted watched run (S2 seed 0 OpenAI diagnosis,
// 2026-10-28): bounded recorder cleanup, second-signal exit in every phase,
// and a credential scan that is safe for large video files. Offline; the
// recorder tests use a fake browser.
import { afterEach, describe, expect, it } from "vitest";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, truncateSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRecorder, type RecordingDriver } from "../src/recorder.js";
import { fileContains, filesContaining } from "../src/secretScan.js";
import { DUPLICATE_SIGNAL_MS, SignalCounter, signalAction } from "../src/shutdown.js";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "s2-shutdown-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A fake browser whose end check or close can hang forever. */
function hangingDriver(o: { finish?: "hang"; close?: "hang" }) {
  const calls = { closes: 0, abandons: 0 };
  const driver: RecordingDriver = async ({ videoDir }) => ({
    label: "fake browser",
    async waitRendered() {},
    async waitFinished() {
      if (o.finish === "hang") await new Promise(() => {});
    },
    async close(target) {
      calls.closes++;
      // The browser has been writing its unfinished file all along.
      writeFileSync(join(videoDir, "page@partial.webm"), "partial");
      if (o.close === "hang") await new Promise(() => {});
      writeFileSync(target, "webm-bytes");
    },
    abandon() {
      calls.abandons++;
    },
  });
  return { driver, calls };
}

describe("bounded recorder cleanup", () => {
  it("gives up on a video that never finalizes, reports it as not saved, and shuts the browser down", async () => {
    const out = tmp();
    const { driver, calls } = hangingDriver({ close: "hang" });
    const rec = await startRecorder({ url: "http://x/watch", outDir: out, driver });
    await rec.ready();
    const t0 = Date.now();
    const r = await rec.stop({ finalTimeoutMs: 0, holdMs: 0, closeTimeoutMs: 200 });
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(r).toMatchObject({ status: "failed", path: null, bytes: null });
    expect(r.error).toMatch(/Finalizing the video did not finish within 200 ms/);
    expect(r.error).toMatch(/not a valid recording/);
    expect(r.stoppedAt).not.toBeNull();
    expect(calls.abandons).toBe(1);
    // The unfinished file is kept for inspection, never reported as the video.
    expect(readFileSync(join(out, ".recording-tmp", "page@partial.webm"), "utf8")).toBe("partial");
    expect(existsSync(join(out, "recording.webm"))).toBe(false);
  });

  it("does not wait forever for a viewer end check that never returns, even without Ctrl-C", async () => {
    const out = tmp();
    const { driver } = hangingDriver({ finish: "hang" });
    const rec = await startRecorder({ url: "http://x/watch", outDir: out, driver });
    await rec.ready();
    const t0 = Date.now();
    const r = await rec.stop({ finalTimeoutMs: 100, holdMs: 0, closeTimeoutMs: 1000 });
    expect(Date.now() - t0).toBeLessThan(8000);
    expect(r).toMatchObject({ status: "saved", finalConfirmed: false });
    expect(r.warnings.at(-1)).toMatch(/did not show the episode's end/);
    expect(existsSync(join(out, ".recording-tmp"))).toBe(false);
  }, 15_000);

  it("still saves normally and cleans up when the browser behaves", async () => {
    const out = tmp();
    const { driver, calls } = hangingDriver({});
    const rec = await startRecorder({ url: "http://x/watch", outDir: out, driver });
    await rec.ready();
    const r = await rec.stop({ finalTimeoutMs: 100, holdMs: 0 });
    expect(r.status).toBe("saved");
    expect(calls.abandons).toBe(0);
    expect(existsSync(join(out, ".recording-tmp"))).toBe(false);
  });
});

describe("signals", () => {
  it("exits at once on the second signal in every phase", () => {
    expect(signalAction("setup", 0)).toBe("exit-now");
    expect(signalAction("running", 0)).toBe("stop-episode");
    expect(signalAction("running", 1)).toBe("force-exit");
    // After the episode (video finalizing, viewer lingering): the first
    // signal cuts the waits short, the next one exits.
    expect(signalAction("finished", 0)).toBe("finish-now");
    expect(signalAction("finished", 1)).toBe("force-exit");
    expect(signalAction("finished", 5)).toBe("force-exit");
  });

  it("the launcher routes SIGINT, SIGTERM and SIGHUP through it and bounds the viewer close", () => {
    const src = readFileSync(join(import.meta.dirname, "../../../scripts/midterm/live.ts"), "utf8");
    for (const s of ['process.on("SIGINT"', 'process.on("SIGTERM"', 'process.on("SIGHUP"']) expect(src).toContain(s);
    expect(src).toContain("signals.next(phase)");
    expect(src).not.toMatch(/await viewer\??\.close\(\)/);
    expect(src).toMatch(/closeTimeoutMs:/);
    // The old in-memory scan read whole files as strings.
    expect(src).not.toMatch(/readFileSync\(p, "utf8"\)\.includes\(secret/);
    expect(src).toContain("filesContaining(out, secret)");
  });
});

describe("duplicate signal deliveries", () => {
  it("folds deliveries within the window into one request; a later press still counts", () => {
    let t = 0;
    const c = new SignalCounter(DUPLICATE_SIGNAL_MS, () => t);
    expect(c.next("running")).toBe("stop-episode");
    t = 5;
    expect(c.next("running")).toBe("duplicate"); // npm relaying the same Ctrl-C
    t = 900;
    expect(c.next("finished")).toBe("duplicate");
    t = 900 + DUPLICATE_SIGNAL_MS;
    expect(c.next("finished")).toBe("force-exit"); // a deliberate second press
    t += 10;
    expect(c.next("finished")).toBe("duplicate");
  });

  it("a first signal after the episode cuts the waits short, then a later one exits", () => {
    let t = 0;
    const c = new SignalCounter(DUPLICATE_SIGNAL_MS, () => t);
    expect(c.next("finished")).toBe("finish-now");
    t = 2 * DUPLICATE_SIGNAL_MS;
    expect(c.next("finished")).toBe("force-exit");
    expect(new SignalCounter().next("setup")).toBe("exit-now");
  });
});

/**
 * Starts the launcher in its own process group (as a terminal runs a
 * foreground job) on a free mock S2 episode, and signals the whole group, as
 * the terminal does on Ctrl-C or hang-up.
 */
function launchAndSignal(o: { out: string; npm?: boolean; record?: boolean; signal: NodeJS.Signals; repeatMs?: number }) {
  const args = ["--scenario", "S2", "--seed", "0", "--player", "model-history", "--gateway", "mock", "--mock-delay-ms", "40", "--out", o.out, ...(o.record ? ["--port", "0", "--no-open"] : ["--no-viewer"])];
  const [cmd, argv] = o.npm ? ["npm", ["run", "--silent", "eval:live", "--", ...args]] : [process.execPath, ["--import", "tsx", "scripts/midterm/live.ts", ...args]];
  const child = spawn(cmd, argv, { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  let text = "";
  let sent = false;
  child.stderr!.on("data", (b: Buffer) => (text += b.toString()));
  child.stdout!.on("data", (b: Buffer) => {
    text += b.toString();
    if (sent || (text.match(/model call #/g) ?? []).length < 3) return;
    sent = true;
    process.kill(-child.pid!, o.signal);
    if (o.repeatMs !== undefined) setTimeout(() => { try { process.kill(-child.pid!, o.signal); } catch { /* already gone */ } }, o.repeatMs);
  });
  return new Promise<{ code: number | null; text: string }>((done) => child.on("close", (code) => done({ code, text })));
}
const ROOT = join(import.meta.dirname, "../../..");
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
/** The episode's records were finalized: outcome line, summary, live.json, settled scratch ledger, no lock. */
function expectFinalized(out: string, interrupted: boolean) {
  const trace = readFileSync(join(out, "S2-seed0", "trace.jsonl"), "utf8").trim().split("\n");
  expect(JSON.parse(trace.at(-1)!).type).toBe("outcome");
  expect(json(join(out, "S2-seed0", "summary.json")).reason).toBe("manual_stop");
  expect(json(join(out, "live.json")).interrupted).toBe(interrupted);
  expect(json(join(out, "mock-ledger.json")).entries.every((e: { status: string }) => e.status === "settled")).toBe(true);
  expect(existsSync(join(out, "mock-ledger.json.lock"))).toBe(false);
}
const hasChromium = existsSync(chromium.executablePath());

describe("launcher signal handling (subprocess, mock gateway, free)", () => {
  it("one group Ctrl-C delivered twice in quick succession stops once and saves the records", async () => {
    const out = join(tmp(), "double");
    const r = await launchAndSignal({ out, signal: "SIGINT", repeatMs: 20 });
    expect(r.code, r.text).toBe(130);
    expect((r.text.match(/Stopping:/g) ?? []).length).toBe(1);
    expect(r.text).not.toMatch(/Forced exit/);
    expectFinalized(out, true);
  }, 120_000);

  it("a hang-up stops the episode like Ctrl-C and keeps the records", async () => {
    const out = join(tmp(), "hup");
    const r = await launchAndSignal({ out, signal: "SIGHUP", repeatMs: 20 });
    expect(r.code, r.text).toBe(129);
    expect(r.text).not.toMatch(/Forced exit/);
    expectFinalized(out, true);
  }, 120_000);

  it.skipIf(!hasChromium)("one Ctrl-C through `npm run eval:live` saves the video; npm's relay is not a second press", async () => {
    const out = join(tmp(), "npm");
    const r = await launchAndSignal({ out, npm: true, record: true, signal: "SIGINT" });
    expect(r.code, r.text).toBe(130);
    expect(r.text).not.toMatch(/Forced exit/);
    expectFinalized(out, true);
    expect(json(join(out, "recording.json"))).toMatchObject({ status: "saved", completion: "interrupted" });
  }, 240_000);
});

describe("credential scan", () => {
  const SECRET = "canary-credential-0123456789abcdef"; // not key-shaped, so the repository secret scanner stays quiet

  it("finds the key across chunk boundaries and in nested folders", () => {
    const d = tmp();
    mkdirSync(join(d, "a", "b"), { recursive: true });
    const p = join(d, "a", "b", "f.txt");
    for (let at = 0; at < 40; at++) {
      writeFileSync(p, "x".repeat(at) + SECRET + "y".repeat(7));
      expect(fileContains(p, SECRET, 16), `offset ${at}`).toBe(true);
    }
    writeFileSync(p, "x".repeat(100) + SECRET.slice(0, -1));
    expect(fileContains(p, SECRET, 16)).toBe(false);
    writeFileSync(p, SECRET);
    expect(filesContaining(d, SECRET)).toEqual([p]);
  });

  it("scans a file larger than V8's string limit without throwing, and still finds a key at its end", () => {
    const d = tmp();
    mkdirSync(join(d, ".recording-tmp"));
    const video = join(d, ".recording-tmp", "page@x.webm");
    writeFileSync(video, "");
    truncateSync(video, 600 * 1024 * 1024); // sparse: costs no disk space
    writeFileSync(join(d, "trace.jsonl"), "{}\n");
    expect(filesContaining(d, SECRET)).toEqual([]);
    const fd = openSync(video, "r+");
    writeSync(fd, SECRET, 600 * 1024 * 1024 - 10);
    closeSync(fd);
    expect(filesContaining(d, SECRET)).toEqual([video]);
  }, 60_000);
});
