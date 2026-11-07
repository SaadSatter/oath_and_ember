// Situation A — Full Hedge Maze (S2-A): free, deterministic checks.
// Definition: packages/agent/src/situationA.ts; record: docs/midterm/SITUATION_A.md.
//
//   node --import tsx scripts/midterm/situation-a.ts              # definition, resets, planned runs
//   node --import tsx scripts/midterm/situation-a.ts --baseline   # also run baseline-quest on seeds 0 and 1
//   node --import tsx scripts/midterm/situation-a.ts --baseline --out <dir>
//
// It never makes a model call: it builds no gateway, reads no key and opens no
// spend ledger. Model-player plans are only validated and printed. Exits 1 if
// any frozen value differs.

import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { runSuite, validatePlan, type ModelSetup, type PlayerKind } from "../../packages/agent/src/harness.js";
import { environmentFor } from "../../packages/agent/src/suite.js";
import { SITUATION_A, SITUATION_A_HASH } from "../../packages/agent/src/situationA.js";
import { repoInfo } from "../../packages/agent/src/repo.js";
import type { PlayerId } from "../../packages/agent/src/types.js";

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
for (const a of argv) if (a.startsWith("--") && !["--baseline", "--out"].includes(a)) throw Error(`Unknown argument ${a}.`);
const repo = repoInfo();
const version = `${repo.head.slice(0, 7)}${repo.dirty ? "+dirty" : ""}`;
const A = SITUATION_A;
const problems: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };

console.log(`${A.label} — ${A.name} (version ${A.version}, frozen ${A.frozenOn})`);
console.log(`  runs as scenario ${A.situation} (preset ${A.preset}, suite revision ${A.suiteRevision}); game version ${version}`);
console.log(`  definition hash ${SITUATION_A_HASH}`);
console.log(`  objective: ${A.objective}`);
console.log(`  success:   ${A.success}`);
console.log(`  limits:    ${A.limits.maxTicks} ticks; per hero ${A.limits.maxDecisionsPerPlayer} decisions, ${A.limits.maxModelCallsPerPlayer} model calls, ${A.limits.maxTokensPerPlayer} tokens;`);
console.log(`             ${A.limits.modelCallTimeoutMs / 1000} s per call; wall clock ${A.limits.wallClockSeconds.model} s (model) / ${A.limits.wallClockSeconds.scripted} s (scripted); $${A.limits.episodeSpendCapUsd} per episode`);

// ── Resets ───────────────────────────────────────────────────────────────────
console.log("\nResets (free):");
const observed: Record<number, string> = {};
for (const seed of A.seeds.tuning) {
  const env = environmentFor(A.situation);
  const first = await env.reset(seed);
  const views = JSON.stringify([await env.observe("sieg"), await env.legal_actions("sieg"), await env.observe("coco"), await env.legal_actions("coco")]);
  const again = await env.reset(seed);
  observed[seed] = createHash("sha256").update(views).digest("hex");
  check(first.startHash === A.start.hashes[seed], `seed ${seed}: start hash ${first.startHash.slice(0, 8)}… matches the frozen value`);
  check(first.tick === A.start.tick, `seed ${seed}: start tick ${first.tick}`);
  check(again.startHash === first.startHash, `seed ${seed}: a second reset gives the same hash`);
}
check(observed[0] === observed[1], "seeds 0 and 1: both heroes' observations and legal actions at reset are identical (seed 1 is a repeated trial)");

// ── Planned comparison (validated, not run) ──────────────────────────────────
console.log("\nPlanned runs (validated only; model runs are PAID and need the owner's approval):");
const roles = Object.entries(A.players).flatMap(([role, kinds]) => kinds.map((k) => ({ role, kind: k as PlayerKind })));
for (const { role, kind } of roles) {
  const isModel = kind.startsWith("model");
  try {
    validatePlan({ player: kind, situations: [A.situation], seeds: [...A.seeds.tuning], final: false, ...(isModel ? { model: { stage: "pilot" } as ModelSetup } : {}) });
    console.log(`  ${role.padEnd(13)} ${kind.padEnd(16)} seeds ${A.seeds.tuning.join(", ")}: plan valid${isModel ? " (not run)" : ""}`);
  } catch (e) {
    check(false, `${kind}: ${(e as Error).message}`);
  }
}

// ── Scripted baseline (free) ─────────────────────────────────────────────────
if (argv.includes("--baseline")) {
  const out = resolve(repo.root, arg("--out") ?? `evaluation-runs/situation-a-baseline-${Date.now()}`);
  console.log(`\nbaseline-quest on ${A.label} (${A.situation}), seeds ${A.seeds.tuning.join(", ")} → ${out}`);
  const runs = await runSuite({ player: "baseline-quest", situations: [A.situation], seeds: [...A.seeds.tuning], outDir: out, gitHash: version, launch: { launcher: "scripts/midterm/situation-a.ts", speed: null, viewer: false } });
  const sum = (r: Record<PlayerId, number>) => r.sieg + r.coco;
  console.log("  seed | outcome | ticks | game s | decisions | invalid | messages | calls | start    | end      | config");
  for (const r of runs)
    console.log(`  ${r.seed}    | ${r.reason} | ${r.gameTicks}  | ${r.gameSeconds}   | ${sum(r.decisions)}       | ${sum(r.invalidActions)}       | ${sum(r.messages)}        | ${r.modelCalls.attempted}     | ${r.startHash.slice(0, 8)} | ${r.endHash.slice(0, 8)} | ${r.configHash?.slice(0, 8)}`);
  const ref = A.baselineReference;
  const s0 = runs.find((r) => r.seed === 0)!;
  check(s0.success && s0.reason === "success", "seed 0: success, read from the evaluator");
  check(s0.gameTicks === ref.gameTicks && s0.gameSeconds === ref.gameSeconds, `seed 0: ${ref.gameTicks} ticks (${ref.gameSeconds} s)`);
  check(sum(s0.decisions) === ref.decisions && sum(s0.invalidActions) === ref.invalidActions, `seed 0: ${ref.decisions} decisions, ${ref.invalidActions} invalid`);
  check(sum(s0.messages) === ref.messages && s0.modelCalls.attempted === ref.modelCalls, `seed 0: ${ref.messages} messages, ${ref.modelCalls} model calls`);
  check(s0.endHash === ref.endHash, `seed 0: end hash ${ref.endHash.slice(0, 8)}… (the committed evidence)`);
  check(s0.evaluation?.label === A.label && s0.evaluation?.definitionHash === SITUATION_A_HASH, `summaries carry ${A.label} and its definition hash`);
  const s1 = runs.find((r) => r.seed === 1)!;
  check(s1.success && s1.gameTicks === s0.gameTicks && sum(s1.decisions) === sum(s0.decisions), "seed 1: the same outcome, ticks and decisions as seed 0 (a repeated trial)");
  check(s1.configHash === s0.configHash, "seeds 0 and 1: the same configuration hash");
}

console.log(problems.length ? `\n${problems.length} check(s) FAILED.` : "\nAll Situation A checks passed.");
process.exit(problems.length ? 1 : 0);
