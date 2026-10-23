// Minimal harness: the eight steps from the Session 1 brief, in order.
//   node --import tsx scripts/midterm/smoke.ts [--seed 7] [--out dir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AgentEnvironment } from "../../packages/agent/src/environment.js";
import { TraceWriter, verifyTrace } from "../../packages/agent/src/trace.js";
import type { GameAction, PlayerId } from "../../packages/agent/src/types.js";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const seed = Number(arg("--seed", "7"));
const out = resolve(arg("--out", `evaluation-runs/smoke-${seed}-${Date.now()}`));
mkdirSync(out, { recursive: true });
const trace = new TraceWriter(join(out, "trace.jsonl"));
const env = new AgentEnvironment({ preset: "milestone", trace: (e) => trace.write(e) });

// 1. reset
const state = await env.reset(seed);
// 2. observe both heroes
const before = { sieg: await env.observe("sieg"), coco: await env.observe("coco") };
// 3. legal actions for each
const legal = { sieg: await env.legal_actions("sieg"), coco: await env.legal_actions("coco") };
for (const id of ["sieg", "coco"] as PlayerId[])
  trace.write({ type: "observation", tick: before[id].tick, player: id, data: { observation: before[id], legal: legal[id] } });
// 4–5. one valid movement action each; both run on the shared clock.
const chosen: Record<PlayerId, GameAction> = {
  sieg: { type: "move", direction: "n", ticks: 30 },
  coco: { type: "move", direction: "n", ticks: 30 },
};
const startTick = before.sieg.tick;
const results = await Promise.all([env.step("sieg", chosen.sieg), env.step("coco", chosen.coco)]);
// 6. observe again
const after = { sieg: await env.observe("sieg"), coco: await env.observe("coco") };
// 7. outcome
const outcome = await env.outcome();
for (const id of ["sieg", "coco"] as PlayerId[])
  trace.write({ type: "observation", tick: after[id].tick, player: id, data: { observation: after[id] } });
trace.write({ type: "outcome", tick: outcome.ticks, data: outcome });
// 8. save the trace (written as we went) and a summary
verifyTrace(trace.lines);
const summary = {
  state,
  chosen,
  results: { sieg: results[0], coco: results[1] },
  ticksAdvanced: after.sieg.tick - startTick,
  positions: {
    sieg: [before.sieg.self, after.sieg.self].map((s) => [s.x, s.y]),
    coco: [before.coco.self, after.coco.self].map((s) => [s.x, s.y]),
  },
  outcome,
};
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`trace: ${join(out, "trace.jsonl")} (${trace.lines.length} lines, hash chain verified)`);
