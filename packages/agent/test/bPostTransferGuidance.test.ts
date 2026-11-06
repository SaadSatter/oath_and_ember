// Situation B post-tuned candidate: guidance b-post-a-transfer-v1
// (docs/midterm/B_POST_TUNING_TRANSFER.md). Free and offline: the planner is
// built against the mock gateway and never called. These pins freeze the text
// and the full planner prompt, and check that only the prompt changes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { situation } from "../src/suite.js";
import { validatePlan, type ModelSetup } from "../src/harness.js";
import { CentralPlanner, CENTRAL_ID } from "../src/policies/centralized.js";
import { guidance, guidanceApproved, guidanceBlock, guidanceHash, SITUATION_GUIDANCE } from "../src/policies/situationGuidance.js";
import { ModelBudget, MeteredGateway } from "../src/budget.js";
import { MockGateway } from "../src/policies/mockGateway.js";

const ID = "b-post-a-transfer-v1";
const B = "griffin-unprepared-v1" as const;
const root = fileURLToPath(new URL("../../..", import.meta.url));
const manual = readFileSync(join(root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const planner = (text?: string) => {
  const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
  const m = { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
  const b = situation(B);
  return new CentralPlanner(manual, m, 4, b.briefing, b.tutorial, undefined, text);
};

describe("B post-tuned guidance b-post-a-transfer-v1", () => {
  it("is frozen: text hash and the full post-tuned planner prompt hash are pinned", () => {
    const g = guidance(ID);
    expect(guidanceHash(g.text)).toBe("60a0a01357e68e2f44f0ecd9d0d0ebb41bfaab04c5c3ec78cae62c760c265263");
    expect(planner(g.text).promptHash).toBe("54605c1b010826448627189d92fc8dfedc9f853b14d45fe5ad21260ce21e5627");
  });

  it("changes only the prompt: Pilot-31's pre-tuned prompt plus one guidance block, same controller", () => {
    const pre = planner();
    const post = planner(guidance(ID).text);
    // Pilot-31 (B pre-tuned) recorded this prompt hash for both heroes.
    expect(pre.promptHash).toBe("cbabb78b42b1227bafff0ef9e95b62ad5e03ba725691482e2e032384097bbb6a");
    expect(post.system).toBe(pre.system + guidanceBlock(guidance(ID).text));
    // Same controller as Pilot-30/31.
    expect(CENTRAL_ID).toBe("f0592888");
  });

  it("is limited to the pre-tuned run's scenario and stays locked for paid runs until the owner approves its hash", () => {
    const g = SITUATION_GUIDANCE[ID];
    expect(g.situations).toEqual([B]);
    expect(g.status).toBe("proposed");
    expect(guidanceApproved(g)).toBe(false);
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
    const paidLike = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    expect(() => validatePlan({ player: "model-centralized", situations: [B], seeds: [0], model: { ...mock, guidance: ID } })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [B], seeds: [0], model: { ...paidLike, guidance: ID } })).toThrow(/proposed, not approved/);
    expect(() => validatePlan({ player: "model-centralized", situations: ["S2-local"], seeds: [0], model: { ...mock, guidance: ID } })).toThrow(/limited to/);
    expect(() => validatePlan({ player: "model-centralized", situations: ["griffin-unprepared-return-v1"], seeds: [0], model: { ...mock, guidance: ID } })).toThrow(/limited to|restricted to/);
  });

  it("names no coordinates, Griffin-specific mechanics, items or attacks", () => {
    const t = guidance(ID).text;
    expect(t).not.toMatch(/\d/);
    expect(t).not.toMatch(/griffin|nest|wig|beam|headbutt|charge|mirror|shears|fireball|sword|black hole|flight|ward|guard|slow time|super speed|pillar|cow|wolf|hedge|gate|key/i);
  });
});
