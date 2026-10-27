// Evaluation harness: runs one player on frozen suite scenarios and seeds
// (docs/midterm/EVALUATION_SUITE.md) and records what the suite says to record.
//
// Rules it enforces (owner decisions 2026-10-27):
//   - S4 and F are held out: they run only in a final run, on the final seeds.
//     Tuning runs use S1-S3 and the tuning seeds only.
//   - model-obs-only runs on S1-S3 only.
//   - Every model episode reserves its whole per-episode cap in the persistent
//     spend ledger before it starts, and settles it afterwards with what the
//     budget charged (calls of unknown cost at their reservation). A run that
//     crashes leaves its reservation open, so it still counts.
//   - Model episodes are metered by one ModelBudget whose spend cap equals the
//     reservation.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { environmentFor, SEEDS, situation, type SituationId } from "./suite.js";
import { runEpisode } from "./runner.js";
import { TraceWriter, verifyTrace } from "./trace.js";
import { ModelBudget, MeteredGateway, defaultBudgetLimits, type CallRecord, type Gateway } from "./budget.js";
import { LLMPlayer } from "./policies/llm.js";
import { ExplorationBaseline } from "./policies/baseline.js";
import { QuestBaseline } from "./policies/questBaseline.js";
import type { Policy } from "./policies/policy.js";
import type { SpendLedger } from "./ledger.js";
import type { GameOutcome, PlayerId } from "./types.js";
import { episodes } from "./evaluator.js";

export type PlayerKind = "baseline-quest" | "baseline-explore" | "model-history" | "model-obs-only";
export const PLAYER_KINDS: readonly PlayerKind[] = ["baseline-quest", "baseline-explore", "model-history", "model-obs-only"];
const isModel = (p: PlayerKind) => p === "model-history" || p === "model-obs-only";

/** Per-episode spend caps, both heroes together (MODEL_BUDGET.md). */
export const EPISODE_CAP_USD: Record<SituationId, number> = { S1: 0.2, S2: 1.25, S3: 1.25, S4: 1.0, F: 3.0 };
export const OBS_ONLY_SITUATIONS: readonly SituationId[] = ["S1", "S2", "S3"];

export interface ModelSetup {
  /** The provider adapter (an AnthropicGateway for paid runs; a fake in tests). */
  gateway: Gateway;
  /** The public player manual, the only game text a model is given. */
  manual: string;
  ledger: SpendLedger;
  /** Ledger stage: pilot for tuning runs, final for final runs, contingency for recorded re-runs. */
  stage: string;
  priceSource: string;
  maxBatch?: number;
}

export interface SuiteRunOptions {
  player: PlayerKind;
  situations: SituationId[];
  seeds: number[];
  outDir: string;
  /** A final run: may include S4 and F, uses the final seeds only. */
  final?: boolean;
  gitHash: string;
  wallSeconds?: number;
  /** Resume completed episodes; interrupted episodes restart with new traces and reservations. */
  resume?: boolean;
  signal?: AbortSignal;
  model?: ModelSetup;
  onEpisode?: (s: EpisodeSummary) => void;
}

export interface EpisodeSummary {
  situation: SituationId;
  seed: number;
  player: PlayerKind;
  policies: Record<PlayerId, string>;
  gateway: string | null;
  modelIds: string[];
  gitHash: string;
  startHash: string;
  startTick: number;
  prefix: string | null;
  status: GameOutcome["status"];
  reason: GameOutcome["reason"] | null;
  success: boolean;
  gameTicks: number;
  gameSeconds: number;
  wallSeconds: number;
  decisions: Record<PlayerId, number>;
  actions: Record<PlayerId, Record<string, number>>;
  attempt: number;
  endHash: string;
  limits: GameOutcome["limits"];
  modelLimits: GameOutcome["modelLimits"] | null;
  invalidActions: Record<PlayerId, number>;
  messages: Record<PlayerId, number>;
  batchStops: number;
  modelCalls: { attempted: number; failed: number; timedOut: number; unknownUsage: number };
  latencyMs: { mean: number | null; max: number | null };
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  spendUsd: { known: number; charged: number };
  priceSource: string | null;
  ledgerEntry: string | null;
  /** Stage notes of a scripted baseline (its own log; never shown to the partner). */
  baselineLog?: Record<PlayerId, { tick: number; note: string }[]>;
  trace: string;
}

/** Check a planned run against the suite's rules before anything starts. */
export function validatePlan(o: Pick<SuiteRunOptions, "player" | "situations" | "seeds" | "final" | "model">) {
  if (!PLAYER_KINDS.includes(o.player)) throw Error(`Unknown player ${o.player}.`);
  if (new Set(o.situations).size !== o.situations.length || new Set(o.seeds).size !== o.seeds.length) throw Error("Duplicate scenarios or seeds are not allowed.");
  if (!o.situations.length || !o.seeds.length) throw Error("Name at least one scenario and one seed.");
  for (const id of o.situations) situation(id);
  const heldOut = o.situations.filter((id) => situation(id).heldOut);
  const allowed = o.final ? SEEDS.final : SEEDS.tuning;
  const bad = o.seeds.filter((s) => !allowed.includes(s));
  if (bad.length) throw Error(`${o.final ? "Final" : "Tuning"} runs use seeds ${allowed.join(", ")} only (got ${bad.join(", ")}).`);
  if (heldOut.length && !o.final) throw Error(`${heldOut.join(", ")} ${heldOut.length > 1 ? "are" : "is"} held out: run only in a final run.`);
  if (o.player === "model-obs-only") {
    const outside = o.situations.filter((id) => !OBS_ONLY_SITUATIONS.includes(id));
    if (outside.length) throw Error(`model-obs-only runs on S1-S3 only (got ${outside.join(", ")}).`);
  }
  if (isModel(o.player)) {
    if (!o.model) throw Error(`${o.player} needs a model setup (gateway, manual, ledger, stage).`);
    const stages = o.final ? ["final", "contingency"] : ["pilot", "contingency"];
    if (!stages.includes(o.model.stage)) throw Error(`A ${o.final ? "final" : "tuning"} run spends from ${stages.join(" or ")}, not "${o.model.stage}".`);
  } else if (o.model) throw Error("Scripted baselines take no model setup.");
}

function policiesFor(player: PlayerKind, budget: ModelBudget | undefined, model: ModelSetup | undefined): Record<PlayerId, Policy> {
  switch (player) {
    case "baseline-quest":
      return { sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") };
    case "baseline-explore":
      return { sieg: new ExplorationBaseline(), coco: new ExplorationBaseline() };
    case "model-history":
    case "model-obs-only": {
      const memory = player === "model-history" ? "history" : "none";
      const make = (hero: "Sieg" | "Coco", id: PlayerId) => new LLMPlayer(hero, model!.manual, new MeteredGateway(model!.gateway, budget!, id), model!.maxBatch, memory);
      return { sieg: make("Sieg", "sieg"), coco: make("Coco", "coco") };
    }
  }
}

function atomicJson(path: string, data: unknown) {
  writeFileSync(`${path}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${path}.tmp`, path);
}

/** Prior interrupted attempts remain visible; their spend is never erased. */
interface PreviousAttempt { directory: string; summary?: EpisodeSummary }

export async function runSuite(o: SuiteRunOptions): Promise<EpisodeSummary[]> {
  validatePlan(o);
  if (o.wallSeconds !== undefined && (!Number.isFinite(o.wallSeconds) || o.wallSeconds <= 0)) throw Error("wallSeconds must be finite and positive.");
  mkdirSync(o.outDir, { recursive: true });
  const manifest = {
    player: o.player, situations: o.situations, seeds: o.seeds, final: !!o.final, gitHash: o.gitHash,
    wallSeconds: o.wallSeconds ?? (o.model ? 3600 : 600),
    model: o.model ? { gateway: o.model.gateway.label, stage: o.model.stage, priceSource: o.model.priceSource,
      maxBatch: o.model.maxBatch ?? 4, manualHash: createHash("sha256").update(o.model.manual).digest("hex") } : null,
  };
  const manifestPath = join(o.outDir, "run.json");
  if (existsSync(manifestPath)) {
    if (!o.resume) throw Error("Output already exists; use resume to preserve and continue it.");
    if (JSON.stringify(JSON.parse(readFileSync(manifestPath, "utf8"))) !== JSON.stringify(manifest)) throw Error("Resume configuration does not match the saved run.");
  } else writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { flag: "wx" });
  const summaries: EpisodeSummary[] = [];
  const previous: PreviousAttempt[] = [];
  for (const id of o.situations)
    for (const seed of o.seeds) {
      if (o.signal?.aborted) { writeResults(o.outDir, summaries, previous); return summaries; }
      let attempt = 1;
      let saved: EpisodeSummary | undefined;
      let dir = join(o.outDir, `${id}-seed${seed}`);
      while (existsSync(dir)) {
        if (!o.resume) throw Error(`Episode output already exists: ${dir}`);
        const path = join(dir, "summary.json");
        if (existsSync(path)) {
          saved = JSON.parse(readFileSync(path, "utf8")) as EpisodeSummary;
          const lines = readFileSync(join(dir, "trace.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
          verifyTrace(lines);
          const reset = lines.find((l) => l.type === "reset")?.data;
          const end = lines.at(-1);
          if (saved.situation !== id || saved.seed !== seed || saved.player !== o.player || saved.gitHash !== o.gitHash ||
            saved.attempt !== attempt || saved.startHash !== reset?.startHash || end?.type !== "outcome" ||
            saved.reason !== end.data.outcome.reason || saved.endHash !== end.data.evaluator.stateHash)
            throw Error(`Incomplete or mismatched saved episode: ${dir}`);
          if (saved.reason !== "manual_stop") break;
        }
        previous.push({ directory: dir, ...(saved ? { summary: saved } : {}) });
        saved = undefined;
        dir = join(o.outDir, `${id}-seed${seed}-attempt${++attempt}`);
      }
      const summary = saved ?? await runOne(o, id, seed, dir, attempt);
      summaries.push(summary);
      // Checkpoint before callbacks/next episode, including interrupted runs.
      writeResults(o.outDir, summaries, previous);
      o.onEpisode?.(summary);
    }
  return summaries;
}

async function runOne(o: SuiteRunOptions, id: SituationId, seed: number, dir: string, attempt: number): Promise<EpisodeSummary> {
  mkdirSync(dir, { recursive: true });
  const tracePath = join(dir, "trace.jsonl");
  const trace = new TraceWriter(tracePath);
  const env = environmentFor(id, { trace: (e) => trace.write(e) });
  const limits = episodes[situation(id).preset].limits;
  const model = isModel(o.player) ? o.model! : undefined;
  const budget = model
    ? new ModelBudget({
        maxModelCallsPerPlayer: limits.maxModelCallsPerPlayer,
        maxTokensPerPlayer: limits.maxTokensPerPlayer,
        maxSpendUsd: EPISODE_CAP_USD[id],
        callTimeoutMs: defaultBudgetLimits.callTimeoutMs,
      })
    : undefined;
  const policies = policiesFor(o.player, budget, model);
  // Reserve before anything can spend; the reservation is on disk first.
  const ledgerEntry = model ? model.ledger.reserve(model.stage, `${o.player}/${id}/seed${seed}/${o.gitHash}`, EPISODE_CAP_USD[id]) : null;
  const started = Date.now();
  let outcome: GameOutcome;
  try {
    outcome = await runEpisode(env, policies, trace, {
      seed,
      signal: o.signal,
      wallClockMs: (o.wallSeconds ?? (model ? 3600 : 600)) * 1000,
      ...(budget ? { budget } : {}),
    });
  } catch (e) {
    if (model && ledgerEntry) model.ledger.settle(ledgerEntry, null, `episode failed: ${(e as Error).message.slice(0, 200)}`);
    throw e;
  }
  if (model && ledgerEntry) {
    const unknown = budget!.records.filter((r) => r.costUsd === null).length;
    model.ledger.settle(ledgerEntry, budget!.chargedUsd, unknown ? `${unknown} call(s) of unknown cost charged at their reservation` : undefined);
  }
  verifyTrace(trace.lines);
  const reset = trace.lines.find((l) => l.type === "reset")!.data as { startHash: string; tick: number; prefix?: { name: string } };
  const steps = trace.lines.filter((l) => l.type === "step");
  const records: CallRecord[] = budget?.records ?? [];
  const lat = records.map((r) => r.latencyMs);
  const sum = (f: (r: CallRecord) => number) => records.reduce((a, r) => a + f(r), 0);
  const per = <T>(f: (id: PlayerId) => T) => ({ sieg: f("sieg"), coco: f("coco") });
  const summary: EpisodeSummary = {
    situation: id,
    seed,
    player: o.player,
    policies: per((p) => policies[p].name),
    gateway: model ? model.gateway.label : null,
    modelIds: [...new Set(records.map((r) => r.model).filter((m): m is string => !!m))],
    gitHash: o.gitHash,
    startHash: reset.startHash,
    startTick: reset.tick,
    prefix: reset.prefix?.name ?? null,
    status: outcome.status,
    reason: outcome.reason ?? null,
    success: outcome.status === "success",
    gameTicks: outcome.ticks,
    gameSeconds: outcome.seconds,
    wallSeconds: Math.round((Date.now() - started) / 100) / 10,
    decisions: outcome.decisions,
    actions: per((p) => {
      const counts: Record<string, number> = {};
      for (const line of steps.filter((l) => l.player === p)) {
        const type = (line.data as { action: { type: string } }).action.type;
        counts[type] = (counts[type] ?? 0) + 1;
      }
      return counts;
    }),
    attempt,
    endHash: env.evaluatorReport().stateHash,
    limits: outcome.limits,
    modelLimits: outcome.modelLimits ?? null,
    invalidActions: outcome.invalidActions,
    messages: per((p) => trace.lines.filter((l) => l.player === p && l.type === "message").length),
    batchStops: trace.lines.filter((l) => l.type === "batch_stop").length,
    modelCalls: {
      attempted: records.length,
      failed: records.filter((r) => r.status !== "ok").length,
      timedOut: records.filter((r) => r.status === "timeout").length,
      unknownUsage: records.filter((r) => r.tokens === null).length,
    },
    latencyMs: { mean: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null, max: lat.length ? Math.max(...lat) : null },
    tokens: {
      input: sum((r) => r.tokens?.input ?? 0),
      output: sum((r) => r.tokens?.output ?? 0),
      cacheRead: sum((r) => r.cache?.read ?? 0),
      cacheWrite: sum((r) => r.cache?.write ?? 0),
    },
    spendUsd: outcome.spendUsd,
    priceSource: model?.priceSource ?? null,
    ledgerEntry,
    ...(o.player === "baseline-quest" ? { baselineLog: per((p) => (policies[p] as QuestBaseline).log) } : {}),
    trace: tracePath,
  };
  atomicJson(join(dir, "summary.json"), summary);
  return summary;
}

/** Aggregate per scenario: successes, mean game time, decisions, invalid actions. */
export function aggregate(summaries: EpisodeSummary[]) {
  const by = new Map<SituationId, EpisodeSummary[]>();
  for (const s of summaries) by.set(s.situation, [...(by.get(s.situation) ?? []), s]);
  const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return [...by].map(([id, xs]) => ({
    situation: id,
    trials: xs.length,
    successes: xs.filter((x) => x.success).length,
    reasons: xs.map((x) => x.reason),
    meanGameSeconds: mean(xs.map((x) => x.gameSeconds)),
    meanWallSeconds: mean(xs.map((x) => x.wallSeconds)),
    gameTicks: xs.reduce((a, x) => a + x.gameTicks, 0),
    actions: xs.reduce((a, x) => a + Object.values(x.actions.sieg).reduce((u, v) => u + v, 0) + Object.values(x.actions.coco).reduce((u, v) => u + v, 0), 0),
    failedModelCalls: xs.reduce((a, x) => a + x.modelCalls.failed, 0),
    unknownUsageCalls: xs.reduce((a, x) => a + x.modelCalls.unknownUsage, 0),
    tokens: { input: xs.reduce((a, x) => a + x.tokens.input, 0), output: xs.reduce((a, x) => a + x.tokens.output, 0),
      cacheRead: xs.reduce((a, x) => a + x.tokens.cacheRead, 0), cacheWrite: xs.reduce((a, x) => a + x.tokens.cacheWrite, 0) },
    knownUsd: xs.reduce((a, x) => a + x.spendUsd.known, 0),
    meanDecisions: mean(xs.map((x) => x.decisions.sieg + x.decisions.coco)),
    invalidActions: xs.reduce((a, x) => a + x.invalidActions.sieg + x.invalidActions.coco, 0),
    messages: xs.reduce((a, x) => a + x.messages.sieg + x.messages.coco, 0),
    modelCalls: xs.reduce((a, x) => a + x.modelCalls.attempted, 0),
    chargedUsd: Math.round(xs.reduce((a, x) => a + x.spendUsd.charged, 0) * 1e6) / 1e6,
    startHashes: [...new Set(xs.map((x) => x.startHash.slice(0, 16)))],
  }));
}

function writeResults(dir: string, summaries: EpisodeSummary[], previous: PreviousAttempt[] = []) {
  mkdirSync(dir, { recursive: true });
  const rows = aggregate(summaries);
  atomicJson(join(dir, "results.json"), { episodes: summaries.map(({ trace: _t, ...s }) => s), aggregate: rows, previousAttempts: previous });
  const md = [
    "| Scenario | Successes | Mean game time (s) | Mean decisions (both heroes) | Invalid actions | Messages | Model calls | Charged (USD) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.situation} | ${r.successes}/${r.trials} | ${r.meanGameSeconds} | ${r.meanDecisions} | ${r.invalidActions} | ${r.messages} | ${r.modelCalls} | ${r.chargedUsd} |`),
  ].join("\n");
  writeFileSync(join(dir, "results.md"), md + "\n");
}

/**
 * Smoke stage: exactly one model call through the metered gateway, from the
 * S1 start, reserved in the ledger's smoke stage. Returns the call record and
 * the reply so tokens, cost, the reported model id and the cache fields can
 * be checked.
 */
export async function smokeCall(gateway: Gateway, manual: string, ledger: SpendLedger, gitHash: string, reserveUsd = 0.01, trace?: TraceWriter, signal?: AbortSignal) {
  const entry = ledger.reserve("smoke", `smoke/S1/${gitHash}`, reserveUsd);
  const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 100_000, maxSpendUsd: reserveUsd, callTimeoutMs: defaultBudgetLimits.callTimeoutMs });
  let settled = false;
  const abort = () => budget.abortAll();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const env = environmentFor("S1", { trace: (event) => trace?.write(event) });
    await env.reset(SEEDS.tuning[0]);
    budget.onRecord = (record) => trace?.write({ type: "model_call", tick: env.currentTick(), player: "sieg", data: record });
    const player = new LLMPlayer("Sieg", manual, new MeteredGateway(gateway, budget, "sieg"));
    let decision;
    try {
      const observation = await env.observe("sieg"), legal = await env.legal_actions("sieg");
      trace?.write({ type: "observation", tick: observation.tick, player: "sieg", data: { observation, legal } });
      decision = await player.decide({ observation, legal });
      trace?.write({ type: "model_reply", tick: observation.tick, player: "sieg", data: { raw: decision.raw, action: decision.action } });
    } catch (e) {
      decision = { error: (e as Error).message };
    }
    const record = budget.records[0] ?? null;
    ledger.settle(entry, budget.chargedUsd, record?.costUsd === null ? "smoke call of unknown cost" : undefined);
    settled = true;
    const result = { record, decision, chargedUsd: budget.chargedUsd, ledgerEntry: entry };
    trace?.write({ type: "smoke_outcome", tick: env.currentTick(), data: result });
    if (trace) verifyTrace(trace.lines);
    return result;
  } catch (e) {
    // Anything unexpected: the reservation is charged in full.
    if (!settled) ledger.settle(entry, null, `smoke failed: ${(e as Error).message.slice(0, 200)}`);
    throw e;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
