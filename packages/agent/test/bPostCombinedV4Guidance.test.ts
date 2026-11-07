// Proposed supplementary B guidance b-post-combined-v4 (docs/midterm/B_POST_TUNING_TRANSFER.md §12).
// Offline: pins text and prompts; checks the prompt is Pilot-32's base prompt plus one block,
// that scenario/observation/evaluator code is Pilot-32's, that it stays locked for paid runs,
// and that v1, v2, v3 and the old draft are unchanged. Wording checks are smoke checks only.
import { createHash } from "node:crypto";
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
import { expectRunPathPinned } from "./helpers/pinnedRunPath.js";

const ID = "b-post-combined-v4";
const RETURN = "griffin-unprepared-return-v1" as const;
type B = "griffin-unprepared-v1" | typeof RETURN;
const root = fileURLToPath(new URL("../../..", import.meta.url));
const manual = readFileSync(join(root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const gateways = () => {
  const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
  return { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
};
const planner = (id: B, text?: string) => { const s = situation(id); return new CentralPlanner(manual, gateways(), 4, s.briefing, s.tutorial, s.task, text); };
const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
const paidLike = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;

describe("B guidance candidate b-post-combined-v4 (supplementary)", () => {
  it("is frozen: text hash and both scenarios' full prompt hashes", () => {
    const t = guidance(ID).text;
    expect(guidanceHash(t)).toBe("1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34");
    expect(planner(RETURN, t).promptHash).toBe("7ff08ba84c4ab14460d0f6707febdc19b8e417ced89d3127636ce7ed9f352144");
    expect(planner("griffin-unprepared-v1", t).promptHash).toBe("473bf220c464d4fca4c7d4267c23011eb2fbcb1a5a3c2001b238fc4a6da07973");
  });

  it("differs from Pilot-32 only in the guidance block", () => {
    const t = guidance(ID).text;
    const base = planner(RETURN);
    // Pilot-32's prompt (17b89312…) was this base prompt plus v1's block.
    expect(base.promptHash).toBe("7fbaaec753d7315e998caf82c3aafe74f5e1b6289d48a320db148bfa28fcb2e0");
    expect(planner(RETURN, guidance("b-post-a-transfer-v1").text).promptHash).toBe("17b89312d88c9da0f81bdea5344c58f149a046b9a86873d166821a74f4be96a6");
    const post = planner(RETURN, t);
    expect(post.system).toBe(base.system + guidanceBlock(t));
    const schema = (p: CentralPlanner) => JSON.stringify((p as unknown as { schema: unknown }).schema);
    expect(schema(post)).toBe(schema(base));
    const s = situation(RETURN);
    expect(centralizedPolicies(manual, gateways(), 4, s.briefing, s.tutorial, s.task, t).sieg.name).toBe(`${centralizedPolicies(manual, gateways(), 4, s.briefing, s.tutorial, s.task).sieg.name}·guidance-12874542`);
    const at2791bce: Record<string, string> = {
      "packages/agent/src/perception.ts": "38cb8a2bd02d022dba502ab9394228a235966105198e8ee3b4cf00ad07535c9e",
      "packages/agent/src/environment.ts": "bb4849d3e8dae752329469965deaf6b30c19f4f594dc96b126846ec149f19756",
      "packages/agent/src/evaluator.ts": "f65ca3d9f4183de1065398fcdac969fed5eefee943fdc3374fbc758f0350cdd1",
      "packages/agent/src/suite.ts": "c9a03db108ccaadf3d6c97477ccf978a3cb2f9ba0115e0bed829fe0e1a57ec6b",
      "packages/agent/src/harness.ts": "cb23592777259f7e4408fd88000ab7a825123835e074945a1dddda426b14bbb8",
      "packages/agent/src/policies/centralized.ts": "0a0dbc31f1d8f21fb529aa8e36469d3d131d06c9c436aceccf66316f9c1a7d49",
      "packages/agent/src/policies/navigator.ts": "400915ad2e7506f6f1b19db563d13c8e45a9b788a7751c19f46fe91fd7d70824",
      "packages/agent/src/actions.ts": "8f7bc65c8c031d1442e678ac7b9fb3074b5723e447a8d121fb81054f0013c856",
      // Review round 3 (finding 6): the guidance block format, the watchdog and the rest of the run path.
      "packages/agent/src/policies/llm.ts": "5a090839c86ce68a4c7840cfbd2d94f0fa3a9729dc81500d86b3c9f30281cf9b",
      "packages/agent/src/policies/centralProgress.ts": "f46b4128907025dfd2eaac76faf759465c9792f23a26e449ea4a896f6eb0bc4b",
      "packages/agent/src/policies/navigate.ts": "7e37dca33e772fe3c636d56fcf663dfa54eb15c623ea6a1b6f21fb575817ee60",
      "packages/agent/src/policies/combat.ts": "44759b6d66c4ff1f8198f911c868843d774fdf762929ed9a499eaa2a84c2bf90",
      "packages/agent/src/policies/openai.ts": "5bd213e2d3b94811e32250296032bb2a3aa1fcb32291c5129d5df8b4c967e808",
      "packages/agent/src/budget.ts": "a5493a1b36588c3fc9081301543d41e33dfcbfe804679577d03c44d505180274",
      "packages/agent/src/heroMemory.ts": "b9587154e8e269608381886c08d24e2c6f9ef4820cea5310dc28443547f2cfff",
      "packages/agent/src/runner.ts": "29064a6958427bc20e290f6d3efd34cf405a71d9f2857520eb96c9dd4d3e0c83",
      "scripts/midterm/live.ts": "3e29f3b845b1458b7133061bd9b107431eb7b7913e4c04b89a31ae9b62464e64",
    };
    // Re-pinned with the owner's approval (2026-11-06, Situation C): checked against git history,
    // and in the working tree for every file C's registration did not touch.
    expectRunPathPinned("2791bce", at2791bce);
    // B at HEAD is unchanged: the return scenario's generic prompt (Pilot-32's base) and Pilot-33's prompt.
    expect(planner(RETURN).promptHash).toBe("7fbaaec753d7315e998caf82c3aafe74f5e1b6289d48a320db148bfa28fcb2e0");
    expect(planner(RETURN, t).promptHash).toBe("7ff08ba84c4ab14460d0f6707febdc19b8e417ced89d3127636ce7ed9f352144");
  });

  it("on griffin-unprepared-v1 too, only one block is appended and the batch size is unchanged", () => {
    const t = guidance(ID).text;
    const base = planner("griffin-unprepared-v1"), post = planner("griffin-unprepared-v1", t);
    expect(post.system).toBe(base.system + guidanceBlock(t));
    expect(post.maxBatch).toBe(base.maxBatch);
    expect(planner(RETURN, t).maxBatch).toBe(planner(RETURN).maxBatch);
  });

  it("is owner-approved for exactly this text, on the two B scenarios and (owner instruction 2026-11-06) C, never final", () => {
    const g = guidance(ID);
    expect(g.status).toBe("approved");
    expect(g.approvedSha256).toBe("1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34");
    expect(guidanceApproved(g)).toBe(true);
    expect(guidanceApproved({ ...g, text: g.text + " " })).toBe(false);
    expect(g.situations).toEqual(["griffin-unprepared-v1", RETURN, "griffin-prepared-return-v1"]);
    expect(() => validatePlan({ player: "model-centralized", situations: [RETURN], seeds: [0], model: { ...paidLike, guidance: ID } })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [RETURN], seeds: [0], model: { ...mock, guidance: ID } })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: ["S2-local"], seeds: [0], model: { ...mock, guidance: ID } })).toThrow(/limited to/);
    expect(() => validatePlan({ player: "model-centralized", situations: [RETURN], seeds: [0], final: true, model: { ...mock, guidance: ID } })).toThrow();
  });

  it("leaves v1, v2, v3 and the old draft byte for byte", () => {
    expect(guidanceHash(guidance("b-post-a-transfer-v1").text)).toBe("60a0a01357e68e2f44f0ecd9d0d0ebb41bfaab04c5c3ec78cae62c760c265263");
    expect(guidanceApproved(guidance("b-post-a-transfer-v1"))).toBe(true);
    expect(guidanceHash(guidance("b-post-combat-v2").text)).toBe("38adcbce91a2fb7df74f5fab2f780c28cdcf09ad266660ca911c8ed5b3ab80db");
    expect(guidanceHash(guidance("b-post-combined-v3").text)).toBe("c94a7bb5281c0db5630dc5af4320b98feb6291950bd965bffbdd1c2ec3886ee3");
    expect(guidanceHash(guidance("griffin-b-post-v1").text)).toBe("1c06284031aff876ca9fcf9d594bac6297b9bb636f18347266b9988cafbf3d36");
    for (const id of ["b-post-combat-v2", "b-post-combined-v3", "griffin-b-post-v1"]) expect(guidance(id).status).toBe("proposed");
  });

  it("carries the owner's five wording decisions (smoke check)", () => {
    const t = guidance(ID).text;
    expect(t).toMatch(/Give a new order only to a hero whose current plan needs to change/);
    expect(t).not.toMatch(/give each hero an order/i);
    expect(t).toMatch(/^1\. Protect both heroes first\. Before any offensive order, check each hero's health and exposure\./m);
    expect(t).toMatch(/general-purpose combat and planning guidance, based on what the heroes' screens show/);
    expect(t).not.toMatch(/not facts about any particular/);
    expect(t).toMatch(/visible attack warning/);
    expect(t).not.toMatch(/\bcharg/i); // "recharges" (ability readiness, as in the base prompt) is allowed
    expect(t).not.toMatch(/message|teammate|you are controlling a character/i);
    expect(t).not.toMatch(/\(\s*\d+\s*,\s*\d+\s*\)|\bx\s*[:=]\s*\d|\by\s*[:=]\s*\d/);
    expect(t).not.toMatch(/\b(griffin|nest|wig|beam|headbutt|mirror|shears|fireball|sword|black hole|flight|ward|guard|slow time|super speed|pillar|goddess)\b/i);
  });
});
