// Evaluation harness: suite rules, ledger reservation around every model
// episode, and the per-episode record. No paid calls: fake gateways only.
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TraceWriter, type TraceLine, verifyTrace } from "../src/trace.js";
import { environmentFor } from "../src/suite.js";
import { EPISODE_CAP_USD, runSuite, smokeCall, validatePlan, type ModelSetup } from "../src/harness.js";
import { SpendLedger } from "../src/ledger.js";
import type { Completion, Gateway } from "../src/budget.js";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "harness-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Fake provider: waits, with a known cost (or unknown), and can watch the ledger mid-run. */
class FakeGateway implements Gateway {
  readonly label = "fake";
  calls = 0;
  constructor(
    private cost: number | null = 0.0005,
    private during?: () => void,
  ) {}
  worstCaseUsd() {
    return 0.002;
  }
  async complete(): Promise<Completion> {
    this.calls++;
    this.during?.();
    return {
      text: '{"notes":"","actions":[{"type":"wait","ticks":30}]}',
      tokens: this.cost === null ? null : { input: 4000, output: 300 },
      costUsd: this.cost,
      model: "fake-model",
      cache: { read: 3000, write: 0 },
    };
  }
}
const setup = (ledger: SpendLedger, gateway: Gateway, stage = "pilot"): ModelSetup => ({ gateway, manual: "manual", ledger, stage, priceSource: "test" });

describe("suite rules", () => {
  it("keeps S4 and F for final runs on the final seeds, and tuning runs on the tuning seeds", () => {
    expect(() => validatePlan({ player: "baseline-quest", situations: ["S4"], seeds: [0] })).toThrow(/held out/);
    expect(() => validatePlan({ player: "baseline-quest", situations: ["F"], seeds: [1] })).toThrow(/held out/);
    expect(() => validatePlan({ player: "baseline-quest", situations: ["S1"], seeds: [100] })).toThrow(/Tuning runs use seeds/);
    expect(() => validatePlan({ player: "baseline-quest", situations: ["S1"], seeds: [0], final: true })).toThrow(/Final runs use seeds 100, 101/);
    expect(() => validatePlan({ player: "baseline-quest", situations: ["S1", "S4", "F"], seeds: [100, 101], final: true })).not.toThrow();
  });

  it("runs the observation-only player on S1-S3 only, and spends from the right stage", () => {
    const m = { stage: "final" } as ModelSetup;
    expect(() => validatePlan({ player: "model-obs-only", situations: ["S4"], seeds: [100], final: true, model: m })).toThrow(/S1-S3 only/);
    expect(() => validatePlan({ player: "model-history", situations: ["S1"], seeds: [0] })).toThrow(/needs a model setup/);
    expect(() => validatePlan({ player: "model-history", situations: ["S1"], seeds: [0], model: m })).toThrow(/pilot or contingency/);
    expect(() => validatePlan({ player: "model-history", situations: ["S1"], seeds: [100], final: true, model: { stage: "pilot" } as ModelSetup })).toThrow(/final or contingency/);
    expect(() => validatePlan({ player: "baseline-quest", situations: ["S1"], seeds: [0], model: m })).toThrow(/no model setup/);
  });
});

describe("model episodes and the spend ledger", () => {
  it("reserves the episode cap on disk before the first call, then settles it with the budget's charge", async () => {
    const d = tmp();
    const ledgerPath = join(d, "spend-ledger.json");
    const ledger = SpendLedger.open(ledgerPath);
    const seenDuringRun: string[] = [];
    const gateway = new FakeGateway(0.0005, () => {
      const onDisk = JSON.parse(readFileSync(ledgerPath, "utf8")).entries;
      seenDuringRun.push(onDisk[onDisk.length - 1].status);
    });
    const [s] = await runSuite({ player: "model-history", situations: ["S1"], seeds: [0], outDir: join(d, "out"), gitHash: "test", model: setup(ledger, gateway) });
    expect(seenDuringRun.length).toBeGreaterThan(0);
    expect(new Set(seenDuringRun)).toEqual(new Set(["open"]));
    const [entry] = ledger.entries();
    expect(entry).toMatchObject({ stage: "pilot", reservedUsd: EPISODE_CAP_USD.S1, status: "settled" });
    expect(entry.chargedUsd).toBeCloseTo(s.spendUsd.charged, 9);
    expect(s.modelCalls.attempted).toBe(gateway.calls);
    expect(s.tokens).toMatchObject({ cacheRead: 3000 * gateway.calls });
    expect(s.modelIds).toEqual(["fake-model"]);
    expect(s.ledgerEntry).toBe(entry.id);
    expect(existsSync(join(d, "out", "S1-seed0", "trace.jsonl"))).toBe(true);
    expect(existsSync(join(d, "out", "results.md"))).toBe(true);
    ledger.close();
  }, 120_000);

  it("charges calls of unknown cost at their reservation, in the budget and in the ledger", async () => {
    const d = tmp();
    const ledger = SpendLedger.open(join(d, "l.json"));
    const gateway = new FakeGateway(null);
    const [s] = await runSuite({ player: "model-obs-only", situations: ["S1"], seeds: [1], outDir: join(d, "out"), gitHash: "test", model: setup(ledger, gateway) });
    expect(s.modelCalls.unknownUsage).toBe(gateway.calls);
    expect(s.spendUsd.charged).toBeCloseTo(0.002 * gateway.calls, 9);
    expect(ledger.entries()[0]).toMatchObject({ chargedUsd: s.spendUsd.charged });
    expect(ledger.entries()[0].note).toMatch(/unknown cost/);
    ledger.close();
  }, 120_000);

  it("refuses to start an episode the stage cannot cover, before any call", async () => {
    const d = tmp();
    const ledger = SpendLedger.open(join(d, "l.json"));
    ledger.settle(ledger.reserve("pilot", "earlier", 7.9), 7.9);
    const gateway = new FakeGateway();
    await expect(runSuite({ player: "model-history", situations: ["S1"], seeds: [0], outDir: join(d, "out"), gitHash: "test", model: setup(ledger, gateway) })).rejects.toThrow(/Stage "pilot"/);
    expect(gateway.calls).toBe(0);
    ledger.close();
  });

  it("smoke stage: exactly one call, reserved and settled in the smoke stage", async () => {
    const d = tmp();
    const ledger = SpendLedger.open(join(d, "l.json"));
    const gateway = new FakeGateway(0.0007);
    const trace = new TraceWriter(join(d, "smoke-trace.jsonl"));
    const r = await smokeCall(gateway, "manual", ledger, "test", 0.01, trace);
    verifyTrace(linesFor(join(d, "smoke-trace.jsonl")));
    // The reservation and the call start are traced so an interrupted smoke can be reconciled.
    expect(trace.lines.map((l) => l.type)).toEqual(["ledger_reservation", "reset", "observation", "model_call_start", "model_call", "model_reply", "smoke_outcome"]);
    expect(gateway.calls).toBe(1);
    expect(r.record).toMatchObject({ status: "ok", costUsd: 0.0007, model: "fake-model", cache: { read: 3000, write: 0 } });
    expect(ledger.entries()).toEqual([expect.objectContaining({ stage: "smoke", status: "settled", chargedUsd: 0.0007 })]);
    ledger.close();
  });
});

describe("scripted baseline through the harness", () => {
  it("records the suite's fields for each episode", async () => {
    const d = tmp();
    const [a, b] = await runSuite({ player: "baseline-quest", situations: ["S1"], seeds: [0, 1], outDir: d, gitHash: "test" });
    for (const s of [a, b]) {
      expect(s).toMatchObject({ situation: "S1", player: "baseline-quest", success: true, gateway: null, ledgerEntry: null, prefix: null, startTick: 0 });
      expect(s.baselineLog?.sieg.length).toBeGreaterThan(0);
    }
    // The seeds are reproducibility trials: the seed changes the room code and
    // ids (so the start hash), not the play.
    expect(a.startHash).not.toBe(b.startHash);
    expect(a.gameTicks).toBe(b.gameTicks);
    expect(a.decisions).toEqual(b.decisions);
    const results = JSON.parse(readFileSync(join(d, "results.json"), "utf8"));
    expect(results.aggregate[0]).toMatchObject({ situation: "S1", trials: 2, successes: 2, invalidActions: 0 });
  }, 120_000);
});


const linesFor = (path: string): TraceLine[] => readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));

describe("checkpointed metrics and resuming", () => {
  it("reproduces gameplay traces and complete metrics using only S1 mock responses", async () => {
    const root = tmp();
    const ledger = SpendLedger.open(join(root, "ledger.json"));
    const turns: Record<string, number> = {};
    const gateway: Gateway = {
      label: "mock-sequence", worstCaseUsd: () => 0.01,
      async complete(_system, user) {
        const { observation: o } = JSON.parse(user);
        const turn = turns[o.hero] = (turns[o.hero] ?? 0) + 1;
        const action = turn === 1 ? { type: "message", text: `hello from ${o.hero}` } : turn === 2 ? { type: "not-an-action" } : { type: "wait", ticks: 30 };
        return { text: JSON.stringify({ actions: [action] }), tokens: { input: 100, output: 10 }, costUsd: 0.01, cache: { read: 80, write: 0 }, model: "mock" };
      },
    };
    const run = (outDir: string) => runSuite({ player: "model-obs-only", situations: ["S1"], seeds: [0], outDir, gitHash: "test", model: setup(ledger, gateway) });
    const [a] = await run(join(root, "a"));
    for (const key of Object.keys(turns)) delete turns[key];
    const [b] = await run(join(root, "b"));
    const traces = [a, b].map((s) => linesFor(s.trace));
    for (const [i, trace] of traces.entries()) {
      verifyTrace(trace);
      const summary = [a, b][i];
      const steps = trace.filter((l) => l.type === "step");
      const calls = trace.filter((l) => l.type === "model_call");
      const end = (trace.at(-1)!.data as { outcome: { decisions: unknown; invalidActions: unknown; reason: string } }).outcome;
      expect(summary.decisions).toEqual(end.decisions);
      expect(summary.invalidActions).toEqual(end.invalidActions);
      expect(summary.reason).toBe(end.reason);
      expect(summary.modelCalls.attempted).toBe(calls.length);
      expect(summary.tokens.input).toBe(calls.length * 100);
      expect(summary.tokens.output).toBe(calls.length * 10);
      expect(summary.tokens.cacheRead).toBe(calls.length * 80);
      expect(summary.messages.sieg + summary.messages.coco).toBe(trace.filter((l) => l.type === "message").length);
      expect(Object.values(summary.actions.sieg).reduce((a, b) => a + b, 0) + Object.values(summary.actions.coco).reduce((a, b) => a + b, 0)).toBe(steps.length);
      expect(summary.spendUsd.charged).toBeLessThanOrEqual(EPISODE_CAP_USD.S1);
      expect(summary.wallSeconds).toBeGreaterThanOrEqual(0);
      expect(summary.endHash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(a.startHash).toBe(b.startHash);
    expect(a.endHash).toBe(b.endHash);
    expect(a.actions).toEqual(b.actions);
    expect(a.gameTicks).toBe(b.gameTicks);
    expect(a.reason).toBe("spend_limit");
    expect(a.invalidActions.sieg + a.invalidActions.coco).toBeGreaterThan(0);
    expect(a.gameTicks).toBeGreaterThan(0);
    // Wall time and response latency are measurements, not deterministic state.
    const semantic = (trace: TraceLine[]) => trace.filter((l) => ["observation", "action", "result", "invalid_action", "message", "terminal"].includes(l.type)).map(({ type, tick, player, data }) => ({ type, tick, player, data }));
    expect(semantic(traces[0])).toEqual(semantic(traces[1]));
    const start = await environmentFor("S1").reset(0);
    expect(a.startHash).toBe(start.startHash);
    ledger.close();
  });

  it("resumes a completed suite without dispatching again, and rejects changed configuration or damaged traces", async () => {
    const root = tmp();
    const ledger = SpendLedger.open(join(root, "ledger.json"));
    const gateway = new FakeGateway();
    const options = { player: "model-history" as const, situations: ["S1" as const], seeds: [0], outDir: join(root, "out"), gitHash: "test", model: setup(ledger, gateway) };
    const [first] = await runSuite(options);
    const count = gateway.calls;
    const [resumed] = await runSuite({ ...options, resume: true });
    expect(resumed).toEqual(first);
    expect(gateway.calls).toBe(count);
    expect(ledger.entries()).toHaveLength(1);
    await expect(runSuite({ ...options, resume: true, gitHash: "other" })).rejects.toThrow(/configuration/);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(first.trace, readFileSync(first.trace, "utf8").replace('"seq":0', '"seq":999'));
    await expect(runSuite({ ...options, resume: true })).rejects.toThrow(/integrity/);
    expect(gateway.calls).toBe(count);
    ledger.close();
  });

  it("persists interrupted usage, resumes into a new attempt, and preserves the original trace", async () => {
    const root = tmp();
    const path = join(root, "ledger.json");
    const controller = new AbortController();
    const ledger = SpendLedger.open(path);
    let hangingCalls = 0;
    const hung: Gateway = { label: "resume-test", worstCaseUsd: () => 0.002, complete: async () => {
      hangingCalls++;
      if (hangingCalls === 2) setTimeout(() => controller.abort(), 0);
      return new Promise(() => {}); // deliberately ignores abort; the meter must still release
    } };
    const options = { player: "model-obs-only" as const, situations: ["S1" as const], seeds: [0], outDir: join(root, "out"), gitHash: "test" };
    const [interrupted] = await runSuite({ ...options, model: setup(ledger, hung), signal: controller.signal });
    expect(interrupted.reason).toBe("manual_stop");
    expect(interrupted.modelCalls).toMatchObject({ attempted: 2, failed: 2, unknownUsage: 2 });
    const oldTrace = readFileSync(interrupted.trace, "utf8");
    expect(ledger.committed()).toBe(0.004);
    ledger.close();
    const reopened = SpendLedger.open(path);
    const normal = new FakeGateway();
    const gateway = { ...hung, complete: normal.complete.bind(normal) };
    const [resumed] = await runSuite({ ...options, model: setup(reopened, gateway), resume: true });
    expect(resumed.attempt).toBe(2);
    expect(resumed.trace).not.toBe(interrupted.trace);
    expect(readFileSync(interrupted.trace, "utf8")).toBe(oldTrace);
    expect(reopened.entries()).toHaveLength(2);
    expect(reopened.committed()).toBeCloseTo(0.004 + resumed.spendUsd.charged, 6);
    const results = JSON.parse(readFileSync(join(options.outDir, "results.json"), "utf8"));
    expect(results.previousAttempts[0].summary.reason).toBe("manual_stop");
    reopened.close();
  });

  it("enforces the $25 global cap across restarts and normal two-hero runner behavior", async () => {
    const root = tmp();
    const path = join(root, "ledger.json");
    const ledger = SpendLedger.open(path);
    // Accounting-only fixtures: consume prior stage allowances, no scenario execution.
    for (const [stage, usd] of [["smoke", 0.1], ["final", 15], ["contingency", 1.9], ["pilot", 7.8]] as const)
      ledger.settle(ledger.reserve(stage, "prior-accounting", usd), usd);
    const gateway: Gateway = { label: "known-cap", worstCaseUsd: () => 0.01, complete: async () => ({ text: '{"actions":[{"type":"wait","ticks":30}]}', tokens: null, costUsd: null }) };
    const options = { player: "model-history" as const, situations: ["S1" as const], seeds: [0], outDir: join(root, "one"), gitHash: "test" };
    const [s] = await runSuite({ ...options, model: setup(ledger, gateway) });
    expect(s.reason).toBe("spend_limit");
    expect(ledger.committed()).toBeLessThanOrEqual(25);
    expect(ledger.remaining()).toBeLessThan(0.2);
    ledger.close();
    const resumed = SpendLedger.open(path);
    let dispatched = false;
    const noMore = { ...gateway, complete: async () => { dispatched = true; return { text: "", tokens: null, costUsd: null }; } };
    await expect(runSuite({ ...options, outDir: join(root, "two"), model: setup(resumed, noMore) })).rejects.toThrow(/Stage|total budget/);
    expect(dispatched).toBe(false);
    expect(resumed.committed()).toBeLessThanOrEqual(25);
    resumed.close();
  });
});


describe("crash-left partial output", () => {
  it("keeps partial bytes and open reservations when resuming with a new attempt", async () => {
    const root = tmp();
    const path = join(root, "ledger.json");
    const ledger = SpendLedger.open(path);
    const gateway = new FakeGateway();
    const options = { player: "model-obs-only" as const, situations: ["S1" as const], seeds: [0], outDir: join(root, "out"), gitHash: "test", model: setup(ledger, gateway) };
    const controller = new AbortController(); controller.abort();
    await runSuite({ ...options, signal: controller.signal });
    expect(gateway.calls).toBe(0);
    ledger.reserve("pilot", "killed-attempt", EPISODE_CAP_USD.S1);
    const partial = join(options.outDir, "S1-seed0");
    mkdirSync(partial);
    writeFileSync(join(partial, "trace.jsonl"), '{"seq":0');
    const [resumed] = await runSuite({ ...options, resume: true });
    expect(resumed.attempt).toBe(2);
    expect(readFileSync(join(partial, "trace.jsonl"), "utf8")).toBe('{"seq":0');
    expect(ledger.entries()[0].status).toBe("open");
    expect(ledger.committed()).toBeCloseTo(EPISODE_CAP_USD.S1 + resumed.spendUsd.charged, 6);
    expect(JSON.parse(readFileSync(join(options.outDir, "results.json"), "utf8")).previousAttempts).toEqual([{ directory: partial }]);
    ledger.close();
  });
});


describe("paid entrypoint guards (no network)", () => {
  it("blocks the legacy model runner and alternate ledger paths before provider access", () => {
    for (const args of [
      ["scripts/midterm/run-episode.ts", "--policy", "anthropic"],
      ["scripts/midterm/run-episode.ts", "--policy", "openai"],
      ["scripts/midterm/evaluate.ts", "--ledger", "alternate.json"],
    ]) {
      try { execFileSync(process.execPath, ["--import", "tsx", ...args], { encoding: "utf8", stdio: "pipe" }); throw Error("entrypoint unexpectedly accepted"); }
      catch (e) {
        const output = String((e as { stderr?: string }).stderr ?? e);
        expect(output).toMatch(/persistent spend ledger|ledger overrides are disabled/);
      }
    }
  }, 15_000);
});
