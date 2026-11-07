// Situation C — Griffin Trial, Prepared, goddess return (griffin-prepared-return-v1):
// free, deterministic preparation checks. Record: docs/midterm/SITUATION_C_PREPARED.md.
//
//   node --import tsx scripts/midterm/situation-c.ts                 # checks only
//   node --import tsx scripts/midterm/situation-c.ts --evidence <dir> # also write the evidence
//
// It never makes a paid model call: no provider gateway, no key, no shared
// ledger. Model prompts are built with the offline mock gateway (scratch
// ledger, a few wall seconds) only to read their prompt hashes; those mock
// episodes are launcher checks, never results. Exits 1 if a pinned value differs.

import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { runSuite, validatePlan, guidanceRecord, type ModelSetup, type EpisodeSummary } from "../../packages/agent/src/harness.js";
import { environmentFor, type SituationId } from "../../packages/agent/src/suite.js";
import { SITUATION_GRIFFIN_C as C, SITUATION_GRIFFIN_C_HASH, SITUATION_C_PAID_APPROVED } from "../../packages/agent/src/griffinSituationC.js";
import { SITUATION_A_HASH } from "../../packages/agent/src/situationA.js";
import { actionsDigest } from "../../packages/agent/src/route/griffinWitness.js";
import { MockGateway } from "../../packages/agent/src/policies/mockGateway.js";
import { APPROVED_LEDGER, SpendLedger } from "../../packages/agent/src/ledger.js";
import { repoInfo } from "../../packages/agent/src/repo.js";
import { stateDiff } from "../../packages/agent/src/griffinSituationC.js";
import type { GameAction, PlayerId } from "../../packages/agent/src/types.js";
import type { GameRoom } from "../../apps/server/src/GameRoom.js";

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
for (const a of argv) if (a.startsWith("--") && !["--evidence"].includes(a)) throw Error(`Unknown argument ${a}.`);
const repo = repoInfo();
const version = `${repo.head.slice(0, 7)}${repo.dirty ? "+dirty" : ""}`;
const problems: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };
const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const B_ID: SituationId = "griffin-unprepared-return-v1";

console.log(`${C.label} — ${C.name} (${C.situation}, version ${C.version}); game version ${version}`);
console.log(`  definition hash ${SITUATION_GRIFFIN_C_HASH}`);
console.log(`  success:   ${C.success}`);
console.log(`  failure:   ${C.failure}`);
console.log(`  paid runs: ${SITUATION_C_PAID_APPROVED ? "approved" : "LOCKED until the owner approves the C declaration"}`);
check(SITUATION_A_HASH === "7efb771a7b91d35422b719676f09c9b36063c5d95ede2de9e5dc681dd93e0eab", "Situation A definition unchanged");

// ── Resets and the B/C start diff ─────────────────────────────────────────────
console.log("\nResets (free):");
const starts: Record<string, { hash: string; tick: number; prefix: string; world: unknown; obs: Record<PlayerId, unknown>; legal: Record<PlayerId, unknown> }> = {};
for (const [id, seed] of [[C.situation, 0], [C.situation, 0], [C.situation, 1], [B_ID, 0]] as const) {
  let room!: GameRoom;
  const env = environmentFor(id, { room: (r) => (room = r) });
  const prefix: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
  let on = true;
  const real = env.step.bind(env);
  env.step = (p, a) => { if (on) prefix[p].push(a); return real(p, a); };
  const r = await env.reset(seed);
  on = false;
  const digest = actionsDigest(prefix);
  if (id === C.situation)
    check(r.startHash === C.start.hashes[seed] && r.tick === C.start.tick && digest === C.start.prefixActionsSha256,
      `C seed ${seed}: tick ${r.tick}, start ${r.startHash.slice(0, 16)}, prefix ${digest.slice(0, 16)} (${prefix.sieg.length}+${prefix.coco.length} actions)`);
  else
    check(r.startHash === C.parity.bStartHash && r.tick === C.start.tick && digest === C.start.prefixActionsSha256,
      `B-return seed 0 unchanged: start ${r.startHash.slice(0, 16)}, same prefix actions as C`);
  const key = `${id}#${seed}`;
  if (!starts[key]) {
    const obs = { sieg: await env.observe("sieg"), coco: await env.observe("coco") };
    const legal = { sieg: await env.legal_actions("sieg"), coco: await env.legal_actions("coco") };
    starts[key] = { hash: r.startHash, tick: r.tick, prefix: digest, world: JSON.parse(JSON.stringify(room.state)), obs, legal };
  }
}
const b = starts[`${B_ID}#0`], c = starts[`${C.situation}#0`];
const worldDiff = stateDiff(b.world, c.world);
const obsDiff = { sieg: stateDiff(b.obs.sieg, c.obs.sieg), coco: stateDiff(b.obs.coco, c.obs.coco) };
const legalDiff = { sieg: stateDiff(b.legal.sieg, c.legal.sieg), coco: stateDiff(b.legal.coco, c.legal.coco) };
console.log("\nB-return → C initial-state diff (authoritative world):");
for (const d of worldDiff) console.log(`    ${d.path}: ${JSON.stringify(d.b)} → ${JSON.stringify(d.c)}`);
check(JSON.stringify(worldDiff.map((d) => d.path)) === JSON.stringify(C.parity.worldDiffPaths), `world differs only at ${C.parity.worldDiffPaths.join(", ")}`);
console.log("  Observation diff (per hero):");
for (const id of ["sieg", "coco"] as const) for (const d of obsDiff[id]) console.log(`    ${id} ${d.path}: ${JSON.stringify(d.b)?.slice(0, 120)} → ${JSON.stringify(d.c)?.slice(0, 120)}`);
check(JSON.stringify(obsDiff.sieg.map((d) => d.path)) === JSON.stringify(C.parity.observationDiffPaths) && JSON.stringify(obsDiff.coco.map((d) => d.path)) === JSON.stringify(C.parity.observationDiffPaths),
  `observations differ only at ${C.parity.observationDiffPaths.join(", ")}`);
check(legalDiff.sieg.length === 0 && legalDiff.coco.length === 0, "legal actions identical at the start");

// ── Deterministic baseline (unchanged baseline-griffin-heuristic-v1) ──────────
console.log("\nbaseline-griffin-heuristic-v1, unchanged (free):");
const scratch = mkdtempSync(join(tmpdir(), "situation-c-"));
const baselineRuns: EpisodeSummary[] = [];
for (const [run, seed] of [[1, 0], [2, 0], [3, 1]] as const) {
  const [s] = await runSuite({ player: "baseline-griffin-heuristic", situations: [C.situation], seeds: [seed], outDir: join(scratch, `baseline-${run}`), gitHash: version });
  baselineRuns.push(s);
  console.log(`    run ${run} seed ${seed}: ${s.status} (${s.reason}) ${s.gameSeconds} game s, decisions ${JSON.stringify(s.decisions)}, invalid ${JSON.stringify(s.invalidActions)}, wall ${s.wallSeconds} s, end ${s.endHash.slice(0, 16)}`);
}
check(baselineRuns[0].endHash === baselineRuns[1].endHash && baselineRuns[0].gameTicks === baselineRuns[1].gameTicks, "repeated seed-0 baseline runs are identical (end hash and ticks)");

// ── Prompt identities (mock gateway, a few wall seconds; not results) ─────────
console.log("\nPrompt identities (offline mock; nothing paid):");
const manual = readFileSync(join(repo.root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const prompts: Record<string, { policy: string; promptHash: string | null; guidance: string | null }> = {};
for (const [label, id, guidanceId] of [
  ["Pilot-31 check: B v1 pre-tuned", "griffin-unprepared-v1", undefined],
  ["Pilot-33 check: B-return + v4", B_ID, "b-post-combined-v4"],
  ["C1 pre-tuned", C.situation, undefined],
  ["C3 post-tuned", C.situation, "b-post-combined-v4"],
] as const) {
  const dir = join(scratch, `mock-${Object.keys(prompts).length}`);
  mkdirSync(dir, { recursive: true });
  const ledger = SpendLedger.open(join(dir, "mock-ledger.json"), APPROVED_LEDGER, { create: true });
  const model: ModelSetup = { gateway: new MockGateway(0, 0), manual, ledger, stage: "pilot", priceSource: "mock: no cost, no network", maxBatch: 4, ...(guidanceId ? { guidance: guidanceId } : {}) };
  const [s] = await runSuite({ player: "model-centralized", situations: [id], seeds: [0], outDir: join(dir, "run"), gitHash: version, wallSeconds: 3, model });
  ledger.close();
  prompts[label] = { policy: s.policies.sieg, promptHash: s.promptHashes?.sieg ?? null, guidance: s.guidance?.sha256 ?? null };
  console.log(`    ${label}: ${s.policies.sieg}, prompt ${s.promptHashes?.sieg}`);
}
check(prompts["Pilot-31 check: B v1 pre-tuned"].promptHash === C.prompts.pilot31PromptHash, "Pilot-31's recorded prompt hash still reproduces");
check(prompts["Pilot-33 check: B-return + v4"].promptHash === C.prompts.pilot33PromptHash, "Pilot-33's recorded prompt hash still reproduces");
check(prompts["C1 pre-tuned"].promptHash === C.prompts.preTunedPromptHash, "C1 prompt hash pinned");
check(prompts["C3 post-tuned"].promptHash === C.prompts.postTunedPromptHash && prompts["C3 post-tuned"].guidance === C.prompts.guidanceSha256, "C3 prompt and guidance hashes pinned");

console.log("\nModel plans (validated only):");
const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
for (const [name, model] of [["C1 pre-tuned (mock)", mock], ["C3 post-tuned (mock)", { ...mock, guidance: "b-post-combined-v4" }]] as const) {
  try { validatePlan({ player: "model-centralized", situations: [C.situation], seeds: [0], model }); check(true, `${name} plan valid`); }
  catch (e) { check(false, `${name}: ${(e as Error).message}`); }
}
try {
  validatePlan({ player: "model-centralized", situations: [C.situation], seeds: [0], model: { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup });
  check(SITUATION_C_PAID_APPROVED, "paid C plan refused while locked");
} catch (e) { check(!SITUATION_C_PAID_APPROVED, `paid C plan refused while locked: ${(e as Error).message}`); }
const g = guidanceRecord("b-post-combined-v4");

if (arg("--evidence")) {
  const evDir = resolve(repo.root, arg("--evidence")!);
  if (existsSync(evDir)) throw Error(`${evDir} already exists.`);
  mkdirSync(evDir, { recursive: true });
  for (const [i, s] of baselineRuns.entries()) {
    const d = join(scratch, `baseline-${i + 1}`, `${C.situation}-seed${s.seed}`);
    writeFileSync(join(evDir, `baseline-run${i + 1}-summary.json`), readFileSync(join(d, "summary.json")));
    writeFileSync(join(evDir, `baseline-run${i + 1}-trace.jsonl.gz`), gzipSync(readFileSync(join(d, "trace.jsonl"))));
  }
  writeFileSync(join(evDir, "initial-state-diff.json"), JSON.stringify({ from: `${B_ID} seed 0 (${b.hash})`, to: `${C.situation} seed 0 (${c.hash})`, tick: c.tick, prefixActionsSha256: c.prefix, world: worldDiff, observations: obsDiff, legalActions: legalDiff }, null, 1));
  writeFileSync(join(evDir, "initial-observations.json"), JSON.stringify({ observations: c.obs, legal_actions: c.legal }, null, 1));
  const summary = {
    kind: "free offline preparation checks for Situation C; baseline rows are unregistered until the owner approves the C declaration; mock prompt checks are not results",
    situation: C.situation, definitionHash: SITUATION_GRIFFIN_C_HASH, gameVersion: version, node: process.version,
    start: { seed: 0, tick: c.tick, startHash: c.hash, seed1StartHash: starts[`${C.situation}#1`].hash, prefixActionsSha256: c.prefix },
    baseline: baselineRuns.map((s, i) => ({ run: i + 1, seed: s.seed, status: s.status, reason: s.reason, success: s.success, gameTicks: s.gameTicks, gameSeconds: s.gameSeconds, wallSeconds: s.wallSeconds, decisions: s.decisions, invalidActions: s.invalidActions, modelCalls: s.modelCalls, startHash: s.startHash, endHash: s.endHash, policies: s.policies,
      traceSha256: sha(readFileSync(join(scratch, `baseline-${i + 1}`, `${C.situation}-seed${s.seed}`, "trace.jsonl"))) })),
    prompts, guidance: g, problems,
  };
  writeFileSync(join(evDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nEvidence written to ${evDir}`);
}
rmSync(scratch, { recursive: true, force: true });
if (problems.length) { console.error(`\n${problems.length} check(s) failed.`); process.exit(1); }
console.log("\nAll Situation C checks passed.");
