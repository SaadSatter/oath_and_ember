// Action batching (owner decision 2026-10-27): up to 4 actions per decision,
// run one at a time through step(), stopped by batchStop().
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { AgentEnvironment } from "../src/environment.js";
import { runEpisode } from "../src/runner.js";
import { TraceWriter, verifyTrace } from "../src/trace.js";
import { batchStop, MAX_BATCH } from "../src/batch.js";
import { LLMPlayer, parseReply, systemPrompt } from "../src/policies/llm.js";
import { MeteredGateway, ModelBudget, defaultBudgetLimits, type Gateway } from "../src/budget.js";
import type { Decision, Policy } from "../src/policies/policy.js";
import type { GameAction, Observation, PlayerId, StepResult } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;

/**
 * Plays a fixed list of actions. Batched, it offers up to `size` at a time and
 * puts back whatever a stopped batch did not run, so both modes execute the
 * same actions in the same order; only the number of decisions differs.
 */
class Scripted implements Policy {
  readonly name: string;
  private queue: GameAction[];
  private offered = 0;
  decisions = 0;
  constructor(script: GameAction[], private readonly size: number) {
    this.queue = [...script];
    this.name = `scripted·batch${size}`;
  }
  async decide(input: { batch?: { steps: unknown[] } }): Promise<Decision> {
    // Put back the actions of the last batch that did not run.
    if (input.batch && this.offered > input.batch.steps.length) {
      const unrun = this.offeredList.slice(input.batch.steps.length);
      this.queue.unshift(...unrun);
    }
    this.decisions++;
    const take = this.queue.splice(0, this.size);
    if (!take.length) take.push({ type: "wait", ticks: 60 });
    this.offered = take.length;
    this.offeredList = take;
    return { action: take[0], ...(take.length > 1 ? { then: take.slice(1) } : {}) };
  }
  private offeredList: GameAction[] = [];
}

// A script with every kind of stop in it: the opening scene's lead-in and
// lines (dialogue), presses that may be stale (invalid), moves, waits, and a
// message (feedback for the sender, a new message for the partner).
const script = (hero: PlayerId): GameAction[] => [
  { type: "wait", ticks: 30 },
  { type: "wait", ticks: 30 },
  ...Array.from({ length: 30 }, (): GameAction => (hero === "sieg" ? { type: "advance_dialogue" } : { type: "wait", ticks: 5 })),
  { type: "move", direction: hero === "sieg" ? "w" : "e", ticks: 20 },
  { type: "move", direction: "s", ticks: 15 },
  { type: "message", text: `${hero} here` },
  { type: "move", direction: "n", ticks: 25 },
  { type: "wait", ticks: 10 },
  { type: "attack", direction: "w" },
  { type: "move", direction: "e", ticks: 12 },
  { type: "wait", ticks: 40 },
];

async function play(size: number) {
  const trace = new TraceWriter();
  const env = new AgentEnvironment({ preset: "milestone", limits: { maxTicks: 1500 }, trace: (e) => trace.write(e) });
  const policies = { sieg: new Scripted(script("sieg"), size), coco: new Scripted(script("coco"), size) };
  const outcome = await runEpisode(env, policies, trace, { seed: 3, wallClockMs: 60_000 });
  verifyTrace(trace.lines);
  const steps = (id: PlayerId) =>
    trace.lines
      .filter((l) => l.type === "step" && l.player === id)
      .map((l) => {
        const d = l.data as { action: GameAction; result: StepResult };
        return JSON.stringify([d.action, d.result.accepted, d.result.ticks]);
      });
  return { outcome, raw: JSON.stringify(roomOf(env).state), steps: { sieg: steps("sieg"), coco: steps("coco") }, policies, trace };
}

describe("batched and unbatched execution of the same actions", () => {
  it("end in the same raw world with the same steps; batching needs fewer decisions", async () => {
    const one = await play(1),
      four = await play(MAX_BATCH);
    expect(one.outcome.reason).toBe("tick_limit");
    expect(four.raw).toBe(one.raw);
    expect(four.steps).toEqual(one.steps);
    for (const id of ["sieg", "coco"] as const) expect(four.policies[id].decisions).toBeLessThan(one.policies[id].decisions);
    // Some batches really were cut short, and some ran in full.
    const stops = four.trace.lines.filter((l) => l.type === "batch_stop").map((l) => (l.data as { reason: string }).reason);
    expect(stops.length).toBeGreaterThan(0);
    expect(four.trace.lines.some((l) => l.type === "step" && (l.data as { batch?: { index: number } }).batch?.index === 3)).toBe(true);
  }, 120_000);
});

describe("batch stop rules", () => {
  const base = (): Observation =>
    ({
      area: { name: "Goddess Shrine", widthTiles: 40, heightTiles: 32 },
      self: { x: 1, y: 1, facing: "n", hp: 100, maxHp: 100, status: [] },
      dialogue: null,
      inventory: { items: [{ id: "a", name: "A", count: 1, description: "" }] },
      journal: { completed: [] },
      messages: [],
    }) as unknown as Observation;
  const ok: StepResult = { accepted: true, ticks: 10, feedback: [], done: false };
  it("continues when nothing happened", () => expect(batchStop(base(), ok, base())).toBeUndefined());
  it.each([
    ["invalid action", { ...ok, accepted: false }, {}],
    ["episode over", { ...ok, done: true }, {}],
    ["interrupted: You arrived at Mirror Pond.", { ...ok, interrupted: "You arrived at Mirror Pond." }, {}],
    ["feedback", { ...ok, feedback: ["Collected Vanity Mirror."] }, {}],
    ["dialogue on screen", ok, { dialogue: { speaker: "", text: "…", canAdvance: true } }],
    ["area changed", ok, { area: { name: "Mirror Pond", widthTiles: 48, heightTiles: 40 } }],
    ["health changed", ok, { self: { x: 1, y: 1, facing: "n", hp: 80, maxHp: 100, status: [] } }],
    ["backpack changed", ok, { inventory: { items: [] } }],
    ["journal changed", ok, { journal: { completed: ["x"] } }],
    ["message received", ok, { messages: [{ from: "Coco", text: "hi", tick: 3 }] }],
  ])("stops: %s", (reason, result, change) => {
    expect(batchStop(base(), result as StepResult, { ...base(), ...change } as Observation)).toBe(reason);
  });
});

describe("LLM player batching", () => {
  class Fake implements Gateway {
    readonly label = "fake";
    constructor(private reply: string) {}
    worstCaseUsd() {
      return 0.001;
    }
    async complete() {
      return { text: this.reply, tokens: { input: 10, output: 5 }, costUsd: 0.00001 };
    }
  }
  const five = JSON.stringify({ actions: Array.from({ length: 5 }, () => ({ type: "wait", ticks: 10 })) });

  it("reads an actions list, keeps at most 4, and still accepts a single action", () => {
    const r = parseReply(five);
    expect(r.ok && [r.actions.length, r.dropped.length]).toEqual([4, 1]);
    const one = parseReply('{"action":{"type":"interact"}}');
    expect(one.ok && one.actions).toEqual([{ type: "interact" }]);
  });

  it("one model call runs up to 4 actions; the unbatched player keeps only the first", async () => {
    for (const [size, perCall] of [[MAX_BATCH, 4], [1, 1]] as const) {
      const budget = new ModelBudget({ ...defaultBudgetLimits, maxModelCallsPerPlayer: 3 });
      const env = new AgentEnvironment({ trace: () => {} });
      const p = (hero: "Sieg" | "Coco", id: PlayerId) => new LLMPlayer(hero, "manual", new MeteredGateway(new Fake(five), budget, id), size);
      const trace = new TraceWriter();
      const out = await runEpisode(env, { sieg: p("Sieg", "sieg"), coco: p("Coco", "coco") }, trace, { seed: 1, wallClockMs: 20_000, budget });
      expect(out.reason).toBe("model_call_limit");
      expect(out.modelCalls.sieg).toBe(3);
      // The opening scene's dialogue stops batches; count only full ones.
      const sieg = trace.lines.filter((l) => l.type === "step" && l.player === "sieg");
      expect(sieg.length).toBeLessThanOrEqual(3 * perCall);
      if (size === 1) expect(sieg.length).toBe(3);
    }
  });

  it("tells the model about batches only when batching is on", () => {
    expect(systemPrompt("Sieg", "m")).toContain('"actions": [');
    expect(systemPrompt("Sieg", "m", 1)).toContain('"action": {');
    expect(systemPrompt("Sieg", "m", 1)).not.toContain("are skipped as soon as");
  });
});
