// The three Hedge Maze situations (S2-A, S2-B, S2-C): free, deterministic checks.
// Definitions: packages/agent/src/hedgeMazeSituations.ts; record: docs/midterm/HEDGE_MAZE_SITUATIONS.md.
//
//   node --import tsx scripts/midterm/hedge-maze-situations.ts              # definitions, resets, planned runs
//   node --import tsx scripts/midterm/hedge-maze-situations.ts --baseline   # also run baseline-quest on seeds 0 and 1
//   node --import tsx scripts/midterm/hedge-maze-situations.ts --baseline --out <dir>
//
// It never makes a model call: no gateway, key or spend ledger. Model-player
// plans are only validated and printed. Exits 1 if a frozen value differs.

import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { runSuite, validatePlan, type ModelSetup, type PlayerKind } from "../../packages/agent/src/harness.js";
import { environmentFor } from "../../packages/agent/src/suite.js";
import { SITUATION_A } from "../../packages/agent/src/situationA.js";
import { HEDGE_MAZE_SITUATIONS, SITUATION_B, SITUATION_C } from "../../packages/agent/src/hedgeMazeSituations.js";
import { repoInfo } from "../../packages/agent/src/repo.js";
import type { PlayerId } from "../../packages/agent/src/types.js";

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
for (const a of argv) if (a.startsWith("--") && !["--baseline", "--out"].includes(a)) throw Error(`Unknown argument ${a}.`);
const repo = repoInfo();
const version = `${repo.head.slice(0, 7)}${repo.dirty ? "+dirty" : ""}`;
const DEFS = [SITUATION_A, SITUATION_B, SITUATION_C] as const;
const problems: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };
const sum = (r: Record<PlayerId, number>) => r.sieg + r.coco;

console.log(`Hedge Maze situations, game version ${version}`);
for (const [i, d] of DEFS.entries())
  console.log(`  ${d.label} ${d.name.padEnd(16)} scenario ${d.situation.padEnd(8)} start tick ${d.start.tick}  definition ${HEDGE_MAZE_SITUATIONS[i].definitionHash.slice(0, 12)}…`);

console.log("\nResets (free):");
for (const d of DEFS) {
  const views: Record<number, string> = {};
  for (const seed of d.seeds.tuning) {
    const env = environmentFor(d.situation);
    const r = await env.reset(seed);
    views[seed] = createHash("sha256").update(JSON.stringify(await Promise.all((["sieg", "coco"] as const).flatMap((h) => [env.observe(h), env.legal_actions(h)])))).digest("hex");
    const again = await env.reset(seed);
    check(r.startHash === d.start.hashes[seed] && again.startHash === r.startHash && r.tick === d.start.tick, `${d.label} seed ${seed}: start ${r.startHash.slice(0, 8)}… at tick ${r.tick}, repeatable`);
  }
  check(views[0] === views[1], `${d.label}: seeds 0 and 1 give both heroes identical observations (a repeated trial)`);
}

console.log("\nPlanned runs (validated only; model runs are PAID and need the owner's approval):");
for (const d of DEFS)
  for (const kind of ["baseline-quest", "model-memory", "model-obs-only"] as PlayerKind[]) {
    try {
      validatePlan({ player: kind, situations: [d.situation], seeds: [...d.seeds.tuning], ...(kind.startsWith("model") ? { model: { stage: "pilot" } as ModelSetup } : {}) });
      console.log(`  ${d.label} ${kind.padEnd(15)} seeds 0, 1: plan valid${kind.startsWith("model") ? " (not run)" : ""}`);
    } catch (e) {
      check(false, `${d.label} ${kind}: ${(e as Error).message}`);
    }
  }

if (argv.includes("--baseline")) {
  const out = resolve(repo.root, arg("--out") ?? `evaluation-runs/hedge-maze-baseline-${Date.now()}`);
  console.log(`\nbaseline-quest on S2-A, S2-B, S2-C, seeds 0 and 1 → ${out}`);
  const runs = await runSuite({ player: "baseline-quest", situations: DEFS.map((d) => d.situation), seeds: [0, 1], outDir: out, gitHash: version, launch: { launcher: "scripts/midterm/hedge-maze-situations.ts", speed: null, viewer: false } });
  console.log("  situation | seed | outcome    | game s | decisions | invalid | msgs | calls | start    | end      | config");
  for (const r of runs)
    console.log(`  ${(r.evaluation?.label ?? r.situation).padEnd(9)} | ${r.seed}    | ${String(r.reason).padEnd(10)} | ${String(r.gameSeconds).padEnd(6)} | ${String(sum(r.decisions)).padEnd(9)} | ${sum(r.invalidActions)}       | ${sum(r.messages)}    | ${r.modelCalls.attempted}     | ${r.startHash.slice(0, 8)} | ${r.endHash.slice(0, 8)} | ${r.configHash?.slice(0, 8)}`);
  for (const d of DEFS) {
    const ref = d.baselineReference as { reason?: string; status: string; gameTicks: number; decisions: number; invalidActions: number; messages: number; endHash: string };
    const r0 = runs.find((r) => r.situation === d.situation && r.seed === 0)!;
    const r1 = runs.find((r) => r.situation === d.situation && r.seed === 1)!;
    check(r0.status === ref.status && r0.gameTicks === ref.gameTicks && sum(r0.decisions) === ref.decisions && sum(r0.invalidActions) === ref.invalidActions && sum(r0.messages) === ref.messages && r0.endHash === ref.endHash,
      `${d.label} seed 0: ${r0.reason}, ${r0.gameTicks} ticks, end ${r0.endHash.slice(0, 8)}… as frozen`);
    check(r1.status === r0.status && r1.gameTicks === r0.gameTicks && sum(r1.decisions) === sum(r0.decisions), `${d.label} seed 1: the same outcome and trajectory length as seed 0`);
  }
}

console.log(problems.length ? `\n${problems.length} check(s) FAILED.` : "\nAll Hedge Maze situation checks passed.");
process.exit(problems.length ? 1 : 0);
