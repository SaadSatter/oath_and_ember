// Owner-approved showcase guidance v2 (docs/midterm/SHOWCASE_PROMPT_V2_PROPOSAL.md).
// Offline: no model call, no network, no spending. Checks that the draft is
// approved at its exact hash and the paid scope, scoped to the showcase, carries no health-preservation
// advice (owner decision 2026-11-07), leaves v1 and v4 unchanged, and names no
// coordinate, waypoint or maze answer.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { situation } from "../src/suite.js";
import { validatePlan, type ModelSetup } from "../src/harness.js";
import { SHOWCASE_GUIDANCE_ID, SHOWCASE_ID } from "../src/showcase.js";
import { CentralPlanner } from "../src/policies/centralized.js";
import { guidance, guidanceApproved, guidanceBlock, guidanceHash, SHOWCASE_PHASE_PLAN, SHOWCASE_PHASE_PLAN_V2 } from "../src/policies/situationGuidance.js";
import { ModelBudget, MeteredGateway } from "../src/budget.js";
import { MockGateway } from "../src/policies/mockGateway.js";

const ID = "showcase-maze-griffin-v2";
const root = fileURLToPath(new URL("../../..", import.meta.url));
const manual = readFileSync(join(root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const gateways = () => {
  const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
  return { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
};

describe("showcase guidance v2 (approved)", () => {
  it("is approved at its exact hash, scoped to the showcase, phase plan only, and leaves v1 and v4 unchanged", () => {
    const g = guidance(ID);
    expect(g.status).toBe("approved");
    expect(guidanceApproved(g)).toBe(true);
    expect(guidanceHash(g.text)).toBe("364acf1a96ca45899d91f3e35f142d21a32ab91a406e745e57def868a8128664");
    expect(SHOWCASE_GUIDANCE_ID).toBe(ID);
    expect(g.situations).toEqual([SHOWCASE_ID]);
    const v4 = guidance("b-post-combined-v4").text;
    expect(guidanceHash(v4)).toBe("1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34");
    expect(g.text).toBe(SHOWCASE_PHASE_PLAN_V2);
    expect(g.text).not.toContain(v4);
    // The approved v1 text is untouched.
    expect(guidanceHash(guidance("showcase-maze-griffin-v1").text)).toBe("ea5d75ba9b74a4c72ac60f0b2f35aaa8e991c5e767737a34fc14b871a355d320");
  });

  it("names no coordinates, waypoints or puzzle answers, and forbids the peaceful route", () => {
    const t = SHOWCASE_PHASE_PLAN_V2;
    expect(t).not.toMatch(/\d+(\.\d+)?\s*,\s*\d+/);
    expect(t).not.toMatch(/\btile\b|\bx\s*=|\by\s*=/i);
    expect(t).not.toMatch(/cow|wolf|hedge is|burn|black hole|key/i);
    expect(t).not.toMatch(/mirror|groom/i);
    expect(t).toMatch(/do not go to its nest or use any backpack item there/);
    expect(t).toMatch(/Phase 0[\s\S]*Phase 1[\s\S]*Phase 2[\s\S]*Phase 3[\s\S]*Phase 4/);
    expect(t).not.toMatch(/knockout ends the episode/i);
  });

  it("makes only the intended changes from v1", () => {
    const v1 = SHOWCASE_PHASE_PLAN.split("\n\n");
    const v2 = SHOWCASE_PHASE_PLAN_V2.split("\n\n");
    // Positioning, Phase 0 and Phase 4 paragraphs are byte-identical.
    expect(v2).toHaveLength(8);
    for (const i of [2, 3, 7]) expect(v2[i]).toBe(v1[i]);
    // Health is inconsequential in every phase; the manual's knockout rule is restated.
    expect(v2[1]).toMatch(/Health does not matter in this demonstration, in any phase, including the Griffin fight/);
    expect(v2[1]).toMatch(/full health/);
    // No health-preservation advice anywhere.
    expect(SHOWCASE_PHASE_PLAN_V2).not.toMatch(/preserve health|health is scarce|safer role|healthier hero|low health|fight defensively|protect both/i);
  });

  it("is the paid scope's guidance; v1 is no longer admitted for paid runs; frozen scenarios refuse it", () => {
    const paid = (guidance: string) => ({ gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot", maxBatch: 4, guidance }) as unknown as ModelSetup;
    expect(() => validatePlan({ player: "model-centralized", situations: [SHOWCASE_ID], seeds: [0], model: paid(ID) })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [SHOWCASE_ID], seeds: [0], model: paid("showcase-maze-griffin-v1") })).toThrow();
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot", guidance: ID } as unknown as ModelSetup;
    expect(() => validatePlan({ player: "model-centralized", situations: [SHOWCASE_ID], seeds: [0], model: mock })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: ["S2-local"], seeds: [0], model: mock })).toThrow(/limited to/);
  });

  it("gives the planner the generic prompt plus exactly one guidance block", () => {
    const s = situation(SHOWCASE_ID);
    const base = new CentralPlanner(manual, gateways(), 4, s.briefing, s.tutorial, s.task);
    const post = new CentralPlanner(manual, gateways(), 4, s.briefing, s.tutorial, s.task, guidance(ID).text);
    expect(post.system).toBe(base.system + guidanceBlock(guidance(ID).text));
  });
});
