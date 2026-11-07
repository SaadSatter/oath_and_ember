// Prompt-tuned continuous showcase, showcase-maze-griffin-complete-v1
// (docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md). Offline: no model call, no
// network, no spending. Checks that the showcase is separate from the frozen
// A/B/C lists, starts at the normal Goddess Shrine checkpoint, that its success predicate needs
// every step of the combat route, that its guidance is proposed (paid runs
// refused) and contains the approved v4 text unchanged, and that the free
// scripted baseline completes the whole route deterministically.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { ABC_SITUATIONS, environmentFor, SHOWCASE_SITUATIONS, SITUATIONS, situation } from "../src/suite.js";
import { episodes, showcaseComplete, showcaseEpisodeComplete, SHOWCASE_REQUIRED_HISTORY, SHOWCASE_ORDERED_MILESTONES } from "../src/evaluator.js";
import { EPISODE_CAP_USD, OBS_ONLY_SITUATIONS, runSuite, SHOWCASE_WALL_CLOCK_CEILING, validatePlan, checkWallSeconds, type ModelSetup } from "../src/harness.js";
import { SHOWCASE, SHOWCASE_GUIDANCE_ID, SHOWCASE_HASH, SHOWCASE_ID, SHOWCASE_PAID_APPROVED } from "../src/showcase.js";
import { CentralPlanner } from "../src/policies/centralized.js";
import { runShowcaseKnockoutProbe } from "../src/route/showcaseKnockoutProbe.js";
import { guidance, guidanceApproved, guidanceBlock, guidanceHash, SHOWCASE_PHASE_PLAN } from "../src/policies/situationGuidance.js";
import { ModelBudget, MeteredGateway } from "../src/budget.js";
import { MockGateway } from "../src/policies/mockGateway.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const manual = readFileSync(join(root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
/** Normal goddess checkpoint start hashes, seeds 0 and 1 (SITUATION_A.md). */
const SHRINE_START = { 0: "9d565ae90d161cc9e79979e0b9b66b1c5499d5a22e5292ba10ca271bda12cb50", 1: "f18052b4e9d452c9cb5251d3b34739292b833f0b79f3c4e9562b944d8a05bb21" };
const GUIDANCE_SHA = "ea5d75ba9b74a4c72ac60f0b2f35aaa8e991c5e767737a34fc14b871a355d320";
const PROMPT_SHA = "0099a850c7219c31797e0802bc82c7a688c99512adc600fe4a4aa808b7087e8b";
const BASELINE_END_SEED0 = "c0e8e3551152d57d9bc861b83daccfab28df1620bad672125f7aac534ccee563";
const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
const paidLike = (label = "openai:gpt-6-luna@medium") => ({ gateway: { label }, stage: "pilot", maxBatch: 4, guidance: SHOWCASE_GUIDANCE_ID }) as unknown as ModelSetup;
const gateways = () => {
  const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
  return { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
};

describe("showcase definition", () => {
  it("is separate from the frozen A/B/C lists and labelled as excluded", () => {
    expect(SHOWCASE_SITUATIONS.map((s) => s.id)).toEqual([SHOWCASE_ID]);
    expect(SITUATIONS.some((s) => s.id === SHOWCASE_ID)).toBe(false);
    expect(ABC_SITUATIONS.some((s) => s.id === SHOWCASE_ID)).toBe(false);
    expect(SHOWCASE.officialEvaluation).toBe(false);
    expect(SHOWCASE.disclosure).toMatch(/excluded from official A\/B\/C evaluation/);
    expect(SHOWCASE_HASH).toBe("ec827f19555e5456d987f866c6f50414827f8875efd911859f351aeafe532831");
    // No prefix: normal shrine checkpoint, no fixture.
    expect(situation(SHOWCASE_ID).prefix).toBeUndefined();
    expect(SHOWCASE.start.fixture).toBe("none");
  });

  it("treats knockouts as recorded, not terminal (owner decision 2026-11-07), unlike B and C", () => {
    expect(episodes[SHOWCASE_ID].failure).toBeUndefined();
    expect(episodes["griffin-unprepared-return-v1"].failure).toBeDefined();
    expect(episodes["griffin-prepared-return-v1"].failure).toBeDefined();
    const s = situation(SHOWCASE_ID);
    expect(`${s.briefing} ${s.task}`).not.toMatch(/ends as a failure|must avoid knockout/i);
    expect(s.briefing).toMatch(/does not end the episode/);
  });

  it("has the owner-approved limits, cap and wall clock, and the planner allowed", () => {
    expect(episodes[SHOWCASE_ID].limits).toEqual({ maxTicks: 36_000, maxDecisionsPerPlayer: 4_000, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 8_000_000 });
    expect(EPISODE_CAP_USD[SHOWCASE_ID]).toBe(2.0);
    expect(SHOWCASE_WALL_CLOCK_CEILING[SHOWCASE_ID]).toBe(7200);
    expect(() => checkWallSeconds({ situations: [SHOWCASE_ID], wallSeconds: 7200 })).not.toThrow();
    expect(() => checkWallSeconds({ situations: [SHOWCASE_ID], wallSeconds: 7201 })).toThrow(/never raise/);
    expect(OBS_ONLY_SITUATIONS).toContain(SHOWCASE_ID);
  });
});

describe("showcase start", () => {
  it("refuses a hidden start prefix so opening actions cannot happen outside this episode", async () => {
    const { AgentEnvironment } = await import("../src/environment.js");
    const env = new AgentEnvironment({ preset: SHOWCASE_ID, prefix: { name: "forbidden setup", run: async () => { throw Error("must not run"); } } });
    await expect(env.reset(0)).rejects.toThrow(/normal goddess checkpoint with no prefix/);
  });
  it("is the normal goddess checkpoint with no opening prefix and resets identically", async () => {
    const env = environmentFor(SHOWCASE_ID);
    const a = await env.reset(0);
    expect(a.startHash).toBe(SHRINE_START[0]);
    const again = await env.reset(0);
    expect(again.startHash).toBe(a.startHash);
    const shrine = await environmentFor("S1").reset(0);
    expect(shrine.startHash).toBe(a.startHash);
    expect(a.tick).toBe(0);
    const one = await environmentFor(SHOWCASE_ID).reset(1);
    expect(one.startHash.startsWith(SHRINE_START[1])).toBe(true);
    for (const id of ["sieg", "coco"] as const) {
      const o = await env.observe(id);
      expect(o.area.name).toBe("Goddess Shrine");
      expect(o.self.hp).toBe(100);
      expect(o.inventory.items.filter((i) => /^(vanity_mirror|enchanted_shears|griffin_wig)$/.test(i.id) && i.count > 0)).toEqual([]);
    }
  });
});

describe("showcase guidance", () => {
  it("is owner-approved at its exact pinned text, and contains the approved v4 text unchanged", () => {
    const g = guidance(SHOWCASE_GUIDANCE_ID);
    expect(g.status).toBe("approved");
    expect(guidanceApproved(g)).toBe(true);
    expect(g.situations).toEqual([SHOWCASE_ID]);
    expect(guidanceHash(g.text)).toBe(GUIDANCE_SHA);
    const v4 = guidance("b-post-combined-v4").text;
    expect(guidanceHash(v4)).toBe("1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34");
    expect(g.text).toBe(`${SHOWCASE_PHASE_PLAN}\n\n${v4}`);
    // The frozen C3 guidance is untouched.
    expect(guidanceHash(guidance("c-post-v4-inventory-hint-v1").text)).toBe("d750861ba30255fd10e139532c8394e2e7dd44237e1ba50dc3ee4e0d311afa83");
  });

  it("names no coordinates, waypoints or puzzle answers, and forbids the peaceful route", () => {
    const t = SHOWCASE_PHASE_PLAN;
    expect(t).not.toMatch(/\d+(\.\d+)?\s*,\s*\d+/); // no coordinate pairs
    expect(t).not.toMatch(/\btile\b|\bx\s*=|\by\s*=/i);
    // No maze answer key: which obstacle takes which ability, or the key/wolf/cow steps.
    expect(t).not.toMatch(/cow|wolf|hedge is|burn|black hole|key/i);
    expect(t).not.toMatch(/mirror|groom/i);
    expect(t).toMatch(/do not go to its nest or use any backpack item there/);
    expect(t).toMatch(/Phase 0[\s\S]*Phase 1[\s\S]*Phase 2[\s\S]*Phase 3[\s\S]*Phase 4/);
    // The owner's health-aware refinement (2026-11-07): before and during combat, and recovery after a knockout.
    expect(t).toMatch(/Health, in every phase/);
    expect(t).toMatch(/Before entering the Griffin Enclosure, note both heroes' health/);
    expect(t).toMatch(/Fight defensively/);
    expect(t).toMatch(/If a hero is knocked out[\s\S]*continue the current phase/);
    expect(t).not.toMatch(/knockout ends the episode/i);
  });

  it("gives the planner the generic prompt plus exactly one guidance block (prompt hash pinned)", () => {
    const s = situation(SHOWCASE_ID);
    const base = new CentralPlanner(manual, gateways(), 4, s.briefing, s.tutorial, s.task);
    const post = new CentralPlanner(manual, gateways(), 4, s.briefing, s.tutorial, s.task, guidance(SHOWCASE_GUIDANCE_ID).text);
    expect(post.system).toBe(base.system + guidanceBlock(guidance(SHOWCASE_GUIDANCE_ID).text));
    expect(post.promptHash).toBe(PROMPT_SHA);
  });
});

describe("showcase run rules", () => {
  it("admits only the exact approved scope; allows mock and its own baseline only", () => {
    expect(SHOWCASE_PAID_APPROVED).toBe(true);
    expect(() => validatePlan({ player: "model-centralized", situations: [SHOWCASE_ID], seeds: [0], model: paidLike() })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [SHOWCASE_ID], seeds: [0], model: { ...mock, guidance: SHOWCASE_GUIDANCE_ID } as ModelSetup })).not.toThrow();
    expect(() => validatePlan({ player: "baseline-showcase-route", situations: [SHOWCASE_ID], seeds: [0] })).not.toThrow();
    expect(() => validatePlan({ player: "baseline-maze-heuristic", situations: [SHOWCASE_ID], seeds: [0] })).toThrow(/runs only/);
    expect(() => validatePlan({ player: "model-history", situations: [SHOWCASE_ID], seeds: [0], model: mock })).toThrow(/runs only/);
    expect(() => validatePlan({ player: "model-centralized", situations: [SHOWCASE_ID], seeds: [0], final: true, model: mock })).toThrow();
    // The showcase guidance cannot be used on a frozen scenario.
    expect(() => validatePlan({ player: "model-centralized", situations: ["S2-local"], seeds: [0], model: { ...mock, guidance: SHOWCASE_GUIDANCE_ID } as ModelSetup })).toThrow(/limited to/);
  });
});

describe("free scripted baseline: the whole continuous route", () => {
  it("succeeds with every milestone in order, no invalid action, and a pinned end hash; the predicate needs every step", async () => {
    const out = mkdtempSync(join(tmpdir(), "showcase-"));
    let room!: GameRoom;
    const [s] = await runSuite({ player: "baseline-showcase-route", situations: [SHOWCASE_ID], seeds: [0], outDir: out, gitHash: "test", environment: { room: (r) => (room = r) } });
    expect(s.reason).toBe("success");
    expect(s.startHash).toBe(SHRINE_START[0]);
    expect(s.endHash).toBe(BASELINE_END_SEED0);
    expect(s.invalidActions).toEqual({ sieg: 0, coco: 0 });
    expect(s.modelCalls.attempted).toBe(0);
    expect(s.evaluation).toMatchObject({ label: "SHOWCASE", officialEvaluation: false });
    const lines = readFileSync(join(out, `${SHOWCASE_ID}-seed0`, "trace.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const order = lines.filter((l) => l.type === "milestone" && /^showcase:\d/.test(l.data.milestone)).map((l) => l.data.milestone);
    expect(order).toEqual(SHOWCASE.milestones);
    expect(lines.some((l) => l.type === "milestone" && /peaceful/.test(l.data.milestone))).toBe(false);

    // UNIT CHECK ON A COPY OF THE FINAL WORLD (labelled fixture; never used in a run):
    // removing any one step makes the predicate fail.
    const w = room.state;
    expect(showcaseComplete(w)).toBe(true);
    const seen = new Map<string, number>(s.showcaseReport!.milestones.map(m => [m.milestone, m.tick]));
    expect(showcaseEpisodeComplete(w, seen)).toBe(true);
    for (const m of SHOWCASE_REQUIRED_HISTORY) {
      const missing = new Map(seen); missing.delete(m);
      expect(showcaseEpisodeComplete(w, missing), `Missing episode history ${m}`).toBe(false);
    }
    // Labelled evaluator-only fixture: Griffin defeated before maze completion.
    // Revisiting areas after the detour cannot make the episode valid.
    const outOfOrder = new Map(seen);
    outOfOrder.set("showcase:2-griffin-defeated", seen.get("showcase:0-maze-entered")! - 1);
    expect(showcaseEpisodeComplete(w, outOfOrder)).toBe(false);
    for (const m of SHOWCASE_ORDERED_MILESTONES) {
      const missing = new Map(seen); missing.delete(m);
      expect(showcaseEpisodeComplete(w, missing), m).toBe(false);
    }
    expect(lines.some(l => l.type === "observation" && /showcase:0-|showcase:1b-/.test(JSON.stringify(l.data)))).toBe(false);
    const copy = () => structuredClone(w);
    const g = (x: typeof w) => x.puzzles.griffin!.griffin!;
    const variants: [string, (x: typeof w) => void][] = [
      ["Griffin still alive", (x) => { g(x).hp = 320; }],
      ["wig not claimed", (x) => { g(x).wigClaimed = false; }],
      ["tools taken (peaceful grooming)", (x) => { g(x).toolsTaken = true; }],
      ["maze chest not claimed", (x) => { x.inventory!.claimed = x.inventory!.claimed.filter((c) => c !== "hedge-shears-chest"); }],
      ["shears not held", (x) => { x.inventory!.counts.enchanted_shears = 0; }],
      ["no opening Goddess quest", (x) => { x.story!.flags = x.story!.flags.filter((f) => f !== "chapter0.goddess-meet"); }],
      ["no chapter0.complete", (x) => { x.story!.flags = x.story!.flags.filter((f) => f !== "chapter0.complete"); }],
    ];
    for (const [why, edit] of variants) {
      const x = copy();
      edit(x);
      expect(showcaseComplete(x), why).toBe(false);
    }
  }, 120_000);
});

describe("knockout recovery under the game's own rules (certification probe, not a result)", () => {
  it("a real knockout respawns the hero at full health in the same area, keeps progress, backpack and Griffin, and the episode continues to chapter0.complete", async () => {
    const r = await runShowcaseKnockoutProbe(0);
    expect(r.startHash).toBe(SHRINE_START[0]);
    expect(r.probe.stage).toBe("recovered");
    expect(r.report.knockoutsByHero.coco).toBeGreaterThanOrEqual(1);
    const first = r.report.events[0];
    expect(first).toMatchObject({ hero: "coco", area: "Griffin Enclosure", heroHpAfter: 100 });
    const { before, after } = r.aroundKnockout!;
    expect(before.cocoHp).toBeLessThan(100);
    expect(after.cocoHp).toBe(100);
    expect(after.cocoScene).toBe(before.cocoScene);
    expect(after.backpack).toEqual(before.backpack);
    expect(after.backpack.enchanted_shears).toBe(1);
    expect(after.griffinHp).toBe(before.griffinHp);
    expect(after.storyFlags).toEqual(before.storyFlags);
    expect(after.claimed).toEqual(before.claimed);
    expect(after.mazeProgress).toEqual(before.mazeProgress);
    expect(after.mazeProgress).toMatchObject({ burned: true, wolfCaught: true, gateComplete: true });
    expect(after.claimed).toContain("hedge-shears-chest");
    // Not terminal: play went on and every later milestone was reached.
    expect(first.milestonesReachedAfter).toEqual(["showcase:2-griffin-defeated", "showcase:3-wig-acquired-after-defeat", "showcase:3b-returned-with-wig", "showcase:4-offering-accepted", "showcase:5-chapter0-complete"]);
    expect(r.outcome.reason).toBe("success");
    // The evaluator's knockout records never reach a player: no observation or legal list mentions them.
    expect(r.observationLinesMentioningShowcase).toBe(0);
  }, 180_000);
});
