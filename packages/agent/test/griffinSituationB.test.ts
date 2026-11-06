// Situation B, Griffin Trial (Unprepared): packages/agent/src/griffinSituations.ts,
// docs/midterm/SITUATION_B_GRIFFIN.md. Free and deterministic: no model is
// called (model players run against the mock gateway with a scratch ledger).
// Raw authoritative state is read only by these trusted assertions; the few
// world edits below are clearly labelled unit fixtures for the success
// predicate, never part of an episode.
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import type { World } from "../../shared/src/gameTypes.js";
import { griffinBeamEnd, griffinBounds, griffinMouth, griffinState, griffinWalls, newGriffin } from "../../shared/src/griffin.js";
import { episodes, griffinDefeatedAndWig, griffinTrialFailure } from "../src/evaluator.js";
import { environmentFor, GRIFFIN_TRIAL_BRIEFING, situation } from "../src/suite.js";
import { EPISODE_CAP_USD, runSuite, validatePlan, type ModelSetup } from "../src/harness.js";
import { SITUATION_A, SITUATION_A_HASH } from "../src/situationA.js";
import { SITUATION_GRIFFIN_B as B, SITUATION_GRIFFIN_B_HASH, griffinEvaluationLabel } from "../src/griffinSituations.js";
import { actionsDigest, griffinOnScreen, runGriffinWitness } from "../src/route/griffinWitness.js";
import { Director } from "../src/route/director.js";
import { AgentEnvironment } from "../src/environment.js";
import { SpendLedger } from "../src/ledger.js";
import { MockGateway } from "../src/policies/mockGateway.js";
import { centralSystemPrompt } from "../src/policies/centralized.js";
import { CentralPlanner } from "../src/policies/centralized.js";
import { guidance, guidanceBlock, SITUATION_GUIDANCE } from "../src/policies/situationGuidance.js";
import { ModelBudget, MeteredGateway } from "../src/budget.js";
import { tutorialBlock } from "../src/playerKnowledge.js";
import { briefingBlock } from "../src/policies/llm.js";
import { createHash } from "node:crypto";
import type { GameAction, PlayerId } from "../src/types.js";

const ID = "griffin-unprepared-v1" as const;
const root = fileURLToPath(new URL("../../..", import.meta.url));
const manual = readFileSync(join(root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const world = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room.state as World;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** Records every action the scenario prefix submits (the legal start's history). */
async function resetRecording(seed: number) {
  const env = environmentFor(ID);
  const prefix: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
  let on = true;
  const real = env.step.bind(env);
  env.step = (p, a) => { if (on) prefix[p].push(a); return real(p, a); };
  const r = await env.reset(seed);
  on = false;
  env.step = real;
  return { env, r, prefix };
}

describe("Situation B definition", () => {
  it("is pinned, and every value agrees with what the harness runs", () => {
    expect(SITUATION_GRIFFIN_B_HASH).toBe("bbbbc43532324b80179ab8fdf122fe7f6d10446a52d9ac752a0efdeae7671374");
    const def = situation(ID);
    expect(def.heldOut).toBe(false);
    expect(B.preset).toBe(def.preset);
    expect(B.limits).toMatchObject(episodes[def.preset].limits);
    expect(B.limits).toMatchObject({ maxTicks: 18_000, maxDecisionsPerPlayer: 1_600, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 4_000_000, episodeSpendCapUsd: 0.75 });
    expect(EPISODE_CAP_USD[ID]).toBe(B.limits.episodeSpendCapUsd);
    expect(def.briefing).toBe(GRIFFIN_TRIAL_BRIEFING);
    expect(griffinEvaluationLabel(ID)).toEqual({ label: "B", definitionHash: SITUATION_GRIFFIN_B_HASH });
    expect(griffinEvaluationLabel("S2-local")).toBeNull();
  });

  it("leaves Situation A's frozen definition unchanged", () => {
    expect(SITUATION_A_HASH).toBe("7efb771a7b91d35422b719676f09c9b36063c5d95ede2de9e5dc681dd93e0eab");
    expect(SITUATION_A.start.hashes[0]).toBe("fdc498771fe89a1ac96fb1ce8bd972c38ad96e84bdeb18b195292e42e20203ca");
  });

  it("the briefing names the goal and the failure rules but no tactic, route or item use", () => {
    expect(GRIFFIN_TRIAL_BRIEFING).toMatch(/health to zero/);
    expect(GRIFFIN_TRIAL_BRIEFING).toMatch(/knocked out/);
    expect(GRIFFIN_TRIAL_BRIEFING).toMatch(/stay in the Griffin Enclosure/);
    expect(GRIFFIN_TRIAL_BRIEFING).not.toMatch(/mirror|shears|nest|fireball|ward|guard|defend|pillar|black hole|flight|shore|\d+\s*(tiles|px)/i);
  });
});

describe("Situation B start: legal, deterministic, as declared", { timeout: 60_000 }, () => {
  it("resets identically, at the pinned tick, hash and prefix history", async () => {
    const a = await resetRecording(0);
    const b = await resetRecording(0);
    expect(a.r.startHash).toBe(B.start.hashes[0]);
    expect(b.r.startHash).toBe(a.r.startHash);
    expect(a.r.tick).toBe(B.start.tick);
    expect(actionsDigest(a.prefix)).toBe(B.start.prefixActionsSha256);
    expect(actionsDigest(b.prefix)).toBe(actionsDigest(a.prefix));
    expect(a.prefix.sieg.length).toBe(171);
    expect(a.prefix.coco.length).toBe(56);
    // Only ordinary player actions: no fixture path exists through step().
    for (const act of [...a.prefix.sieg, ...a.prefix.coco]) expect(["move", "wait", "interact", "advance_dialogue", "choose_dialogue"]).toContain(act.type);
    const s1 = await resetRecording(1);
    expect(s1.r.startHash).toBe(B.start.hashes[1]);
    expect(actionsDigest(s1.prefix)).toBe(B.start.prefixActionsSha256);
  });

  it("starts with a fresh full-health Griffin, full-health ready heroes, and no Mirror, Shears or wig", async () => {
    const { env } = await resetRecording(0);
    const w = world(env);
    expect(w.sceneId).toBe("GRIFFIN_ENCLOSURE");
    expect(griffinState(w.puzzles)).toEqual(newGriffin());
    for (const p of Object.values(w.players)) {
      expect(p.sceneId).toBe("GRIFFIN_ENCLOSURE");
      expect(p.hp).toBe(100);
      for (const v of Object.values(p.cooldowns ?? {})) expect(v).toBe(0);
    }
    const sieg = Object.values(w.players).find((p) => p.role === "OATH")!;
    const coco = Object.values(w.players).find((p) => p.role === "EMBER")!;
    expect({ x: sieg.x, y: sieg.y }).toEqual(B.start.heroes.sieg.px);
    expect({ x: coco.x, y: coco.y }).toEqual(B.start.heroes.coco.px);
    for (const item of ["vanity_mirror", "enchanted_shears", "griffin_wig"]) expect(w.inventory?.counts[item as never] ?? 0).toBe(0);
    expect(w.inventory?.claimed ?? []).not.toContain("griffin-nest");
    for (const id of ["sieg", "coco"] as const) {
      const o = await env.observe(id);
      expect(o.area.name).toBe("Griffin Enclosure");
      expect(o.self.hp).toBe(100);
      expect(o.abilities.map((x) => x.name)).toEqual(B.start.heroes[id].abilities);
      for (const x of o.abilities) expect(x.state === "ready" || x.state === "hold").toBe(true);
      expect(o.inventory.items.map((i) => i.id)).not.toEqual(expect.arrayContaining(["vanity_mirror"]));
      expect(o.messages).toEqual([]);
      expect(o.dialogue).toBeNull();
      expect(JSON.stringify(o)).not.toMatch(/agent-|EVAL\d|"flags"|"hp":640|griffin\.complete|stateHash/);
    }
    expect(await env.outcome()).toMatchObject({ status: "ongoing", ticks: 0, decisions: { sieg: 0, coco: 0 }, invalidActions: { sieg: 0, coco: 0 } });
  });

  it("a second reset of the same environment leaks nothing from the first episode", async () => {
    const env = environmentFor(ID);
    await env.reset(0);
    const first = { sieg: await env.observe("sieg"), coco: await env.observe("coco") };
    const d = new Director({ env });
    for (let i = 0; i < 30; i++) {
      if ((await env.observe("sieg")).dialogue) await d.dialogue();
      await d.both({ type: "move", direction: "n", ticks: 20 }, { type: "message", text: "hello" });
      if ((await env.outcome()).status !== "ongoing") break;
    }
    const r = await env.reset(0);
    expect(r.startHash).toBe(B.start.hashes[0]);
    expect(await env.observe("sieg")).toEqual(first.sieg);
    expect(await env.observe("coco")).toEqual(first.coco);
    expect(await env.outcome()).toMatchObject({ status: "ongoing", ticks: 0, decisions: { sieg: 0, coco: 0 } });
  });
});

describe("Situation B success and failure predicates", () => {
  // Unit fixtures (labelled): edits to a cloned start world, only to exercise the predicate.
  it("success needs Griffin HP 0 AND the wig; nothing less passes", async () => {
    const { env } = await resetRecording(0);
    const base = world(env);
    const variant = (f: (w: World) => void) => { const w = structuredClone(base); f(w); return griffinDefeatedAndWig(w); };
    const g = (w: World) => griffinState(w.puzzles)!;
    expect(griffinDefeatedAndWig(base)).toBe(false); // entering the arena
    expect(variant((w) => { g(w).hp = 1; g(w).phase = "FLY"; })).toBe(false); // damaged
    expect(variant((w) => { g(w).hp = 0; g(w).phase = "DEFEATED"; })).toBe(false); // defeated, no wig
    expect(variant((w) => { w.puzzles.griffin.complete = true; w.inventory!.counts.griffin_wig = 1; })).toBe(false); // peaceful wig, HP above 0
    expect(variant((w) => { g(w).hp = 0; w.puzzles.griffin.complete = true; })).toBe(false); // the broad flag alone
    expect(variant((w) => { g(w).hp = 0; w.inventory!.counts.griffin_wig = 1; })).toBe(true);
  });

  it("failure: a knockout or a hero outside the enclosure, checked before success", async () => {
    const { env } = await resetRecording(0);
    const w = world(env);
    expect(griffinTrialFailure(w, { knockedOut: false })).toBeUndefined();
    expect(griffinTrialFailure(w, { knockedOut: true })).toBe("knocked_out");
    const out = structuredClone(w);
    Object.values(out.players).find((p) => p.role === "OATH")!.sceneId = "GODDESS_SHRINE";
    expect(griffinTrialFailure(out, { knockedOut: false })).toBe("left_area");
  });
});

describe("Situation B terminal outcomes through real play", { timeout: 120_000 }, () => {
  it("heroes standing in the beams are knocked out: the trial ends as a failure, not at full health", async () => {
    const env = environmentFor(ID);
    await env.reset(0);
    const d = new Director({ env });
    for (let i = 0; i < 400 && (await env.outcome()).status === "ongoing"; i++) {
      if ((await env.observe("sieg")).dialogue || (await env.observe("coco")).dialogue) { await d.dialogue(); continue; }
      await d.both({ type: "move", direction: "n", ticks: 10 }, { type: "move", direction: "n", ticks: 10 });
    }
    expect(await env.outcome()).toMatchObject({ status: "terminated", reason: "knocked_out" });
    expect(griffinDefeatedAndWig(world(env))).toBe(false);
  });

  it("walking out through the RETURN exit ends the trial as left_area", async () => {
    const env = environmentFor(ID);
    await env.reset(0);
    const d = new Director({ env });
    await d.go({ sieg: { to: { x: 20, y: 33.4 }, opts: { tolerance: 0.6 } } });
    // Travel opens a moment after arrival (GameRoom travelReadyTick): press E until the party leaves.
    for (let i = 0; i < 40 && (await env.outcome()).status === "ongoing"; i++) {
      if ((await env.observe("sieg")).dialogue) { await d.dialogue(); continue; }
      await d.both({ type: "interact" }, { type: "wait", ticks: 2 });
      await d.both({ type: "wait", ticks: 10 }, { type: "wait", ticks: 10 });
    }
    expect(await env.outcome()).toMatchObject({ status: "terminated", reason: "left_area" });
  });

  it("an idle episode reaches the tick limit as a failure", async () => {
    const env = new AgentEnvironment({ preset: ID, prefix: situation(ID).prefix!, limits: { maxTicks: 300 } });
    await env.reset(0);
    const d = new Director({ env });
    for (let i = 0; i < 60 && (await env.outcome()).status === "ongoing"; i++) {
      if ((await env.observe("sieg")).dialogue || (await env.observe("coco")).dialogue) { await d.dialogue(); continue; }
      await d.both({ type: "defend", ticks: 30 }, { type: "defend", ticks: 30 });
    }
    expect(await env.outcome()).toMatchObject({ status: "terminated", reason: "tick_limit", ticks: 300 });
  });
});

describe("Situation B offline witness (scripted, solution-aware certification controller)", { timeout: 120_000 }, () => {
  it("defeats the Griffin without the tools and collects the wig, inside the limits, with no knockout", async () => {
    const run = await runGriffinWitness(0);
    expect(run.startHash).toBe(B.start.hashes[0]);
    expect(run.outcome).toMatchObject({ status: "success", reason: "success", ticks: B.witness.gameTicks, decisions: B.witness.decisions, invalidActions: { sieg: 0, coco: 0 } });
    expect(run.knockouts).toBe(0);
    expect(run.actionsSha256).toBe(B.witness.actionsSha256);
    expect(run.endHash).toBe(B.witness.endHash);
    expect(run.outcome.ticks).toBeLessThan(B.limits.maxTicks);
    expect(Math.max(run.outcome.decisions.sieg, run.outcome.decisions.coco)).toBeLessThan(B.limits.maxDecisionsPerPlayer);
    // Defeat alone did not end the episode: the wig came later, by an ordinary E at the nest.
    const zero = run.milestones.find((m) => m.milestone === "griffin:hp-zero")!;
    const wig = run.milestones.find((m) => m.milestone === "holding:griffin_wig")!;
    expect(zero.tick).toBeLessThan(wig.tick);
    expect(run.trace.lines.filter((l) => l.type === "terminal")).toHaveLength(1);
    expect(run.trace.lines.find((l) => l.type === "terminal")!.tick).toBe(wig.tick);
  });
});

describe("Situation B observations: the Griffin's drawn attack warnings", { timeout: 60_000 }, () => {
  it("lists the warning line and the beam at their drawn end, only while drawn, with no hidden numbers", async () => {
    const env = environmentFor(ID);
    await env.reset(0);
    const d = new Director({ env });
    const seen = new Set<string>();
    for (let i = 0; i < 400 && (await env.outcome()).status === "ongoing" && seen.size < 2; i++) {
      if ((await env.observe("coco")).dialogue) { await d.dialogue(); continue; }
      const c = await env.observe("coco");
      const g = griffinState(world(env).puzzles)!;
      const effects = c.visible.filter((v) => v.kind === "effect" && v.name.startsWith("griffin"));
      const view = griffinOnScreen(c);
      if (g.phase === "BEAM_CHARGE" || g.phase === "BEAM") {
        if (view) {
          expect(effects).toHaveLength(1);
          const e = effects[0];
          seen.add(e.name);
          expect(e.name).toBe(g.phase === "BEAM" ? "griffin beam" : "griffin beam warning line");
          const end = g.phase === "BEAM" && g.beam ? g.beam : griffinBeamEnd(g, [...griffinBounds, ...griffinWalls(world(env).puzzles)], Object.values(world(env).players));
          const cols = c.screen.rows[0].length, rows = c.screen.rows.length;
          const endOnScreen = end.x / 32 >= c.screen.originX && end.x / 32 <= c.screen.originX + cols && end.y / 32 >= c.screen.originY && end.y / 32 <= c.screen.originY + rows;
          if (e.details!.endsWith("ending here")) {
            expect(Math.abs(e.x - end.x / 32)).toBeLessThan(0.02);
            expect(Math.abs(e.y - end.y / 32)).toBeLessThan(0.02);
          } else {
            // Listed where the drawn line leaves this hero's screen, on the line from the mouth to the end.
            expect(endOnScreen).toBe(false);
            const m = griffinMouth(g), t = ((e.x * 32 - m.x) * (end.x - m.x) + (e.y * 32 - m.y) * (end.y - m.y)) / ((end.x - m.x) ** 2 + (end.y - m.y) ** 2);
            expect(Math.hypot(m.x + (end.x - m.x) * t - e.x * 32, m.y + (end.y - m.y) * t - e.y * 32)).toBeLessThan(1);
          }
          expect(e.details).not.toMatch(/\d/);
        }
      } else if (g.phase !== "HEADBUTT_CHARGE") expect(effects).toEqual([]);
      await d.both({ type: "defend", ticks: 6 }, c.self.y > 14 ? { type: "move", direction: "n", ticks: 6 } : { type: "defend", ticks: 6 });
    }
    expect([...seen].sort()).toEqual(["griffin beam", "griffin beam warning line"]);
  });
});

describe("Situation B players: same interface, recorded conditions", { timeout: 180_000 }, () => {
  it("the pre-tuned planner prompt is the generic policy's, byte for byte (Pilot-30's S2-local prompt hash)", () => {
    const a = situation("S2-local");
    const metered = (budget: ModelBudget) => ({ sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") });
    const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
    const pilot30 = new CentralPlanner(manual, metered(budget), 4, a.briefing, a.tutorial);
    expect(pilot30.promptHash).toBe("0616c47baf03f2860f75a4a0867221998b2439f51b55fde33c56111ec8240c44");
    const b = situation(ID);
    const pre = new CentralPlanner(manual, metered(budget), 4, b.briefing, b.tutorial);
    expect(pre.system).toBe(centralSystemPrompt(manual, 4) + tutorialBlock(b.tutorial!) + briefingBlock(b.briefing!));
    expect(pre.system).not.toMatch(/Post-tuned guidance/);
    const post = new CentralPlanner(manual, metered(budget), 4, b.briefing, b.tutorial, undefined, guidance("griffin-b-post-v1").text);
    expect(post.system).toBe(pre.system + guidanceBlock(guidance("griffin-b-post-v1").text));
    expect(post.promptHash).not.toBe(pre.promptHash);
  });

  it("guidance is limited to its situations and to model-centralized; a proposed text never runs paid", () => {
    const mock = { gateway: new MockGateway(0, 0), stage: "pilot" } as unknown as ModelSetup;
    const paidLike = { gateway: { label: "openai:gpt-6-luna@medium" }, stage: "pilot" } as unknown as ModelSetup;
    expect(SITUATION_GUIDANCE["griffin-b-post-v1"].status).toBe("proposed");
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...mock, guidance: "griffin-b-post-v1" } })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...paidLike, guidance: "griffin-b-post-v1" } })).toThrow(/proposed, not approved/);
    expect(() => validatePlan({ player: "model-centralized", situations: ["S2-local"], seeds: [0], model: { ...mock, guidance: "griffin-b-post-v1" } })).toThrow(/limited to/);
    expect(() => validatePlan({ player: "model-memory", situations: [ID], seeds: [0], model: { ...mock, guidance: "griffin-b-post-v1" } })).toThrow(/model-centralized only/);
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: { ...mock, guidance: "no-such" } })).toThrow(/Unknown guidance/);
    expect(() => validatePlan({ player: "model-centralized", situations: [ID], seeds: [0], model: paidLike })).not.toThrow();
  });

  it("baseline, pre-tuned and post-tuned mock runs share one start, record failures and their configuration", async () => {
    const dir = mkdtempSync(join(tmpdir(), "griffin-b-"));
    dirs.push(dir);
    const ledger = SpendLedger.open(join(dir, "mock-ledger.json"));
    const base = { situations: [ID] as typeof ID[], seeds: [0], gitHash: "offline-test" };
    const [baseline] = await runSuite({ ...base, player: "baseline-quest", outDir: join(dir, "baseline") });
    expect(baseline).toMatchObject({ startHash: B.start.hashes[0], status: "terminated", reason: B.baselineReference.reason, gameTicks: B.baselineReference.gameTicks, endHash: B.baselineReference.endHash, success: false });
    const model = (guidanceId?: string): ModelSetup => ({ gateway: new MockGateway(0, 0), manual, ledger, stage: "pilot", priceSource: "mock", ...(guidanceId ? { guidance: guidanceId } : {}) });
    const [pre] = await runSuite({ ...base, player: "model-centralized", outDir: join(dir, "pre"), model: model() });
    const [post] = await runSuite({ ...base, player: "model-centralized", outDir: join(dir, "post"), model: model("griffin-b-post-v1") });
    for (const s of [pre, post]) {
      expect(s.startHash).toBe(B.start.hashes[0]);
      expect(s.success).toBe(false);
      expect(s.status).toBe("terminated");
      expect(s.evaluation).toEqual({ label: "B", definitionHash: SITUATION_GRIFFIN_B_HASH });
      expect(s.episodeCapUsd).toBe(0.75);
    }
    expect(pre.guidance).toBeUndefined();
    expect(post.guidance).toEqual({ id: "griffin-b-post-v1", status: "proposed", sha256: sha(guidance("griffin-b-post-v1").text), situations: [ID] });
    expect(post.policies.sieg).toMatch(/·guidance-[0-9a-f]{8}$/);
    expect(pre.policies.sieg).not.toMatch(/guidance/);
    expect(post.configHash).not.toBe(pre.configHash);
    expect(post.promptHashes?.sieg).not.toBe(pre.promptHashes?.sieg);
  });
});
