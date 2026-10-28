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
import { signalAction } from "../src/shutdown.js";

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
    expect(src).toContain("signalAction(phase, interrupts++)");
    expect(src).not.toMatch(/await viewer\??\.close\(\)/);
    expect(src).toMatch(/closeTimeoutMs:/);
    // The old in-memory scan read whole files as strings.
    expect(src).not.toMatch(/readFileSync\(p, "utf8"\)\.includes\(secret/);
    expect(src).toContain("filesContaining(out, secret)");
  });
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
