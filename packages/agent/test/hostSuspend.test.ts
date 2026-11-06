// P0 of the 2026-11-05 model-navigator run review: a stalled model request
// can never hold the evaluation past its deadline, unknown-usage calls are
// charged their reservation once, and host sleep is prevented and recorded.
// Offline; no provider request.

import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, ModelCallError, type Completion, type Gateway } from "../src/budget.js";
import { keepAwake, SuspendMonitor } from "../src/keepAwake.js";

/** Never looks at its abort signal; resolves only when the test says so. */
class DeafGateway implements Gateway {
  readonly label = "mock:deaf";
  release: (c: Completion) => void = () => {};
  worstCaseUsd() {
    return 0.002;
  }
  complete(): Promise<Completion> {
    return new Promise((resolve) => (this.release = resolve));
  }
}

describe("a stalled request cannot block past the per-call deadline", () => {
  it("rejects at the deadline even when the transport ignores abort, charges the reservation once, and ignores a late reply", async () => {
    const budget = new ModelBudget({ ...defaultBudgetLimits, callTimeoutMs: 80 });
    const deaf = new DeafGateway();
    const metered = new MeteredGateway(deaf, budget, "coco");
    const started = performance.now();
    const err = await metered.complete("s", "u").catch((e) => e);
    const elapsed = performance.now() - started;
    expect(err).toBeInstanceOf(ModelCallError);
    expect(err.status).toBe("timeout");
    expect(elapsed).toBeGreaterThanOrEqual(75);
    expect(elapsed).toBeLessThan(1000);
    expect(budget.records).toHaveLength(1);
    expect(budget.records[0]).toMatchObject({ status: "timeout", tokens: null, costUsd: null, chargedUsd: 0.002 });
    expect(budget.unknownUsage.coco).toBe(1);
    expect(budget.chargedUsd).toBeCloseTo(0.002, 9);
    // The provider answers long after: nothing is recorded or charged again.
    deaf.release({ text: "{}", tokens: { input: 10, output: 10 }, costUsd: 0.0001 });
    await new Promise((r) => setTimeout(r, 20));
    expect(budget.records).toHaveLength(1);
    expect(budget.chargedUsd).toBeCloseTo(0.002, 9);
    // Nothing is left in flight, so the next call is admitted against the cap normally.
    expect(budget.exhausted("coco")).toBeUndefined();
  });

  it("three stalled calls in a row take about three deadlines, not longer", async () => {
    const budget = new ModelBudget({ ...defaultBudgetLimits, callTimeoutMs: 50 });
    const metered = new MeteredGateway(new DeafGateway(), budget, "sieg");
    const started = performance.now();
    for (let k = 0; k < 3; k++) await metered.complete("s", "u").catch(() => undefined);
    expect(performance.now() - started).toBeLessThan(150 + 500);
    expect(budget.records.map((r) => r.status)).toEqual(["timeout", "timeout", "timeout"]);
  });
});

describe("host sleep", () => {
  it("holds caffeinate on macOS, tied to this process, and does nothing elsewhere", () => {
    const calls: { cmd: string; args: string[] }[] = [];
    let killed = 0;
    const fake = Object.assign(new EventEmitter(), { unref() {}, kill() { killed++; return true; } });
    const a = keepAwake({ platform: "darwin", pid: 4242, spawner: (cmd, args) => (calls.push({ cmd, args }), fake as never) });
    expect(a.mode).toBe("caffeinate");
    expect(calls).toEqual([{ cmd: "caffeinate", args: ["-i", "-s", "-w", "4242"] }]);
    a.stop();
    expect(killed).toBe(1);
    expect(keepAwake({ platform: "linux", spawner: () => { throw Error("not called"); } }).mode).toBe("unsupported");
    expect(keepAwake({ platform: "darwin", spawner: () => { throw Error("ENOENT"); } })).toMatchObject({ mode: "unavailable", detail: "ENOENT" });
  });

  it("records a wall-clock jump as a host suspension, not ordinary ticks", () => {
    let t = Date.parse("2026-11-05T23:40:00Z");
    const seen: number[] = [];
    const m = new SuspendMonitor((s) => seen.push(s.seconds), 1000, 5000, () => t);
    for (let k = 0; k < 5; k++) { t += 1000; m.check(); }
    expect(m.suspensions).toEqual([]);
    // The 2026-11-05 run: a 657 s maintenance sleep.
    t += 657_000;
    m.check();
    t += 1000;
    m.check();
    expect(seen).toEqual([657]);
    expect(m.suspensions[0]).toMatchObject({ from: "2026-11-05T23:40:05.000Z", to: "2026-11-05T23:51:02.000Z", seconds: 657 });
    expect(m.totalSeconds()).toBe(657);
  });
});
