// Gameplay video recording for watched runs (scripts/midterm/live.ts;
// docs/midterm/LIVE_RUN.md "Recording").
//
// A headless Chromium opens the existing read-only `/watch` page and
// Playwright records the page to a video. The recorder is a passive viewer:
// it only loads the page and reads the DOM to confirm both hero views have
// rendered. It sends no input or requests (the server rejects them from
// viewers anyway, SERVER_CHANGES.md §3) and has no access to the room or
// the players. Game ticks are driven only by the environment.
//
// Nothing here throws to the caller. A failure to launch, render or save is
// reported in the result's `status` and `error`, and the evaluation goes on
// without a video. A video path is reported only after Playwright has
// finished writing the file and it exists with a non-zero size.

import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export const RECORDING_FILE = "recording.webm";
export const RECORDING_META = "recording.json";
export const DEFAULT_SIZE = { width: 1280, height: 720 } as const;

export type RecordingStatus = "recording" | "saved" | "failed";

export type ShutdownStage = "context.close" | "video.saveAs" | "video.delete" | "browser.close";
export interface ShutdownDiagnostics {
  activeStage: ShutdownStage | null;
  stages: { stage: ShutdownStage; elapsedMs: number; status: "completed" | "failed"; error?: string }[];
  elapsedMs: number;
  saved: boolean;
  timedOut: boolean;
  timeoutStage: ShutdownStage | null;
  activeStageElapsedMs: number;
  cleanup: "pending" | "completed" | "failed";
  forcedCleanup: string[];
}
export interface RecordingResult {
  shutdown: ShutdownDiagnostics;
  status: RecordingStatus;
  /** Absolute path of the saved video; null unless status is "saved". */
  path: string | null;
  bytes: number | null;
  size: { width: number; height: number };
  /** Both hero views had connected and rendered before the first action. */
  readyConfirmed: boolean;
  /** The viewer showed the episode's end ("finished: …") before recording stopped. */
  finalConfirmed: boolean;
  /** Which browser recorded, e.g. "chromium (GPU)". */
  browser: string | null;
  startedAt: string;
  readyAt: string | null;
  stoppedAt: string | null;
  /** Wall-clock length of the recording (launch to close), seconds. */
  wallSeconds: number | null;
  error: string | null;
  warnings: string[];
}

/** One open browser page being recorded. */
export interface RecordingSession {
  /** Resolves once both hero views show the game; rejects on timeout. */
  waitRendered(timeoutMs: number, signal?: AbortSignal): Promise<void>;
  /** Resolves once the viewer's status line shows the episode's end; rejects on timeout. */
  waitFinished?(timeoutMs: number, signal?: AbortSignal): Promise<void>;
  /** Which browser is recording, and anything worth reporting about it. */
  label?: string;
  warnings?: string[];
  /** Closes the page and browser and writes the video to `target`. */
  close(target: string, progress?: (stage: ShutdownStage, status: "started" | "completed" | "failed", error?: string) => void, signal?: AbortSignal): Promise<void>;
  /** Force owned browser/encoder cleanup after a failed or timed-out close. */
  abandon?(): void | Promise<string[]>;
}

/** Opens a recorded page. Replaceable in tests; the default uses Playwright. */
export type RecordingDriver = (o: { url: string; videoDir: string; size: { width: number; height: number }; env?: NodeJS.ProcessEnv }) => Promise<RecordingSession>;

export interface Recorder {
  readonly result: RecordingResult;
  /** Final-screen capture/tail is done; encoding and cleanup may still be pending. */
  readonly captureFinished: Promise<void>;
  /**
   * The environment's `ready` hook: waits until the viewer has rendered the
   * episode's start, or until it fails, times out or `signal` aborts. Never
   * rejects, so a recording problem cannot stop the evaluation.
   */
  ready(signal?: AbortSignal): Promise<void>;
  /**
   * Stops recording and saves the video. First waits (at most
   * `finalTimeoutMs`) until the viewer shows the episode's end, then keeps
   * recording for `holdMs` so the final screen is in the video; `signal`
   * cuts both waits short. Idempotent; never rejects.
   */
  stop(o?: { holdMs?: number; finalTimeoutMs?: number; closeTimeoutMs?: number; signal?: AbortSignal }): Promise<RecordingResult>;
}

/** Default bound on finalizing the video (closing the page, writing and moving the file). */
export const CLOSE_TIMEOUT_MS = 120_000;
/** Extra time the recorder allows a driver's own end wait before giving up on it. */
const FINAL_GRACE_MS = 5_000;

/**
 * Rejects after `ms` with a plain message; `clear` cancels it. The recorder
 * bounds every browser wait itself, whatever the driver does, so a stuck
 * browser cannot keep the launcher alive (S2 seed 0 OpenAI run, 2026-10-28).
 */
function deadline(ms: number, what: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Error(`${what} did not finish within ${ms < 1000 ? `${ms} ms` : `${Math.round(ms / 1000)} s`}`)), ms);
  });
  expired.catch(() => {});
  return { expired, clear: () => clearTimeout(timer) };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0]!.slice(0, 300);

/** Rejects when `signal` aborts (never, without one). */
const aborted = (signal?: AbortSignal) => {
  const p = new Promise<never>((_, reject) => {
    if (signal?.aborted) reject(Error("stopped"));
    signal?.addEventListener("abort", () => reject(Error("stopped")), { once: true });
  });
  p.catch(() => {});
  return p;
};
const sleep = (ms: number, signal?: AbortSignal) =>
  ms > 0 && !signal?.aborted
    ? Promise.race([new Promise<void>((r) => setTimeout(r, ms)), aborted(signal)]).catch(() => {})
    : Promise.resolve();

/**
 * True once both hero frames on `/watch` have attached and drawn the game:
 * the client sets `body[data-playing="true"]` from the server's world state,
 * and the HUD's `#stats` line ("Sieg · HP 100 · Room … · Connected") is
 * written only by the game scene's update loop, which starts after the
 * assets have loaded and draws the world each frame. Runs in the page; reads only.
 * (Source strings, not functions: the TypeScript loader would add helpers
 * that do not exist in the browser.)
 */
export const FRAMES_PLAYING = `(() => {
  const frames = [...document.querySelectorAll("iframe")];
  return frames.length === 2 && frames.every((f) => {
    const d = f.contentDocument;
    const canvas = d && d.querySelector("#game canvas");
    const stats = d && d.querySelector("#stats");
    return !!d && !!d.body && d.body.dataset.playing === "true" && !!canvas && canvas.width > 0 && canvas.height > 0 &&
      !!stats && / · Connected$/.test(stats.textContent || "");
  });
})()`;
/** True once the viewer's status line reports the episode's end. Reads only. */
export const STATUS_FINISHED = `/^finished: /.test((document.getElementById("meta") || {}).textContent || "")`;
/** Waits for a few animation frames in each hero frame, so the state is drawn. */
export const FRAMES_DRAWN = `Promise.all([...document.querySelectorAll("iframe")].map((f) => new Promise((resolve) => {
  const w = f.contentWindow;
  if (!w) return resolve();
  let n = 0;
  const next = () => (++n >= 3 ? resolve() : w.requestAnimationFrame(next));
  w.requestAnimationFrame(next);
}))).then(() => true)`;

export const playwrightDriver: RecordingDriver = async ({ url, videoDir, size, env }) => {
  const { chromium } = await import("playwright");
  // The launcher handles Ctrl-C itself and closes the browser after saving;
  // Playwright must not close it first on the same signal.
  const options = { artifactsDir: videoDir, headless: true, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false, ...(env ? { env } : {}) };
  // The full Chromium build draws WebGL on the GPU. Playwright's default
  // headless shell draws it on the CPU (SwiftShader), which with two game
  // views at 1080p falls behind real time, so the video would lag the game.
  const warnings: string[] = [];
  let label = "chromium (GPU)";
  let server: import("playwright").BrowserServer;
  let browser: import("playwright").Browser;
  try {
    server = await chromium.launchServer({ ...options, channel: "chromium" });
  } catch (e) {
    server = await chromium.launchServer(options);
    label = "chromium headless shell (software WebGL)";
    warnings.push(`Full Chromium unavailable (${message(e)}); recorded with the headless shell, whose software rendering may lag behind the game.`);
  }
  try { browser = await chromium.connect(server.wsEndpoint()); }
  catch (e) { await server.kill(); throw e; }
  // The browser server owns Chromium. Playwright's encoder is a direct child
  // of this Node process; only select ffmpeg children naming this unique directory.
  const forceCleanup = async () => {
    const actions: string[] = [];
    const encoders: number[] = [];
    try {
      const rows = execFileSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8", timeout: 2000, maxBuffer: 4 * 1024 * 1024 }).split("\n");
      for (const row of rows) {
        const m = row.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
        if (m && Number(m[2]) === process.pid && m[3]!.includes(videoDir + "/") && /ffmpeg/i.test(m[3]!)) {
          try { process.kill(Number(m[1]), "SIGKILL"); encoders.push(Number(m[1])); actions.push(`Sent SIGKILL to owned encoder ${m[1]}`); }
          catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
        }
      }
    } catch (e) { actions.push(`Encoder cleanup inspection failed: ${message(e)}`); }
    await server.kill();
    actions.push("Owned Chromium server terminated");
    for (const pid of encoders) {
      let exited = false;
      for (let n = 0; n < 40; n++) {
        try { process.kill(pid, 0); }
        catch (e) { if ((e as NodeJS.ErrnoException).code === "ESRCH") { exited = true; break; } throw e; }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      actions.push(exited ? `Owned encoder ${pid} exit confirmed` : `WARNING: owned encoder ${pid} exit not confirmed`);
    }
    return actions;
  };
  try {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    return {
      label,
      warnings,
      async waitRendered(timeoutMs, signal) {
        await Promise.race([page.waitForFunction(FRAMES_PLAYING, undefined, { timeout: timeoutMs, polling: 100 }), aborted(signal)]);
        await Promise.race([page.evaluate(FRAMES_DRAWN), aborted(signal)]);
      },
      async waitFinished(timeoutMs, signal) {
        await Promise.race([page.waitForFunction(STATUS_FINISHED, undefined, { timeout: timeoutMs, polling: 100 }), aborted(signal)]);
        await Promise.race([page.evaluate(FRAMES_DRAWN), aborted(signal)]);
      },
      async close(target, progress, signal) {
        const video = page.video();
        const stage = async (name: ShutdownStage, action: () => Promise<unknown>) => {
          if (signal?.aborted) throw Error("Recording shutdown cancelled");
          progress?.(name, "started");
          try { await action(); }
          catch (e) { if (!signal?.aborted) progress?.(name, "failed", message(e)); throw e; }
          if (signal?.aborted) throw Error("Recording shutdown cancelled");
          progress?.(name, "completed");
        };
        await stage("context.close", () => context.close());
        if (!video) throw Error("Playwright produced no video for the page.");
        await stage("video.saveAs", () => video.saveAs(target));
        // Cleanup failures must still attempt browser shutdown.
        let cleanupError: unknown;
        try { await stage("video.delete", () => video.delete()); } catch (e) { cleanupError = e; }
        await stage("browser.close", async () => { await browser.close(); await server.close(); });
        if (cleanupError) throw cleanupError;
      },
      abandon: forceCleanup,
    };
  } catch (e) {
    await forceCleanup().catch(() => {});
    throw e;
  }
};

/**
 * Starts recording `url` into `outDir`. Resolves in every case: on failure
 * the recorder's result is "failed" and `ready()` returns at once.
 */
export async function startRecorder(o: {
  url: string;
  outDir: string;
  size?: { width: number; height: number };
  driver?: RecordingDriver;
  readyTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}): Promise<Recorder> {
  const size = o.size ?? { ...DEFAULT_SIZE };
  const started = Date.now();
  const target = join(o.outDir, RECORDING_FILE);
  const videoDir = join(o.outDir, ".recording-tmp");
  const result: RecordingResult = {
    shutdown: { activeStage: null, stages: [], elapsedMs: 0, saved: false, timedOut: false, timeoutStage: null, activeStageElapsedMs: 0, cleanup: "pending", forcedCleanup: [] },
    status: "recording", path: null, bytes: null, size, readyConfirmed: false, finalConfirmed: false, browser: null,
    startedAt: new Date(started).toISOString(), readyAt: null, stoppedAt: null, wallSeconds: null, error: null, warnings: [],
  };
  let session: RecordingSession | undefined;
  try {
    mkdirSync(videoDir, { recursive: true });
    session = await (o.driver ?? playwrightDriver)({ url: o.url, videoDir, size, ...(o.env ? { env: o.env } : {}) });
    result.browser = session.label ?? null;
    result.warnings.push(...(session.warnings ?? []));
  } catch (e) {
    result.status = "failed";
    result.error = `Could not start the recording browser: ${message(e)}`;
    if (existsSync(videoDir) && readdirSync(videoDir).length === 0) rmSync(videoDir, { recursive: true, force: true });
    else result.warnings.push(`Startup diagnostic files retained in ${videoDir}`);
  }
  let captured!: () => void;
  const captureFinished = new Promise<void>((resolve) => { captured = resolve; });
  let waited: Promise<void> | undefined;
  let stopped: Promise<RecordingResult> | undefined;
  let retainDiagnostics = result.status === "failed";
  return {
    result,
    captureFinished,
    ready(signal) {
      if (!session || result.status !== "recording" || result.readyConfirmed) return Promise.resolve();
      // A later reset (a retried attempt) checks again.
      // The recorder enforces the abort itself, whatever the driver does.
      waited ??= Promise.race([session.waitRendered(o.readyTimeoutMs ?? 60_000, signal), aborted(signal)]).then(
        () => {
          result.readyConfirmed = true;
          result.readyAt = new Date().toISOString();
        },
        (e) => {
          result.warnings.push(signal?.aborted ? "Stopped before the viewer was confirmed ready." : `The viewer was not confirmed ready before the first action: ${message(e)}`);
        },
      ).finally(() => (waited = undefined));
      return waited;
    },
    stop(s = {}) {
      stopped ??= (async () => {
        if (session && result.status === "recording") {
          if (session.waitFinished && (s.finalTimeoutMs ?? 0) > 0) {
            const limit = deadline(s.finalTimeoutMs! + FINAL_GRACE_MS, "The viewer's end check");
            try {
              await Promise.race([session.waitFinished(s.finalTimeoutMs!, s.signal), aborted(s.signal), limit.expired]);
              result.finalConfirmed = true;
            } catch (e) {
              result.warnings.push(s.signal?.aborted ? "Stopped before the viewer showed the episode's end." : `The viewer did not show the episode's end before recording stopped: ${message(e)}`);
            } finally {
              limit.clear();
            }
          }
          await sleep(s.holdMs ?? 0, s.signal);
          captured();
          const closeMs = s.closeTimeoutMs ?? CLOSE_TIMEOUT_MS;
          const limit = deadline(closeMs, "Finalizing the video");
          const shutdown = result.shutdown;
          const closing = new AbortController();
          const began = Date.now();
          let stageBegan = began;
          const saved = () => {
            const bytes = existsSync(target) ? statSync(target).size : 0;
            if (!bytes) throw Error(`no video data at ${target}`);
            Object.assign(result, { status: "saved", path: target, bytes });
            shutdown.saved = true;
          };
          const progress = (stage: ShutdownStage, status: "started" | "completed" | "failed", error?: string) => {
            if (closing.signal.aborted) return;
            if (status === "started") { shutdown.activeStage = stage; stageBegan = Date.now(); }
            else {
              shutdown.stages.push({ stage, elapsedMs: Date.now() - stageBegan, status, ...(error ? { error } : {}) });
              shutdown.activeStage = null;
              if (stage === "video.saveAs" && status === "completed") saved();
            }
          };
          try {
            await Promise.race([session.close(target, progress, closing.signal), limit.expired]);
            if (!shutdown.saved) saved(); // Legacy/test drivers without stage callbacks.
            shutdown.cleanup = "completed";
          } catch (e) {
            shutdown.timedOut = /did not finish within/.test(message(e));
            shutdown.timeoutStage = shutdown.timedOut ? shutdown.activeStage : null;
            shutdown.activeStageElapsedMs = shutdown.activeStage ? Date.now() - stageBegan : 0;
            shutdown.cleanup = "failed";
            retainDiagnostics = true; // Preserve diagnostic artifacts on every shutdown failure.
            const detail = `${message(e)}; stage=${shutdown.activeStage ?? "between stages"}; elapsed=${Date.now() - began} ms; saved=${shutdown.saved}`;
            if (shutdown.saved) result.warnings.push(`Video saved; cleanup failed: ${detail}`);
            else { result.status = "failed"; result.error = `Could not save the video: ${detail}. Diagnostic files retained in ${videoDir}`; }
            closing.abort(); // Prevent late continuation from saving/deleting diagnostic files.
            const cleanupLimit = deadline(10_000, "Forced recorder cleanup");
            try {
              shutdown.forcedCleanup = (await Promise.race([Promise.resolve(session.abandon?.()), cleanupLimit.expired])) ?? [];
            } catch (e) { shutdown.forcedCleanup.push(`Forced cleanup failed: ${message(e)}`); }
            finally { cleanupLimit.clear(); }
          } finally {
            shutdown.elapsedMs = Date.now() - began;
            limit.clear();
          }
        }
        captured();
        result.stoppedAt = new Date().toISOString();
        result.wallSeconds = Math.round((Date.now() - started) / 100) / 10;
        if (!retainDiagnostics) rmSync(videoDir, { recursive: true, force: true });
        return result;
      })();
      return stopped;
    },
  };
}
