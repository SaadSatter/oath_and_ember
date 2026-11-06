// Extracts the Black Hole casts of a model run into a small test fixture:
// for each cast, the caster's own observation just before it (screen, visible
// things, position), the direction chosen, the first vortex position any
// hero's screen showed afterwards, and the cow's drawn position before and
// after (from the screens). Observation data only; nothing from the engine.
//
//   node --import tsx scripts/midterm/extract-black-hole-casts.ts <trace.jsonl> <out.json>

import { readFileSync, writeFileSync } from "node:fs";
import type { Observation } from "../../packages/agent/src/types.ts";

const [tracePath, out] = process.argv.slice(2);
if (!tracePath || !out) {
  console.error("usage: extract-black-hole-casts.ts <trace.jsonl> <out.json>");
  process.exit(2);
}
type Line = { type: string; tick: number; player?: string; data: Record<string, unknown> };
const lines = readFileSync(tracePath, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Line);
const cowAt = (o: Observation) => o.visible.find((v) => v.kind === "creature" && /cow/i.test(v.name));
const last: Record<string, Observation> = {};
const casts: unknown[] = [];
lines.forEach((l, i) => {
  if (l.type === "observation") last[l.player!] = (l.data as { observation: Observation }).observation;
  if (l.type !== "step" || (l.data as { action: { type: string; ability?: string } }).action.ability !== "black_hole") return;
  const action = (l.data as { action: { direction?: string } }).action;
  const before = last[l.player!];
  let vortex: { x: number; y: number; seenBy: string; tick: number } | null = null;
  let cowAfter: { x: number; y: number; tick: number } | null = null;
  for (const m of lines.slice(i + 1)) {
    if (m.type !== "observation" || m.tick > l.tick + 360) continue;
    const o = (m.data as { observation: Observation }).observation;
    const v = o.visible.find((x) => x.kind === "effect" && x.name === "black hole" && x.details === "vortex");
    if (v && !vortex) vortex = { x: v.x, y: v.y, seenBy: m.player!, tick: m.tick };
    const c = cowAt(o);
    if (c) cowAfter = { x: c.x, y: c.y, tick: m.tick };
  }
  const c = cowAt(before);
  casts.push({ tick: l.tick, hero: l.player, direction: action.direction ?? null, observation: before, cowBefore: c ? { x: c.x, y: c.y, extent: c.extent } : null, vortex, cowAfter });
});
writeFileSync(out, JSON.stringify({ source: tracePath.split("/").slice(-3).join("/"), note: "Black Hole casts from a model run: caster observation before each cast, first vortex seen afterwards, cow drawn position before and after (observation data only).", casts }, null, 1));
console.log(`${casts.length} casts written to ${out}`);
