// Review H3: the frozen S2-S4 start states never depend on the quest-aware
// baseline's mutable knowledge. Start-state hashes are pinned; these tests
// only reset scenarios (no player acts and no outcome is inspected).
//
// Held-out policy (re-review M5): building the S4 start state is route
// development, not evaluation. It runs under explicit, labelled
// RouteDevelopmentAccess, which allows reset only at the final seeds (any
// step throws) and which runEpisode() refuses, so no player can act here.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { environmentFor, type SituationId } from "../../src/suite.js";
import * as baselineKnowledge from "../../src/policies/questKnowledge.js";
import * as routeConstants from "../../src/route/routeConstants.js";
import { routeDevelopmentAccess } from "../../src/finalAccess.js";

const ROUTE_DEV = routeDevelopmentAccess("checkpointFreeze.test.ts: pinned start-state hashes (reset only)");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src");

/**
 * Start tick and state hash of each scenario. First recorded at commit bc377ee
 * before the split. RE-PINNED with owner approval 2026-11-04 after the game
 * change ffbdecb (cow posts in the Hedge Maze, griffin 640 HP, new story
 * lines): every start carries the story's content hash, and the S4 prefix's
 * route now passes the posts through their opening (start tick 9979 -> 9963).
 * The previous values reproduce at 96625b5.
 */
const PINNED: Record<string, [number, string]> = {
  "S2/0": [221, "ec2026386b19ab503c1176a897da23492c219ffe6963610e90123db3a4f71558"],
  "S2/1": [221, "0f1bb75edaea970c8de3795f28850a5ec5e4458ad01967dd50b73597c3cd6cdd"],
  "S2/100": [221, "de7b0b78710ed9c0698e6bcc18853a4a5cbf8f92d7d88aa027e603d04af71171"],
  "S2/101": [221, "6350a405073b8efd65f0186c98f5a6a1eff4fda2035b8d9dd3e73ce7a37e96a3"],
  "S4/0": [9963, "e5361f3f51783e13c132695921428bff193e23f901538950d5196760eafa6c66"],
  "S4/1": [9963, "edb277661d49f1eb7200823a7547ec46bd85feb925c97c8202c832cef8059e3f"],
  "S4/100": [9963, "ea2dca5f9a1f5476b3bde3f9235dcf604834b08de7b618295612403de28b3d35"],
  "S4/101": [9963, "f899c7fc273e84567b2277956fe3a2278caefb76801dbac39bf9ccde4b0753fb"],
};

const start = async (key: string) => {
  const [id, seed] = key.split("/");
  const r = await environmentFor(id as SituationId, { routeDevelopment: ROUTE_DEV }).reset(Number(seed));
  return [r.tick, r.startHash] as [number, string];
};

/** Every source file a module reaches through relative imports. */
function closure(file: string, seen = new Set<string>()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const text = readFileSync(join(SRC, file), "utf8");
  // Static `from` imports, side-effect imports and dynamic imports, either quote.
  for (const m of text.matchAll(/(?:from\s+|import\s*\(?\s*)["'](\.[^"']+)["']/g)) {
    const target = normalize(join(dirname(file), m[1])).replace(/\.js$/, ".ts");
    if (!target.startsWith("..")) closure(target, seen);
  }
  return seen;
}

describe("frozen scenario checkpoints (H3)", () => {
  it("the route and suite never reach the baseline's knowledge or policy", () => {
    const reached = [...closure("suite.ts")];
    expect(reached).not.toContain("policies/questKnowledge.ts");
    expect(reached).not.toContain("policies/questBaseline.ts");
    expect(reached).toContain("route/routeConstants.ts");
  });

  it("route constants are deep-frozen and equal the values they were copied from", () => {
    for (const [name, value] of Object.entries(routeConstants)) {
      if (typeof value !== "object") continue;
      expect(Object.isFrozen(value), name).toBe(true);
      const stack: unknown[] = [value];
      while (stack.length) {
        const v = stack.pop();
        if (v && typeof v === "object") {
          expect(Object.isFrozen(v), name).toBe(true);
          stack.push(...Object.values(v));
        }
      }
    }
    expect(() => { (routeConstants.MIRROR_TARGET as number[])[0] = 0; }).toThrow();
    // Today's baseline knowledge still matches (they may diverge later without effect).
    for (const name of ["WALK_SPEED", "SHRINE", "POND_PLAN", "MIRROR", "MIRROR_TARGET", "MIRROR_REST", "PAD", "SHOT", "TO_MIRROR"] as const)
      expect(routeConstants[name], name).toEqual(baselineKnowledge[name]);
  });

  it("S2 and S4 start exactly at the pinned state hashes", async () => {
    for (const key of Object.keys(PINNED)) expect(await start(key), key).toEqual(PINNED[key]);
  }, 240_000);

  it("editing the baseline's knowledge does not move the S4 start", async () => {
    const k = baselineKnowledge as unknown as { POND_PLAN: { push?: number }[][]; MIRROR_TARGET: number[]; SHRINE: { west: { x: number } }; TO_MIRROR: { x: number }[][] };
    const saved = structuredClone({ push: k.POND_PLAN[0][0].push, target: k.MIRROR_TARGET[0], west: k.SHRINE.west.x, to: k.TO_MIRROR[0][0].x });
    try {
      k.POND_PLAN[0][0].push = 1;
      k.MIRROR_TARGET[0] = 0;
      k.SHRINE.west.x = 30;
      k.TO_MIRROR[0][0].x = 1;
      expect(await start("S4/0")).toEqual(PINNED["S4/0"]);
    } finally {
      k.POND_PLAN[0][0].push = saved.push;
      k.MIRROR_TARGET[0] = saved.target;
      k.SHRINE.west.x = saved.west;
      k.TO_MIRROR[0][0].x = saved.to;
    }
  }, 120_000);
});
