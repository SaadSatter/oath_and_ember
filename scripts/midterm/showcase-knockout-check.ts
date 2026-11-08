// Free check: does play continue after a real knockout in the showcase?
// (docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md). Certification probe only; no
// model call, no spending, nothing here is a showcase result.
//
//   node --import tsx scripts/midterm/showcase-knockout-check.ts [--evidence <dir>]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runShowcaseKnockoutProbe } from "../../packages/agent/src/route/showcaseKnockoutProbe.js";
import { repoInfo } from "../../packages/agent/src/repo.js";

const i = process.argv.indexOf("--evidence");
const dir = i >= 0 ? resolve(process.argv[i + 1]) : undefined;
if (dir) mkdirSync(dir, { recursive: true });
const repo = repoInfo();
const r = await runShowcaseKnockoutProbe(0, dir ? join(dir, "trace.jsonl") : undefined);
const out = { kind: "certification probe (not a player, not a result)", gitHead: repo.head.slice(0, 7) + (repo.dirty ? "+dirty" : ""), ...r };
console.log(JSON.stringify(out, null, 2));
if (dir) writeFileSync(join(dir, "knockout-check.json"), JSON.stringify(out, null, 2) + "\n");
