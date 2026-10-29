// Runs one two-player episode through the five-operation interface.
//
//   Baseline:  node --import tsx scripts/midterm/run-episode.ts --policy baseline --seed 1
//   Claude:    node --import tsx scripts/midterm/run-episode.ts --policy anthropic \
//                --model claude-haiku-5-5 --max-spend-usd 1 --seed 1   (no paid run without owner approval)
//   OpenAI:    node --import tsx scripts/midterm/run-episode.ts --policy openai --model <id> \
//                --input-usd-per-million <n> --output-usd-per-million <n> --pricing-source <url> --max-spend-usd 1
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AgentEnvironment } from "../../packages/agent/src/environment.js";
import { runEpisode } from "../../packages/agent/src/runner.js";
import { TraceWriter, verifyTrace } from "../../packages/agent/src/trace.js";
import { ExplorationBaseline } from "../../packages/agent/src/policies/baseline.js";
import { AnthropicGateway, anthropicPrices, LLMPlayer, OpenAIGateway } from "../../packages/agent/src/policies/llm.js";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Gateway } from "../../packages/agent/src/budget.js";
import type { Policy } from "../../packages/agent/src/policies/policy.js";
import { episodes, type EpisodePreset } from "../../packages/agent/src/evaluator.js";
import type { LabelMode } from "../../packages/agent/src/perception.js";
import type { PlayerId } from "../../packages/agent/src/types.js";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1];
};
/** A numeric flag that must be a positive number; a typo stops the run before it starts. */
const positive = (name: string, fallback?: number) => {
  const raw = arg(name);
  if (raw === undefined) {
    if (fallback === undefined) throw Error(`${name} is required.`);
    return fallback;
  }
  const n = Number(raw);
  if (!(Number.isFinite(n) && n > 0)) throw Error(`${name} must be a positive number, got "${raw}".`);
  return n;
};
const policy = arg("--policy", "baseline")!;
if (!["baseline", "anthropic", "openai"].includes(policy)) throw Error(`Unknown --policy ${policy}.`);
// Legacy helper remains available for free exploration runs. Paid runs must
// use the one stage-aware entrypoint so they cannot bypass the shared ledger.
function requireLedgerEntrypoint(kind: string) {
  if (kind !== "baseline") throw Error("Paid model runs must use scripts/midterm/evaluate.ts with the persistent spend ledger and owner approval.");
}
requireLedgerEntrypoint(policy);
const seed = Number(arg("--seed", "1"));
if (!Number.isSafeInteger(seed)) throw Error("--seed must be an integer.");
const preset = arg("--preset", "milestone") as EpisodePreset;
if (!(preset in episodes)) throw Error(`Unknown --preset ${preset}.`);
const labels = arg("--labels", "as-drawn") as LabelMode;
if (!["as-drawn", "names-only"].includes(labels)) throw Error(`Unknown --labels ${labels}.`);
/** Real-world limit, separate from the preset's game-time tick limit. */
// Real-world ceiling, separate from the preset's game-time limit (480 s of game
// time for the full episode). Model runs: 3,600 s, owner-approved 2026-10-27.
const wallSeconds = positive("--wall-seconds", policy === "baseline" ? 60 : 3600);
const out = resolve(arg("--out", `evaluation-runs/${policy}-${preset}-${seed}-${Date.now()}`)!);

const model = policy === "baseline" ? undefined : policy;
const limits = episodes[preset].limits;
const budget = model
  ? new ModelBudget({
      maxModelCallsPerPlayer: positive("--max-model-calls", limits.maxModelCallsPerPlayer),
      maxTokensPerPlayer: positive("--max-tokens", limits.maxTokensPerPlayer),
      maxSpendUsd: positive("--max-spend-usd"),
      callTimeoutMs: positive("--call-timeout-seconds", defaultBudgetLimits.callTimeoutMs / 1000) * 1000,
    })
  : undefined;

let gateway: Gateway | undefined;
if (policy === "anthropic") {
  const id = arg("--model", "claude-haiku-5-5")!;
  const prices = anthropicPrices[id];
  if (!prices) throw Error(`No price on record for ${id}.`);
  gateway = new AnthropicGateway(id, prices);
} else if (policy === "openai") {
  const id = arg("--model");
  if (!id) throw Error("--model is required for OpenAI.");
  const source = arg("--pricing-source");
  if (!source) throw Error("OpenAI runs need --pricing-source.");
  gateway = new OpenAIGateway(id, {
    inputPerM: positive("--input-usd-per-million"),
    outputPerM: positive("--output-usd-per-million"),
    source,
  });
}

const make = (hero: "Sieg" | "Coco", id: PlayerId): Policy => {
  if (!gateway || !budget) return new ExplorationBaseline();
  // Only the public player manual goes to the model.
  const manual = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
  return new LLMPlayer(hero, manual, new MeteredGateway(gateway, budget, id));
};

mkdirSync(out, { recursive: true });
const trace = new TraceWriter(join(out, "trace.jsonl"));
const env = new AgentEnvironment({ preset, labels, trace: (e) => trace.write(e) });
const policies = { sieg: make("Sieg", "sieg"), coco: make("Coco", "coco") };
const started = Date.now();
const outcome = await runEpisode(env, policies, trace, { seed, wallClockMs: wallSeconds * 1000, ...(budget ? { budget } : {}) });
verifyTrace(trace.lines);
const steps = trace.lines.filter((l) => l.type === "step");
const records = budget?.records ?? [];
const ok = records.filter((r) => r.status === "ok");
const summary = {
  policy: { sieg: policies.sieg.name, coco: policies.coco.name },
  preset,
  seed,
  labels,
  outcome,
  evaluator: env.evaluatorReport(),
  wallSeconds: Math.round((Date.now() - started) / 100) / 10,
  steps: steps.length,
  invalidActions: outcome.invalidActions,
  policyErrors: trace.lines.filter((l) => l.type === "policy_error").length,
  modelCalls: {
    attempted: records.length,
    ok: ok.length,
    failed: records.length - ok.length,
    byStatus: Object.fromEntries(["ok", "error", "timeout", "refusal", "aborted"].map((s) => [s, records.filter((r) => r.status === s).length])),
    unknownUsage: records.filter((r) => r.tokens === null).length,
    /** Mean over every attempt, failures included. */
    meanLatencyMs: records.length ? Math.round(records.reduce((a, r) => a + r.latencyMs, 0) / records.length) : null,
    models: [...new Set(records.map((r) => r.model).filter(Boolean))],
  },
  spendUsd: outcome.spendUsd,
  prices: gateway ? { gateway: gateway.label, source: (policy === "anthropic" ? anthropicPrices[arg("--model", "claude-haiku-5-5")!]?.source : arg("--pricing-source")) ?? null } : null,
  traceLines: trace.lines.length,
};
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`output: ${out}`);
