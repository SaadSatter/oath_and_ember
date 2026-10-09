import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { maps } from "../packages/shared/src/maps.js";
const folder = process.argv[2];
if (!folder) throw new Error("Usage: node --import tsx scripts/collision-jitter-audit.ts QA_DIRECTORY");
const totals: Record<string, { reversals: number; maxBackwardWorldUnits: number; penetrations: number }> = {};
const stages: Record<string, unknown> = {};
for (const file of readdirSync(folder).filter(f => f.endsWith(".json"))) {
  const rows = JSON.parse(readFileSync(`${folder}/${file}`, "utf8"));
  if (!Array.isArray(rows) || !rows[0]?.authoritative) continue;
  const result: typeof totals = {};
  for (const phase of ["all", "after500ms"]) for (const kind of ["authoritative", "predicted", "rendered"]) {
    const key = `${phase}:${kind}`;
    const stats = { reversals: 0, maxBackwardWorldUnits: 0, penetrations: 0 };
    for (let i = 0; i < rows.length; i++) {
      const b = rows[i], a = rows[i - 1];
      if (phase === "after500ms" && b.time - rows[0].time <= 500) continue;
      if (a) for (const axis of ["x", "y"]) {
        const back = -(b[kind][axis] - a[kind][axis]) * (b.intent?.[axis] ?? 0);
        if (back > 0.01) { stats.reversals++; stats.maxBackwardWorldUnits = Math.max(stats.maxBackwardWorldUnits, back); }
      }
      const p = b[kind];
      if (maps[b.sceneId as keyof typeof maps].walls.some(r => p.x + 13 > r.x + 1e-7 && p.x - 13 < r.x + r.w - 1e-7 && p.y + 13 > r.y + 1e-7 && p.y - 13 < r.y + r.h - 1e-7)) stats.penetrations++;
    }
    result[key] = stats;
    const t = totals[key] ??= { reversals: 0, maxBackwardWorldUnits: 0, penetrations: 0 };
    t.reversals += stats.reversals; t.penetrations += stats.penetrations; t.maxBackwardWorldUnits = Math.max(t.maxBackwardWorldUnits, stats.maxBackwardWorldUnits);
  }
  stages[file] = result;
}
writeFileSync(`${folder}/VERIFICATION.json`, JSON.stringify({ thresholds: { backwardMeasurement: 0.01, overlapMeasurement: 1e-7 }, totals, stages }, null, 2));
console.log(totals);
