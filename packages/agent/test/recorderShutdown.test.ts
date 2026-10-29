import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRecorder, type RecordingDriver, type ShutdownStage } from "../src/recorder.js";
import { finishViewerAfterGrace } from "../src/shutdown.js";
import { runSuite } from "../src/harness.js";
import { verifyTrace } from "../src/trace.js";
const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "rec-shutdown-")); dirs.push(d); return d; };
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
function staged(stall?: ShutdownStage, fail?: ShutdownStage) {
  let abandoned = 0;
  const driver: RecordingDriver = async ({ videoDir }) => {
    writeFileSync(join(videoDir, "diagnostic.txt"), "retain on failure");
    return {
      async waitRendered() {},
      async close(target, progress) {
        for (const stage of ["context.close", "video.saveAs", "video.delete", "browser.close"] as ShutdownStage[]) {
          progress?.(stage, "started");
          if (stage === stall) await new Promise(() => {});
          if (stage === fail) { progress?.(stage, "failed", "cleanup failure"); throw Error("cleanup failure"); }
          if (stage === "video.saveAs") writeFileSync(target, "finalized-video");
          progress?.(stage, "completed");
        }
      },
      async abandon() { abandoned++; return ["owned processes terminated"]; },
    };
  };
  return { driver, abandoned: () => abandoned };
}
describe("recording shutdown diagnostics", () => {
  for (const stage of ["context.close", "video.saveAs"] as const) {
    it(`identifies a stalled ${stage}, retains artifacts and invokes owned cleanup`, async () => {
      const outDir = tmp(); const f = staged(stage);
      const rec = await startRecorder({ url: "http://unused", outDir, driver: f.driver });
      const r = await rec.stop({ closeTimeoutMs: 25 });
      expect(r.status).toBe("failed"); expect(r.path).toBeNull();
      expect(r.shutdown).toMatchObject({ activeStage: stage, timeoutStage: stage, timedOut: true, saved: false, cleanup: "failed" });
      expect(r.shutdown.elapsedMs).toBeGreaterThanOrEqual(20);
      expect(r.shutdown.activeStageElapsedMs).toBeGreaterThanOrEqual(0);
      expect(r.shutdown.activeStageElapsedMs).toBeLessThanOrEqual(r.shutdown.elapsedMs);
      expect(r.shutdown.stages.map((s) => s.stage)).toEqual(stage === "context.close" ? [] : ["context.close"]);
      expect(f.abandoned()).toBe(1);
      expect(existsSync(join(outDir, ".recording-tmp", "diagnostic.txt"))).toBe(true);
    });
  }
  for (const mode of ["fail", "stall"] as const) for (const stage of ["video.delete", "browser.close"] as const) {
    it(`keeps the finalized video when ${stage} ${mode}s`, async () => {
      const outDir = tmp(); const f = staged(mode === "stall" ? stage : undefined, mode === "fail" ? stage : undefined);
      const rec = await startRecorder({ url: "http://unused", outDir, driver: f.driver });
      const r = await rec.stop({ closeTimeoutMs: 25 });
      expect(r).toMatchObject({ status: "saved", path: join(outDir, "recording.webm"), bytes: 15, error: null });
      expect(r.shutdown).toMatchObject({ saved: true, cleanup: "failed", timedOut: mode === "stall" });
      expect(r.warnings.join()).toContain("Video saved; cleanup failed");
      expect(f.abandoned()).toBe(1);
      expect(readFileSync(r.path!, "utf8")).toBe("finalized-video");
    });
  }
  it("closes the viewer after its grace while recording is still pending", async () => {
    const f = staged("context.close");
    const rec = await startRecorder({ url: "http://unused", outDir: tmp(), driver: f.driver });
    let recordingDone = false; let viewerClosed = false;
    const grace = finishViewerAfterGrace({ milliseconds: 10, signal: new AbortController().signal, close: async () => { viewerClosed = true; expect(recordingDone).toBe(false); } });
    const recording = rec.stop({ closeTimeoutMs: 60 }).then(() => { recordingDone = true; });
    await grace; expect(viewerClosed).toBe(true); await recording;
  });
  it("lets final-screen capture finish before viewer closure without awaiting encoding", async () => {
    const rec = await startRecorder({ url: "http://unused", outDir: tmp(), driver: staged("context.close").driver });
    let recordingDone = false;
    const grace = finishViewerAfterGrace({ milliseconds: 0, signal: new AbortController().signal, close: async () => {
      await rec.captureFinished;
      expect(recordingDone).toBe(false);
    } });
    const stopping = rec.stop({ holdMs: 15, closeTimeoutMs: 40 }).then(() => { recordingDone = true; });
    await grace; await stopping;
  });
  it("honors Ctrl-C during viewer grace even without recording", async () => {
    const signal = new AbortController(); let closed = false;
    const done = finishViewerAfterGrace({ milliseconds: 15000, signal: signal.signal, close: async () => { closed = true; } });
    signal.abort(); await done; expect(closed).toBe(true);
  });
  it("records all four completed stages on successful shutdown", async () => {
    const outDir = tmp();
    const rec = await startRecorder({ url: "http://unused", outDir, driver: staged().driver });
    const result = await rec.stop();
    expect(result).toMatchObject({ status: "saved", shutdown: { activeStage: null, saved: true, cleanup: "completed", timedOut: false } });
    expect(result.shutdown.stages.map((s) => [s.stage, s.status])).toEqual([
      ["context.close", "completed"], ["video.saveAs", "completed"], ["video.delete", "completed"], ["browser.close", "completed"],
    ]);
    expect(existsSync(join(outDir, ".recording-tmp"))).toBe(false);
  });
  it("retains completed evaluation results and trace on recording timeout", async () => {
    const outDir = tmp();
    const [summary] = await runSuite({ player: "baseline-quest", situations: ["S1"], seeds: [0], outDir, gitHash: "offline-test" });
    const before = readFileSync(summary!.trace, "utf8");
    const rec = await startRecorder({ url: "http://unused", outDir, driver: staged("video.saveAs").driver });
    expect((await rec.stop({ closeTimeoutMs: 20 })).status).toBe("failed");
    expect(summary!.success).toBe(true);
    expect(JSON.parse(readFileSync(join(outDir, "S1-seed0", "summary.json"), "utf8")).endHash).toBe(summary!.endHash);
    expect(readFileSync(summary!.trace, "utf8")).toBe(before);
    verifyTrace(before.trim().split("\n").map((line) => JSON.parse(line)));
  });
});
