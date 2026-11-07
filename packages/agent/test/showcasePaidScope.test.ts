// Owner-authorized north-next showcase; no provider call in tests.
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { SpendLedger } from "../src/ledger.js";
import { MockGateway } from "../src/policies/mockGateway.js";
const { validatePlan, defaultWallSeconds, runSuite } = await import("../src/harness.js");
import type { ModelSetup } from "../src/harness.js";

const ID = "showcase-maze-griffin-complete-v1" as const;
const model = (over: Record<string, unknown> = {}) => ({ gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot", maxBatch: 4, guidance: "showcase-maze-griffin-v1", ...over }) as unknown as ModelSetup;

describe("owner-authorized north-next scope", () => {
  it("admits only openai:gpt-6-luna@medium, batch 4, the showcase guidance and seed 0", () => {
    // Only the approved exact scope passes.
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: model() })).not.toThrow();
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
  it("rejects multiple seeds, paid resume/retry and an excessive cap before dispatch", async () => {
    const plan = { player: "model-centralized" as const, situations: [ID], seeds: [0], model: model() };
    expect(() => validatePlan({ ...plan, seeds: [0, 1] })).toThrow(/seed 0/);
    expect(() => validatePlan({ ...plan, seeds: [0, 0] })).toThrow(/Duplicate/);
    expect(() => validatePlan({ ...plan, resume: true })).toThrow(/one attempt only/);
    expect(() => validatePlan({ ...plan, episodeCapUsd: 2.01 })).toThrow(/cap|never raise/);
    await expect(runSuite({ ...plan, resume: true, outDir: "/tmp/showcase-should-never-dispatch", gitHash: "test-only" })).rejects.toThrow(/one attempt only/);
  });

  it("keeps the new scripted demonstration player off official A/B/C cases", () => {
    for (const id of ["S2-local", "griffin-unprepared-return-v1", "griffin-prepared-return-v1"] as const)
      expect(() => validatePlan({ player: "baseline-showcase-route", situations: [id], seeds: [0] })).toThrow(/restricted to showcase/);
  });

  it("records the 7,200 s model default in the actual run and summary, with a free failing gateway", async () => {
    const dir = mkdtempSync(join(tmpdir(), "showcase-wall-"));
    const ledger = SpendLedger.open(join(dir, "scratch-ledger.json"));
    class FreeFailure extends MockGateway {
      override async complete(): Promise<never> { throw Error("intentional offline gateway failure"); }
    }
    try {
      const [summary] = await runSuite({ player: "model-centralized", situations: [ID], seeds: [0], outDir: join(dir, "run"), gitHash: "offline-test",
        episodeCapUsd: 0.01, model: { gateway: new FreeFailure(0), ledger, stage: "pilot", manual: "test-only manual", priceSource: "mock, zero cost", guidance: "showcase-maze-griffin-v1" } });
      expect(summary.wallLimitSeconds).toBe(7200);
      expect(JSON.parse(readFileSync(join(dir, "run", "run.json"), "utf8")).wallSeconds).toBe(7200);
      expect(summary.modelCalls.failed).toBeGreaterThan(0);
    } finally { ledger.close(); rmSync(dir, { recursive: true, force: true }); }
  }, 60_000);

  it("the exact live CLI validates but cannot dispatch without a credential", () => {
    const env = { ...process.env };
    delete env.OPENAI_API_KEY;
    delete env.ANTHROPIC_API_KEY;
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/midterm/live.ts", "--scenario", ID, "--seed", "0", "--player", "model-centralized", "--guidance", "showcase-maze-griffin-v1", "--gateway", "openai", "--model", "gpt-6-luna", "--effort", "medium", "--max-spend-usd", "2.00", "--wall-seconds", "7200", "--paid"], { env, encoding: "utf8", timeout: 30_000 });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/no OPENAI_API_KEY and no interactive terminal/);
    expect(result.stderr).not.toMatch(/locked for paid|not approved|paid scope requires|insufficient/);
  }, 35_000);

});
