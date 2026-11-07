// Showcase paid scope AFTER a future unlock (audit 2026-11-07, finding 4).
// TEST-ONLY: the lock is mocked open here so the scope check behind it can be
// exercised. The real SHOWCASE_PAID_APPROVED stays false (showcase.test.ts).
import { describe, expect, it, vi } from "vitest";
vi.mock("../src/showcase.js", async (orig) => ({ ...(await orig<typeof import("../src/showcase.js")>()), SHOWCASE_PAID_APPROVED: true }));
const { validatePlan, defaultWallSeconds } = await import("../src/harness.js");
import type { ModelSetup } from "../src/harness.js";

const ID = "showcase-maze-griffin-complete-v1" as const;
const model = (over: Record<string, unknown> = {}) => ({ gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot", maxBatch: 4, guidance: "showcase-maze-griffin-v1", ...over }) as unknown as ModelSetup;

describe("showcase paid scope once unlocked (lock mocked open in this test only)", () => {
  it("admits only openai:gpt-6-luna@medium, batch 4, the showcase guidance and seed 0", () => {
    // The guidance itself is still "proposed", so even the exact scope is refused by the guidance check.
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: model() })).toThrow(/not approved/);
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [1], model: model() })).toThrow(/seed 0/);
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: model({ gateway: { label: "openai:gpt-6-luna@high" } }) })).toThrow(/limited to/);
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: model({ maxBatch: 2 }) })).toThrow(/limited to/);
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: model({ guidance: undefined }) })).toThrow(/limited to/);
  });

  it("gives showcase model runs the owner-approved 7,200 s wall clock by default; others unchanged", () => {
    expect(defaultWallSeconds({ situations: [ID], model: model() })).toBe(7200);
    expect(defaultWallSeconds({ situations: [ID] })).toBe(600);
    expect(defaultWallSeconds({ situations: ["griffin-prepared-return-v1"], model: model() })).toBe(3600);
    expect(defaultWallSeconds({ situations: ["S2-local"], model: model() })).toBe(3600);
  });
});
