// Runs one two-player episode through the five-operation interface.
//
//   Baseline:  node --import tsx scripts/midterm/run-episode.ts --policy baseline --seed 1
//   Claude:    node --import tsx scripts/midterm/run-episode.ts --policy anthropic \
//                --model claude-haiku-5-5 --max-spend-usd 1 --seed 1
//   OpenAI:    node --import tsx scripts/midterm/run-episode.ts --policy openai --model <id> \
//                --input-usd-per-million <n> --output-usd-per-million <n> --pricing-source <url> --max-spend-usd 1
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AgentEnvironment } from "../../packages/agent/src/environment.js";
import { runEpisode } from "../../packages/agent/src/runner.js";
import { TraceWriter, verifyTrace } from "../../packages/agent/src/trace.js";
import { ExplorationBaseline } from "../../packages/agent/src/policies/baseline.js";
import {
  AnthropicGateway,
  anthropicPrices,
  LLMPlayer,
  OpenAIGateway,
  SpendCap,
  type Gateway,
} from "../../packages/agent/src/policies/llm.js";
import type { Policy } from "../../packages/agent/src/policies/policy.js";
import type { EpisodePreset } from "../../packages/agent/src/evaluator.js";
import type { LabelMode } from "../../packages/agent/src/perception.js";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const policy = arg("--policy", "baseline")!;
const seed = Number(arg("--seed", "1"));
const preset = arg("--preset", "milestone") as EpisodePreset;
const labels = arg("--labels", "names-only") as LabelMode;
const wallSeconds = Number(arg("--wall-seconds", policy === "baseline" ? "60" : "900"));
const out = resolve(arg("--out", `evaluation-runs/${policy}-${preset}-${seed}-${Date.now()}`)!);
const maxCalls = arg("--max-model-calls");

let cap: SpendCap | undefined;
const make = (hero: "Sieg" | "Coco"): Policy => {
  if (policy === "baseline") return new ExplorationBaseline();
  // Only the public player manual goes to the model.
  const manual = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
  cap ??= new SpendCap(Number(arg("--max-spend-usd")));
  let gateway: Gateway;
  if (policy === "anthropic") {
    const model = arg("--model", "claude-opus-5-5")!;
    const prices = anthropicPrices[model];
    if (!prices) throw Error(`No price on record for ${model}.`);
    gateway = new AnthropicGateway(model, prices, cap);
  } else if (policy === "openai") {
    const model = arg("--model");
    if (!model) throw Error("--model is required for OpenAI.");
    const prices = {
      inputPerM: Number(arg("--input-usd-per-million")),
      outputPerM: Number(arg("--output-usd-per-million")),
      source: arg("--pricing-source", "")!,
    };
    if (!(prices.inputPerM > 0 && prices.outputPerM > 0 && prices.source))
      throw Error("OpenAI runs need explicit prices and a pricing source.");
    gateway = new OpenAIGateway(model, prices, cap);
  } else throw Error(`Unknown policy ${policy}`);
  return new LLMPlayer(hero, manual, gateway);
};

mkdirSync(out, { recursive: true });
const trace = new TraceWriter(join(out, "trace.jsonl"));
const env = new AgentEnvironment({
  preset,
  labels,
  ...(maxCalls ? { limits: { maxModelCallsPerPlayer: Number(maxCalls) } } : {}),
  trace: (e) => trace.write(e),
});
const policies = { sieg: make("Sieg"), coco: make("Coco") };
const started = Date.now();
const outcome = await runEpisode(env, policies, trace, { seed, wallClockMs: wallSeconds * 1000 });
verifyTrace(trace.lines);
const steps = trace.lines.filter((l) => l.type === "step");
const calls = trace.lines.filter((l) => l.type === "model_call");
const usage = calls.map((l) => (l.data as { usage: { latencyMs: number; costUsd: number } }).usage);
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
  modelCalls: calls.length,
  meanLatencyMs: usage.length ? Math.round(usage.reduce((a, u) => a + u.latencyMs, 0) / usage.length) : 0,
  spendUsd: Math.round((cap?.spent ?? 0) * 1e5) / 1e5,
  traceLines: trace.lines.length,
};
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`output: ${out}`);
