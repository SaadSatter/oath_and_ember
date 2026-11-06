// Situation B — Griffin Trial, Unprepared (griffin-unprepared-v1): free, deterministic certification.
// Definition: packages/agent/src/griffinSituations.ts; record: docs/midterm/SITUATION_B_GRIFFIN.md.
//
//   node --import tsx scripts/midterm/situation-b.ts                 # definition, resets, witness, baseline
//   node --import tsx scripts/midterm/situation-b.ts --evidence <dir> # also write the certification evidence
//
// It never makes a model call: it builds no paid gateway, reads no key and
// opens no shared spend ledger. Model-player plans are only validated and the
// live command templates printed. Exits 1 if any frozen value differs.
//
// The witness is a SCRIPTED, SOLUTION-AWARE certification controller
// (route/griffinWitness.ts). It is not a baseline and its actions are never
// given to a model.

import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { runSuite, validatePlan, guidanceRecord, type ModelSetup } from "../../packages/agent/src/harness.js";
import { environmentFor } from "../../packages/agent/src/suite.js";
import { SITUATION_GRIFFIN_B as B, SITUATION_GRIFFIN_B_HASH } from "../../packages/agent/src/griffinSituations.js";
import { SITUATION_A_HASH } from "../../packages/agent/src/situationA.js";
import { runGriffinWitness, actionsDigest } from "../../packages/agent/src/route/griffinWitness.js";
import { MockGateway } from "../../packages/agent/src/policies/mockGateway.js";
import { repoInfo } from "../../packages/agent/src/repo.js";
import type { GameAction, PlayerId } from "../../packages/agent/src/types.js";

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
for (const a of argv) if (a.startsWith("--") && !["--evidence"].includes(a)) throw Error(`Unknown argument ${a}.`);
const repo = repoInfo();
const version = `${repo.head.slice(0, 7)}${repo.dirty ? "+dirty" : ""}`;
const problems: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };
const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

console.log(`${B.label} — ${B.name} (${B.logicalId}, version ${B.version}); game version ${version}`);
console.log(`  definition hash ${SITUATION_GRIFFIN_B_HASH}`);
console.log(`  objective: ${B.objective}`);
console.log(`  success:   ${B.success}`);
console.log(`  failure:   ${B.failure}`);
console.log(`  limits:    ${B.limits.maxTicks} ticks; per hero ${B.limits.maxDecisionsPerPlayer} decisions, ${B.limits.maxModelCallsPerPlayer} calls, ${B.limits.maxTokensPerPlayer} tokens; ${B.limits.modelCallTimeoutMs / 1000} s per call; wall ${B.limits.wallClockSeconds.model} s model / ${B.limits.wallClockSeconds.scripted} s scripted; $${B.limits.episodeSpendCapUsd} per episode`);
check(SITUATION_A_HASH === "7efb771a7b91d35422b719676f09c9b36063c5d95ede2de9e5dc681dd93e0eab", "Situation A definition unchanged");

// ── Resets ───────────────────────────────────────────────────────────────────
console.log("\nResets (free):");
const observations: Record<string, unknown> = {};
for (const seed of [0, 0, 1]) {
  const env = environmentFor(B.situation);
  const prefix: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
  let on = true;
  const real = env.step.bind(env);
  env.step = (p, a) => { if (on) prefix[p].push(a); return real(p, a); };
  const r = await env.reset(seed);
  on = false;
  check(r.startHash === B.start.hashes[seed] && r.tick === B.start.tick && actionsDigest(prefix) === B.start.prefixActionsSha256,
    `seed ${seed}: tick ${r.tick}, start ${r.startHash.slice(0, 16)}, prefix ${actionsDigest(prefix).slice(0, 16)} (${prefix.sieg.length}+${prefix.coco.length} actions)`);
  if (seed === 0 && !observations.sieg) {
    for (const id of ["sieg", "coco"] as const) observations[id] = { observation: await env.observe(id), legal_actions: await env.legal_actions(id) };
    observations.prefixActions = prefix;
  }
}

// ── Offline witness ─────────────────────────────────────────────────────────
console.log("\nOffline witness (scripted, solution-aware certification controller; not a baseline):");
const evidence = arg("--evidence");
const evDir = evidence ? resolve(repo.root, evidence) : undefined;
if (evDir) {
  if (existsSync(evDir)) throw Error(`${evDir} already exists.`);
  mkdirSync(evDir, { recursive: true });
}
const scratch = mkdtempSync(join(tmpdir(), "situation-b-"));
const tracePath = join(scratch, "witness-trace.jsonl");
const w = await runGriffinWitness(0, tracePath);
const W = B.witness;
check(w.outcome.status === "success" && w.outcome.reason === "success", `outcome ${w.outcome.status} (${w.outcome.reason})`);
check(w.outcome.ticks === W.gameTicks, `${w.outcome.ticks} episode ticks (${(w.outcome.ticks / 60).toFixed(1)} game s) of ${B.limits.maxTicks}`);
check(JSON.stringify(w.outcome.decisions) === JSON.stringify(W.decisions), `decisions ${JSON.stringify(w.outcome.decisions)} of ${B.limits.maxDecisionsPerPlayer} per hero`);
check(w.outcome.invalidActions.sieg + w.outcome.invalidActions.coco === 0, "0 invalid actions");
check(w.knockouts === 0, "0 knockouts");
check(w.actionsSha256 === W.actionsSha256 && w.endHash === W.endHash, `actions ${w.actionsSha256.slice(0, 16)}, end ${w.endHash.slice(0, 16)}`);
for (const l of w.log) console.log(`    t${l.tick} ${l.note}`);

// ── Unchanged baseline ──────────────────────────────────────────────────────
console.log("\nUnchanged baseline-quest (free):");
const [bq] = await runSuite({ player: "baseline-quest", situations: [B.situation], seeds: [0], outDir: join(scratch, "baseline"), gitHash: version });
const R = B.baselineReference;
check(bq.status === R.status && bq.reason === R.reason && bq.gameTicks === R.gameTicks && bq.endHash === R.endHash && bq.startHash === B.start.hashes[0],
  `${bq.status} (${bq.reason}) at ${bq.gameSeconds} game s, decisions ${JSON.stringify(bq.decisions)}, end ${bq.endHash.slice(0, 16)}`);

// ── Plans (validated, not run) ──────────────────────────────────────────────
console.log("\nModel plans (validated only; nothing is called):");
const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
for (const [name, model] of [["pre-tuned", mock], ["post-tuned (mock)", { ...mock, guidance: "griffin-b-post-v1" }]] as const) {
  try { validatePlan({ player: "model-centralized", situations: [B.situation], seeds: [0], model }); check(true, `${name} plan valid`); }
  catch (e) { check(false, `${name}: ${(e as Error).message}`); }
}
const g = guidanceRecord("griffin-b-post-v1");
console.log(`  post-tuned guidance ${g.id}: status ${g.status}, sha256 ${g.sha256}`);
console.log("\nLive command templates (paid runs need the owner's authorization, a clean commit and the shared ledger):");
console.log(`  pre-tuned:  npm run eval:live -- --scenario ${B.situation} --seed 0 --player model-centralized --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid`);
console.log(`  post-tuned: npm run eval:live -- --scenario ${B.situation} --seed 0 --player model-centralized --guidance griffin-b-post-v1 --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid`);
console.log(`  baseline:   npm run eval:live -- --scenario ${B.situation} --seed 0 --player baseline-quest`);
console.log(`  (mock rehearsal: replace the gateway/model/effort/cap/--paid flags with --gateway mock)`);

if (evDir) {
  const trace = readFileSync(tracePath);
  writeFileSync(join(evDir, "witness-trace.jsonl.gz"), gzipSync(trace));
  writeFileSync(join(evDir, "witness-actions.json"), JSON.stringify(w.actions));
  writeFileSync(join(evDir, "initial-observations.json"), JSON.stringify(observations, null, 1));
  writeFileSync(join(evDir, "baseline-quest-summary.json"), readFileSync(join(scratch, "baseline", `${B.situation}-seed0`, "summary.json")));
  writeFileSync(join(evDir, "baseline-quest-trace.jsonl.gz"), gzipSync(readFileSync(join(scratch, "baseline", `${B.situation}-seed0`, "trace.jsonl"))));
  const summary = {
    kind: "offline certification of Situation B; not a model result and not a declared trial",
    situation: B.situation, label: B.label, definitionHash: SITUATION_GRIFFIN_B_HASH, gameVersion: version, node: process.version,
    start: { seed: 0, tick: B.start.tick, startHash: B.start.hashes[0], seed1StartHash: B.start.hashes[1], prefix: B.start.prefix, prefixActionsSha256: B.start.prefixActionsSha256, prefixActions: { sieg: w.prefixActions.sieg.length, coco: w.prefixActions.coco.length } },
    witness: {
      controller: "packages/agent/src/route/griffinWitness.ts (scripted, solution-aware certification controller; not a baseline; never shown to a model)",
      outcome: w.outcome, knockouts: w.knockouts, endHash: w.endHash, actionsSha256: w.actionsSha256, wallSeconds: Math.round(w.wallSeconds * 1000) / 1000,
      milestones: w.milestones, log: w.log,
      traceSha256: sha(trace), traceLines: w.trace.lines.length,
    },
    baseline: { player: "baseline-quest", status: bq.status, reason: bq.reason, gameTicks: bq.gameTicks, gameSeconds: bq.gameSeconds, decisions: bq.decisions, invalidActions: bq.invalidActions, startHash: bq.startHash, endHash: bq.endHash, log: bq.baselineLog ?? null },
    guidance: g,
    files: {
      "witness-trace.jsonl.gz": "hash-chained evaluator trace of the witness episode (gzip)",
      "witness-actions.json": "every action each hero submitted during the witness episode",
      "initial-observations.json": "both heroes' observation and legal actions at reset, and the prefix's actions",
      "baseline-quest-summary.json": "the unchanged baseline's summary at seed 0",
      "baseline-quest-trace.jsonl.gz": "its trace (gzip)",
    },
  };
  writeFileSync(join(evDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nEvidence written to ${evDir}`);
}
rmSync(scratch, { recursive: true, force: true });
if (problems.length) { console.error(`\n${problems.length} check(s) failed.`); process.exit(1); }
console.log("\nAll Situation B checks passed.");
