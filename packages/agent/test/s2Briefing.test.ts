// The owner-approved S2 episode briefing (2026-10-28, after pilot-5).
// Offline: recording gateways only, no provider request.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AgentEnvironment } from "../src/environment.js";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { policiesFor, type ModelSetup } from "../src/harness.js";
import { briefingBlock, briefingId, LLMPlayer, systemPrompt } from "../src/policies/llm.js";
import { S2_BRIEFING, situation, SITUATIONS, type SituationId } from "../src/suite.js";
import type { PlayerId } from "../src/types.js";

const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");

/** Records the system text it is sent; replies with one wait. */
class Recording implements Gateway {
  systems: string[] = [];
  constructor(readonly label: string) {}
  worstCaseUsd() {
    return 0.001;
  }
  async complete(system: string): Promise<Completion> {
    this.systems.push(system);
    return { text: '{"actions":[{"type":"wait","ticks":5}]}', tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}
const setup = (gateway: Gateway): ModelSetup => ({ gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 });

/** The system text each hero sends for scenario `id`, with player kind `kind`. */
async function systemsFor(id: SituationId, gateway: Recording, kind: "model-history" | "model-obs-only" = "model-history") {
  const policies = policiesFor(kind, new ModelBudget(defaultBudgetLimits), setup(gateway), id);
  const env = new AgentEnvironment({ preset: "milestone" });
  await env.reset(0);
  for (const pid of ["sieg", "coco"] as PlayerId[]) await policies[pid].decide({ observation: await env.observe(pid), legal: await env.legal_actions(pid) });
  return { sieg: gateway.systems[0], coco: gateway.systems[1], policies };
}

describe("S2 episode briefing", () => {
  it("is defined for S2 only", () => {
    expect(situation("S2").briefing).toBe(S2_BRIEFING);
    for (const s of SITUATIONS) if (s.id !== "S2") expect(s.briefing, s.id).toBeUndefined();
  });

  it("states exactly the second revision (after pilot-6, 2026-10-28: owner-approved content, wording pending the owner)", () => {
    expect(S2_BRIEFING).toBe(
      [
        "**Episode briefing for this evaluation (S2), the same for both players:**",
        "",
        "- This evaluation episode is Mirror Pond.",
        "- Your objective is to obtain the **Vanity Mirror** and add it to the shared quest inventory. Only the Vanity Mirror completes this episode.",
        '- Bridge Ruins is a puzzle you have already completed. Only the shrine\'s "START / RETURN · E · Puzzle Map 2" sign leads back to it. It is outside the scope of this episode: do not use that sign.',
        "- Every other area's RETURN exit leads back to the shrine. You may use those exits.",
        "- Visiting another area, such as Hedge Maze, is not a failure. You may explore it and complete its objectives before you go on to Mirror Pond, but it does not complete this episode.",
        "- The goddess's offering is the overall quest goal, not your objective in this episode.",
        "- Solve this episode with your normal observations, actions, and messages to your partner.",
      ].join("\n"),
    );
  });

  it("names the evaluator's own S2 objective, and that item exists in the game", async () => {
    const { episodes } = await import("../src/evaluator.js");
    const { items } = await import("../../shared/src/items.js");
    expect(episodes.S2.goal).toMatch(/Vanity Mirror/);
    expect(items.vanity_mirror.name).toBe("Vanity Mirror");
    expect(S2_BRIEFING).toContain("**Vanity Mirror**");
  });

  it("reveals no position, direction, item, mechanism or step", () => {
    expect(S2_BRIEFING).not.toMatch(/\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*\)/); // coordinates
    expect(S2_BRIEFING).not.toMatch(/\b(north|south|east|west|left|right|up|down)\b/i);
    // The objective item is named (owner-approved); how to get it is not.
    expect(S2_BRIEFING).not.toMatch(/mirror m\d|brazier|torch|flame|push|rotate|spike|sanctuary|culvert|flight|fireball|black hole|chest|key/i);
  });

  it("reaches both heroes in S2, identically, as a separate block after the unchanged general prompt", async () => {
    const { sieg, coco, policies } = await systemsFor("S2", new Recording("openai:test"));
    const block = briefingBlock(S2_BRIEFING);
    expect(sieg.endsWith(block)).toBe(true);
    expect(coco.endsWith(block)).toBe(true);
    expect(sieg.slice(0, -block.length)).toBe(systemPrompt("Sieg", MANUAL));
    expect(coco.slice(0, -block.length)).toBe(systemPrompt("Coco", MANUAL));
    expect(sieg.split("=== Episode briefing ===").length).toBe(2);
    for (const pid of ["sieg", "coco"] as PlayerId[]) expect(policies[pid].name).toContain(`·briefing-${briefingId(S2_BRIEFING)}`);
  });

  it("is absent from S1 and S3 (and from the general prompt everywhere)", async () => {
    for (const id of ["S1", "S3"] as const) {
      const { sieg, coco, policies } = await systemsFor(id, new Recording("openai:test"));
      expect(sieg, id).toBe(systemPrompt("Sieg", MANUAL));
      expect(coco, id).toBe(systemPrompt("Coco", MANUAL));
      expect(sieg + coco, id).not.toMatch(/Episode briefing|Bridge Ruins/);
      expect(policies.sieg.name, id).not.toContain("briefing");
    }
    expect(systemPrompt("Sieg", MANUAL)).not.toMatch(/Episode briefing|Bridge Ruins|Puzzle Map 2/);
  });

  it("is the same system text whichever provider serves the players", async () => {
    const a = await systemsFor("S2", new Recording("openai:gpt-6-luna@medium"));
    const b = await systemsFor("S2", new Recording("anthropic:claude-haiku-5-5@medium"));
    expect(a.sieg).toBe(b.sieg);
    expect(a.coco).toBe(b.coco);
  });

  it("is also given to the observation-only player, which keeps it as a fixed instruction, not memory", async () => {
    const { sieg } = await systemsFor("S2", new Recording("openai:test"), "model-obs-only");
    expect(sieg.endsWith(briefingBlock(S2_BRIEFING))).toBe(true);
  });

  it("does not affect the scripted baselines or the game", async () => {
    for (const kind of ["baseline-quest", "baseline-explore"] as const) {
      const p = policiesFor(kind, undefined, undefined, "S2");
      expect(JSON.stringify(Object.keys(p))).toBe('["sieg","coco"]');
      expect(p.sieg.name).not.toContain("briefing");
    }
    const a = new AgentEnvironment({ preset: "S2" }),
      b = new AgentEnvironment({ preset: "S2" });
    expect((await a.reset(0)).startHash).toBe((await b.reset(0)).startHash);
  });

  it("refuses an empty briefing", () => {
    const g = new MeteredGateway(new Recording("x"), new ModelBudget(defaultBudgetLimits), "sieg");
    expect(() => new LLMPlayer("Sieg", MANUAL, g, 4, "history", "  ")).toThrow(/must not be empty/);
  });
});
