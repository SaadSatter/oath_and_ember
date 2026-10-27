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
// a local read-only browser viewer and game time paced to real time.
//
// What it never does: run S4 or F, run final seeds, take a credential on the
// command line, write a credential anywhere, or use any ledger other than the
// canonical one for paid runs. Mock runs never touch the canonical ledger and
// make no network request.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { aggregate, EPISODE_CAP_USD, episodeCap, PLAYER_KINDS, runSuite, validatePlan, type EpisodeSummary, type ModelSetup, type PlayerKind } from "../../packages/agent/src/harness.js";
import { APPROVED_LEDGER, SpendLedger } from "../../packages/agent/src/ledger.js";
import { startViewer, type Viewer } from "../../packages/agent/src/liveViewer.js";
import { AnthropicGateway, anthropicPrices, EFFORTS, type Effort } from "../../packages/agent/src/policies/llm.js";
import { MockGateway } from "../../packages/agent/src/policies/mockGateway.js";
import { canonicalLedgerPath, repoInfo } from "../../packages/agent/src/repo.js";
import { SEEDS, situation, type SituationId } from "../../packages/agent/src/suite.js";
import type { TraceLine } from "../../packages/agent/src/trace.js";
import { ask, credentialArgs } from "./tty.js";

const argv = process.argv.slice(2);
const KNOWN = new Map<string, "value" | "flag">([
  ["--scenario", "value"], ["--seed", "value"], ["--player", "value"], ["--gateway", "value"], ["--model", "value"],
  ["--effort", "value"], ["--max-spend-usd", "value"], ["--paid", "flag"], ["--speed", "value"], ["--port", "value"],
  ["--out", "value"], ["--wall-seconds", "value"], ["--max-batch", "value"], ["--mock-delay-ms", "value"],
  ["--linger-seconds", "value"], ["--no-viewer", "flag"], ["--no-open", "flag"], ["--help", "flag"],
]);

function fail(message: string): never {
  console.error(`eval:live: ${message}`);
  process.exit(2);
}

// The credential is taken out of this process's environment immediately, for
// every kind of run, so no child process (client build, browser) inherits it.
const envKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
delete process.env.ANTHROPIC_API_KEY;

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

const scenario = (get("--scenario") ?? fail("--scenario S1|S2|S3 is required.")).toUpperCase() as SituationId;
// Held-out scenarios are refused unconditionally here, whatever else is set (review H2).
if (scenario === "S4" || scenario === "F") fail(`${scenario} is held out. The live launcher never runs S4 or F; the final evaluation needs separate owner approval through evaluate.ts.`);
if (!["S1", "S2", "S3"].includes(scenario)) fail(`unknown scenario ${scenario} (S1, S2 or S3).`);
const seed = Number(get("--seed", "0"));
if (!SEEDS.tuning.includes(seed)) fail(`the live launcher uses the tuning seeds ${SEEDS.tuning.join(", ")} only.`);
const player = get("--player", "model-history") as PlayerKind;
if (!PLAYER_KINDS.includes(player)) fail(`--player must be one of ${PLAYER_KINDS.join(", ")}.`);
const isModel = player === "model-history" || player === "model-obs-only";
const gatewayKind = get("--gateway", isModel ? "anthropic" : "none")!;
if (!isModel && opts.has("--gateway")) fail("scripted baselines use no gateway.");
if (isModel && !["anthropic", "mock"].includes(gatewayKind)) fail("--gateway must be anthropic or mock.");
const paid = isModel && gatewayKind === "anthropic";
if (paid && !opts.has("--paid")) fail("this is a paid run. Pass --paid only after the owner has authorized it, or use --gateway mock.");
if (!paid && opts.has("--paid")) fail("--paid is only for --gateway anthropic.");
if (!paid && (opts.has("--model") || opts.has("--effort") || opts.has("--max-spend-usd"))) fail("--model, --effort and --max-spend-usd apply to paid runs only.");
const viewerOn = !opts.has("--no-viewer");
const speed = num("--speed", 1);
const lingerSeconds = num("--linger-seconds", viewerOn ? 15 : 0);
const maxBatch = num("--max-batch", 4);
const wallSeconds = opts.has("--wall-seconds") ? num("--wall-seconds", 0) : undefined;
if (wallSeconds === 0) fail("--wall-seconds must be positive.");

const repo = repoInfo();
const version = repo.dirty ? `${repo.head.slice(0, 7)}+dirty` : repo.head.slice(0, 7);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = resolve(repo.root, get("--out", `evaluation-runs/live/${scenario}-seed${seed}-${player}${isModel ? `-${gatewayKind}` : ""}-${stamp}`)!);
if (existsSync(out)) fail(`output ${out} already exists.`);

// ── Model setup (checks first, credential last) ──────────────────────────────
let model: ModelSetup | undefined;
let ledger: SpendLedger | undefined;
let episodeCapUsd: number | undefined;
let secret: string | undefined;
const manual = readFileSync(join(repo.root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
if (isModel) {
  validatePlan({ player, situations: [scenario], seeds: [seed], model: { stage: "pilot" } as ModelSetup });
  if (paid) {
    if (repo.dirty) fail("paid runs need a clean, committed tree so the game version is exact.");
    const id = get("--model", "claude-haiku-5-5")!;
    const prices = anthropicPrices[id];
    if (!prices) fail(`no verified price on record for ${id}.`);
    const effort = get("--effort", "medium") as Effort;
    if (!EFFORTS.includes(effort)) fail(`--effort must be one of ${EFFORTS.join(", ")}.`);
    const raw = get("--max-spend-usd") ?? fail(`--max-spend-usd is required for paid runs (at most $${EPISODE_CAP_USD[scenario]} for ${scenario}).`);
    episodeCapUsd = Number(raw);
    try {
      episodeCap({ episodeCapUsd }, scenario);
    } catch (e) {
      fail((e as Error).message);
    }
    // The one shared ledger (review H1). Refuses if missing, locked, or if
    // a legacy ledger exists. Opened before asking for the credential.
    try {
      ledger = SpendLedger.openCanonical(repo);
    } catch (e) {
      fail((e as Error).message);
    }
    const left = Math.min(ledger.remaining("pilot"), ledger.remaining());
    if (episodeCapUsd > left + 1e-9) {
      ledger.close();
      fail(`the pilot stage has $${left.toFixed(4)} left; this run would reserve $${episodeCapUsd}.`);
    }
    // Credential: the environment variable, else a hidden prompt. It stays
    // in memory, is removed from this process's environment so no child
    // process inherits it, and is never written or printed.
    secret = envKey;
    if (!secret) {
      try {
        secret = (await ask("Anthropic API key (hidden, not stored): ", true)).trim() || undefined;
      } catch (e) {
        ledger.close();
        fail((e as Error).message === "Cancelled." ? "cancelled." : "no ANTHROPIC_API_KEY and no interactive terminal for the hidden prompt.");
      }
    }
    if (!secret) {
      ledger.close();
      fail("no credential given.");
    }
    model = { gateway: new AnthropicGateway(id, prices, effort, secret), manual, ledger, stage: "pilot", priceSource: prices.source, maxBatch };
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
  return env;
}
if (viewerOn) {
  const index = join(repo.root, "dist/client/index.html");
  const stale = !existsSync(index) || statSync(index).mtimeMs < Math.max(newest(join(repo.root, "apps/client/src")), newest(join(repo.root, "packages/shared/src")));
  if (stale) {
    console.log("Building the game client for the viewer…");
    const r = spawnSync("npx", ["vite", "build", "--config", "apps/client/vite.config.ts", "--logLevel", "warn"], { cwd: repo.root, stdio: "inherit", env: cleanEnv() });
    if (r.status !== 0) {
      ledger?.close();
      fail("client build failed; the run did not start.");
    }
  }
}

// ── Interruption ─────────────────────────────────────────────────────────────
const controller = new AbortController();
const linger = new AbortController();
let runFinished = false;
let interrupts = 0;
const onSignal = (code: number) => () => {
  if (runFinished) {
    linger.abort();
    return;
  }
  if (++interrupts > 1) {
    // Records already on disk are kept; an open reservation stays held (fails closed).
    console.error("\nForced exit. Traces written so far are kept; any open ledger reservation stays held until reviewed.");
    process.exit(code);
  }
  console.error("\nStopping: the episode ends now and its records are being saved. Press Ctrl-C again to force exit.");
  process.exitCode = code;
  controller.abort();
};
process.on("SIGINT", onSignal(130));
process.on("SIGTERM", onSignal(143));

// ── Viewer ───────────────────────────────────────────────────────────────────
let viewer: Viewer | undefined;
if (viewerOn) {
  try {
    viewer = await startViewer({ root: repo.root, port: num("--port", 3030), speed, title: `Oath and Ember · ${scenario} seed ${seed} · ${player}${isModel ? ` (${model!.gateway.label})` : ""}` });
  } catch (e) {
    ledger?.close();
    fail(`could not start the viewer: ${(e as Error).message}. Try --port <n>.`);
  }
  console.log(`Viewer (read-only): ${viewer.url}`);
  if (!opts.has("--no-open")) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
    spawn(opener, [viewer.url], { stdio: "ignore", detached: true, env: cleanEnv() }).on("error", () => {}).unref();
  }
}

// ── Terminal status (trusted trace lines; players never see this) ───────────
let startTick = 0;
const hero = (p?: string) => (p === "sieg" ? "Sieg" : p === "coco" ? "Coco" : "");
const short = (v: unknown) => JSON.stringify(v).replace(/"([a-z_]+)":/g, "$1:").slice(0, 90);
function onTrace(l: TraceLine) {
  const t = Math.max(0, (l.tick - startTick) / 60).toFixed(1).padStart(6);
  const s = viewer?.status;
  const d = l.data as Record<string, any>;
  switch (l.type) {
    case "reset":
      startTick = d.tick;
      console.log(`Start: ${scenario} seed ${seed} at tick ${d.tick}${d.prefix ? ` (after ${d.prefix.name})` : ""}, start hash ${String(d.startHash).slice(0, 16)}`);
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
      console.log(`[${t}s] ${hero(l.player).padEnd(4)} ${line}`);
      if (s && l.player) s.heroes[l.player as "sieg" | "coco"].last = line;
      break;
    }
    case "model_call":
      if (s) { s.calls++; s.spendUsd += d.chargedUsd ?? 0; }
      console.log(`[${t}s] ${hero(l.player).padEnd(4)} model call #${d.attempt} ${d.status} ${d.latencyMs} ms${d.tokens ? `, ${d.tokens.input}+${d.tokens.output} tokens` : ", usage unknown"}, $${(d.chargedUsd ?? 0).toFixed(5)}`);
      break;
    case "message":
      console.log(`[${t}s] ${hero(l.player).padEnd(4)} message to ${hero(d.to)}: ${JSON.stringify(d.text)}`);
      break;
    case "milestone":
      console.log(`[${t}s] milestone: ${d.milestone}`);
      s?.notes.push(String(d.milestone));
      break;
    case "policy_error":
      console.log(`[${t}s] ${hero(l.player).padEnd(4)} policy error (${d.kind}): ${String(d.message).slice(0, 120)}`);
      break;
    case "terminal":
      console.log(`[${t}s] episode ended: ${d.reason}`);
      if (s) s.outcome = d.reason;
      break;
  }
  if (s) s.gameSeconds = Math.max(0, (l.tick - startTick) / 60);
}

// ── Run ──────────────────────────────────────────────────────────────────────
const situ = situation(scenario);
console.log(`Running ${scenario} (${situ.title}), seed ${seed}, player ${player}${isModel ? `, gateway ${model!.gateway.label}` : ""}${paid ? `, cap $${episodeCapUsd}` : ""}. Output: ${relative(repo.root, out)}`);
let summaries: EpisodeSummary[] = [];
let error: Error | undefined;
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
    ...(viewer ? { environment: viewer.hooks } : {}),
  });
} catch (e) {
  error = e as Error;
} finally {
  runFinished = true;
  const remaining = ledger && paid ? { pilot: ledger.remaining("pilot"), total: ledger.remaining() } : null;
  ledger?.close();
  writeFileSync(join(out, "live.json"), JSON.stringify({
    launcher: "scripts/midterm/live.ts", scenario, seed, player, gateway: model?.gateway.label ?? null, paid,
    episodeCapUsd: episodeCapUsd ?? null, speed: viewerOn ? speed : null, viewer: viewerOn, viewsIssued: viewer?.viewsIssued ?? 0,
    gitHash: version, interrupted: controller.signal.aborted, error: error?.message ?? null,
    ledger: paid ? { path: canonicalLedgerPath(repo), remainingAfter: remaining } : model ? { path: join(out, "mock-ledger.json"), scratch: true } : null,
  }, null, 2));
  // The credential must not appear in anything this run wrote.
  if (secret) {
    const leaks: string[] = [];
    const scan = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) scan(p);
        else if (readFileSync(p, "utf8").includes(secret!)) leaks.push(p);
      }
    };
    scan(out);
    secret = undefined;
    if (leaks.length) {
      console.error(`CREDENTIAL FOUND IN OUTPUT: ${leaks.join(", ")}. Delete these files and rotate the key.`);
      process.exitCode = 3;
    }
  }
  if (paid && remaining) console.log(`Ledger: $${remaining.pilot.toFixed(4)} left in pilot, $${remaining.total.toFixed(4)} left in total.`);
}

if (error) {
  console.error(`The run failed: ${error.message}`);
  console.error(`Records kept in ${out}`);
  await viewer?.close();
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
  if (lingerSeconds > 0 && !controller.signal.aborted) {
    console.log(`Viewer stays up for ${lingerSeconds} s (Ctrl-C to close now).`);
    await new Promise<void>((r) => {
      const t = setTimeout(r, lingerSeconds * 1000);
      linger.signal.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true });
    });
  }
  await viewer.close();
}
process.exit(process.exitCode ?? 0);
