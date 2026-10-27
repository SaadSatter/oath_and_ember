// Run one player on the frozen evaluation suite (docs/midterm/EVALUATION_SUITE.md).
//
// Scripted baselines (free):
//   node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S1,S2,S3 --seeds tuning
//   node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --final --situations S1,S2,S3,S4,F --seeds final
//   (a final run needs the owner's approval for the current clean commit:
//    scripts/midterm/final-approve.ts; review H2)
//
// Model players (PAID; only after the owner has authorized the stage):
//   --player model-history|model-obs-only --stage pilot|final|contingency --effort medium|low --paid
//   --smoke --paid    one call, from the smoke stage
// Every paid episode is reserved in the one shared spend ledger, in the git
// common directory (packages/agent/src/repo.ts), before it starts.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { aggregate, runSuite, smokeCall, validatePlan, type ModelSetup, type PlayerKind } from "../../packages/agent/src/harness.js";
import { SEEDS, type SituationId } from "../../packages/agent/src/suite.js";
import { SpendLedger } from "../../packages/agent/src/ledger.js";
import { AnthropicGateway, anthropicPrices, EFFORTS, type Effort } from "../../packages/agent/src/policies/llm.js";

import { TraceWriter } from "../../packages/agent/src/trace.js";
import { repoInfo } from "../../packages/agent/src/repo.js";
import { authorizeFinalRun, type FinalGrant } from "../../packages/agent/src/finalAccess.js";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const flag = (name: string) => process.argv.includes(name);

// Git checks run on this script's own worktree, never on the shell's cwd (H1).
const repo = repoInfo();
const gitHash = repo.head.slice(0, 7);
const dirty = repo.dirty;
const version = dirty ? `${gitHash}+dirty` : gitHash;
const final = flag("--final");
const controller = new AbortController();
process.once("SIGINT", () => { process.exitCode = 130; controller.abort(); });
process.once("SIGTERM", () => { process.exitCode = 143; controller.abort(); });
if (flag("--ledger")) throw Error("Paid evaluation uses the one shared ledger in the git common directory; ledger overrides are disabled.");
const manual = () => readFileSync(join(repo.root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");

function paidGateway() {
  if (!flag("--paid")) throw Error("Model runs are paid. Pass --paid only after the owner has authorized this stage.");
  if (!process.env.ANTHROPIC_API_KEY) throw Error("ANTHROPIC_API_KEY is not set.");
  if (dirty) throw Error("Paid runs need a clean, committed tree so the game version is exact.");
  const id = arg("--model", "claude-haiku-5-5")!;
  const prices = anthropicPrices[id];
  if (!prices) throw Error(`No verified price on record for ${id}.`);
  const effort = arg("--effort", "medium") as Effort;
  if (!EFFORTS.includes(effort)) throw Error(`--effort must be one of ${EFFORTS.join(", ")}.`);
  return { gateway: new AnthropicGateway(id, prices, effort), source: prices.source };
}

if (flag("--smoke")) {
  const { gateway } = paidGateway();
  const ledger = SpendLedger.openCanonical(repo);
  try {
    const out = resolve(repo.root, arg("--out", `evaluation-runs/smoke-${Date.now()}`)!);
    mkdirSync(out, { recursive: true });
    const trace = new TraceWriter(join(out, "trace.jsonl"));
    const r = await smokeCall(gateway, manual(), ledger, version, 0.01, trace, controller.signal);
    writeFileSync(join(out, "summary.json"), JSON.stringify({ ...r, gitHash: version, gateway: gateway.label, priceSource: anthropicPrices[arg("--model", "claude-haiku-5-5")!].source }, null, 2));
    console.log(JSON.stringify({ ...r, ledgerRemaining: { smoke: ledger.remaining("smoke"), total: ledger.remaining() } }, null, 2));
  } finally {
    ledger.close();
  }
  process.exit(process.exitCode ?? 0);
}

const player = arg("--player", "baseline-quest") as PlayerKind;
const situations = arg("--situations", "S1,S2,S3")!.split(",") as SituationId[];
const seedArg = arg("--seeds", final ? "final" : "tuning")!;
const seeds = seedArg === "tuning" ? [...SEEDS.tuning] : seedArg === "final" ? [...SEEDS.final] : seedArg.split(",").map(Number);
const out = resolve(repo.root, arg("--out", `evaluation-runs/${player}-${final ? "final" : "tuning"}-${Date.now()}`)!);

// Final runs (S4, F, final seeds) need the owner's recorded approval for this
// exact, clean commit (review H2), checked before the ledger or the network.
let finalGrant: FinalGrant | undefined;
if (final) {
  validatePlan({ player, situations, seeds, final, ...(player.startsWith("model") ? { model: { stage: arg("--stage") } as ModelSetup } : {}) });
  finalGrant = authorizeFinalRun({ player, stage: arg("--stage", "final")!, situations, seeds }, repo);
}
let model: ModelSetup | undefined;
let ledger: SpendLedger | undefined;
if (player === "model-history" || player === "model-obs-only") {
  const stage = arg("--stage");
  if (!stage) throw Error("--stage is required for model runs.");
  // Check the plan before touching the ledger or the network.
  validatePlan({ player, situations, seeds, final, model: { stage } as ModelSetup });
  const { gateway, source } = paidGateway();
  ledger = SpendLedger.openCanonical(repo);
  model = { gateway, manual: manual(), ledger, stage, priceSource: source, maxBatch: Number(arg("--max-batch", "4")) };
}

try {
  const summaries = await runSuite({
    player,
    situations,
    seeds,
    final,
    outDir: out,
    gitHash: version,
    resume: flag("--resume"),
    signal: controller.signal,
    ...(model ? { model } : {}),
    ...(finalGrant ? { finalGrant } : {}),
    onEpisode: (s) =>
      console.log(`${s.situation} seed ${s.seed}: ${s.status}${s.reason && s.reason !== "success" ? ` (${s.reason})` : ""}, ${s.gameSeconds}s game time, decisions ${s.decisions.sieg}/${s.decisions.coco}, invalid ${s.invalidActions.sieg + s.invalidActions.coco}, ${s.wallSeconds}s real${s.gateway ? `, $${s.spendUsd.charged.toFixed(4)} charged` : ""}`),
  });
  console.table(aggregate(summaries));
  if (ledger) console.log(`ledger: ${ledger.remaining(model!.stage).toFixed(4)} left in ${model!.stage}; ${ledger.remaining().toFixed(4)} left in total`);
  console.log(`output: ${out}`);
} finally {
  ledger?.close();
}
