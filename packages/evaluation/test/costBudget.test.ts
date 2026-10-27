import { describe, it, expect } from "vitest";
import { CostBudget } from "../src/costBudget.js";
import { validateEnvelope } from "../src/scheduler.js";
describe("paid-call reservations and intent restrictions", () => {
  it("reserves before dispatch and refuses requests that would exceed the dollar ceiling", () => {
    const b = new CostBudget({
      maximumUsd: 0.01,
      inputUsdPerMillion: 2,
      outputUsdPerMillion: 10,
      source: "explicit test prices",
    });
    const first = b.reserve(1000, 500);
    expect(b.accountedUsd).toBe(0.007);
    expect(() => b.reserve(1000, 500)).toThrow("dollar_budget");
    expect(first.settle(500, 100)).toBe(0.002);
    expect(b.accountedUsd).toBeCloseTo(0.002);
    expect(() => first.settle(1, 1)).toThrow("Already settled");
  });
  it("does not permit guessed or missing price information", () => {
    expect(
      () =>
        new CostBudget({
          maximumUsd: 1,
          inputUsdPerMillion: 0,
          outputUsdPerMillion: 2,
          source: "",
        }),
    ).toThrow();
  });
  it("rejects hidden outcome fields rather than silently accepting them", () => {
    const a = {
      observation_id: "a",
      action_id: "b",
      plan: [{ type: "wait", ticks: 1 }],
    };
    expect(() => validateEnvelope({ ...a, hp: 100 } as never)).toThrow(
      "Unexpected",
    );
    expect(() =>
      validateEnvelope({
        ...a,
        plan: [{ type: "wait", ticks: 1, position: [1, 2] }],
      } as never),
    ).toThrow("Unexpected");
  });
});
