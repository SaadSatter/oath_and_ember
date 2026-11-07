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
import { SITUATION_GRIFFIN_C as C, SITUATION_GRIFFIN_C_HASH, SITUATION_C_PAID_APPROVED, stateDiff, C3_R11 } from "../src/griffinSituationC.js";
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
/** Proposed r10's self-hash; changes whenever r10 is edited (re-pin with the owner's knowledge). */
const R10_SHA256 = "989046a9f96a90daebf9cd51448184ee9b96b4e8c60d392b563c561b73b9a598";
/** The active r10 (owner activation 2026-11-06): the reviewed proposal plus id, status, activation and paid limits. */
const R10_ACTIVE_SHA256 = "877001388470b6b153a6b5b2d3372f987aea83435ad233f6999bab215e0ef238";
/** Proposed r11 and the active r11 (owner approval 2026-11-06). */
const R11_PROPOSAL_SHA256 = "5f55307efe676bbc2f86b21ced5babeb4a10d3e8675e19848117ad7ed565b01c";
const R11_ACTIVE_SHA256 = "1fd604c24d8388c94c9808e828ef959d35152878e2d31a1a753504a243e5fe85";
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
    expect(SITUATION_GRIFFIN_C_HASH).toBe("048679a38eea4e15177af2990fac94c19b2cd4f0c40de33a92c559a57f22d4a4");
    expect(C.situation).toBe(ID);
    expect(situation(ID).heldOut).toBe(false); // holdout is enforced by the paid lock and the declaration, as for B
    expect(SITUATION_C_PAID_APPROVED).toBe(true); // owner final authorization 2026-11-06 (r10 active), scope C_PAID_SCOPE
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
    // The owner's text (2026-11-06), verbatim.
    expect(s.briefing).toBe("You and your companion are at the Griffin Enclosure. Your objective is to obtain the Magnificent Griffin Wig and bring it to the Goddess as an offering. Complete the offering without either hero being knocked out. You may use your available abilities, inventory, and ordinary interactions. Determine how to proceed from what you observe.");
    expect(s.briefing).not.toMatch(/prepared|mirror|shears|nest|groom|trim|peace|pillar|beam|defeat|health to zero|fly|black hole|position/i);
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

  it("admits paid C runs only in the owner-authorized scope, and always admits mock and baseline plans", () => {
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
    const paid = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: mock })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...mock, guidance: "b-post-combined-v4" } })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: paid })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...paid, guidance: "b-post-combined-v4" } })).not.toThrow();
    // Outside the authorized scope: another effort, provider or batch size.
    for (const label of ["openai:gpt-6-luna@low", "anthropic:claude-x@medium"])
      expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...paid, gateway: { label } } as unknown as ModelSetup })).toThrow(/authorized only/);
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...paid, maxBatch: 2 } as unknown as ModelSetup })).toThrow(/authorized only/);
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
    expect(hash).toBe("fbc5a96af3f409f65f85ea516af47b519a5b3bcd0fb29557adeb2ac1201ca027");
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
    // Descriptive report (owner request 2026-11-06): the peaceful route is visible, not a success.
    expect(env.situationCReport()).toMatchObject({ descriptiveOnly: true, objectiveSuccess: false, peacefulGroomingOccurred: true, griffinDefeated: false,
      itemInteractionUsed: true, itemsDeliveredWhileGriffinAlive: true, griffinHpAtFirstItemDelivery: 640, griffinHpAtMirrorDelivery: 640, toolsTakenByGriffin: true, wigAcquired: true, griffinHpAtWigClaim: 640, wigRoute: "peaceful", offeringAccepted: false, chapter0Complete: false, griffinHpAtEnd: 640 });
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
      // The approved C2 wins by combat and does not demonstrate prepared-item use.
      expect(a.situationCReport).toMatchObject({ objectiveSuccess: true, griffinDefeated: true, griffinHpAtEnd: 0, griffinHpAtWigClaim: 0, wigRoute: "defeat",
        peacefulGroomingOccurred: false, itemsDeliveredWhileGriffinAlive: false, griffinHpAtFirstItemDelivery: 0, griffinHpAtMirrorDelivery: 0, toolsTakenByGriffin: false, wigAcquired: true, offeringAccepted: true, chapter0Complete: true });
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
    // No agent-facing "prepared" (owner 2026-11-06), and nothing about the tools' use, in either prompt.
    for (const sys of [pre.system, post.system]) expect(sys).not.toMatch(/prepared|groom|peaceful/i);
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

  it("paid C runs are refused for every model player kind except model-centralized, and scripted baselines are admitted", () => {
    const paid = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    for (const player of PLAYER_KINDS) {
      const plan = () => validatePlan({ player, situations: [ID], seeds: [0], ...(player.startsWith("model-") ? { model: paid } : {}) });
      if (player === "baseline-showcase-route") expect(plan, player).toThrow(/restricted to showcase/);
      else if (player === "model-centralized") expect(plan, player).not.toThrow();
      else if (player.startsWith("model-")) expect(plan, player).toThrow();
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
    expect(env.situationCReport()).toMatchObject({ griffinHpAtMirrorDelivery: 640, peacefulGroomingOccurred: true, wigAcquired: false, wigRoute: "none" });
  }, 120000);

  it("round 2 finding 1: the Shears alone, delivered while the Griffin is alive, start nothing; the report shows an ineffective delivery", async () => {
    // UNIT FIXTURE for Coco's position only.
    let room!: GameRoom;
    const env = environmentFor(ID, { room: (r) => (room = r) });
    await env.reset(0);
    const d = new Director({ env });
    await d.both(undefined, { type: "ability", ability: "flight" });
    const coco = Object.values(room.state.players).find((p) => p.role === "EMBER")!;
    coco.x = 640; coco.y = 160;
    expect((await d.both(undefined, { type: "use_item", item: "enchanted_shears" })).coco.accepted).toBe(true);
    const g = room.state.puzzles.griffin!.griffin!;
    expect(g.shearsDelivered).toBe(true);
    expect(g.phase).not.toBe("GROOMING");
    expect(env.situationCReport()).toMatchObject({ itemsDeliveredWhileGriffinAlive: true, griffinHpAtMirrorDelivery: null, peacefulGroomingOccurred: false, wigRoute: "none" });
  }, 60000);

  it("round 2 finding 2: an unobserved wig claim is reported as route unknown, never peaceful", async () => {
    const { situationCReport } = await import("../src/evaluator.js");
    const { room } = await start();
    const w = room().state;
    w.puzzles.griffin!.griffin!.wigClaimed = true; // predicate UNIT FIXTURE
    expect(situationCReport(w, new Set(), null, null, null, undefined).wigRoute).toBe("unknown");
    expect(situationCReport(w, new Set(), 0, 0, 0, undefined).wigRoute).toBe("defeat");
    expect(situationCReport(w, new Set(), 640, 640, 640, undefined).wigRoute).toBe("peaceful");
  }, 60000);

  it("gives no Situation C report on B scenarios", async () => {
    const env = environmentFor(B_ID);
    await env.reset(0);
    expect(env.situationCReport()).toBeNull();
  }, 60000);

  it("round 2 finding 10: archived r9 is unchanged and every declaration's self-hash recomputes", () => {
    // Python json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=True) without declarationSha256.
    const canon = (v: unknown): string => Array.isArray(v) ? `[${v.map(canon).join(",")}]`
      : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}`
      : JSON.stringify(v);
    const ascii = (t: string) => t.replace(/[^\x00-\x7f]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
    for (const [f, pin] of [["history/r9/declaration.json", "616c182453e06ec9568ffea3bc0c26dde314dca54376a2e77012766a269445be"], ["proposed/declaration-r10-c.json", R10_SHA256], ["history/r10/declaration.json", R10_ACTIVE_SHA256], ["proposed/declaration-r11-c3-hint.json", R11_PROPOSAL_SHA256], ["declaration.json", R11_ACTIVE_SHA256]] as const) {
      const d = JSON.parse(readFileSync(new URL(`../../../docs/midterm/evaluation-abc/${f}`, import.meta.url), "utf8"));
      const h = d.declarationSha256;
      delete d.declarationSha256;
      expect(createHash("sha256").update(ascii(canon(d))).digest("hex"), f).toBe(h);
      expect(h, f).toBe(pin);
    }
  });
});

describe("r10 activation", () => {
  it("active r10 equals the reviewed proposal except id, status, supersedes, activation and paid limits", () => {
    const read = (f: string) => JSON.parse(readFileSync(new URL(`../../../docs/midterm/evaluation-abc/${f}`, import.meta.url), "utf8"));
    const active = read("history/r10/declaration.json"), proposal = read("proposed/declaration-r10-c.json");
    expect(active.activation.proposalSha256).toBe(proposal.declarationSha256);
    const strip = (d: Record<string, unknown>) => {
      const c = JSON.parse(JSON.stringify(d));
      for (const k of ["id", "status", "supersedes", "activation", "declarationSha256"]) delete c[k];
      delete c.trialAllocation.paidAuthorization; delete c.trialAllocation.paidLimits;
      return c;
    };
    expect(strip(active)).toEqual(strip(proposal));
    expect(active.trialAllocation.paidLimits).toMatchObject({ model: "openai:gpt-6-luna", effort: "medium", scenario: ID, seed: 0, perEpisodeCapUsd: 0.75, combinedCapUsd: 1.5 });
  });
});

describe("proposed r11: C3 = v4 + inventory/nest hint (owner request after C1)", () => {
  const manual = readFileSync(new URL("../../../manual/Oath_and_Ember_Player_Manual.md", import.meta.url), "utf8");
  const gateways = () => {
    const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
    return { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
  };
  const planner = (text?: string) => { const s = situation(ID); return new CentralPlanner(manual, gateways(), 4, s.briefing, s.tutorial, s.task, text); };

  it("keeps v4 byte for byte and appends only the hint paragraph", () => {
    const v4 = guidance("b-post-combined-v4").text, g = guidance(C3_R11.guidanceId);
    expect(guidanceHash(v4)).toBe("1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34");
    expect(guidanceHash(g.text)).toBe(C3_R11.guidanceSha256);
    expect(g.text.startsWith(v4 + "\n\n")).toBe(true);
    const hint = g.text.slice(v4.length + 2);
    expect(hint).toMatch(/inventory/i);
    expect(hint).toMatch(/nest/i);
    // A hint, not the solution: no tool names, no delivery instruction, no grooming.
    expect(hint).not.toMatch(/mirror|shears|drop|deliver|groom|trim|haircut|E at|press/i);
    expect(g.situations).toEqual([ID]);
  });

  it("C3's prompt is exactly C1's prompt plus one guidance block; C1 is unchanged", () => {
    const g = guidance(C3_R11.guidanceId).text;
    const pre = planner(), post = planner(g);
    expect(pre.promptHash).toBe(C.prompts.preTunedPromptHash);
    expect(post.system).toBe(pre.system + guidanceBlock(g));
    expect(post.promptHash).toBe(C3_R11.promptHash);
    expect(post.maxBatch).toBe(pre.maxBatch);
  });

  it("is owner-approved for this exact text, on C only and in the authorized paid scope (mock allowed)", () => {
    const g = guidance(C3_R11.guidanceId);
    expect(g.status).toBe("approved");
    expect(g.approvedSha256).toBe(C3_R11.guidanceSha256);
    expect(guidanceApproved(g)).toBe(true);
    expect(guidanceApproved({ ...g, text: g.text + " " })).toBe(false);
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot", guidance: C3_R11.guidanceId } as unknown as ModelSetup;
    const paid = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot", guidance: C3_R11.guidanceId } as unknown as ModelSetup;
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: mock })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: paid })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...paid, gateway: { label: "openai:gpt-6-luna@low" } } as unknown as ModelSetup })).toThrow(/authorized only/);
    expect(() => validatePlan({ player: "model-centralized", situations: [B_ID], seeds: [0], model: { ...mock } })).toThrow(/limited to/);
  });
});

describe("r11 activation", () => {
  it("active r11 equals the reviewed proposal except id, status, supersedes, activation, guidance status and C3 classification", () => {
    const read = (f: string) => JSON.parse(readFileSync(new URL(`../../../docs/midterm/evaluation-abc/${f}`, import.meta.url), "utf8"));
    const active = read("declaration.json"), proposal = read("proposed/declaration-r11-c3-hint.json");
    expect(active.activation.proposalSha256).toBe(proposal.declarationSha256);
    const strip = (d: Record<string, unknown>) => {
      const c = JSON.parse(JSON.stringify(d));
      for (const k of ["id", "status", "supersedes", "activation", "declarationSha256", "c3Classification"]) delete c[k];
      delete c.model.postGuidanceC.status;
      return c;
    };
    expect(strip(active)).toEqual(strip(proposal));
    expect(active.c3Classification.label).toMatch(/outcome-informed, C-specific supplementary tuning; not independent B-to-C transfer/);
    expect(active.model.postGuidanceC).toMatchObject({ id: C3_R11.guidanceId, sha256: C3_R11.guidanceSha256, postTunedPromptSha256: C3_R11.promptHash, preTunedPromptSha256: C.prompts.preTunedPromptHash });
    // A and B rows unchanged from r10 (and from r9, tested via history).
    const r10 = read("history/r10/declaration.json");
    expect(active.situations.A).toEqual(r10.situations.A);
    expect(active.situations.B).toEqual(r10.situations.B);
  });
});
