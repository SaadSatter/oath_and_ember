// Model-player configurations approved on 2026-10-27: Haiku 5.5 effort
// (medium first, compared with low in the pilot) and the observation-only
// player. No network: the SDK call is replaced by a stub.
import { describe, expect, it } from "vitest";
import { AnthropicGateway, anthropicPrices, LLMPlayer, systemPrompt } from "../src/policies/llm.js";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { cutscenes } from "../../shared/src/prologue.js";
import { AgentEnvironment } from "../src/environment.js";

function stubbedGateway(effort?: "low" | "medium") {
  const prior = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  try {
    const g = effort ? new AnthropicGateway("claude-haiku-5-5", anthropicPrices["claude-haiku-5-5"], effort) : new AnthropicGateway("claude-haiku-5-5", anthropicPrices["claude-haiku-5-5"]);
    const requests: Record<string, unknown>[] = [];
    (g.client.messages as unknown as { create: unknown }).create = async (body: Record<string, unknown>) => {
      requests.push(body);
      return {
        model: "claude-haiku-5-5",
        stop_reason: "end_turn",
        content: [{ type: "text", text: '{"actions":[{"type":"wait","ticks":5}]}' }],
        usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 3000 },
      };
    };
    return { g, requests };
  } finally {
    if (prior === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prior;
  }
}

describe("Haiku 5.5 effort", () => {
  it("sends output_config.effort explicitly, medium by default, and labels the gateway with it", async () => {
    for (const [effort, expected] of [[undefined, "medium"], ["low", "low"]] as const) {
      const { g, requests } = stubbedGateway(effort);
      expect(g.label).toBe(`anthropic:claude-haiku-5-5@${expected}`);
      const c = await g.complete("system", "user", new AbortController().signal);
      expect(requests[0]).toMatchObject({ model: "claude-haiku-5-5", output_config: { effort: expected } });
      // 1000 input at $0.10/M + 3000 cache reads at 0.1x + 200 output at $0.50/M.
      expect(c.costUsd).toBeCloseTo((1000 * 0.1 + 3000 * 0.01 + 200 * 0.5) / 1e6, 12);
    }
  });
});

/** Records every prompt it is sent. */
class Recorder implements Gateway {
  readonly label = "recorder";
  prompts: { system: string; user: string }[] = [];
  constructor(private reply: string) {}
  worstCaseUsd() {
    return 0.001;
  }
  async complete(system: string, user: string): Promise<Completion> {
    this.prompts.push({ system, user });
    return { text: this.reply, tokens: { input: 10, output: 5 }, costUsd: 0.00001 };
  }
}

describe("observation-only player", () => {
  it("sends only the current observation and legal actions, and keeps no notes", async () => {
    const env = new AgentEnvironment();
    await env.reset(0);
    const budget = new ModelBudget(defaultBudgetLimits);
    const rec = new Recorder('{"notes":"remember this","actions":[{"type":"wait","ticks":5}]}');
    const p = new LLMPlayer("Sieg", "manual", new MeteredGateway(rec, budget, "sieg"), 4, "none");
    expect(p.name).toContain("obs-only");
    const input = { observation: await env.observe("sieg"), legal: await env.legal_actions("sieg") };
    await p.decide(input);
    await p.decide({ ...input, last: { accepted: true, ticks: 5, feedback: [], done: false } });
    for (const { user } of rec.prompts) expect(Object.keys(JSON.parse(user))).toEqual(["observation", "legal_actions"]);
    expect(rec.prompts[1].user).not.toContain("remember this");
    expect(rec.prompts[0].system).not.toContain('"notes"');
    expect(rec.prompts[0].system).toContain("You keep no memory between turns");
  });

  it("the history player still gets notes, recent actions and the last turn", async () => {
    const env = new AgentEnvironment();
    await env.reset(0);
    const budget = new ModelBudget(defaultBudgetLimits);
    const rec = new Recorder('{"notes":"remember this","actions":[{"type":"wait","ticks":5}]}');
    const p = new LLMPlayer("Coco", "manual", new MeteredGateway(rec, budget, "coco"));
    const input = { observation: await env.observe("coco"), legal: await env.legal_actions("coco") };
    await p.decide(input);
    await p.decide({ ...input, last: { accepted: true, ticks: 5, feedback: [], done: false } });
    const second = JSON.parse(rec.prompts[1].user);
    expect(Object.keys(second)).toEqual(["your_notes", "completed_actions", "recent_rejected_actions", "last_turn", "observation", "legal_actions"]);
    expect(second.your_notes).toBe("remember this");
    expect(systemPrompt("Coco", "m")).toContain('"notes"');
  });
});


describe("observation-only information boundary (synthetic unit fixture)", () => {
  it("passes exactly each hero's permitted observation without hidden flags, partner choices or private history", async () => {
    const env = new AgentEnvironment({ preset: "S1" });
    await env.reset(0);
    const room = (env as unknown as { room: GameRoom }).room;
    // Independent synthetic data: no existing cutscene is read or copied.
    const fixture = "phase4-unit-choice";
    cutscenes[fixture] = { id: fixture, scene: "GODDESS_SHRINE", cast: ["OATH", "EMBER"], placement: {},
      next: "GODDESS", flag: "unit-fixture-only",
      lines: [{ speaker: "NARRATION", text: "Choose your own response.", choose: true }] };
    try {
      room.state.story!.cutscene = { id: fixture, line: 0, acks: [], since: 0 };
      room.state.story!.motivations = { OATH: "PRIVATE-SIEG-CHOICE-CANARY" };
      room.state.story!.flags.push("chapter0.HIDDEN-CANARY");
      const budget = new ModelBudget(defaultBudgetLimits);
      const siegRec = new Recorder('{"notes":"SIEG-PRIVATE-NOTE","actions":[{"type":"wait","ticks":1}]}');
      const cocoRec = new Recorder('{"notes":"COCO-PRIVATE-NOTE","actions":[{"type":"wait","ticks":1}]}');
      const sieg = new LLMPlayer("Sieg", "public manual", new MeteredGateway(siegRec, budget, "sieg"), 4, "none");
      const coco = new LLMPlayer("Coco", "public manual", new MeteredGateway(cocoRec, budget, "coco"), 4, "none");
      for (const [id, player, recorder] of [["sieg", sieg, siegRec], ["coco", coco, cocoRec]] as const) {
        const observation = await env.observe(id);
        const legal = await env.legal_actions(id);
        const privateLast = { accepted: true, ticks: 0, done: false, feedback: ["PRIVATE-PREVIOUS-TURN"] };
        await player.decide({ observation, legal, last: privateLast, batch: { steps: [{ action: { type: "wait", ticks: 1 }, result: privateLast, status: "executed" }], skipped: [] } });
        await player.decide({ observation, legal });
        for (const prompt of recorder.prompts) {
          expect(JSON.parse(prompt.user)).toEqual({ observation, legal_actions: legal });
          const text = prompt.system + prompt.user;
          for (const forbidden of ["PRIVATE-SIEG-CHOICE-CANARY", "HIDDEN-CANARY", "PRIVATE-PREVIOUS-TURN", "SIEG-PRIVATE-NOTE", "COCO-PRIVATE-NOTE", ...Object.keys(room.state.players)])
            expect(text).not.toContain(forbidden);
        }
      }
      const cocoview = JSON.parse(cocoRec.prompts[0].user).observation;
      expect(cocoview.dialogue.choices.length).toBeGreaterThan(0);
      const siegview = JSON.parse(siegRec.prompts[0].user).observation;
      expect(siegview.dialogue.choices).toBeUndefined();
      expect(cocoview.hero).toBe("Coco");
      expect(siegview.hero).toBe("Sieg");
    } finally { delete cutscenes[fixture]; }
  });
});
