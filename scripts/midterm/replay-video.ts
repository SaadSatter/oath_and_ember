// Replay a recorded episode from its trace and record it to video
// (docs/midterm/LIVE_RUN.md, "Replaying a trace").
//
//   node --import tsx scripts/midterm/replay-video.ts <trace.jsonl> [--out <dir>] [--speed 1] [--port 3031]
//   node --import tsx scripts/midterm/replay-video.ts <trace.jsonl> --check-only   # no viewer, no video
//
// How it works: the environment is lockstep (environment.ts "Scheduling"):
// game time runs only while both heroes have an action running, and
// simultaneous submissions are applied Sieg first, then Coco. So the game is
// fully determined by the seed, the scenario and each hero's ordered list of
// submitted actions, never by model latency. This script resets the same
// scenario and seed, and submits each hero's recorded actions, in order,
// through the same five-operation interface (step), on the real GameRoom.
// It makes no model calls and spends nothing.
//
// Proof that the replay is the same game: the start hash, every timed
// action's result hash, and the terminal hash and reason must equal the
// trace's. Any mismatch stops the replay and fails it (exit 1). The video
// (a passive recording of the read-only /watch page, recorder.ts) is
// reported as matching only when every check passed.
//
// The video bytes are not identical between runs (browser frame timing),
// but the game content shown is the trace's episode, tick for tick.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { environmentFor, HISTORICAL_SITUATIONS, SITUATIONS, type SituationId } from "../../packages/agent/src/suite.js";
import { verifyTrace, type TraceLine } from "../../packages/agent/src/trace.js";
import { startViewer, type Viewer } from "../../packages/agent/src/liveViewer.js";
import { RECORDING_META, startRecorder, type Recorder } from "../../packages/agent/src/recorder.js";
import { repoInfo } from "../../packages/agent/src/repo.js";
import type { TraceEvent } from "../../packages/agent/src/environment.js";
import type { GameAction, PlayerId } from "../../packages/agent/src/types.js";

const argv = process.argv.slice(2);
function fail(message: string): never {
  console.error(`replay-video: ${message}`);
  process.exit(2);
}
const tracePath = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && ["--out", "--speed", "--port"].includes(argv[i - 1])));
if (!tracePath || argv.includes("--help")) fail("usage: replay-video.ts <trace.jsonl> [--out <dir>] [--speed 1] [--port 3031] [--check-only]");
const opt = (k: string) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : undefined;
};
const checkOnly = argv.includes("--check-only");
const speed = Number(opt("--speed") ?? 1);
if (!(speed > 0)) fail("--speed must be positive.");

// ── Read and verify the trace ────────────────────────────────────────────────
const raw = readFileSync(resolve(tracePath), "utf8");
const lines = raw.trim().split("\n").map((l) => JSON.parse(l) as TraceLine);
verifyTrace(lines); // hash chain: no edits or gaps
const resetLine = lines.find((l) => l.type === "reset");
if (!resetLine) fail("the trace has no reset line.");
const reset = resetLine.data as { episode: string; seed: number; startHash: string; tick: number };
const terminal = lines.find((l) => l.type === "terminal")?.data as { reason: string; hash: string } | undefined;
const outcome = lines.find((l) => l.type === "outcome")?.data as { outcome: { ticks: number; status: string } } | undefined;
const ledgerEntry = (lines.find((l) => l.type === "ledger_reservation")?.data as { entry?: string } | undefined)?.entry ?? null;
const summaryPath = join(dirname(resolve(tracePath)), "summary.json");
const summary = existsSync(summaryPath) ? (JSON.parse(readFileSync(summaryPath, "utf8")) as { situation?: string; player?: string; gitHash?: string }) : {};
// Episode ids are `<preset>-<seed>-<hash8>`; the scenario comes from the summary.
const scenario = summary.situation as SituationId | undefined;
const known = [...SITUATIONS, ...HISTORICAL_SITUATIONS];
if (!scenario || !known.some((s) => s.id === scenario)) fail(`cannot tell the scenario (summary.json situation: ${String(scenario)}).`);
// Held-out scenarios and final seeds are never replayed here.
if (scenario === "S4" || scenario === "F") fail(`${scenario} is held out; not replayed.`);
const seed = reset.seed;

const heroes: PlayerId[] = ["sieg", "coco"];
const actions: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
// Expected result hashes per hero, in order (timed actions carry a hash; instant ones do not).
const expected: Record<PlayerId, (string | null)[]> = { sieg: [], coco: [] };
for (const l of lines) {
  const p = l.player as PlayerId | undefined;
  if (l.type === "action" && p) actions[p].push((l.data as { action: GameAction }).action);
  if (l.type === "result" && p) expected[p].push((l.data as { hash?: string }).hash ?? null);
}
const traceSha = createHash("sha256").update(raw).digest("hex");
console.log(`Trace ${relative(process.cwd(), resolve(tracePath))} (sha256 ${traceSha.slice(0, 16)}, chain verified${ledgerEntry ? `, ${ledgerEntry}` : ""})`);
console.log(`Scenario ${scenario}, seed ${seed}; Sieg ${actions.sieg.length} actions, Coco ${actions.coco.length} actions; recorded end: ${terminal?.reason ?? "none"}`);

// ── Viewer and recorder (skipped with --check-only) ──────────────────────────
const repo = repoInfo();
const version = repo.dirty ? `${repo.head.slice(0, 7)}+dirty` : repo.head.slice(0, 7);
const out = resolve(opt("--out") ?? join(dirname(dirname(resolve(tracePath))), "replay"));
let viewer: Viewer | undefined;
let recorder: Recorder | undefined;
if (!checkOnly) {
  if (existsSync(join(out, "recording.webm"))) fail(`${out} already has a recording.webm.`);
  if (!existsSync(join(repo.root, "dist/client/index.html"))) fail("dist/client is missing; run `npm run build` first.");
  mkdirSync(out, { recursive: true });
  viewer = await startViewer({
    root: repo.root,
    port: Number(opt("--port") ?? 3031),
    speed,
    title: `Oath and Ember · REPLAY of ${ledgerEntry ?? basename(dirname(dirname(resolve(tracePath))))} · ${scenario} seed ${seed} · ${summary.player ?? ""} (recorded actions, no model calls)`,
  });
  console.log(`Viewer (read-only): ${viewer.url}`);
  recorder = await startRecorder({ url: viewer.url, outDir: out });
  if (recorder.result.status === "failed") fail(`recording failed to start: ${recorder.result.error}`);
}

// ── Replay ───────────────────────────────────────────────────────────────────
const mismatches: string[] = [];
const got: Record<PlayerId, (string | null)[]> = { sieg: [], coco: [] };
let gotTerminal: { reason: string; hash: string } | undefined;
let startTick = 0;
const env = environmentFor(scenario, {
  trace: (e: TraceEvent) => {
    const d = e.data as Record<string, any>;
    if (e.type === "result" && e.player) {
      const p = e.player;
      const i = got[p].push(d.hash ?? null) - 1;
      if (expected[p][i] !== (d.hash ?? null)) {
        mismatches.push(`${p} result #${i + 1} at tick ${e.tick}: hash ${String(d.hash).slice(0, 16)} ≠ trace ${String(expected[p][i]).slice(0, 16)}`);
        env.stop("error");
      }
    }
    if (e.type === "terminal") gotTerminal = d as { reason: string; hash: string };
    if (e.type === "invalid_action") mismatches.push(`${e.player} action refused at tick ${e.tick}: ${d.error}`);
    if (viewer && e.player && (e.type === "action" || e.type === "result")) {
      const h = viewer.status.heroes[e.player as "sieg" | "coco"];
      if (e.type === "action") h.state = `acting: ${JSON.stringify(d.action).slice(0, 80)}`;
    }
    if (viewer) {
      if (e.type === "milestone") viewer.status.notes.push(String(d.milestone));
      if (e.type === "terminal") viewer.status.outcome = d.reason;
      viewer.status.gameSeconds = Math.max(0, (e.tick - startTick) / 60);
    }
  },
  ...(viewer ? { ...viewer.hooks, ...(recorder ? { ready: () => recorder!.ready() } : {}) } : {}),
});

const state = await env.reset(seed);
startTick = state.tick;
if (state.startHash !== reset.startHash) mismatches.push(`start hash ${state.startHash.slice(0, 16)} ≠ trace ${reset.startHash.slice(0, 16)}`);
if (state.tick !== reset.tick) mismatches.push(`start tick ${state.tick} ≠ trace ${reset.tick}`);

async function play(p: PlayerId) {
  for (const action of actions[p]) {
    if (mismatches.length) return;
    const r = await env.step(p, action);
    if (r.done) return;
  }
}
if (!mismatches.length) await Promise.all(heroes.map(play));
const end = await env.outcome();
if (!mismatches.length) {
  if (terminal && (!gotTerminal || gotTerminal.reason !== terminal.reason || gotTerminal.hash !== terminal.hash))
    mismatches.push(`terminal ${gotTerminal?.reason ?? "none"} ${gotTerminal?.hash.slice(0, 16) ?? ""} ≠ trace ${terminal.reason} ${terminal.hash.slice(0, 16)}`);
  if (outcome && end.ticks !== outcome.outcome.ticks) mismatches.push(`episode ticks ${end.ticks} ≠ trace ${outcome.outcome.ticks}`);
  for (const p of heroes) if (got[p].length !== expected[p].length) mismatches.push(`${p}: ${got[p].length} results ≠ trace ${expected[p].length}`);
}
const matched = mismatches.length === 0;
console.log(matched
  ? `REPLAY MATCHES THE TRACE: start hash, ${got.sieg.length + got.coco.length} step results, end (${gotTerminal?.reason}, ${gotTerminal?.hash.slice(0, 16)}) and ${end.ticks} ticks.`
  : `REPLAY DIFFERS FROM THE TRACE:\n  ${mismatches.join("\n  ")}`);

// ── Finish the recording ─────────────────────────────────────────────────────
if (recorder && viewer) {
  const r = await recorder.stop({ finalTimeoutMs: 15_000, holdMs: 3000, closeTimeoutMs: 120_000 });
  writeFileSync(join(out, RECORDING_META), JSON.stringify({
    kind: "replay", source: { trace: relative(repo.root, resolve(tracePath)), sha256: traceSha, ledgerEntry, gitHash: summary.gitHash ?? null },
    scenario, seed, player: summary.player ?? null, speed, gitHash: version, passive: true, modelCalls: 0,
    matchesTrace: matched, mismatches, endHash: gotTerminal?.hash ?? null, endReason: gotTerminal?.reason ?? null, episodeTicks: end.ticks,
    status: r.status, path: r.path, relativePath: r.path ? relative(repo.root, r.path) : null, bytes: r.bytes,
    resolution: `${r.size.width}x${r.size.height}`, browser: r.browser, readyConfirmed: r.readyConfirmed, finalConfirmed: r.finalConfirmed,
    startedAt: r.startedAt, stoppedAt: r.stoppedAt, wallSeconds: r.wallSeconds, error: r.error, warnings: r.warnings,
  }, null, 2));
  if (r.status === "saved") console.log(`Video: ${r.path} (${r.size.width}×${r.size.height}, ${r.wallSeconds} s${r.readyConfirmed ? "" : ", start not confirmed"}${r.finalConfirmed ? "" : ", end not confirmed"})`);
  else console.error(`RECORDING FAILED: ${r.error}`);
  for (const w of r.warnings) console.error(`Recording warning: ${w}`);
  await viewer.close();
}
process.exit(matched ? 0 : 1);
