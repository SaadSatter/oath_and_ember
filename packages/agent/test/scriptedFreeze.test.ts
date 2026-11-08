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

// RE-PINNED with owner approval 2026-11-04 after the game change ffbdecb
// (stone posts around the Hedge Maze cow, griffin 640 HP, new story lines).
// The story content hash moved every state hash. The route and the quest
// baseline now pass the posts through their opening at x=26.5 instead of
// x=27.5, so runs that cross the maze are 16 ticks shorter. Every status is
// unchanged. The previous values (below each entry) reproduce at 96625b5.
// Updated again the same day for 3ca9792 (the wolf runs laps of its loop
// once a hero enters it): the chase now takes longer; outcomes unchanged.
const PINNED = {
  // was 12412, 32e8611191b9c283, 9a4c1785bf28cee8 (ffbdecb alone: 12396, df4b0d238894d83a, 8e548149a1a2c416)
  "route/seed1": { status: "success", ticks: 12635, end: "9cfbb57d449a591f", digest: "189b131e132120dd" },
  // was 7e22d17e885d2cd2, a6f172d50b64d36c
  "quest/S1": { status: "success", ticks: 290, end: "3bdadd9f450227dc", digest: "c6c6def39a2062fe" },
  // was 8b2f4551ddf45c6d, 1789d50e2aa172dd
  "explore/S1": { status: "success", ticks: 323, end: "12324b18ecbb15df", digest: "8f6d4d3419922945" },
  // was 8786, 3119923352c08724, 95ba992c670b8575 (ffbdecb alone: 8770, 1069b26a745c6a8e, 18bfbbb675dff04d)
  "quest/S2": { status: "success", ticks: 8924, end: "cefc48fc0ace8907", digest: "cade2f62d72ede3e" },
  // explore/S2 and explore/S3 are one trajectory (same post-opening start; the
  // exploration baseline has no briefing): not two independent results.
  // Re-pinned 2026-10-28 (pilot-7 observation fixes; docs/midterm/PILOT7_FIXES.md)
  // and 2026-11-04 (was ba34603a00ee793d, e78c8b162f8c735b).
  "explore/S2": { status: "terminated", ticks: 6000, end: "479f4bb8fe2b2693", digest: "f14da233005710c3" },
  // was 3174, bf31311f6c56638b, a6518c4acff7a7e8 (ffbdecb alone: 3158, 22900abe990a552a, d7d795fa01a31a7d)
  "quest/S3": { status: "success", ticks: 3312, end: "6644f2cac04b9454", digest: "72c1e5ad22817fb5" },
  "explore/S3": { status: "terminated", ticks: 6000, end: "479f4bb8fe2b2693", digest: "f14da233005710c3" },
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
