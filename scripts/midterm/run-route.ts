// Runs the scripted full-quest route (packages/agent/test/route) and writes
// evidence: summary.json, route-log.txt and a gzipped hash-chained trace.
//
//   node --import tsx scripts/midterm/run-route.ts --seed 1 --out docs/midterm/evidence/route/seed1
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { Director } from "../../packages/agent/src/route/director.js";
import { fullQuest } from "../../packages/agent/src/route/fullQuest.js";
import { TraceWriter, verifyTrace } from "../../packages/agent/src/trace.js";
import { systemPrompt } from "../../packages/agent/src/policies/llm.js";
import { routeDevelopmentAccess } from "../../packages/agent/src/finalAccess.js";

const arg = (n: string, f?: string) => {
  const i = process.argv.indexOf(n);
  return i < 0 ? f : process.argv[i + 1];
};
const seed = Number(arg("--seed", "1"));
const out = resolve(arg("--out", `evaluation-runs/route-${seed}`)!);
mkdirSync(out, { recursive: true });
const trace = new TraceWriter();
// Route development, not a player (finalAccess.ts): F is held out, so the
// route needs explicit, labelled access. At a final seed it may only reset.
const d = new Director({ trace: (e) => trace.write(e), routeDevelopment: routeDevelopmentAccess("scripts/midterm/run-route.ts: scripted route evidence") });
d.measurePrompts = true;
const started = Date.now();
let error: string | undefined;
try {
  await fullQuest(d, seed);
} catch (e) {
  error = (e as Error).message;
}
const outcome = await d.outcome();
verifyTrace(trace.lines);
const actions = { sieg: {} as Record<string, number>, coco: {} as Record<string, number> };
for (const l of trace.lines)
  if (l.type === "action" && l.player) {
    const t = (l.data as { action: { type: string } }).action.type;
    actions[l.player as "sieg" | "coco"][t] = (actions[l.player as "sieg" | "coco"][t] ?? 0) + 1;
  }
const sorted = [...d.promptChars].sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const manual = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const summary = {
  route: "packages/agent/src/route/fullQuest.ts",
  seed,
  outcome,
  ...(error ? { error } : {}),
  stages: d.log,
  endStateHash: d.env.evaluatorReport().stateHash,
  actionsByType: actions,
  promptSize: {
    note: "JSON characters of {observation, legal_actions} at each route observation; tokens are roughly characters / 3.5 to 4",
    samples: sorted.length,
    mean: Math.round(sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length)),
    p50: pct(50),
    p95: pct(95),
    max: sorted.at(-1),
    systemPromptChars: systemPrompt("Coco", manual).length,
  },
  wallSeconds: Math.round((Date.now() - started) / 100) / 10,
  traceLines: trace.lines.length,
};
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(out, "route-log.txt"), d.log.map((l) => `${String(l.tick).padStart(6)}  ${l.note}`).join("\n") + "\n");
writeFileSync(join(out, "trace.jsonl.gz"), gzipSync(trace.lines.map((l) => JSON.stringify(l)).join("\n") + "\n"));
console.log(JSON.stringify({ ...summary, stages: undefined }, null, 2));
