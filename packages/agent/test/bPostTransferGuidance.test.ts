// Situation B post-tuned candidate: guidance b-post-a-transfer-v1
// (docs/midterm/B_POST_TUNING_TRANSFER.md). Free and offline: the planner is
// built against the mock gateway and never called. These pins freeze the text
// and the full planner prompt, and check that only the prompt changes.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { situation } from "../src/suite.js";
import { validatePlan, type ModelSetup } from "../src/harness.js";
import { CentralPlanner, CENTRAL_ID, centralizedPolicies } from "../src/policies/centralized.js";
import { guidance, guidanceApproved, guidanceBlock, guidanceHash, SITUATION_GUIDANCE } from "../src/policies/situationGuidance.js";
import { ModelBudget, MeteredGateway } from "../src/budget.js";
import { MockGateway } from "../src/policies/mockGateway.js";

const ID = "b-post-a-transfer-v1";
const B = "griffin-unprepared-v1" as const;
const RETURN = "griffin-unprepared-return-v1" as const;
const root = fileURLToPath(new URL("../../..", import.meta.url));
const manual = readFileSync(join(root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const gateways = () => {
  const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
  return { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
};
const planner = (text?: string) => {
  const b = situation(B);
  return new CentralPlanner(manual, gateways(), 4, b.briefing, b.tutorial, undefined, text);
};
const fileSha = (rel: string) => createHash("sha256").update(readFileSync(join(root, rel))).digest("hex");

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
    // Same tuning constants as Pilot-30/31 (CENTRAL_ID hashes constants only, not code; see the file pins below).
    expect(CENTRAL_ID).toBe("f0592888");
    // Everything else the planner is built from is equal (review round 1, missing coverage).
    const fields = (p: CentralPlanner) => { const r = p as unknown as Record<string, unknown>; return JSON.stringify({ schema: r.schema, maxBatch: p.maxBatch, briefing: p.briefing, tutorial: p.tutorial, task: p.task }); };
    expect(fields(post)).toBe(fields(pre));
    const b = situation(B);
    const preNames = centralizedPolicies(manual, gateways(), 4, b.briefing, b.tutorial);
    const postNames = centralizedPolicies(manual, gateways(), 4, b.briefing, b.tutorial, undefined, guidance(ID).text);
    for (const h of ["sieg", "coco"] as const) expect(postNames[h].name).toBe(`${preNames[h].name}·guidance-60a0a013`);
  });

  it("planner, controller and runner code is byte-identical to Pilot-31's commit 6df4bc0", () => {
    // SHA-256 of each file at 6df4bc0 (git show 6df4bc0:<file> | shasum -a 256).
    const atPilot31: Record<string, string> = {
      "packages/agent/src/policies/centralized.ts": "0a0dbc31f1d8f21fb529aa8e36469d3d131d06c9c436aceccf66316f9c1a7d49",
      "packages/agent/src/policies/navigator.ts": "400915ad2e7506f6f1b19db563d13c8e45a9b788a7751c19f46fe91fd7d70824",
      "packages/agent/src/policies/navigate.ts": "7e37dca33e772fe3c636d56fcf663dfa54eb15c623ea6a1b6f21fb575817ee60",
      "packages/agent/src/policies/combat.ts": "44759b6d66c4ff1f8198f911c868843d774fdf762929ed9a499eaa2a84c2bf90",
      "packages/agent/src/policies/llm.ts": "5a090839c86ce68a4c7840cfbd2d94f0fa3a9729dc81500d86b3c9f30281cf9b",
      "packages/agent/src/policies/pullPreview.ts": "306a815fe9439e318b40e1e5a2ff6cec0f0c32199af65f967ef40bbca69335ee",
      "packages/agent/src/policies/centralProgress.ts": "f46b4128907025dfd2eaac76faf759465c9792f23a26e449ea4a896f6eb0bc4b",
      "packages/agent/src/policies/openai.ts": "5bd213e2d3b94811e32250296032bb2a3aa1fcb32291c5129d5df8b4c967e808",
      "packages/agent/src/policies/policy.ts": "6dc72070897db606d320ca91e406464dacb8a2d12225928cdae27ef26caf89da",
      "packages/agent/src/policies/providers.ts": "a002b081768c588f32aafcf3cd06e1d4207fb63990627fd0fdbf117d60594d58",
      "packages/agent/src/budget.ts": "a5493a1b36588c3fc9081301543d41e33dfcbfe804679577d03c44d505180274",
      "packages/agent/src/heroMemory.ts": "b9587154e8e269608381886c08d24e2c6f9ef4820cea5310dc28443547f2cfff",
      "packages/agent/src/actions.ts": "8f7bc65c8c031d1442e678ac7b9fb3074b5723e447a8d121fb81054f0013c856",
      "packages/agent/src/runner.ts": "29064a6958427bc20e290f6d3efd34cf405a71d9f2857520eb96c9dd4d3e0c83",
    };
    for (const [file, sha] of Object.entries(atPilot31)) expect(fileSha(file), file).toBe(sha);
    // The old, locked draft is untouched.
    expect(guidanceHash(guidance("griffin-b-post-v1").text)).toBe("1c06284031aff876ca9fcf9d594bac6297b9bb636f18347266b9988cafbf3d36");
  });

  it("is owner-approved for exactly this text, on the two B scenarios only", () => {
    const g = SITUATION_GUIDANCE[ID];
    expect(g.situations).toEqual([B, RETURN]);
    expect(g.status).toBe("approved");
    expect(g.approvedSha256).toBe("60a0a01357e68e2f44f0ecd9d0d0ebb41bfaab04c5c3ec78cae62c760c265263");
    expect(guidanceApproved(g)).toBe(true);
    // Editing even one character re-locks it for paid runs.
    expect(guidanceApproved({ ...g, text: g.text + " " })).toBe(false);
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
    const paidLike = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    for (const id of [B, RETURN]) {
      expect(() => validatePlan({ player: "model-centralized", situations: [id], seeds: [0], model: { ...mock, guidance: ID } })).not.toThrow();
      expect(() => validatePlan({ player: "model-centralized", situations: [id], seeds: [0], model: { ...paidLike, guidance: ID } })).not.toThrow();
    }
    expect(() => validatePlan({ player: "model-centralized", situations: ["S2-local"], seeds: [0], model: { ...mock, guidance: ID } })).toThrow(/limited to/);
    expect(() => validatePlan({ player: "model-centralized", situations: [RETURN], seeds: [0], final: true, model: { ...paidLike, guidance: ID } })).toThrow();
    expect(() => validatePlan({ player: "model-memory", situations: [RETURN], seeds: [0], model: { ...mock, guidance: ID } })).toThrow();
  });

  it("on the return scenario (declaration r8), the post-tuned prompt is that scenario's generic prompt plus the same block", () => {
    const r = situation(RETURN);
    // The return scenario has its own task line and no tutorial or briefing (unlike griffin-unprepared-v1).
    expect(r.briefing).toBeUndefined();
    expect(r.tutorial).toBeUndefined();
    const pre = new CentralPlanner(manual, gateways(), 4, r.briefing, r.tutorial, r.task);
    const post = new CentralPlanner(manual, gateways(), 4, r.briefing, r.tutorial, r.task, guidance(ID).text);
    expect(post.system).toBe(pre.system + guidanceBlock(guidance(ID).text));
    expect(pre.promptHash).toBe("7fbaaec753d7315e998caf82c3aafe74f5e1b6289d48a320db148bfa28fcb2e0");
    expect(post.promptHash).toBe("17b89312d88c9da0f81bdea5344c58f149a046b9a86873d166821a74f4be96a6");
    expect(centralizedPolicies(manual, gateways(), 4, r.briefing, r.tutorial, r.task, guidance(ID).text).sieg.name).toMatch(/^centralized-f0592888\(.+\)·batch4·task-cdbee612·guidance-60a0a013$/);
  });

  // A smoke check only (review finding 7): it cannot catch a mechanic described in generic words.
  it("names no coordinates or Griffin, puzzle, item or ability names", () => {
    const t = guidance(ID).text;
    expect(t).not.toMatch(/\d/);
    expect(t).not.toMatch(/griffin|nest|wig|beam|headbutt|charge|mirror|shears|fireball|sword|black hole|flight|ward|guard|slow time|super speed|pillar|cow|wolf|hedge|gate|key/i);
  });
});
