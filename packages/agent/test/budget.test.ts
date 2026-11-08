// Central model budget (owner decisions 2026-10-27): every attempted call counts,
// a 30 s configurable per-call timeout, no SDK retries, call/token/spend limits
// enforced by the runner with a total episode budget, unknown usage marked as
// unknown, and game-time vs wall-clock limits with distinct reasons.
import { describe, expect, it } from "vitest";
import { AgentEnvironment } from "../src/environment.js";
import { runEpisode } from "../src/runner.js";
import { TraceWriter, verifyTrace } from "../src/trace.js";
import { ExplorationBaseline } from "../src/policies/baseline.js";
import { AnthropicGateway, anthropicPrices, LLMPlayer } from "../src/policies/llm.js";
import {
  BudgetExhausted,
  defaultBudgetLimits,
  MeteredGateway,
  ModelBudget,
  ModelCallError,
  type Completion,
  type Gateway,
} from "../src/budget.js";
import type { PlayerId } from "../src/types.js";

const WAIT = '{"action":{"type":"wait","ticks":10}}';

/** Scripted provider: each entry is a reply, an Error to throw, or "hang". */
class ScriptedGateway implements Gateway {
  readonly label = "scripted";
  calls = 0;
  aborted = 0;
  constructor(
    private script: (string | Error | "hang" | Completion)[],
    private worstCase: number | null = 0.001,
  ) {}
  worstCaseUsd() {
    return this.worstCase;
  }
  complete(_s: string, _u: string, signal: AbortSignal): Promise<Completion> {
    this.calls++;
    const next = this.script.length > 1 ? this.script.shift()! : this.script[0];
    if (next === "hang")
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => {
          this.aborted++;
          reject(new Error("aborted by signal"));
        }),
      );
    if (next instanceof Error) return Promise.reject(next);
    if (typeof next === "string") return Promise.resolve({ text: next, tokens: { input: 100, output: 10 }, costUsd: 0.0002 });
    return Promise.resolve(next);
  }
}

function players(budget: ModelBudget, sieg: Gateway, coco: Gateway) {
  return {
    sieg: new LLMPlayer("Sieg", "manual", new MeteredGateway(sieg, budget, "sieg")),
    coco: new LLMPlayer("Coco", "manual", new MeteredGateway(coco, budget, "coco")),
  };
}
async function play(budget: ModelBudget, sieg: Gateway, coco: Gateway, opts: { wallClockMs?: number; maxConsecutiveFailures?: number } = {}) {
  const trace = new TraceWriter();
  const env = new AgentEnvironment({ trace: (e) => trace.write(e) });
  const out = await runEpisode(env, players(budget, sieg, coco), trace, {
    seed: 1,
    wallClockMs: opts.wallClockMs ?? 20_000,
    budget,
    ...(opts.maxConsecutiveFailures ? { maxConsecutiveFailures: opts.maxConsecutiveFailures } : {}),
  });
  verifyTrace(trace.lines);
  return { out, trace };
}

describe("every attempted call counts toward the per-hero cap", () => {
  it("failed calls use up the cap, which is exact", async () => {
    const budget = new ModelBudget({ ...defaultBudgetLimits, maxModelCallsPerPlayer: 4 });
    const sieg = new ScriptedGateway([new Error("http 529"), WAIT, new Error("http 500"), WAIT]);
    const { out, trace } = await play(budget, sieg, new ScriptedGateway([WAIT]), { maxConsecutiveFailures: 10 });
    expect(out.reason).toBe("model_call_limit");
    expect(out.modelCalls.sieg).toBe(4);
    expect(sieg.calls).toBe(4);
    expect(out.failedModelCalls.sieg).toBe(2);
    const sCalls = trace.lines.filter((l) => l.type === "model_call" && l.player === "sieg");
    expect(sCalls.map((l) => (l.data as { status: string }).status)).toEqual(["error", "ok", "error", "ok"]);
    // A failed call with no reported usage is unknown, not zero.
    expect((sCalls[0].data as { tokens: unknown }).tokens).toBeNull();
    expect(out.unknownUsageCalls.sieg).toBe(2);
    expect(out.tokens.sieg).toEqual({ input: 200, output: 20 });
  });

  it("consecutive failures end the episode with reason error, and are still counted", async () => {
    const budget = new ModelBudget(defaultBudgetLimits);
    const { out } = await play(budget, new ScriptedGateway([new Error("down")]), new ScriptedGateway([WAIT]), { maxConsecutiveFailures: 3 });
    expect(out.reason).toBe("error");
    expect(out.modelCalls.sieg).toBe(3);
    expect(out.failedModelCalls.sieg).toBe(3);
  });
});

describe("per-call timeout", () => {
  it("aborts a hung call at the configured timeout and counts it as a timeout", async () => {
    const budget = new ModelBudget({ ...defaultBudgetLimits, callTimeoutMs: 60 });
    const hung = new ScriptedGateway(["hang"]);
    const metered = new MeteredGateway(hung, budget, "sieg");
    const started = performance.now();
    const err = await metered.complete("s", "u").catch((e) => e);
    expect(err).toBeInstanceOf(ModelCallError);
    expect(err.status).toBe("timeout");
    expect(performance.now() - started).toBeLessThan(1000);
    expect(hung.aborted).toBe(1);
    expect(budget.calls.sieg).toBe(1);
    expect(budget.records[0]).toMatchObject({ status: "timeout", tokens: null, costUsd: null, chargedUsd: 0.001 });
  });

  it("defaults to 30 seconds and is configurable", () => {
    expect(defaultBudgetLimits.callTimeoutMs).toBe(30_000);
    expect(new ModelBudget({ ...defaultBudgetLimits, callTimeoutMs: 5_000 }).limits.callTimeoutMs).toBe(5_000);
    expect(() => new ModelBudget({ ...defaultBudgetLimits, callTimeoutMs: 0 })).toThrow();
  });
});

describe("usage and cost are recorded as reported, unknown when not", () => {
  it("a refusal keeps the usage the provider reported", async () => {
    const budget = new ModelBudget(defaultBudgetLimits);
    const refusing: Gateway = {
      label: "refuses",
      worstCaseUsd: () => 0.001,
      complete: () => Promise.reject(new ModelCallError("refusal", "model_refusal", { tokens: { input: 80, output: 3 }, costUsd: 0.00005 })),
    };
    await new MeteredGateway(refusing, budget, "coco").complete("s", "u").catch(() => {});
    expect(budget.records[0]).toMatchObject({ status: "refusal", tokens: { input: 80, output: 3 }, costUsd: 0.00005, chargedUsd: 0.00005 });
    expect(budget.unknownUsage.coco).toBe(0);
  });

  it("a successful call without reported usage is unknown and is charged its full reservation", async () => {
    const budget = new ModelBudget(defaultBudgetLimits);
    const noUsage = new ScriptedGateway([{ text: WAIT, tokens: null, costUsd: null }], 0.01);
    await new MeteredGateway(noUsage, budget, "sieg").complete("s", "u");
    expect(budget.unknownUsage.sieg).toBe(1);
    expect(budget.knownSpendUsd).toBe(0);
    expect(budget.chargedUsd).toBeCloseTo(0.01);
  });

  it("refuses to call a model whose price is unknown, since the spend cap could not be enforced", async () => {
    const budget = new ModelBudget(defaultBudgetLimits);
    const unpriced = new ScriptedGateway([WAIT], null);
    await expect(new MeteredGateway(unpriced, budget, "sieg").complete("s", "u")).rejects.toBeInstanceOf(BudgetExhausted);
    expect(unpriced.calls).toBe(0);
  });
});

describe("limits enforced centrally by the runner", () => {
  it("one spend cap covers both heroes and ends the episode with spend_limit", async () => {
    // Each call reserves 0.004 and costs 0.003; the shared cap of 0.02 runs out
    // after about six calls in total, whichever hero makes them.
    const budget = new ModelBudget({ ...defaultBudgetLimits, maxSpendUsd: 0.02 });
    const priced = () => new ScriptedGateway([{ text: WAIT, tokens: { input: 10, output: 1 }, costUsd: 0.003 }], 0.004);
    const { out } = await play(budget, priced(), priced());
    expect(out.reason).toBe("spend_limit");
    expect(out.spendUsd.charged).toBeLessThanOrEqual(0.02);
    expect(out.modelCalls.sieg + out.modelCalls.coco).toBeLessThanOrEqual(6);
    expect(out.modelCalls.sieg).toBeGreaterThan(0);
    expect(out.modelCalls.coco).toBeGreaterThan(0);
  });

  it("ends with token_limit once a hero's reported tokens reach the cap", async () => {
    const budget = new ModelBudget({ ...defaultBudgetLimits, maxTokensPerPlayer: 330 });
    const { out } = await play(budget, new ScriptedGateway([WAIT]), new ScriptedGateway([WAIT]));
    expect(out.reason).toBe("token_limit");
    expect(out.tokens.sieg.input + out.tokens.sieg.output).toBeLessThan(330 + 110);
  });

  it("refuses model players that are not metered by this episode's budget", async () => {
    const mine = new ModelBudget(defaultBudgetLimits),
      other = new ModelBudget(defaultBudgetLimits);
    const env = new AgentEnvironment();
    const p = (b: ModelBudget, as: PlayerId) => new LLMPlayer("Sieg", "m", new MeteredGateway(new ScriptedGateway([WAIT]), b, as));
    await expect(runEpisode(env, { sieg: p(other, "sieg"), coco: p(mine, "coco") }, new TraceWriter(), { seed: 1, wallClockMs: 1000, budget: mine })).rejects.toThrow(/not metered/);
    await expect(runEpisode(env, { sieg: p(mine, "coco"), coco: p(mine, "coco") }, new TraceWriter(), { seed: 1, wallClockMs: 1000, budget: mine })).rejects.toThrow(/metered as coco/);
    await expect(runEpisode(env, { sieg: p(mine, "sieg"), coco: p(mine, "coco") }, new TraceWriter(), { seed: 1, wallClockMs: 1000 })).rejects.toThrow(/not metered/);
  });

  it("turns SDK retries off, so every request the SDK sends is a counted call", () => {
    const prior = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key-not-used";
    try {
      const g = new AnthropicGateway("claude-haiku-5-5", anthropicPrices["claude-haiku-5-5"]);
      expect(g.client.maxRetries).toBe(0);
    } finally {
      if (prior === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prior;
    }
  });
});

describe("per-call timeout through a whole episode", () => {
  it("a hung model times out, is traced as a timeout and counted, and repeated timeouts end the episode with error", async () => {
    const budget = new ModelBudget({ ...defaultBudgetLimits, callTimeoutMs: 40 });
    const { out, trace } = await play(budget, new ScriptedGateway(["hang"]), new ScriptedGateway([WAIT]), { maxConsecutiveFailures: 2 });
    expect(out.reason).toBe("error");
    expect(out.modelCalls.sieg).toBe(2);
    expect(out.failedModelCalls.sieg).toBe(2);
    const sieg = trace.lines.filter((l) => l.player === "sieg");
    expect(sieg.filter((l) => l.type === "model_call").map((l) => (l.data as { status: string }).status)).toEqual(["timeout", "timeout"]);
    expect(sieg.filter((l) => l.type === "policy_error").map((l) => (l.data as { kind: string }).kind)).toEqual(["timeout", "timeout"]);
  });
});

describe("game time and wall-clock time are separate limits", () => {
  it("the game-time limit reports tick_limit, measured in ticks", async () => {
    const env = new AgentEnvironment({ preset: "milestone", limits: { maxTicks: 120 } });
    const out = await runEpisode(env, { sieg: new ExplorationBaseline(), coco: new ExplorationBaseline() }, new TraceWriter(), { seed: 1, wallClockMs: 30_000 });
    expect(out.reason).toBe("tick_limit");
    expect(out.ticks).toBe(120);
    expect(new AgentEnvironment({ preset: "milestone" })["limits"].maxTicks).toBe(90 * 60);
  });

  it("the wall-clock limit ends the episode with its own reason and aborts calls in flight", async () => {
    const budget = new ModelBudget({ ...defaultBudgetLimits, callTimeoutMs: 30_000 });
    const hung = new ScriptedGateway(["hang"]);
    const started = performance.now();
    const { out } = await play(budget, hung, new ScriptedGateway(["hang"]), { wallClockMs: 150 });
    expect(out.reason).toBe("wall_clock_limit");
    expect(performance.now() - started).toBeLessThan(5_000);
    expect(hung.aborted).toBe(1);
    expect(out.modelCalls.sieg).toBe(1);
    expect(out.ticks).toBe(0);
  });
});

describe("verified prices (2026-10-27)", () => {
  it("prices Haiku 5.5, including cache reads and the over-100K-token tier", async () => {
    const { anthropicCost, anthropicPrices } = await import("../src/policies/llm.js");
    const h = anthropicPrices["claude-haiku-5-5"];
    // 1,400 uncached + 3,400 cache-read input, 1,000 output (thinking included).
    expect(anthropicCost(h, { input: 1400, cacheWrite: 0, cacheRead: 3400, output: 1000 })).toBeCloseTo((1400 * 0.1 + 3400 * 0.01 + 1000 * 0.5) / 1e6, 12);
    // Over 100,000 prompt tokens, every rate is the long-context one.
    expect(anthropicCost(h, { input: 100_001, cacheWrite: 0, cacheRead: 0, output: 10 })).toBeCloseTo((100_001 * 0.5 + 10 * 2.5) / 1e6, 12);
    // Sonnet 5.5 cache reads are 0.05x input.
    expect(anthropicCost(anthropicPrices["claude-sonnet-5-5"], { input: 0, cacheWrite: 0, cacheRead: 1_000_000, output: 0 })).toBeCloseTo(0.1, 12);
    for (const p of Object.values(anthropicPrices)) expect(p.source).toContain("verified 2026-10-27");
  });
});


describe("reservation safety", () => {
  it("holds both heroes' concurrent costs before dispatch, including unknown results", async () => {
    const budget = new ModelBudget({ ...defaultBudgetLimits, maxSpendUsd: 0.01 });
    const release: ((c: Completion) => void)[] = [];
    const gateway: Gateway = { label: "concurrent", worstCaseUsd: () => 0.005, complete: async () => new Promise((resolve) => release.push(resolve)) };
    const a = new MeteredGateway(gateway, budget, "sieg").complete("s", "u");
    const b = new MeteredGateway(gateway, budget, "coco").complete("s", "u");
    await expect(new MeteredGateway(gateway, budget, "sieg").complete("s", "u")).rejects.toBeInstanceOf(BudgetExhausted);
    expect(release).toHaveLength(2);
    for (const done of release) done({ text: WAIT, tokens: null, costUsd: null });
    await Promise.all([a, b]);
    expect(budget.chargedUsd).toBeCloseTo(0.01);
    expect(budget.unknownUsage).toEqual({ sieg: 1, coco: 1 });
    expect(budget.exhausted("sieg")).toBe("spend_limit");
  });

  it("refuses non-finite limits and call reservations before provider dispatch", async () => {
    for (const limits of [{ maxSpendUsd: Infinity }, { maxTokensPerPlayer: NaN }, { maxModelCallsPerPlayer: Infinity }, { callTimeoutMs: Infinity }])
      expect(() => new ModelBudget({ ...defaultBudgetLimits, ...limits })).toThrow();
    for (const reservation of [NaN, Infinity, -1]) {
      const gateway = new ScriptedGateway([WAIT], reservation);
      await expect(new MeteredGateway(gateway, new ModelBudget(defaultBudgetLimits), "sieg").complete("s", "u")).rejects.toBeInstanceOf(BudgetExhausted);
      expect(gateway.calls).toBe(0);
    }
  });

  it("does not let malformed provider accounting poison the cap", async () => {
    const budget = new ModelBudget(defaultBudgetLimits);
    const gateway = new ScriptedGateway([{ text: WAIT, tokens: { input: -1, output: NaN }, costUsd: NaN }], 0.01);
    await new MeteredGateway(gateway, budget, "sieg").complete("s", "u");
    expect(budget.records[0]).toMatchObject({ tokens: null, costUsd: null, chargedUsd: 0.01 });
    expect(budget.unknownUsage.sieg).toBe(1);
  });

  it("uses a byte bound and framing margin for text prompt reservations", () => {
    const prior = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key-not-used";
    try {
      const gateway = new AnthropicGateway("claude-haiku-5-5", anthropicPrices["claude-haiku-5-5"]);
      const prompt = "🦉".repeat(30_000);
      const bytes = Buffer.byteLength(prompt, "utf8");
      // The conservative bound crosses 100K and reserves the high tier, 4K output included.
      expect(gateway.worstCaseUsd(prompt, "")).toBeCloseTo(((bytes + 4096) * 0.625 + 4000 * 2.5) / 1e6, 12);
    } finally {
      if (prior === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prior;
    }
  });
});
