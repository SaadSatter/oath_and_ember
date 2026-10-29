// The scripted route and both baselines must behave exactly as before the
// pilot-6 interface changes (review finding 3/6; owner approval 2026-10-28).
// Pinned values were recorded at 7bd0c7e, before those changes, and
// reproduced at bdfcf7c, 07c028f and after the review fixes (session 36).
// Fingerprint: each step's hero, tick and action, and every result's
// authoritative state hash; plus outcome, ticks and the end-state hash. Trace
// bytes are deliberately not pinned (new feedback fields change them).
// The route plays the whole quest through labelled route-development access,
// exactly as route/fullQuest.test.ts does; it is a feasibility and freeze
// check, not an evaluation. Baselines run on the tuning scenarios S1-S3 only.
// Never update these values to make a test pass: a change means scripted
// behaviour changed, and the owner decides.
//
// Suite revision 2 (2026-10-28) swapped S2 and S3. The pins below are the
// revision 1 trajectories and keep their keys and values unchanged: "S2" and
// "S3" here are run on the preserved revision 1 definitions S2-v1 (Mirror
// Pond) and S3-v1 (Hedge Maze). No pin exists yet for the revision 2 ids;
// adding one needs the owner's approval.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { Director } from "../src/route/director.js";
import { fullQuest } from "../src/route/fullQuest.js";
import { routeDevelopmentAccess } from "../src/finalAccess.js";
import { TraceWriter } from "../src/trace.js";
import { environmentFor } from "../src/suite.js";
import { runEpisode } from "../src/runner.js";
import { QuestBaseline } from "../src/policies/questBaseline.js";
import { ExplorationBaseline } from "../src/policies/baseline.js";

function digest(lines: { type: string; tick: number; player?: string; data: unknown }[]) {
  const h = createHash("sha256");
  for (const l of lines) {
    const d = l.data as { action?: unknown; hash?: string };
    if (l.type === "step") h.update(JSON.stringify([l.player, l.tick, d.action]));
    if (l.type === "result" && d.hash) h.update(String(d.hash));
  }
  return h.digest("hex").slice(0, 16);
}

const PINNED = {
  "route/seed1": { status: "success", ticks: 12412, end: "32e8611191b9c283", digest: "9a4c1785bf28cee8" },
  "quest/S1": { status: "success", ticks: 290, end: "7e22d17e885d2cd2", digest: "a6f172d50b64d36c" },
  "explore/S1": { status: "success", ticks: 323, end: "8b2f4551ddf45c6d", digest: "1789d50e2aa172dd" },
  "quest/S2": { status: "success", ticks: 8786, end: "3119923352c08724", digest: "95ba992c670b8575" },
  // explore/S2 and explore/S3 are one trajectory (same post-opening start; the
  // exploration baseline has no briefing): not two independent results.
  // RE-PINNED with owner approval 2026-10-28 (pilot-7 observation fixes), this
  // shared entry only. The old values (end cc9ad696c917e214, digest
  // 53edd2605b70c7ac) relied on the "East spike entrance" painted label drawing
  // "o" over the impassable wall cell (45,23); it is now drawn "#". First
  // divergence: decision 214, tick 2999. Restoring only that "o" reproduces the
  // old values. Evidence: docs/midterm/PILOT7_FIXES.md.
  "explore/S2": { status: "terminated", ticks: 6000, end: "ba34603a00ee793d", digest: "e78c8b162f8c735b" },
  "quest/S3": { status: "success", ticks: 3174, end: "bf31311f6c56638b", digest: "a6518c4acff7a7e8" },
  "explore/S3": { status: "terminated", ticks: 6000, end: "ba34603a00ee793d", digest: "e78c8b162f8c735b" },
} as const;

describe("scripted players behave exactly as before the pilot-6 interface changes", () => {
  it("the scripted route, seed 1", async () => {
    const trace = new TraceWriter();
    const d = new Director({ trace: (e) => trace.write(e), routeDevelopment: routeDevelopmentAccess("scriptedFreeze.test.ts: scripted behaviour freeze check") });
    const o = await fullQuest(d, 1);
    expect({ status: o.status, ticks: o.ticks, end: d.env.evaluatorReport().stateHash.slice(0, 16), digest: digest(trace.lines) }).toEqual(PINNED["route/seed1"]);
  }, 120_000);

  const definitions = { S1: "S1", S2: "S2-v1", S3: "S3-v1" } as const;
  for (const id of ["S1", "S2", "S3"] as const)
    for (const kind of ["quest", "explore"] as const)
      it(`the ${kind} baseline on ${id}, seed 0${id === "S1" ? "" : ` (revision 1, ${definitions[id]})`}`, async () => {
        const trace = new TraceWriter();
        const env = environmentFor(definitions[id], { trace: (e) => trace.write(e), ...(kind === "explore" ? { limits: { maxTicks: 6000 } } : {}) });
        const p = kind === "quest" ? { sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") } : { sieg: new ExplorationBaseline(), coco: new ExplorationBaseline() };
        const o = await runEpisode(env, p, trace, { seed: 0, wallClockMs: 300_000 });
        expect({ status: o.status, ticks: o.ticks, end: env.evaluatorReport().stateHash.slice(0, 16), digest: digest(trace.lines) }).toEqual(PINNED[`${kind}/${id}`]);
      }, 120_000);
});
