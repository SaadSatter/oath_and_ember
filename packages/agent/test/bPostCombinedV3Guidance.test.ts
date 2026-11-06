// Proposed B guidance b-post-combined-v3 (docs/midterm/B_POST_TUNING_TRANSFER.md §10).
// Offline: pins text and prompts, checks it is appended only, stays locked for
// paid runs, and leaves v1 and v2 unchanged. Wording checks are smoke checks;
// the independent review is the real check for leakage.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { situation } from "../src/suite.js";
import { validatePlan, type ModelSetup } from "../src/harness.js";
import { CentralPlanner, centralizedPolicies } from "../src/policies/centralized.js";
import { guidance, guidanceApproved, guidanceBlock, guidanceHash } from "../src/policies/situationGuidance.js";
import { ModelBudget, MeteredGateway } from "../src/budget.js";
import { MockGateway } from "../src/policies/mockGateway.js";

const ID = "b-post-combined-v3";
type B = "griffin-unprepared-v1" | "griffin-unprepared-return-v1";
const root = fileURLToPath(new URL("../../..", import.meta.url));
const manual = readFileSync(join(root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const gateways = () => {
  const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
  return { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
};
const planner = (id: B, text?: string) => { const s = situation(id); return new CentralPlanner(manual, gateways(), 4, s.briefing, s.tutorial, s.task, text); };

describe("B guidance candidate b-post-combined-v3", () => {
  it("is frozen: text hash and both scenarios' full prompt hashes", () => {
    const t = guidance(ID).text;
    expect(guidanceHash(t)).toBe("c94a7bb5281c0db5630dc5af4320b98feb6291950bd965bffbdd1c2ec3886ee3");
    expect(planner("griffin-unprepared-return-v1", t).promptHash).toBe("42cfa29a803bbf056bf9a39f52b9d81cff27c44d82be2e138a297c2283351487");
    expect(planner("griffin-unprepared-v1", t).promptHash).toBe("9927327ee87ca46784ad41fa05f08b8e4afb7c5eb955b815bdcd3da0b821a2d4");
  });

  it("only appends one block: same base prompt, schema, batch and policy name apart from the guidance id", () => {
    const t = guidance(ID).text;
    for (const id of ["griffin-unprepared-v1", "griffin-unprepared-return-v1"] as const) {
      const pre = planner(id), post = planner(id, t);
      expect(post.system).toBe(pre.system + guidanceBlock(t));
      const r = (p: CentralPlanner) => JSON.stringify((p as unknown as { schema: unknown }).schema);
      expect(r(post)).toBe(r(pre));
      expect(post.maxBatch).toBe(pre.maxBatch);
      const s = situation(id);
      const a = centralizedPolicies(manual, gateways(), 4, s.briefing, s.tutorial, s.task);
      const b = centralizedPolicies(manual, gateways(), 4, s.briefing, s.tutorial, s.task, t);
      expect(b.sieg.name).toBe(`${a.sieg.name}·guidance-c94a7bb5`);
    }
  });

  it("stays locked for paid runs; v1 and v2 are unchanged", () => {
    const g = guidance(ID);
    expect(g.status).toBe("proposed");
    expect(guidanceApproved(g)).toBe(false);
    const paidLike = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
    expect(() => validatePlan({ player: "model-centralized", situations: ["griffin-unprepared-return-v1"], seeds: [0], model: { ...paidLike, guidance: ID } })).toThrow(/proposed, not approved/);
    expect(() => validatePlan({ player: "model-centralized", situations: ["griffin-unprepared-return-v1"], seeds: [0], model: { ...mock, guidance: ID } })).not.toThrow();
    expect(guidanceHash(guidance("b-post-a-transfer-v1").text)).toBe("60a0a01357e68e2f44f0ecd9d0d0ebb41bfaab04c5c3ec78cae62c760c265263");
    expect(guidanceApproved(guidance("b-post-a-transfer-v1"))).toBe(true);
    expect(guidanceHash(guidance("b-post-combat-v2").text)).toBe("38adcbce91a2fb7df74f5fab2f780c28cdcf09ad266660ca911c8ed5b3ab80db");
    expect(guidance("b-post-combat-v2").status).toBe("proposed");
  });

  it("addresses one planner for both heroes, with no messaging and no named game specifics (smoke check)", () => {
    const t = guidance(ID).text;
    expect(t).toMatch(/both heroes/);
    expect(t).not.toMatch(/message|teammate|you are controlling a character/i);
    expect(t).not.toMatch(/\b(griffin|nest|wig|beam|headbutt|mirror|shears|fireball|sword|black hole|flight|ward|guard|slow time|super speed|pillar|goddess)\b/i);
    expect(t).not.toMatch(/\(\s*\d+\s*,\s*\d+\s*\)|\bx\s*[:=]\s*\d|\by\s*[:=]\s*\d/);
  });
});
