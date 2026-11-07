// Situation C — Griffin Trial, Prepared, goddess return (griffin-prepared-return-v1).
// docs/midterm/SITUATION_C_PREPARED.md. Tests marked UNIT FIXTURE change room
// state directly to reach a position or predicate case quickly; they are never
// part of a checkpoint, baseline or model run.
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { environmentFor, situation } from "../src/suite.js";
import { episodes, griffinWigReturned } from "../src/evaluator.js";
import { validatePlan, runSuite, EPISODE_CAP_USD, ABC_WALL_CLOCK_CEILING_S, OBS_ONLY_SITUATIONS, type ModelSetup } from "../src/harness.js";
import { SITUATION_GRIFFIN_C as C, SITUATION_GRIFFIN_C_HASH, SITUATION_C_PAID_APPROVED, stateDiff } from "../src/griffinSituationC.js";
import { guidance, guidanceApproved, guidanceHash } from "../src/policies/situationGuidance.js";
import { MockGateway } from "../src/policies/mockGateway.js";
import { Director } from "../src/route/director.js";
import { AgentEnvironment, type StartFixture } from "../src/environment.js";
import { CentralPlanner } from "../src/policies/centralized.js";
import { guidanceBlock } from "../src/policies/situationGuidance.js";
import { ModelBudget, MeteredGateway } from "../src/budget.js";
import { PLAYER_KINDS } from "../src/playerKinds.js";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ID = "griffin-prepared-return-v1" as const;
const B_ID = "griffin-unprepared-return-v1" as const;
const TOOLS = /^(vanity_mirror|enchanted_shears|griffin_wig)$/;

async function start(id: typeof ID | typeof B_ID = ID) {
  let room!: GameRoom;
  const env = environmentFor(id, { room: (r) => (room = r) });
  const r = await env.reset(0);
  return { env, room: () => room, r };
}
const both = (env: Awaited<ReturnType<typeof start>>["env"], sieg: Parameters<typeof env.step>[1], coco: Parameters<typeof env.step>[1]) =>
  Promise.all([env.step("sieg", sieg), env.step("coco", coco)]);

describe("Situation C definition", () => {
  it("pins its definition hash, B parity references and the paid lock", () => {
    expect(SITUATION_GRIFFIN_C_HASH).toBe("f68bf85b3bd571be186b04c46083040a179941d0d54fba3eab3f74523d197400");
    expect(C.situation).toBe(ID);
    expect(situation(ID).heldOut).toBe(false); // holdout is enforced by the paid lock and the declaration, as for B
    expect(SITUATION_C_PAID_APPROVED).toBe(false);
    expect(C.parity.bStartHash).toBe("45b1a6aa2c164b2c31885d6e5d514fc8d7eae190ef76d7aad4422445f38db9b8");
    // Same limits as B-return.
    expect(episodes[ID].limits).toEqual(episodes[B_ID].limits);
    expect(EPISODE_CAP_USD[ID]).toBe(EPISODE_CAP_USD[B_ID]);
    expect(ABC_WALL_CLOCK_CEILING_S[ID]).toBe(ABC_WALL_CLOCK_CEILING_S[B_ID]);
    expect(OBS_ONLY_SITUATIONS).toContain(ID);
  });

  it("uses the tutorial and a C briefing that names no tool use, route or defeat requirement", () => {
    const s = situation(ID);
    expect(s.tutorial).toBe(situation("griffin-unprepared-v1").tutorial);
    expect(s.task).toBeUndefined();
    expect(s.briefing).toMatch(/obtain the Griffin's wig/);
    expect(s.briefing).toMatch(/knocked out/);
    expect(s.briefing).not.toMatch(/mirror|shears|nest|groom|trim|pillar|beam|defeat|health to zero|fly|black hole|position/i);
  });

  it("extends only the scope of the frozen v4 guidance to C, with its text and approval unchanged", () => {
    const g = guidance("b-post-combined-v4");
    expect(guidanceHash(g.text)).toBe("1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34");
    expect(guidanceApproved(g)).toBe(true);
    expect(g.situations).toEqual(["griffin-unprepared-v1", B_ID, ID]);
    expect(g.text).not.toMatch(/mirror|shears|nest|groom|wig|griffin|pillar/i);
    for (const other of ["b-post-combined-v3", "b-post-combat-v2", "b-post-a-transfer-v1", "griffin-b-post-v1"])
      expect(guidance(other).situations).not.toContain(ID);
  });

  it("refuses paid C model runs while locked but admits mock and baseline plans", () => {
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
    const paid = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: mock })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...mock, guidance: "b-post-combined-v4" } })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: paid })).toThrow(/locked for paid model runs/);
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...paid, guidance: "b-post-combined-v4" } })).toThrow(/locked for paid model runs/);
    expect(() => validatePlan({ player: "baseline-griffin-heuristic", situations: [ID], seeds: [0] })).not.toThrow();
    // B is not affected by the C lock.
    expect(() => validatePlan({ player: "model-centralized", situations: [B_ID], seeds: [0], model: paid })).not.toThrow();
  });
});

describe("Situation C definition file", () => {
  it("pins docs/midterm/evaluation-abc/C-prepared-return-definition.json and agrees with the code", () => {
    const d = JSON.parse(readFileSync(new URL("../../../docs/midterm/evaluation-abc/C-prepared-return-definition.json", import.meta.url), "utf8"));
    const hash = d.definitionSha256;
    delete d.definitionSha256;
    const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v;
    const text = JSON.stringify(canonical(d)).replace(/[^\x00-\x7f]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
    expect(createHash("sha256").update(text).digest("hex")).toBe(hash);
    expect(hash).toBe("9c91accdecc529a6284dff61306ea9ebbbb753db5c86a74888a360b987b2ea94");
    expect(d.id).toBe(ID);
    expect(d.startHash).toBe(C.start.hashes[0]);
    expect(d.seed1StartHash).toBe(C.start.hashes[1]);
    expect(d.prefixActionsSha256).toBe(C.start.prefixActionsSha256);
    expect(d.parity.bStartHash).toBe(C.parity.bStartHash);
    expect(Object.keys(d.parity.worldDiff)).toEqual([...C.parity.worldDiffPaths]);
    expect(d.prompt.preTunedPromptSha256).toBe(C.prompts.preTunedPromptHash);
    expect(d.prompt.postTunedPromptSha256).toBe(C.prompts.postTunedPromptHash);
    expect(d.limits.gameTicks).toBe(episodes[ID].limits.maxTicks);
  });
});

describe("Situation C start state", () => {
  it("resets to the pinned start, B-return's start plus exactly the two tools", async () => {
    const c = await start();
    const again = await c.env.reset(0);
    expect(c.r.startHash).toBe(C.start.hashes[0]);
    expect(again.startHash).toBe(c.r.startHash);
    expect(c.r.tick).toBe(C.start.tick);
    const cWorld = JSON.parse(JSON.stringify(c.room().state));
    const b = await start(B_ID);
    expect(b.r.startHash).toBe(C.parity.bStartHash);
    const bWorld = JSON.parse(JSON.stringify(b.room().state));
    expect(stateDiff(bWorld, cWorld).map((d) => d.path)).toEqual([...C.parity.worldDiffPaths]);
    const counts = cWorld.inventory.counts;
    expect({ ...counts, vanity_mirror: undefined, enchanted_shears: undefined }).toEqual({ ...bWorld.inventory.counts, vanity_mirror: undefined, enchanted_shears: undefined });
    expect(counts.vanity_mirror).toBe(1);
    expect(counts.enchanted_shears).toBe(1);
    expect(counts.griffin_wig ?? 0).toBe(0);
    expect(cWorld.inventory.claimed).toEqual(bWorld.inventory.claimed);
    expect(cWorld.story.flags).toEqual(bWorld.story.flags);
  }, 60000);

  it("starts a fresh, sleeping 640-HP Griffin and two full-health heroes who can act normally", async () => {
    const { env, room } = await start();
    expect(room().state.sceneId).toBe("GRIFFIN_ENCLOSURE");
    expect(room().state.puzzles.griffin?.griffin).toMatchObject({ hp: 640, phase: "NEST", pillars: [false, false, false, false], mirrorDelivered: false, wigClaimed: false });
    for (const hero of ["sieg", "coco"] as const) {
      const o = await env.observe(hero);
      expect(o.area.name).toBe("Griffin Enclosure");
      expect(o.self.hp).toBe(100);
      expect(o.inventory.items.filter((i) => TOOLS.test(i.id)).map((i) => [i.id, i.count]).sort()).toEqual([["enchanted_shears", 1], ["vanity_mirror", 1]]);
      const legal = (await env.legal_actions(hero)).map((a) => a.type);
      for (const t of ["move", "attack", "defend", "ability", "wait"]) expect(legal).toContain(t);
    }
    const before = { s: (await env.observe("sieg")).self, c: (await env.observe("coco")).self };
    const [rs, rc] = await both(env, { type: "move", direction: "w", ticks: 10 }, { type: "move", direction: "e", ticks: 10 });
    expect(rs.accepted && rc.accepted).toBe(true);
    expect((await env.observe("sieg")).self.x).toBeLessThan(before.s.x);
    expect((await env.observe("coco")).self.x).toBeGreaterThan(before.c.x);
    expect((await env.outcome()).status).toBe("ongoing");
  }, 60000);

  it("shows players no hidden Griffin, puzzle or evaluator state", async () => {
    const { env } = await start();
    for (const hero of ["sieg", "coco"] as const) {
      const text = JSON.stringify([await env.observe(hero), await env.legal_actions(hero)]);
      expect(text).not.toMatch(/mirrorDelivered|shearsDelivered|toolsTaken|groomingStage|wigDropped|wigClaimed|stationary|lastSiegX|griffin-prepared|chapter0\.complete|startHash|evaluator/);
      expect(text).not.toMatch(/640\/640/); // the sleeping Griffin's label is off screen at the entrance
    }
  }, 60000);
});

describe("Situation C success and failure", () => {
  it("needs the wig claimed AND chapter0.complete; Griffin HP is not part of it", async () => {
    // Evaluator UNIT FIXTURE only.
    const { room } = await start();
    const w = room().state, g = w.puzzles.griffin!.griffin!;
    const ok = () => episodes[ID].success(w);
    expect(ok()).toBe(false);
    g.hp = 0; // defeat alone
    expect(ok()).toBe(false);
    g.wigClaimed = true; w.inventory!.counts.griffin_wig = 1; // defeat + wig, no offering
    expect(ok()).toBe(false);
    w.story!.flags.push("chapter0.complete");
    expect(ok()).toBe(true);
    g.hp = 640; // peaceful wig + offering: success by the owner's decision
    expect(ok()).toBe(true);
    g.wigClaimed = false; // chapter0.complete without a claimed wig
    expect(ok()).toBe(false);
    expect(griffinWigReturned).toBe(episodes[ID].success);
  }, 60000);

  it("fails on an authoritative knockout, even though the game respawns at full health", async () => {
    // Damage UNIT FIXTURE: normal server damage handles the lethal hit.
    let lethal = false;
    const env = environmentFor(ID, { tick: (room) => { room.tick(); if (lethal) { lethal = false; room.damage(Object.values(room.state.players)[1], 10000); } } });
    await env.reset(0);
    lethal = true;
    await both(env, { type: "wait", ticks: 2 }, { type: "wait", ticks: 2 });
    expect((await env.outcome()).reason).toBe("knocked_out");
  }, 60000);

  it("does not fail on leaving the enclosure (the return requires it)", async () => {
    const { room } = await start();
    const w = room().state;
    for (const p of Object.values(w.players)) p.sceneId = "GODDESS_SHRINE"; // predicate UNIT FIXTURE
    expect(episodes[ID].failure?.(w, { knockedOut: false })).toBeUndefined();
    expect(episodes[ID].failure?.(w, { knockedOut: true })).toBe("knocked_out");
  }, 60000);
});

describe("Mirror and Shears under ordinary game rules", () => {
  // UNIT FIXTURE: Coco casts Flight for real, then is placed beside the nest
  // (as if she had flown there); every interaction and tick after that is the
  // real server's. An interaction takes no game time, so it is sent alone; time
  // advances only when both heroes have an action.
  async function atNest() {
    const s = await start();
    const d = new Director({ env: s.env });
    await d.both(undefined, { type: "ability", ability: "flight" });
    const coco = Object.values(s.room().state.players).find((p) => p.role === "EMBER")!;
    coco.x = 640; coco.y = 160;
    return { ...s, d };
  }
  const interact = async (d: Director) => (await d.both(undefined, { type: "interact" })).coco;
  const advance = async (d: Director, ticks: number) => {
    for (let t = 0; t < ticks; t += 60) await d.both({ type: "wait", ticks: 60 }, { type: "wait", ticks: 60 });
  };

  it("a plain E at the nest with the Griffin alive delivers both tools and starts grooming; it takes no damage while grooming", async () => {
    const { env, room, d } = await atNest();
    expect((await env.observe("coco")).inventory.nearbyTarget?.name).toMatch(/nest/i);
    const r = await interact(d);
    expect(r.accepted).toBe(true);
    const g = room().state.puzzles.griffin!.griffin!;
    expect(g).toMatchObject({ mirrorDelivered: true, shearsDelivered: true, phase: "GROOMING", hp: 640 });
    // Ordinary rule: damageGriffin ignores hits while it grooms.
    const { damageGriffin } = await import("../../../apps/server/src/griffin.js");
    damageGriffin(room().state, 100);
    expect(g.hp).toBe(640);
  }, 60000);

  it("grooming ends with the tools taken and the wig dropped; collecting it claims the wig at full Griffin HP, which alone is not C success", async () => {
    const { env, room, d } = await atNest();
    await interact(d);
    await advance(d, 60 * 12);
    const w = room().state, g = w.puzzles.griffin!.griffin!;
    expect(g.toolsTaken).toBe(true);
    expect(g.wigDropped).toBe(true);
    expect(w.inventory!.counts.vanity_mirror).toBe(0);
    expect(w.inventory!.counts.enchanted_shears).toBe(0);
    const r = await interact(d);
    expect(r.accepted).toBe(true);
    expect(g.wigClaimed).toBe(true);
    expect(g.hp).toBe(640);
    expect(w.inventory!.counts.griffin_wig).toBe(1);
    expect((await env.outcome()).status).toBe("ongoing");
    expect(episodes[ID].success(w)).toBe(false);
  }, 120000);

  it("after a defeat, a plain E at the nest awards the wig immediately and keeps the tools", async () => {
    const { room, d } = await atNest();
    const g = room().state.puzzles.griffin!.griffin!;
    g.hp = 0; g.phase = "DEFEATED"; // UNIT FIXTURE for the defeated state
    await interact(d);
    expect(g.wigClaimed).toBe(true);
    expect(room().state.inventory!.counts.griffin_wig).toBe(1);
    expect(room().state.inventory!.counts.vanity_mirror).toBe(1);
  }, 60000);
});

describe("C2 baseline: unchanged baseline-griffin-heuristic-v1", () => {
  it("uses the unchanged B baseline source", () => {
    const src = readFileSync(new URL("../src/policies/griffinHeuristic.ts", import.meta.url));
    expect(createHash("sha256").update(src).digest("hex")).toBe("a7c9ea786a8c57c374952d9425b7a4bc25553aa453913ae3f935fca330792edc");
  });

  it("succeeds on C deterministically with zero invalid actions or model calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "c-baseline-"));
    try {
      const run = async (k: number) => (await runSuite({ player: "baseline-griffin-heuristic", situations: [ID], seeds: [0], outDir: join(dir, `r${k}`), gitHash: "test" }))[0];
      const [a, b] = [await run(1), await run(2)];
      expect(a.success).toBe(true);
      expect(a.reason).toBe("success");
      expect(a.startHash).toBe(C.start.hashes[0]);
      expect(a.gameTicks).toBe(b.gameTicks);
      expect(a.endHash).toBe(b.endHash);
      expect(a.invalidActions).toEqual({ sieg: 0, coco: 0 });
      expect(a.modelCalls.attempted).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// Review round 1 (docs/midterm/agent-evidence/reviews/2026-11-06-situation-c-rules-review.md).
describe("Situation C review round 1", () => {
  const manual = readFileSync(new URL("../../../manual/Oath_and_Ember_Player_Manual.md", import.meta.url), "utf8");
  const gateways = () => {
    const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
    return { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
  };
  const planner = (text?: string) => { const s = situation(ID); return new CentralPlanner(manual, gateways(), 4, s.briefing, s.tutorial, s.task, text); };

  it("finding 7: C3's system prompt is exactly C1's plus the v4 block, with the pinned hashes", () => {
    const v4 = guidance("b-post-combined-v4").text;
    const pre = planner(), post = planner(v4);
    expect(post.system).toBe(pre.system + guidanceBlock(v4));
    expect(pre.promptHash).toBe(C.prompts.preTunedPromptHash);
    expect(post.promptHash).toBe(C.prompts.postTunedPromptHash);
    expect(post.maxBatch).toBe(pre.maxBatch);
    expect(pre.system).not.toContain(episodes[ID].goal);
  });

  it("finding 4: B-return's definition at HEAD is unchanged (limits, failure, prefix, task)", () => {
    const b = episodes[B_ID], s = situation(B_ID);
    expect(b.limits).toEqual({ maxTicks: 18000, maxDecisionsPerPlayer: 1600, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 4000000 });
    expect(s.prefix?.name).toBe("opening and ordinary north travel to Griffin enclosure (unprepared)");
    expect(s.task).toBe("Defeat the Griffin, obtain its Divine Wig, return it to the goddess and complete Chapter 0. Both heroes must avoid knockout.");
    expect(s.briefing).toBeUndefined();
    expect(s.tutorial).toBeUndefined();
    const w = { players: { a: { role: "OATH", sceneId: "GODDESS_SHRINE" } } } as never;
    expect(b.failure?.(w, { knockedOut: false })).toBeUndefined();
    expect(b.failure?.(w, { knockedOut: true })).toBe("knocked_out");
    expect(EPISODE_CAP_USD[B_ID]).toBe(0.75);
  });

  it("seed 1 resets to its pinned start hash", async () => {
    expect((await environmentFor(ID).reset(1)).startHash).toBe(C.start.hashes[1]);
  }, 60000);

  it("finding 6: the start fixture is C-only, tool-only and closed once reset returns", async () => {
    let kept!: StartFixture;
    const env = new AgentEnvironment({ preset: ID, prefix: { name: "test", run: async (_e, setup) => { kept = setup!; } } });
    await env.reset(0);
    expect(() => kept.addItems({ vanity_mirror: 1 })).toThrow(/only available during reset/);
    await expect(new AgentEnvironment({ preset: ID, prefix: { name: "test", run: async (_e, setup) => setup!.addItems({ griffin_wig: 1 } as never) } }).reset(0)).rejects.toThrow(/not an approved start item/);
    await expect(new AgentEnvironment({ preset: B_ID, prefix: { name: "test", run: async (_e, setup) => setup!.addItems({ vanity_mirror: 1 }) } }).reset(0)).rejects.toThrow(/no approved start fixture/);
  }, 60000);

  it("the paid lock refuses every model player kind on C, and admits scripted baselines", () => {
    const paid = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    for (const player of PLAYER_KINDS) {
      const plan = () => validatePlan({ player, situations: [ID], seeds: [0], ...(player.startsWith("model-") ? { model: paid } : {}) });
      if (player.startsWith("model-")) expect(plan, player).toThrow();
      else if (player !== "baseline-quest" && player !== "baseline-explore") expect(plan, player).not.toThrow();
    }
  });

  it("finding 8: the Mirror alone starts grooming that never finishes without the Shears; the Griffin stays immune and the Shears stay held", async () => {
    // UNIT FIXTURE for Coco's position only, as above.
    let room!: GameRoom;
    const env = environmentFor(ID, { room: (r) => (room = r) });
    await env.reset(0);
    const d = new Director({ env });
    await d.both(undefined, { type: "ability", ability: "flight" });
    const coco = Object.values(room.state.players).find((p) => p.role === "EMBER")!;
    coco.x = 640; coco.y = 160;
    const r = (await d.both(undefined, { type: "use_item", item: "vanity_mirror" })).coco;
    expect(r.accepted).toBe(true);
    const g = room.state.puzzles.griffin!.griffin!;
    expect(g).toMatchObject({ mirrorDelivered: true, phase: "GROOMING" });
    expect(g.shearsDelivered ?? false).toBe(false);
    for (let t = 0; t < 12 * 60; t += 60) await d.both({ type: "wait", ticks: 60 }, { type: "wait", ticks: 60 });
    expect(g.wigDropped ?? false).toBe(false);
    expect(g.toolsTaken ?? false).toBe(false);
    expect(g.hp).toBe(640);
    expect(room.state.inventory!.counts.enchanted_shears).toBe(1);
  }, 120000);
});
