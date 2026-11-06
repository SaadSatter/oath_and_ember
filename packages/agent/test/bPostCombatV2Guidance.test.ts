// Owner-authored B guidance candidate b-post-combat-v2 (docs/midterm/B_POST_TUNING_TRANSFER.md §9).
// Offline: pins the verbatim text and prompts, and checks it stays locked for paid runs until approved.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { situation } from "../src/suite.js";
import { validatePlan, type ModelSetup } from "../src/harness.js";
import { CentralPlanner } from "../src/policies/centralized.js";
import { guidance, guidanceApproved, guidanceBlock, guidanceHash } from "../src/policies/situationGuidance.js";
import { ModelBudget, MeteredGateway } from "../src/budget.js";
import { MockGateway } from "../src/policies/mockGateway.js";

const ID = "b-post-combat-v2";
const root = fileURLToPath(new URL("../../..", import.meta.url));
const manual = readFileSync(join(root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const planner = (id: "griffin-unprepared-v1" | "griffin-unprepared-return-v1", text?: string) => {
  const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
  const g = { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
  const s = situation(id);
  return new CentralPlanner(manual, g, 4, s.briefing, s.tutorial, s.task, text);
};

describe("B guidance candidate b-post-combat-v2", () => {
  it("is frozen: verbatim text hash and both scenarios' full prompt hashes", () => {
    const t = guidance(ID).text;
    expect(guidanceHash(t)).toBe("38adcbce91a2fb7df74f5fab2f780c28cdcf09ad266660ca911c8ed5b3ab80db");
    expect(planner("griffin-unprepared-return-v1", t).promptHash).toBe("f8008bf17a00f1eda196ac782006245d272b8336f6d544d2f4f462bf007e2216");
    expect(planner("griffin-unprepared-v1", t).promptHash).toBe("af944697b98e159cc8d064e88eb6b2b67064a4b0e2c791440bcaef8997fb4262");
    for (const id of ["griffin-unprepared-v1", "griffin-unprepared-return-v1"] as const)
      expect(planner(id, t).system).toBe(planner(id).system + guidanceBlock(t));
  });

  it("stays locked for paid runs; v1 stays approved and unchanged", () => {
    const g = guidance(ID);
    expect(g.status).toBe("proposed");
    expect(guidanceApproved(g)).toBe(false);
    const paidLike = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
    expect(() => validatePlan({ player: "model-centralized", situations: ["griffin-unprepared-return-v1"], seeds: [0], model: { ...paidLike, guidance: ID } })).toThrow(/proposed, not approved/);
    expect(() => validatePlan({ player: "model-centralized", situations: ["griffin-unprepared-return-v1"], seeds: [0], model: { ...mock, guidance: ID } })).not.toThrow();
    expect(guidanceHash(guidance("b-post-a-transfer-v1").text)).toBe("60a0a01357e68e2f44f0ecd9d0d0ebb41bfaab04c5c3ec78cae62c760c265263");
    expect(guidanceApproved(guidance("b-post-a-transfer-v1"))).toBe(true);
  });
});
