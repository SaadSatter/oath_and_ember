// Watch two independent AI players (Sieg and Coco) play one tuning scenario in
// the real game, through the existing evaluation harness (docs/midterm/LIVE_RUN.md).
//
//   Offline, no spending:
//     npm run eval:live -- --scenario S1 --seed 0 --player baseline-quest
//     npm run eval:live -- --scenario S2 --seed 1 --player model-history --gateway mock
//   Paid (only after the owner authorizes it; key from ANTHROPIC_API_KEY or a hidden prompt):
//     npm run eval:live -- --scenario S1 --seed 0 --player model-history \
//       --model claude-haiku-5-5 --effort medium --max-spend-usd 0.20 --paid
//
// What it does: one runSuite() episode (same suite rules, budget, ledger,
// traces and records as evaluate.ts), with the environment's room served to
// a local read-only browser viewer and game time paced to real time. A
// headless Chromium records the viewer to <out>/recording.webm (1920×1080)
// with its metadata in <out>/recording.json; --no-record turns this off.
//
// What it never does: run S4 or F, run final seeds, take a credential on the
// command line, write a credential anywhere, or use any ledger other than the
// canonical one for paid runs. Mock runs never touch the canonical ledger and
// make no network request.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { aggregate, EPISODE_CAP_USD, episodeCap, PLAYER_KINDS, runSuite, validatePlan, type EpisodeSummary, type ModelSetup, type PlayerKind } from "../../packages/agent/src/harness.js";
import { APPROVED_LEDGER, SpendLedger } from "../../packages/agent/src/ledger.js";
import { startViewer, type Viewer } from "../../packages/agent/src/liveViewer.js";
import { RECORDING_META, startRecorder, type Recorder, type RecordingResult } from "../../packages/agent/src/recorder.js";
import { filesContaining } from "../../packages/agent/src/secretScan.js";
import { SignalCounter } from "../../packages/agent/src/shutdown.js";
import { providerConfig } from "../../packages/agent/src/policies/providers.js";
import type { Gateway } from "../../packages/agent/src/budget.js";
import { MockGateway } from "../../packages/agent/src/policies/mockGateway.js";
import { canonicalLedgerPath, repoInfo, unmeteredWorktrees } from "../../packages/agent/src/repo.js";
import { HISTORICAL_SITUATIONS, SEEDS, SITUATIONS, situation, type SituationId } from "../../packages/agent/src/suite.js";
import type { TraceLine } from "../../packages/agent/src/trace.js";
import { ask, credentialArgs, redactStreams, safeText } from "./tty.js";

const argv = process.argv.slice(2);
const KNOWN = new Map<string, "value" | "flag">([
  ["--scenario", "value"], ["--seed", "value"], ["--player", "value"], ["--gateway", "value"], ["--model", "value"],
  ["--effort", "value"], ["--max-spend-usd", "value"], ["--paid", "flag"], ["--speed", "value"], ["--port", "value"],
  ["--out", "value"], ["--wall-seconds", "value"], ["--max-batch", "value"], ["--mock-delay-ms", "value"],
  ["--linger-seconds", "value"], ["--no-viewer", "flag"], ["--no-open", "flag"], ["--no-record", "flag"], ["--help", "flag"],
]);

function fail(message: string): never {
  console.error(`eval:live: ${message}`);
  process.exit(2);
}

// The credential is taken out of this process's environment immediately, for
// every kind of run, so no child process (client build, browser) inherits it.
const envKeys = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY?.trim(), OPENAI_API_KEY: process.env.OPENAI_API_KEY?.trim() };
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
for (const key of Object.values(envKeys)) if (key) redactStreams(key);

// ── Arguments ──────────────────────────────────────────────────────────────
// A credential never belongs on the command line (it would reach shell
// history and process listings). Refuse before reading anything else.
if (credentialArgs(argv).length) fail("credentials are never accepted as arguments. Set ANTHROPIC_API_KEY or answer the hidden prompt.");
const opts = new Map<string, string | true>();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--final" || a === "--situations" || a === "--seeds") fail(`${a} is not available here: the live launcher runs one tuning scenario. Final runs use evaluate.ts with the owner's approval.`);
  const kind = KNOWN.get(a);
  if (!kind) fail(`unknown argument ${a}. See docs/midterm/LIVE_RUN.md.`);
  if (kind === "flag") opts.set(a, true);
  else {
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) fail(`${a} needs a value.`);
    opts.set(a, v);
  }
}
const get = (k: string, fallback?: string) => (typeof opts.get(k) === "string" ? (opts.get(k) as string) : fallback);
const num = (k: string, fallback: number) => {
  const raw = get(k);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) fail(`${k} must be a non-negative number (got "${raw}").`);
  return n;
};
if (opts.has("--help")) {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  process.exit(0);
}

const requestedScenario = (get("--scenario") ?? fail("--scenario S1|S2|S3|S2-local|S3-local is required.")).toUpperCase();
const scenario = ([...SITUATIONS, ...HISTORICAL_SITUATIONS].find((s) => s.id.toUpperCase() === requestedScenario)?.id ?? requestedScenario) as SituationId;
// Held-out scenarios are refused unconditionally here, whatever else is set (review H2).
if (scenario === "S4" || scenario === "F") fail(`${scenario} is held out. The live launcher never runs S4 or F; the final evaluation needs separate owner approval through evaluate.ts.`);
// Suite revision 2: S2 is Hedge Maze and S3 Mirror Pond. The revision 1
// definitions (-v1 ids) stay runnable to reproduce historical results.
if (!["S1", "S2", "S3", "S2-local", "S3-local", ...HISTORICAL_SITUATIONS.map((s) => s.id)].includes(scenario))
  fail(`unknown scenario ${scenario} (S1, S2, S3, S2-local, S3-local, or a historical ${HISTORICAL_SITUATIONS.map((s) => s.id).join(", ")}).`);
const seed = Number(get("--seed", "0"));
if (!SEEDS.tuning.includes(seed)) fail(`the live launcher uses the tuning seeds ${SEEDS.tuning.join(", ")} only.`);
const player = get("--player", "model-history") as PlayerKind;
if (!PLAYER_KINDS.includes(player)) fail(`--player must be one of ${PLAYER_KINDS.join(", ")}.`);
const isModel = player === "model-history" || player === "model-obs-only" || player === "model-guided";
const gatewayKind = get("--gateway", isModel ? "anthropic" : "none")!;
if (!isModel && opts.has("--gateway")) fail("scripted baselines use no gateway.");
if (isModel && !["anthropic", "openai", "mock"].includes(gatewayKind)) fail("--gateway must be anthropic, openai or mock.");
const paid = isModel && gatewayKind !== "mock";
if (paid && !opts.has("--paid")) fail("this is a paid run. Pass --paid only after the owner has authorized it, or use --gateway mock.");
if (!paid && opts.has("--paid")) fail("--paid is only for --gateway anthropic or openai.");
if (!paid && (opts.has("--model") || opts.has("--effort") || opts.has("--max-spend-usd"))) fail("--model, --effort and --max-spend-usd apply to paid runs only.");
const viewerOn = !opts.has("--no-viewer");
// The video is recorded from the viewer, so --no-viewer also means no video.
const recordOn = viewerOn && !opts.has("--no-record");
const speed = num("--speed", 1);
const paced = viewerOn && speed > 0;
const lingerSeconds = num("--linger-seconds", viewerOn ? 15 : 0);
const maxBatch = num("--max-batch", 4);
const wallSeconds = opts.has("--wall-seconds") ? num("--wall-seconds", 0) : undefined;
if (wallSeconds === 0) fail("--wall-seconds must be positive.");

// ── Interruption (installed before any setup; re-review M3) ─────────────────
// During setup a signal exits at once. While the episode runs, the first
// signal ends it and saves its records; a second exits now. The exit handler
// releases the ledger lock in every case; an open reservation stays open
// (fails closed) and is settled later by `ledger.ts reconcile`.
const controller = new AbortController();
const linger = new AbortController();
let phase: "setup" | "running" | "finished" = "setup";
let recorder: Recorder | undefined;
let summaries: EpisodeSummary[] = [];
let error: Error | undefined;
const signals = new SignalCounter();
let ledger: SpendLedger | undefined;
let recordingMeta: ((r: RecordingResult, note?: string) => void) | undefined;
let recordingFinal = false;
process.on("exit", () => {
  ledger?.close();
  // A forced exit cannot wait for the video to be finalized: say so.
  if (recorder && recordingMeta && !recordingFinal)
    recordingMeta({ ...recorder.result, status: "failed", path: null, error: "The launcher exited before the video was saved (forced exit or a stop before the episode). Any partial file is incomplete." });
});
const onSignal = (code: number) => () => {
  // A duplicate delivery of the same request (npm relays the terminal's
  // signal to this process) is ignored; see SignalCounter.
  const action = signals.next(phase);
  if (action === "duplicate") return;
  if (action === "exit-now") {
    console.error("\nStopped before the episode started; nothing was reserved.");
    process.exit(code);
  }
  // A second signal always exits now, in any phase, including while the
  // video is being finalized after the episode. The exit handler then marks
  // the recording as not saved.
  if (action === "force-exit") {
    console.error("\nForced exit. Traces written so far are kept; any open ledger reservation stays held until it is reconciled (`ledger.ts reconcile`).");
    process.exit(code);
  }
  if (action === "finish-now") {
    console.error("\nClosing: the episode's records are saved; finishing the video. Press Ctrl-C again to exit now (the video is then marked as not saved).");
    linger.abort();
    return;
  }
  console.error("\nStopping: the episode ends now and its records are being saved. Press Ctrl-C again to force exit.");
  process.exitCode = code;
  controller.abort();
};
process.on("SIGINT", onSignal(130));
process.on("SIGTERM", onSignal(143));
// Closing the terminal: stop and save like Ctrl-C, instead of dying without
// the exit handler (which left recording.json saying "recording").
process.on("SIGHUP", onSignal(129));

/** Waits at most `ms` for `p`; reports and moves on if it takes longer. */
async function bounded(p: Promise<unknown>, ms: number, what: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<"late">((r) => (timer = setTimeout(() => r("late"), ms)));
  const r = await Promise.race([p.then(() => "done" as const, () => "done" as const), late]);
  clearTimeout(timer);
  if (r === "late") console.error(`${what} did not finish within ${Math.round(ms / 1000)} s; continuing.`);
}
const VIEWER_CLOSE_MS = 10_000;

const repo = repoInfo();
const version = repo.dirty ? `${repo.head.slice(0, 7)}+dirty` : repo.head.slice(0, 7);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = resolve(repo.root, get("--out", `evaluation-runs/live/${scenario}-seed${seed}-${player}${isModel ? `-${gatewayKind}` : ""}-${stamp}`)!);
if (existsSync(out)) fail(`output ${out} already exists.`);

// ── Model setup (checks first, credential last) ──────────────────────────────
let model: ModelSetup | undefined;
let paidGateway: { gateway: Gateway; source: string } | undefined;
let episodeCapUsd: number | undefined;
let secret: string | undefined;
let secretSeenInOutput = () => false;

/** Open the shared ledger and check the pilot stage can cover the cap (fails the run otherwise). */
function openPaidLedger(): SpendLedger {
  let l: SpendLedger;
  try {
    l = SpendLedger.openCanonical(repo);
  } catch (e) {
    fail((e as Error).message);
  }
  const left = Math.min(l.remaining("pilot"), l.remaining());
  if (episodeCapUsd! > left + 1e-9) {
    l.close();
    fail(`the pilot stage has $${left.toFixed(4)} left; this run would reserve $${episodeCapUsd}.`);
  }
  return l;
}
const manual = readFileSync(join(repo.root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
if (isModel) {
  validatePlan({ player, situations: [scenario], seeds: [seed], model: { stage: "pilot" } as ModelSetup });
  if (paid) {
    let config: ReturnType<typeof providerConfig>;
    try { config = providerConfig(gatewayKind, get("--model"), get("--effort", "medium")!); }
    catch (e) { fail((e as Error).message); }
    const raw = get("--max-spend-usd") ?? fail(`--max-spend-usd is required for paid runs (at most $${EPISODE_CAP_USD[scenario]} for ${scenario}).`);
    episodeCapUsd = Number(raw);
    try {
      episodeCap({ episodeCapUsd }, scenario);
    } catch (e) {
      fail((e as Error).message);
    }
    if (repo.dirty) fail("paid runs need a clean, committed tree so the game version is exact.");
    for (const u of unmeteredWorktrees(repo)) console.error(`WARNING: ${u.file} can make paid calls outside the shared ledger. Never run paid commands there.`);
    // The one shared ledger (review H1): refuses if missing, locked, replaced,
    // or if a legacy ledger exists. Checked before asking for the credential,
    // then closed so no lock is held during the prompt or the client build
    // (re-review M3); it is reopened and re-checked just before the run.
    openPaidLedger().close();
    // Credential: the environment variable, else a hidden prompt. It stays
    // in memory, is removed from this process's environment so no child
    // process inherits it, and is never written or printed.
    secret = envKeys[config.keyName as keyof typeof envKeys];
    if (!secret) {
      try {
        secret = (await ask(`${gatewayKind === "openai" ? "OpenAI" : "Anthropic"} API key (hidden, not stored): `, true)).trim() || undefined;
      } catch (e) {
        fail((e as Error).message === "Cancelled." ? "cancelled." : `no ${config.keyName} and no interactive terminal for the hidden prompt.`);
      }
    }
    if (!secret) fail("no credential given.");
    secretSeenInOutput = redactStreams(secret);
    paidGateway = { gateway: config.create(secret), source: config.source };
  } else {
    // Mock: a scratch ledger inside this run's own folder, never the canonical one.
    mkdirSync(out, { recursive: true });
    const scratch = join(out, "mock-ledger.json");
    if (resolve(scratch) === resolve(canonicalLedgerPath(repo))) fail("refusing to use the canonical ledger for a mock run.");
    ledger = SpendLedger.open(scratch, APPROVED_LEDGER, { create: true });
    model = { gateway: new MockGateway(seed, num("--mock-delay-ms", viewerOn ? 300 : 0)), manual, ledger, stage: "pilot", priceSource: "mock: no cost, no network", maxBatch };
  }
}

// ── Client build (the viewer serves dist/client from this checkout) ─────────
function newest(dir: string): number {
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return t;
}
function cleanEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.OPENAI_API_KEY;
  return env;
}
if (viewerOn) {
  const index = join(repo.root, "dist/client/index.html");
  const stale = !existsSync(index) || statSync(index).mtimeMs < Math.max(newest(join(repo.root, "apps/client/src")), newest(join(repo.root, "packages/shared/src")));
  if (stale) {
    console.log("Building the game client for the viewer…");
    const r = spawnSync("npx", ["vite", "build", "--config", "apps/client/vite.config.ts", "--logLevel", "warn"], { cwd: repo.root, stdio: "inherit", env: cleanEnv() });
    if (r.status !== 0) fail("client build failed; the run did not start.");
  }
}

// ── Viewer ───────────────────────────────────────────────────────────────────
let viewer: Viewer | undefined;
if (viewerOn) {
  try {
    viewer = await startViewer({ root: repo.root, port: num("--port", 3030), speed, title: `Oath and Ember · ${scenario} seed ${seed} · ${player}${isModel ? ` (${(paidGateway?.gateway ?? model!.gateway).label})` : ""}` });
  } catch (e) {
    fail(`could not start the viewer: ${(e as Error).message}. Try --port <n>.`);
  }
  console.log(`Viewer (read-only): ${viewer.url}`);
  if (!opts.has("--no-open")) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
    spawn(opener, [viewer.url], { stdio: "ignore", detached: true, env: cleanEnv() }).on("error", () => {}).unref();
  }
}

// ── Recording (passive: a headless browser on the read-only /watch page) ────
// It starts before the episode; the environment's `ready` hook then waits,
// with game time frozen, until both hero views have drawn the start. A
// recording failure is reported and the evaluation continues without video.
if (viewer && recordOn) {
  mkdirSync(out, { recursive: true });
  recorder = await startRecorder({ url: viewer.url, outDir: out, env: cleanEnv() });
  recordingMeta = (r, note) => {
    writeFileSync(join(out, RECORDING_META), JSON.stringify({
      runId: basename(out), scenario, seed, player,
      model: paid ? get("--model", "claude-haiku-5-5") : null, effort: paid ? get("--effort", "medium") : null,
      gateway: model?.gateway.label ?? paidGateway?.gateway.label ?? null, paid, speed: paced ? speed : null, gitHash: version,
      viewerUrl: viewer!.url, passive: true,
      status: r.status, path: r.path, relativePath: r.path ? relative(repo.root, r.path) : null, bytes: r.bytes,
      resolution: `${r.size.width}x${r.size.height}`, browser: r.browser, readyConfirmed: r.readyConfirmed, finalConfirmed: r.finalConfirmed,
      startedAt: r.startedAt, readyAt: r.readyAt, stoppedAt: r.stoppedAt, wallSeconds: r.wallSeconds,
      completion: completion(), episode: episodeInfo(), error: r.error, warnings: r.warnings, ...(note ? { note } : {}),
    }, null, 2));
  };
  if (recorder.result.status === "failed") console.error(`RECORDING FAILED: ${recorder.result.error} The evaluation continues without a video.`);
  else console.log(`Recording the viewer (${recorder.result.browser ?? "headless Chromium"}, ${recorder.result.size.width}×${recorder.result.size.height}).`);
  recordingMeta(recorder.result, "in progress");
} else if (viewerOn) console.log("Recording off (--no-record).");

// ── Paid ledger: reopened and re-checked just before the run (M3) ──────────
if (paidGateway) {
  ledger = openPaidLedger();
  model = { gateway: paidGateway.gateway, manual, ledger, stage: "pilot", priceSource: paidGateway.source, maxBatch };
}

// ── Terminal status (trusted trace lines; players never see this) ───────────
// Every line may hold model-supplied text (actions, refusals, messages,
// errors); it is printed only through safeText (re-review L1).
const say = (line: string) => console.log(safeText(line));
let startTick = 0;
const hero = (p?: string) => (p === "sieg" ? "Sieg" : p === "coco" ? "Coco" : "");
const short = (v: unknown) => safeText(JSON.stringify(v) ?? String(v)).replace(/"([a-z_]+)":/g, "$1:").slice(0, 90);
function onTrace(l: TraceLine) {
  const t = Math.max(0, (l.tick - startTick) / 60).toFixed(1).padStart(6);
  const s = viewer?.status;
  const d = l.data as Record<string, any>;
  switch (l.type) {
    case "reset":
      startTick = d.tick;
      say(`Start: ${scenario} seed ${seed} at tick ${d.tick}${d.prefix ? ` (after ${d.prefix.name})` : ""}, start hash ${String(d.startHash).slice(0, 16)}`);
      break;
    case "observation":
      if (s && l.player && !d.inBatch) s.heroes[l.player as "sieg" | "coco"].state = "deciding…";
      break;
    case "action":
      if (s && l.player) s.heroes[l.player as "sieg" | "coco"].state = `acting: ${short(d.action)}`;
      break;
    case "step": {
      const r = d.result as { accepted: boolean; error?: string; ticks: number; interrupted?: string };
      const t = Math.max(0, (l.tick + r.ticks - startTick) / 60).toFixed(1).padStart(6);
      const line = `${short(d.action)} → ${r.accepted ? `ok${r.ticks ? ` ${r.ticks}t` : ""}${r.interrupted ? ` (${r.interrupted})` : ""}` : `refused: ${r.error}`}`;
      say(`[${t}s] ${hero(l.player).padEnd(4)} ${line}`);
      if (s && l.player) s.heroes[l.player as "sieg" | "coco"].last = safeText(line);
      break;
    }
    case "model_call":
      if (s) { s.calls++; s.spendUsd += d.chargedUsd ?? 0; }
      say(`[${t}s] ${hero(l.player).padEnd(4)} model call #${d.attempt} ${d.status} ${d.latencyMs} ms${d.tokens ? `, ${d.tokens.input}+${d.tokens.output} tokens` : ", usage unknown"}, $${(d.chargedUsd ?? 0).toFixed(5)}`);
      break;
    case "message":
      say(`[${t}s] ${hero(l.player).padEnd(4)} message to ${hero(d.to)}: ${JSON.stringify(d.text)}`);
      break;
    case "milestone":
      say(`[${t}s] milestone: ${d.milestone}`);
      s?.notes.push(String(d.milestone));
      break;
    case "policy_error":
      say(`[${t}s] ${hero(l.player).padEnd(4)} policy error (${d.kind}): ${String(d.message).slice(0, 120)}`);
      break;
    case "terminal":
      say(`[${t}s] episode ended: ${d.reason}`);
      if (s) s.outcome = d.reason;
      break;
  }
  if (s) s.gameSeconds = Math.max(0, (l.tick - startTick) / 60);
}

// ── Run ──────────────────────────────────────────────────────────────────────
/** How the episode ended, for the recording's metadata. */
function completion(): string {
  if (phase !== "finished") return "running";
  if (error) return "error";
  if (controller.signal.aborted) return "interrupted";
  const s = summaries[0];
  if (!s) return "no_episode";
  if (s.success) return "success";
  return s.reason === "wall_clock_limit" || s.reason === "tick_limit" ? "timeout" : "failure";
}
function episodeInfo() {
  const s = summaries[0];
  return s ? { status: s.status, reason: s.reason, success: s.success, startHash: s.startHash, endHash: s.endHash, trace: s.trace } : null;
}
const situ = situation(scenario);
console.log(`Running ${scenario} (${situ.title}), seed ${seed}, player ${player}${isModel ? `, gateway ${model!.gateway.label}` : ""}${paid ? `, cap $${episodeCapUsd}` : ""}. Output: ${relative(repo.root, out)}`);
phase = "running";
try {
  summaries = await runSuite({
    player,
    situations: [scenario],
    seeds: [seed],
    outDir: out,
    gitHash: version,
    signal: controller.signal,
    onTrace,
    ...(wallSeconds !== undefined ? { wallSeconds } : {}),
    ...(model ? { model } : {}),
    ...(episodeCapUsd !== undefined ? { episodeCapUsd } : {}),
    ...(viewer ? { environment: { ...viewer.hooks, ...(recorder ? { ready: () => recorder!.ready(controller.signal) } : {}) } } : {}),
    // Recorded in run.json and every summary, so watched runs are never pooled blindly.
    launch: { launcher: "scripts/midterm/live.ts", speed: paced ? speed : null, viewer: viewerOn },
  });
} catch (e) {
  error = e as Error;
} finally {
  phase = "finished";
  const remaining = ledger && paid ? { pilot: ledger.remaining("pilot"), total: ledger.remaining() } : null;
  ledger?.close();
  writeFileSync(join(out, "live.json"), JSON.stringify({
    launcher: "scripts/midterm/live.ts", scenario, seed, player, gateway: model?.gateway.label ?? null, paid,
    episodeCapUsd: episodeCapUsd ?? null, speed: paced ? speed : null, viewer: viewerOn, viewsIssued: viewer?.viewsIssued ?? 0,
    gitHash: version, interrupted: controller.signal.aborted, error: error?.message ?? null,
    ledger: paid ? { path: canonicalLedgerPath(repo), remainingAfter: remaining } : model ? { path: join(out, "mock-ledger.json"), scratch: true } : null,
  }, null, 2));
  // The credential must not appear in anything this run wrote.
  if (secret) {
    // Chunked byte search: safe for a large or still-growing video file.
    const leaks = filesContaining(out, secret);
    secret = undefined;
    if (leaks.length) {
      console.error(`CREDENTIAL FOUND IN OUTPUT: ${leaks.join(", ")}. Delete these files and rotate the key.`);
      process.exitCode = 3;
    }
    if (secretSeenInOutput()) {
      console.error("The credential appeared in terminal output (it was replaced with [REDACTED]). Rotate the key.");
      process.exitCode = 3;
    }
  }
  if (paid && remaining) console.log(`Ledger: $${remaining.pilot.toFixed(4)} left in pilot, $${remaining.total.toFixed(4)} left in total.`);
}

// ── Finish the recording before reporting (and before the viewer lingers) ───
// The recorder waits until the viewer itself shows the episode's end, then
// keeps a 3 s tail so the final screen is in the video. After Ctrl-C there
// is no tail, and a Ctrl-C during these waits cuts them short.
if (recorder) {
  const stoppedByUser = controller.signal.aborted;
  // Every wait inside stop() is bounded (recorder.ts); a second Ctrl-C exits at once.
  const r = await recorder.stop({ finalTimeoutMs: stoppedByUser ? 3000 : 15_000, holdMs: stoppedByUser || error ? 0 : 3000, closeTimeoutMs: stoppedByUser ? 60_000 : 120_000, signal: linger.signal });
  recordingMeta!(r);
  recordingFinal = true;
  if (r.status === "saved") console.log(`Video:   ${r.path} (${r.size.width}×${r.size.height}, ${r.wallSeconds} s${r.readyConfirmed ? "" : ", start not confirmed"}${r.finalConfirmed ? "" : ", end not confirmed"})`);
  else console.error(`RECORDING FAILED: ${r.error} No video was saved; the evaluation records are unaffected.`);
  for (const w of r.warnings) console.error(`Recording warning: ${w}`);
  console.log(`Recording metadata: ${join(out, RECORDING_META)}`);
}

if (error) {
  console.error(safeText(`The run failed: ${error.message}`));
  console.error(`Records kept in ${out}`);
  if (viewer) await bounded(viewer.close(), VIEWER_CLOSE_MS, "Closing the viewer");
  process.exit(process.exitCode && process.exitCode !== 0 ? process.exitCode : 1);
}
const s = summaries[0];
if (s) {
  console.log("\nResult");
  console.table(aggregate(summaries).map((r) => ({ scenario: r.situation, success: r.successes === 1, reason: s.reason, gameSeconds: s.gameSeconds, wallSeconds: s.wallSeconds, decisions: r.meanDecisions, invalid: r.invalidActions, messages: r.messages, modelCalls: r.modelCalls, chargedUsd: r.chargedUsd })));
  console.log(`Start hash ${s.startHash.slice(0, 16)}, end hash ${s.endHash.slice(0, 16)}${s.ledgerEntry ? `, ledger entry ${s.ledgerEntry}` : ""}`);
  console.log(`Trace:   ${s.trace}`);
  console.log(`Summary: ${join(out, `${scenario}-seed${seed}${s.attempt > 1 ? `-attempt${s.attempt}` : ""}`, "summary.json")}`);
  console.log(`Results: ${join(out, "results.json")}`);
} else {
  console.log(`No episode completed. Records kept in ${out}`);
}
if (viewer) {
  if (lingerSeconds > 0 && !controller.signal.aborted && !linger.signal.aborted) {
    console.log(`Viewer stays up for ${lingerSeconds} s (Ctrl-C to close now).`);
    await new Promise<void>((r) => {
      const t = setTimeout(r, lingerSeconds * 1000);
      linger.signal.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true });
    });
  }
  await bounded(viewer.close(), VIEWER_CLOSE_MS, "Closing the viewer");
}
process.exit(process.exitCode ?? 0);
