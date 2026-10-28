// Agent-interface reliability pass (owner approval 2026-10-27, after the
// first real-LLM S1 run at 4193424): action-history semantics, reply
// handling, per-hero dialogue history, prompt clarity, separate metrics and
// shared-dialogue guidance. Everything here is offline; no provider is called.
//
// Some tests set a SYNTHETIC cutscene directly on the room (a labelled unit
// fixture, as in modelPlayers.test.ts). It is invented text, not game
// content, and is removed afterwards. No evaluation result uses it.

import { afterEach, describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { cutscenes } from "../../shared/src/prologue.js";
import type { Role } from "../../shared/src/gameTypes.js";
import { AgentEnvironment } from "../src/environment.js";
import { runEpisode } from "../src/runner.js";
import { TraceWriter, verifyTrace } from "../src/trace.js";
import { batchStop } from "../src/batch.js";
import { STALE_LINE } from "../src/actions.js";
import { aggregate, episodeMetrics, type EpisodeSummary } from "../src/harness.js";
import { AnthropicGateway, anthropicPrices, LLMPlayer, parseReply, replySchema, systemPrompt } from "../src/policies/llm.js";
import { MeteredGateway, ModelBudget, defaultBudgetLimits, type Completion, type CompletionOptions, type Gateway } from "../src/budget.js";
import type { Decision, Policy } from "../src/policies/policy.js";
import type { GameAction, Observation, StepResult } from "../src/types.js";

const FIXTURE = "unit-reliability-scene";
type FixtureLine = { speaker: "NARRATION"; text: string; audience?: Role; elsewhere?: string };

/** Installs the synthetic scene and returns an environment option that starts it at reset. */
function fixtureScene(lines: FixtureLine[], cast: Role[] = ["OATH", "EMBER"]) {
  (cutscenes as Record<string, unknown>)[FIXTURE] = { id: FIXTURE, scene: "GODDESS_SHRINE", cast, placement: {}, next: "GODDESS", flag: "unit-fixture-only", lines };
  return (room: GameRoom) => {
    room.state.story!.cutscene = { id: FIXTURE, line: 0, acks: [], since: 0 };
  };
}
afterEach(() => {
  delete (cutscenes as Record<string, unknown>)[FIXTURE];
});

const LINES: FixtureLine[] = [
  { speaker: "NARRATION", text: "Fixture line one." },
  { speaker: "NARRATION", text: "Fixture line two." },
  { speaker: "NARRATION", text: "Fixture line three." },
  { speaker: "NARRATION", text: "Fixture line four." },
  { speaker: "NARRATION", text: "Fixture line five (future)." },
];
const texts = (o: Observation) => o.dialogueLog.map((d) => d.text);

/** Plays a fixed list of decisions, then waits; records every input it was given. */
class Scripted implements Policy {
  readonly name = "scripted-test";
  inputs: Parameters<Policy["decide"]>[0][] = [];
  constructor(private plan: GameAction[][]) {}
  async decide(input: Parameters<Policy["decide"]>[0]): Promise<Decision> {
    this.inputs.push(input);
    const [action, ...then] = this.plan.shift() ?? [{ type: "wait", ticks: 30 }];
    return { action, ...(then.length ? { then } : {}) };
  }
}

/** Fake provider: answers from a queue and records each prompt and option. */
class Queue implements Gateway {
  readonly label = "queue";
  prompts: { system: string; user: string; options?: CompletionOptions }[] = [];
  constructor(private replies: (string | Completion)[], private fallback = '{"actions":[{"type":"wait","ticks":30}]}') {}
  worstCaseUsd() {
    return 0.001;
  }
  async complete(system: string, user: string, _signal: AbortSignal, options?: CompletionOptions): Promise<Completion> {
    this.prompts.push({ system, user, ...(options ? { options } : {}) });
    const r = this.replies.shift() ?? this.fallback;
    return typeof r === "string" ? { text: r, tokens: { input: 10, output: 5 }, costUsd: 0.00001 } : r;
  }
}

describe("simultaneous dialogue submissions", () => {
  it("one press moves the shared line on; the other comes back stale, not illegal", async () => {
    const env = new AgentEnvironment({ room: fixtureScene(LINES) });
    await env.reset(0);
    const [s, c] = await Promise.all([env.step("sieg", { type: "advance_dialogue" }), env.step("coco", { type: "advance_dialogue" })]);
    // The scheduler applies simultaneous submissions in a fixed order: Sieg, then Coco.
    expect(s).toMatchObject({ accepted: true });
    expect(c).toMatchObject({ accepted: false, stale: true, error: STALE_LINE });
    const out = await env.outcome();
    expect(out.invalidActions).toEqual({ sieg: 0, coco: 0 });
    // Both screens moved to line two exactly once.
    for (const id of ["sieg", "coco"] as const) expect(texts(await env.observe(id))).toEqual(["Fixture line one.", "Fixture line two."]);
  });

  it("is counted as a stale submission in the metrics and reported as stale to that player", async () => {
    const trace = new TraceWriter();
    const env = new AgentEnvironment({ room: fixtureScene(LINES), limits: { maxTicks: 90 }, trace: (e) => trace.write(e) });
    const sieg = new Scripted([[{ type: "advance_dialogue" }]]);
    const coco = new Scripted([[{ type: "advance_dialogue" }]]);
    const out = await runEpisode(env, { sieg, coco }, trace, { seed: 0, wallClockMs: 20_000 });
    verifyTrace(trace.lines);
    expect(out.reason).toBe("tick_limit");
    expect(out.invalidActions).toEqual({ sieg: 0, coco: 0 });
    const m = { sieg: episodeMetrics(trace.lines, [], "sieg"), coco: episodeMetrics(trace.lines, [], "coco") };
    expect(m.coco).toMatchObject({ staleSubmissions: 1, gameplayRejections: 0 });
    expect(m.sieg).toMatchObject({ staleSubmissions: 0, gameplayRejections: 0 });
    expect(m.sieg.executedActions).toBe(m.sieg.submittedActions);
    expect(m.coco.executedActions).toBe(m.coco.submittedActions - 1);
    expect(coco.inputs[1].batch!.steps[0]).toMatchObject({ status: "stale", action: { type: "advance_dialogue" } });
    expect(sieg.inputs[1].batch!.steps[0]).toMatchObject({ status: "executed" });
  });
});

describe("dialogue each hero observed", () => {
  it("keeps lines shown while a hero waits, even if they move on before it observes again", async () => {
    const env = new AgentEnvironment({ room: fixtureScene(LINES) });
    await env.reset(0);
    expect(texts(await env.observe("coco"))).toEqual(["Fixture line one."]);
    // Coco starts a wait; Sieg moves three lines on while Coco's wait has not finished.
    const cocoWait = env.step("coco", { type: "wait", ticks: 30 });
    for (let i = 0; i < 3; i++) expect((await env.step("sieg", { type: "advance_dialogue" })).accepted).toBe(true);
    // Sieg's wait lets game time run; the new line interrupts Coco's wait.
    const siegWait = env.step("sieg", { type: "wait", ticks: 30 });
    expect((await cocoWait).interrupted).toBe("A dialogue line appeared.");
    const coco = await env.observe("coco");
    expect(coco.dialogue?.text).toBe("Fixture line four.");
    expect(texts(coco)).toEqual(["Fixture line one.", "Fixture line two.", "Fixture line three.", "Fixture line four."]);
    // Never a line that has not been shown yet.
    expect(JSON.stringify(coco)).not.toContain("future");
    env.stop("manual_stop");
    await siegWait;
  });

  it("shows a private line to the partner only as their own screen showed it", async () => {
    const env = new AgentEnvironment({
      room: fixtureScene([
        { speaker: "NARRATION", text: "Shared opening." },
        { speaker: "NARRATION", text: "SIEG-ONLY-CANARY thought.", audience: "OATH", elsewhere: "Sieg is lost in thought." },
        { speaker: "NARRATION", text: "SIEG-ONLY-CANARY second thought.", audience: "OATH" },
        { speaker: "NARRATION", text: "Shared closing." },
      ]),
    });
    await env.reset(0);
    // Coco waits (mid-action) while Sieg reads on.
    const cocoWait = env.step("coco", { type: "wait", ticks: 10 });
    for (let i = 0; i < 3; i++) expect((await env.step("sieg", { type: "advance_dialogue" })).accepted).toBe(true);
    const siegWait = env.step("sieg", { type: "wait", ticks: 10 });
    await cocoWait;
    env.stop("manual_stop");
    await siegWait;
    const sieg = await env.observe("sieg"),
      coco = await env.observe("coco");
    expect(texts(sieg)).toEqual(["Shared opening.", "SIEG-ONLY-CANARY thought.", "SIEG-ONLY-CANARY second thought.", "Shared closing."]);
    // Coco's box showed the `elsewhere` text, then a blank box (not recorded).
    expect(texts(coco)).toEqual(["Shared opening.", "Sieg is lost in thought.", "Shared closing."]);
    expect(JSON.stringify(coco)).not.toContain("SIEG-ONLY-CANARY");
  });

  it("records nothing for a hero outside the scene who is not watching it", async () => {
    const env = new AgentEnvironment({ room: fixtureScene(LINES, ["OATH"]) });
    await env.reset(0);
    const cocoWait = env.step("coco", { type: "wait", ticks: 2 });
    expect((await env.step("sieg", { type: "advance_dialogue" })).accepted).toBe(true);
    await Promise.all([env.step("sieg", { type: "wait", ticks: 2 }), cocoWait]);
    expect(texts(await env.observe("sieg"))).toEqual(["Fixture line one.", "Fixture line two."]);
    expect(texts(await env.observe("coco"))).toEqual([]);
  });
});

describe("action history: proposed, executed, skipped and rejected", () => {
  it("only executed actions become completed history; skipped and rejected ones are labelled", async () => {
    const trace = new TraceWriter();
    const env = new AgentEnvironment({ room: fixtureScene(LINES), trace: (e) => trace.write(e) });
    const budget = new ModelBudget({ ...defaultBudgetLimits, maxModelCallsPerPlayer: 3 });
    const siegGw = new Queue([
      // Turn 1: the press runs; the line on screen stops the batch, so the rest is skipped.
      '{"notes":"n1","actions":[{"type":"advance_dialogue"},{"type":"move","direction":"n","ticks":10},{"type":"interact"}]}',
      // Turn 2: walking is not available during the scene, so the game refuses it.
      '{"actions":[{"type":"move","direction":"n","ticks":10}]}',
    ]);
    const cocoGw = new Queue([]);
    const sieg = new LLMPlayer("Sieg", "manual", new MeteredGateway(siegGw, budget, "sieg"));
    const coco = new LLMPlayer("Coco", "manual", new MeteredGateway(cocoGw, budget, "coco"));
    const out = await runEpisode(env, { sieg, coco }, trace, { seed: 0, wallClockMs: 20_000, budget });
    expect(out.reason).toBe("model_call_limit");
    const [, second, third] = siegGw.prompts.map((p) => JSON.parse(p.user));
    expect(second.completed_actions).toEqual([{ action: { type: "advance_dialogue" }, ticks: 0 }]);
    expect(second.recent_rejected_actions).toEqual([]);
    expect(second.last_turn.results.map((r: { action: GameAction; status: string }) => [r.action.type, r.status])).toEqual([
      ["advance_dialogue", "executed"],
      ["move", "skipped"],
      ["interact", "skipped"],
    ]);
    expect(second.last_turn.stopped_early_because).toBe("dialogue on screen");
    // The refused move is listed apart from completed history, never in it.
    expect(third.completed_actions).toEqual([{ action: { type: "advance_dialogue" }, ticks: 0 }]);
    expect(third.recent_rejected_actions).toEqual([{ action: { type: "move", direction: "n", ticks: 10 }, status: "rejected", error: 'Action "move" is not available right now.' }]);
    expect(third.last_turn.results[0]).toMatchObject({ status: "rejected" });
    // The trace records the skipped actions explicitly.
    const skipped = trace.lines.filter((l) => l.type === "skipped_actions" && l.player === "sieg");
    expect(skipped).toHaveLength(1);
    expect((skipped[0].data as { skipped: { reason: string }[] }).skipped.map((s) => s.reason)).toEqual(["dialogue on screen", "dialogue on screen"]);
    expect(episodeMetrics(trace.lines, budget.records, "sieg")).toMatchObject({
      modelCalls: 3, modelDecisions: 3, parseFailures: 0, proposedActions: 5, submittedActions: 3, executedActions: 2, gameplayRejections: 1, skippedActions: 2,
    });
  });

  it("a batch cut short by a stale press stops with a reason that says so", () => {
    const o = { area: { name: "A" }, self: { hp: 1 }, dialogue: null, inventory: { items: [] }, journal: {}, messages: [] } as unknown as Observation;
    const stale: StepResult = { accepted: false, stale: true, error: STALE_LINE, ticks: 0, feedback: [STALE_LINE], done: false };
    expect(batchStop(o, stale, o)).toBe("dialogue line had already moved on");
  });

  it("over-limit actions are reported as skipped, not run", async () => {
    const budget = new ModelBudget(defaultBudgetLimits);
    const six = JSON.stringify({ actions: Array.from({ length: 6 }, () => ({ type: "wait", ticks: 2 })) });
    const p = new LLMPlayer("Sieg", "manual", new MeteredGateway(new Queue([six]), budget, "sieg"));
    const env = new AgentEnvironment();
    await env.reset(0);
    const d = await p.decide({ observation: await env.observe("sieg"), legal: await env.legal_actions("sieg") });
    expect([d.action, ...(d.then ?? [])]).toHaveLength(4);
    expect(d.dropped).toHaveLength(2);
  });
});

describe("unusable model replies", () => {
  it("submit nothing, are counted as parse failures, and are reported to the player next turn", async () => {
    const trace = new TraceWriter();
    const env = new AgentEnvironment({ trace: (e) => trace.write(e) });
    const budget = new ModelBudget({ ...defaultBudgetLimits, maxModelCallsPerPlayer: 3 });
    const siegGw = new Queue(["<invoke_placeholder>\n</invoke_placeholder>", '{"actions":[{"type":"wait","ticks":20}]}']);
    const sieg = new LLMPlayer("Sieg", "manual", new MeteredGateway(siegGw, budget, "sieg"));
    const coco = new LLMPlayer("Coco", "manual", new MeteredGateway(new Queue([]), budget, "coco"));
    const out = await runEpisode(env, { sieg, coco }, trace, { seed: 1, wallClockMs: 20_000, budget });
    expect(out.reason).toBe("model_call_limit");
    expect(out.invalidActions.sieg).toBe(0);
    // No placeholder action ever reaches the game.
    const types = trace.lines.filter((l) => l.type === "step").map((l) => (l.data as { action: { type: string } }).action.type);
    expect(types).not.toContain("unparseable_reply");
    expect(trace.lines.filter((l) => l.type === "reply_rejected" && l.player === "sieg")).toHaveLength(1);
    const reply = trace.lines.find((l) => l.type === "model_reply" && l.player === "sieg")!.data as { envelope: string; problem: string };
    expect(reply).toMatchObject({ envelope: "rejected" });
    expect(JSON.parse(siegGw.prompts[1].user).last_turn).toEqual({ reply_problem: 'The reply had no JSON object with an "actions" list. Nothing was done.' });
    expect(episodeMetrics(trace.lines, budget.records, "sieg")).toMatchObject({ modelCalls: 3, modelDecisions: 2, parseFailures: 1 });
  });

  it("a reply cut off at the output limit is not used, even if it parses", async () => {
    const budget = new ModelBudget(defaultBudgetLimits);
    const cut: Completion = { text: '{"actions":[{"type":"wait","ticks":5}]}', tokens: { input: 1, output: 1 }, costUsd: 0, meta: { stopReason: "max_tokens", blocks: [{ type: "text", chars: 38 }], structured: true } };
    const p = new LLMPlayer("Sieg", "manual", new MeteredGateway(new Queue([cut]), budget, "sieg"));
    const env = new AgentEnvironment();
    await env.reset(0);
    const d = await p.decide({ observation: await env.observe("sieg"), legal: await env.legal_actions("sieg") });
    expect(d.action).toBeUndefined();
    expect(d.replyProblem).toMatch(/max_tokens/);
  });

  it("a scripted policy that returns no action ends the episode as an error instead of spinning", async () => {
    const trace = new TraceWriter();
    const env = new AgentEnvironment({ trace: (e) => trace.write(e) });
    const empty: Policy = { name: "empty", decide: async () => ({}) };
    const out = await runEpisode(env, { sieg: empty, coco: new Scripted([]) }, trace, { seed: 1, wallClockMs: 20_000 });
    expect(out.reason).toBe("error");
  });
});

describe("parseReply: conservative envelope validation", () => {
  const ok = (text: string, max?: number) => {
    const r = parseReply(text, max);
    if (!r.ok) throw Error(r.reason);
    return r;
  };
  const fails = (text: string) => {
    const r = parseReply(text);
    expect(r.ok).toBe(false);
    return r.ok ? "" : r.reason;
  };
  it("accepts a clean envelope without recovery", () => {
    const r = ok('{"notes":"n","actions":[{"type":"interact"}]}');
    expect(r).toEqual({ ok: true, notes: "n", actions: [{ type: "interact" }], dropped: [] });
  });
  it("accepts the single-action form", () => expect(ok('{"action":{"type":"interact"}}').actions).toEqual([{ type: "interact" }]));
  it("recovers one envelope from surrounding text and says so", () => {
    const r = ok('Here is my move:\n```json\n{"actions":[{"type":"wait","ticks":5}]}\n```');
    expect(r.actions).toEqual([{ type: "wait", ticks: 5 }]);
    expect(r.recovered).toMatch(/ignored/);
  });
  it("ignores an empty object next to the one envelope (the S1 failure shape)", () => {
    expect(ok('<invoke_ids>\n{}\n</invoke_ids>\n\n{"notes":"x","actions":[{"type":"interact"}]}').actions).toEqual([{ type: "interact" }]);
  });
  it("accepts an envelope repeated identically", () => expect(ok('{"actions":[{"type":"interact"}]} {"actions":[{"type":"interact"}]}').actions).toHaveLength(1));
  it("handles braces inside strings", () => {
    expect(ok('note: {"actions":[{"type":"message","text":"a } b { c"}]}').actions).toEqual([{ type: "message", text: "a } b { c" }]);
  });
  it("keeps at most the batch limit and returns the rest as dropped", () => {
    const r = ok(JSON.stringify({ actions: Array.from({ length: 5 }, () => ({ type: "wait", ticks: 1 })) }));
    expect([r.actions.length, r.dropped.length]).toEqual([4, 1]);
    expect(ok('{"actions":[{"type":"interact"},{"type":"wait","ticks":1}]}', 1).dropped).toEqual([{ type: "wait", ticks: 1 }]);
  });
  it.each([
    ["no json", "no JSON object"],
    ["", "empty"],
    ['{"actions":[{"type":"wait","ticks":5}]} {"actions":[{"type":"interact"}]}', "several different"],
    ['<parameter="actions">[{"type":"move","direction":"e","ticks":60}]</parameter> {"actions":[{"type":"interact"}]}', "outside the action list"],
    ['{"actions":[]}', "empty"],
    ['{"actions":[{"type":"wait"}, "go north"]}', "Action 2"],
    ['{"actions":[{"direction":"n"}]}', "Action 1"],
    ['{"actions":{"type":"wait"}}', "must be a list"],
    ['{"actions":[{"type":"interact"}],"plan":"x"}', 'unexpected field "plan"'],
    ['{"action":{"type":"interact"},"actions":[{"type":"interact"}]}', "both"],
    ['{"notes":5,"actions":[{"type":"interact"}]}', "notes"],
    ['{"actions":[{"type":"wait","ticks":5}', "no JSON object"],
    ['{"notes":"only notes"}', "no JSON object"],
  ])("refuses %j", (text, reason) => expect(fails(text)).toContain(reason));
});

describe("structured output and reply metadata (stubbed provider, no network)", () => {
  function stub(structured?: boolean) {
    const g = new AnthropicGateway("claude-haiku-5-5", anthropicPrices["claude-haiku-5-5"], "medium", "test-key-not-used", ...(structured === undefined ? [] : [structured]));
    const requests: Record<string, unknown>[] = [];
    (g.client.messages as unknown as { create: unknown }).create = async (body: Record<string, unknown>) => {
      requests.push(body);
      return {
        model: "claude-haiku-5-5",
        stop_reason: "end_turn",
        content: [
          { type: "thinking", thinking: "THINKING-CANARY", signature: "sig" },
          { type: "text", text: '{"actions":[{"type":"wait","ticks":5}]}' },
        ],
        usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      };
    };
    return { g, requests };
  }
  it("sends the player's schema as output_config.format without changing model or effort", async () => {
    const { g, requests } = stub();
    const schema = replySchema();
    const c = await g.complete("system", "user", new AbortController().signal, { schema });
    expect(requests[0]).toMatchObject({ model: "claude-haiku-5-5", output_config: { effort: "medium", format: { type: "json_schema", schema } } });
    expect(c.meta).toEqual({ stopReason: "end_turn", blocks: [{ type: "thinking", chars: 15 }, { type: "text", chars: 39 }], structured: true });
    expect(JSON.stringify(c.meta)).not.toContain("THINKING-CANARY");
    expect(c.text).not.toContain("THINKING-CANARY");
  });
  it("can be turned off, and sends no format when the player gives no schema", async () => {
    const off = stub(false);
    await off.g.complete("s", "u", new AbortController().signal, { schema: replySchema() });
    expect((off.requests[0].output_config as Record<string, unknown>).format).toBeUndefined();
    const none = stub();
    const c = await none.g.complete("s", "u", new AbortController().signal);
    expect((none.requests[0].output_config as Record<string, unknown>).format).toBeUndefined();
    expect(c.meta?.structured).toBe(false);
  });
  it("records the reply metadata in the call record, never credentials", async () => {
    const { g } = stub();
    const budget = new ModelBudget(defaultBudgetLimits);
    const r = await new MeteredGateway(g, budget, "sieg").complete("s", "u", { schema: replySchema() });
    expect(r.record.meta).toMatchObject({ stopReason: "end_turn", structured: true });
    expect(JSON.stringify(budget.records)).not.toMatch(/test-key|THINKING-CANARY/);
  });
  it("the schema uses only accepted features: every object closed, no numeric, length or item limits", () => {
    for (const [batch, memory] of [[4, "history"], [1, "history"], [4, "none"]] as const) {
      const schema = replySchema(batch, memory);
      const walk = (v: unknown) => {
        if (!v || typeof v !== "object") return;
        const o = v as Record<string, unknown>;
        for (const k of ["minimum", "maximum", "minItems", "maxItems", "minLength", "maxLength", "multipleOf", "pattern"]) expect(o).not.toHaveProperty(k);
        if (o.type === "object") expect(o.additionalProperties).toBe(false);
        Object.values(o).forEach(walk);
      };
      walk(schema);
      expect(JSON.stringify(schema).includes('"notes"')).toBe(memory === "history");
    }
  });
  it("the model player sends its schema with every call", async () => {
    const gw = new Queue([]);
    const p = new LLMPlayer("Coco", "manual", new MeteredGateway(gw, new ModelBudget(defaultBudgetLimits), "coco"), 1);
    const env = new AgentEnvironment();
    await env.reset(0);
    await p.decide({ observation: await env.observe("coco"), legal: await env.legal_actions("coco") });
    expect(gw.prompts[0].options?.schema).toEqual(replySchema(1));
  });
});

describe("prompt: abstract actions and shared dialogue guidance", () => {
  const prompt = systemPrompt("Sieg", "MANUAL");
  it("explains that actions depend on state and proximity and that keys are not commands", () => {
    expect(prompt).toContain("You cannot press keys");
    expect(prompt).toMatch(/rebuilt every turn from your situation/);
    expect(prompt).toMatch(/use_item appears only when you stand next to an object/);
  });
  it("explains the four action statuses (history memory only)", () => {
    for (const s of ['"executed"', '"rejected"', '"stale"', '"skipped"']) expect(prompt).toContain(s);
    expect(systemPrompt("Sieg", "MANUAL", 4, "none")).not.toContain("completed_actions");
  });
  it("suggests agreeing on shared-line ownership by message, without a controller", () => {
    expect(prompt).toContain("Shared dialogue");
    expect(prompt).toMatch(/Agree with your partner by message who moves shared lines on/);
    expect(prompt).toContain("dialogue_log");
  });
  it("is identical for every call of a player (cache-friendly) and differs between heroes only by name", () => {
    expect(systemPrompt("Coco", "MANUAL").replace(/Coco|Sieg/g, "X")).toBe(prompt.replace(/Coco|Sieg/g, "X"));
  });
});

describe("summary compatibility", () => {
  it("aggregates old summaries that have no per-hero metrics", () => {
    const old = {
      situation: "S1", success: true, reason: "success", gameSeconds: 6, wallSeconds: 1, gameTicks: 360,
      actions: { sieg: {}, coco: {} }, modelCalls: { attempted: 2, failed: 0, timedOut: 0, unknownUsage: 0 },
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, spendUsd: { known: 0, charged: 0 },
      decisions: { sieg: 1, coco: 1 }, invalidActions: { sieg: 0, coco: 0 }, messages: { sieg: 0, coco: 0 }, startHash: "a".repeat(64),
    } as unknown as EpisodeSummary;
    const [row] = aggregate([old]);
    expect(row.metricsEpisodes).toBe(0);
    expect(row.metrics.modelCalls).toBe(0);
    expect(row.modelCalls).toBe(2);
  });
});
