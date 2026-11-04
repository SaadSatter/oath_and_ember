// P1 "Into the Forest" (the Prologue): free, deterministic checks of the current revision.
// Definition: packages/agent/src/prologueSituation.ts; record: docs/midterm/PROLOGUE_SITUATION.md.
//
//   node --import tsx scripts/midterm/prologue-situation.ts              # definition, resets, planned runs
//   node --import tsx scripts/midterm/prologue-situation.ts --baseline   # also run baseline-quest on seeds 0 and 1
//   node --import tsx scripts/midterm/prologue-situation.ts --baseline --out <dir>
//
// It never makes a model call: it builds no gateway, reads no key and opens no
// spend ledger. Model-player plans are only validated and printed. Exits 1 if
// any frozen value differs.

import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { runSuite, validatePlan, EPISODE_CAP_USD, WALL_CLOCK_CEILING_S, type ModelSetup, type PlayerKind } from "../../packages/agent/src/harness.js";
import { environmentFor } from "../../packages/agent/src/suite.js";
import { P1, P1_HASH, P1_REVISIONS } from "../../packages/agent/src/prologueSituation.js";
import { repoInfo } from "../../packages/agent/src/repo.js";
import type { PlayerId } from "../../packages/agent/src/types.js";

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
for (const a of argv) if (a.startsWith("--") && !["--baseline", "--out"].includes(a)) throw Error(`Unknown argument ${a}.`);
const repo = repoInfo();
const version = `${repo.head.slice(0, 7)}${repo.dirty ? "+dirty" : ""}`;
const problems: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };

console.log(`${P1.label} — ${P1.name} (version ${P1.version}, frozen ${P1.frozenOn})`);
console.log(`  scenario ${P1.situation} (preset ${P1.preset}, suite revision ${P1.suiteRevision}); game version ${version}`);
console.log(`  definition hash ${P1_HASH}`);
console.log(`  supersedes revision ${P1.supersedes.version} (definition hash ${P1.supersedes.definitionHash}, commit ${P1.supersedes.commit})`);
// Earlier revisions are kept verbatim; each keeps the hash it was frozen with.
const FROZEN: Record<number, string> = {
  1: "baa6b04b7de3d56e479cbb092d5d8a10875a290c89748b836917e32a895f73ac",
  2: "7dfac8cd2b91b5d096328265a4eba068a8a86055750c204896394ebdc6b1a655",
};
for (const r of P1_REVISIONS.filter((x) => x.version < P1.version))
  check(r.definitionHash === FROZEN[r.version], `revision ${r.version} (preset ${r.preset}) is kept verbatim with its original hash ${FROZEN[r.version]?.slice(0, 8)}…`);
check(P1.supersedes.definitionHash === FROZEN[P1.supersedes.version], `the current revision supersedes revision ${P1.supersedes.version} by its frozen hash`);
console.log(`  objective: ${P1.objective}`);
console.log(`  success:   ${P1.success}`);
console.log(`  limits:    ${P1.limits.maxTicks} ticks; per hero ${P1.limits.maxDecisionsPerPlayer} decisions, ${P1.limits.maxModelCallsPerPlayer} model calls, ${P1.limits.maxTokensPerPlayer} tokens;`);
console.log(`             ${P1.limits.modelCallTimeoutMs / 1000} s per call; wall clock ${P1.limits.wallClockSeconds.model} s (model) / ${P1.limits.wallClockSeconds.scripted} s (scripted); $${P1.limits.episodeSpendCapUsd} per episode`);
check(EPISODE_CAP_USD.P1 === P1.limits.episodeSpendCapUsd, `harness episode cap $${EPISODE_CAP_USD.P1}`);
check(WALL_CLOCK_CEILING_S.P1 === P1.limits.wallClockCeilingSeconds, `harness wall-clock ceiling ${WALL_CLOCK_CEILING_S.P1} s (a run may lower it, never raise it)`);

console.log("\nResets (free):");
for (const seed of P1.seeds.tuning) {
  const env = environmentFor(P1.situation);
  const first = await env.reset(seed);
  const views = JSON.stringify([await env.observe("sieg"), await env.legal_actions("sieg"), await env.observe("coco"), await env.legal_actions("coco")]);
  const again = await env.reset(seed);
  check(first.startHash === P1.start.hashes[seed], `seed ${seed}: start hash ${first.startHash.slice(0, 8)}… matches the frozen value`);
  check(first.tick === P1.start.tick, `seed ${seed}: start tick ${first.tick}`);
  check(again.startHash === first.startHash, `seed ${seed}: a second reset gives the same hash`);
  check(createHash("sha256").update(views).digest("hex") === P1.start.viewsHash, `seed ${seed}: both heroes' first observation and legal actions match the frozen views hash`);
}

console.log("\nPlanned runs (validated only; model runs are PAID and need the owner's approval):");
for (const [role, kinds] of Object.entries(P1.players))
  for (const kind of kinds as readonly PlayerKind[]) {
    const isModel = kind.startsWith("model");
    try {
      validatePlan({ player: kind, situations: [P1.situation], seeds: [...P1.seeds.tuning], final: false, ...(isModel ? { model: { stage: "pilot" } as ModelSetup } : {}) });
      console.log(`  ${role.padEnd(10)} ${kind.padEnd(16)} seeds ${P1.seeds.tuning.join(", ")}: plan valid${isModel ? " (not run)" : ""}`);
    } catch (e) {
      check(false, `${kind}: ${(e as Error).message}`);
    }
  }

if (argv.includes("--baseline")) {
  const out = resolve(repo.root, arg("--out") ?? `evaluation-runs/p1-baseline-${Date.now()}`);
  console.log(`\nbaseline-quest on ${P1.label}, seeds ${P1.seeds.tuning.join(", ")} → ${out}`);
  const runs = await runSuite({ player: "baseline-quest", situations: [P1.situation], seeds: [...P1.seeds.tuning], outDir: out, gitHash: version, launch: { launcher: "scripts/midterm/prologue-situation.ts", speed: null, viewer: false } });
  const sum = (r: Record<PlayerId, number>) => r.sieg + r.coco;
  console.log("  seed | outcome | ticks | game s | decisions (S/C) | invalid | messages | calls | start    | end      | config");
  for (const r of runs)
    console.log(`  ${r.seed}    | ${r.reason} | ${r.gameTicks} | ${r.gameSeconds} | ${sum(r.decisions)} (${r.decisions.sieg}/${r.decisions.coco}) | ${sum(r.invalidActions)} | ${sum(r.messages)} | ${r.modelCalls.attempted} | ${r.startHash.slice(0, 8)} | ${r.endHash.slice(0, 8)} | ${r.configHash?.slice(0, 8)}`);
  const ref = P1.baseline.reference;
  const s0 = runs.find((r) => r.seed === 0)!;
  check(s0.success && s0.reason === "success", "seed 0: success, read from the evaluator");
  check(s0.gameTicks === ref.gameTicks && s0.gameSeconds === ref.gameSeconds, `seed 0: ${ref.gameTicks} ticks (${ref.gameSeconds} s)`);
  check(sum(s0.decisions) === ref.decisions && sum(s0.invalidActions) === ref.invalidActions, `seed 0: ${ref.decisions} decisions, ${ref.invalidActions} invalid`);
  check(sum(s0.messages) === ref.messages && s0.modelCalls.attempted === ref.modelCalls, `seed 0: ${ref.messages} messages, ${ref.modelCalls} model calls`);
  check(s0.endHash === ref.endHash, `seed 0: end hash ${ref.endHash.slice(0, 8)}…`);
  const s1 = runs.find((r) => r.seed === 1)!;
  check(s1.success && s1.gameTicks === s0.gameTicks && sum(s1.decisions) === sum(s0.decisions), "seed 1: the same success, ticks and decisions (a repeated trial)");
  check(runs.every((r) => r.evaluation?.label === "P1" && r.evaluation.definitionHash === P1_HASH), "every summary carries the P1 label and definition hash");
}

if (problems.length) {
  console.log(`\n${problems.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
