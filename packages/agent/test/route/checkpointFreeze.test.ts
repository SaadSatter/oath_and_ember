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

/** Start tick and state hash of each scenario, recorded at commit bc377ee before the split. */
const PINNED: Record<string, [number, string]> = {
  "S2/0": [221, "5397eba5c68d4770bf41e742e5ae9474a256a30f9ddd4149a6bf35592bc2c9ab"],
  "S2/1": [221, "d109db6679d708103648fedd33562a17dc05f6e37b83b19af70374411c3dbb57"],
  "S2/100": [221, "6028e2a9c8c836b6ab05e1cf3e3ad835fd488158f5a1edf633cab7802e91657b"],
  "S2/101": [221, "97682f9b462b2b45b833d9f3d81d6db39f2599257d3a4db3009e3a0aabb69221"],
  "S4/0": [9979, "0a07acef49819dff992bc2575850c8943df4943471f3f022e7ebdb6713c2fcf3"],
  "S4/1": [9979, "3eac7f228479e7df2f3636c2458452f0f083381075a97e9a5f57cdad6aaafc93"],
  "S4/100": [9979, "325e9ee5195bbe50279cc90c91f19aa69e808a0d12814df637e85acabcf9f162"],
  "S4/101": [9979, "3cc6250f22230b7f35f66d075b155fa6a29f0d2da210da8a96e6e87e1566fe1d"],
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
