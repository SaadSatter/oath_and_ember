// Offline tests for the instruction-guided Mirror Pond walkthrough. The scripted
// reachability proof is an engineering oracle, NOT a guided LLM result. Only
// current S3-local tuning seeds 0/1 are reset/played. No network, no spend.
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { policiesFor, runSuite, validatePlan, type ModelSetup } from "../src/harness.js";
import { defaultBudgetLimits, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { environmentFor, situation } from "../src/suite.js";
import { briefingBlock, systemPrompt } from "../src/policies/llm.js";
import { tutorialBlock } from "../src/playerKnowledge.js";
import { GuidedPlayer, GUIDES } from "../src/policies/guided.js";
import { GUIDED_MAZE_ID, GUIDED_MAZE_VERSION } from "../src/policies/guidedMazeInstructions.js";
import { GUIDED_POND_ID, GUIDED_POND_VERSION, guidedPondInstructions, POND_GUIDE, POND_GUIDE_CHECKPOINTS, POND_MEASURED } from "../src/policies/guidedPondInstructions.js";
import { policyKind } from "../src/policies/kind.js";
import { directionTo } from "../src/policies/navigate.js";
import { stateHash } from "../src/evaluator.js";
import { SpendLedger } from "../src/ledger.js";
import { TraceWriter, verifyTrace } from "../src/trace.js";
import { Director } from "../src/route/director.js";
import { mirrorPond } from "../src/route/fullQuest.js";
import { MIRROR, MIRROR_REST, MIRROR_TARGET, PAD, POND_PLAN, SHOT, TO_MIRROR } from "../src/route/routeConstants.js";
import { pondChest, pondSpawn, pondSpikeColumns, pondStations } from "../../shared/src/mirrorPond.js";
import type { PlayerId } from "../src/types.js";

const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const scratch: string[] = [];
afterEach(() => { vi.unstubAllGlobals(); for (const p of scratch.splice(0)) rmSync(p, { recursive: true, force: true }); });
class Recording implements Gateway {
  label = "offline-guided-fixture";
  priced: { system: string; user: string }[] = [];
  sent: { system: string; user: string }[] = [];
  reply: Completion = { text: '{"notes":"private fixture note","actions":[{"type":"wait","ticks":1}]}', tokens: { input: 1, output: 1 }, costUsd: 0 };
  worstCaseUsd(system: string, user: string) { this.priced.push({ system, user }); return Buffer.byteLength(system) / 1e6; }
  async complete(system: string, user: string) { this.sent.push({ system, user }); return this.reply; }
}
const setup = (gateway: Gateway): ModelSetup => ({ gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "offline fixture" });
const budget = () => new ModelBudget({ ...defaultBudgetLimits, maxSpendUsd: 1 });
const decisionInput = async (env: ReturnType<typeof environmentFor>, id: PlayerId) => ({ observation: await env.observe(id), legal: await env.legal_actions(id) });
const mod180 = (a: number) => ((a % 180) + 180) % 180;

describe("instruction-guided Mirror Pond policy", () => {
  it("sends the pond walkthrough only to opt-in S3-local players; plain prompts and the Maze guide are unchanged", async () => {
    const env = environmentFor("S3-local"); await env.reset(0);
    const initial = (env as any).room.state;
    const hash = stateHash(initial);
    const inputs = { sieg: await decisionInput(env, "sieg"), coco: await decisionInput(env, "coco") };
    const def = situation("S3-local");
    const g = new Recording(); const guided = policiesFor("model-guided", budget(), setup(g), "S3-local");
    expect(policyKind(guided)).toBe("model-guided");
    expect(guided.sieg).not.toBe(guided.coco);
    for (const id of ["sieg", "coco"] as const) {
      const hero = id === "sieg" ? "Sieg" : "Coco";
      await guided[id].decide(inputs[id]); await guided[id].decide(inputs[id]);
      const requests = g.sent.slice(-2);
      for (const r of requests) {
        expect(r.system).toBe(systemPrompt(hero, MANUAL, 4, "history") + tutorialBlock(def.tutorial!) + briefingBlock(def.briefing!) + guidedPondInstructions(hero));
        expect(r.system).toContain(`YOU ARE ${hero.toUpperCase()}`);
        expect(r.system).not.toContain(`YOU ARE ${id === "sieg" ? "COCO" : "SIEG"}`);
        expect(r.system.split(GUIDED_POND_VERSION)).toHaveLength(2);
        expect(r.system).not.toContain(GUIDED_MAZE_VERSION);
        expect(JSON.parse(r.user).observation).toEqual(inputs[id].observation);
        expect(r.user).not.toContain("INSTRUCTION-GUIDED");
      }
      expect(JSON.parse(requests[0].user).your_notes).toBe("");
      expect(JSON.parse(requests[1].user).your_notes).toBe("private fixture note");
    }
    expect(g.priced).toEqual(g.sent); // the augmented prompt is exactly what is priced
    expect(stateHash(initial)).toBe(hash); // decide did not step or mutate the game
    for (const kind of ["model-history", "model-obs-only"] as const) {
      const plain = new Recording(); const ps = policiesFor(kind, budget(), setup(plain), "S3-local");
      for (const id of ["sieg", "coco"] as const) {
        await ps[id].decide(inputs[id]);
        expect(plain.sent.at(-1)!.system).toBe(systemPrompt(id === "sieg" ? "Sieg" : "Coco", MANUAL, 4, kind === "model-history" ? "history" : "none") + tutorialBlock(def.tutorial!) + briefingBlock(def.briefing!));
        expect(plain.sent.at(-1)!.system).not.toContain(GUIDED_POND_VERSION);
      }
    }
    expect(GUIDED_POND_ID).toMatch(/^[a-f0-9]{12}$/);
    expect(guided.sieg.name).toContain(`walkthrough-${GUIDED_POND_ID}`);
    expect((guided.sieg as GuidedPlayer).model.label).toContain(`guided-${GUIDED_POND_ID}`);
    // The Maze walkthrough and its labels are byte-unchanged by the generalization.
    expect(GUIDED_MAZE_ID).toBe("975e5580671c");
    const maze = policiesFor("model-guided", budget(), setup(new Recording()), "S2-local");
    expect(maze.sieg.name).toContain(`walkthrough-${GUIDED_MAZE_ID}`);
    expect(GUIDES["S2-local"].id).toBe(GUIDED_MAZE_ID);
    expect(GUIDES["S3-local"].id).toBe(GUIDED_POND_ID);
  });

  it("accepts only the current local tuning scenarios with a walkthrough", () => {
    expect(situation("S3-local")).toMatchObject({ revision: 2, heldOut: false, title: "Mirror Pond — local start" });
    for (const id of ["S2-local", "S3-local"] as const)
      for (const seed of [0, 1]) expect(() => validatePlan({ player: "model-guided", situations: [id], seeds: [seed], model: setup(new Recording()) })).not.toThrow();
    for (const id of ["S1", "S2", "S3", "S2-local-v1", "S3-local-v1"] as const)
      expect(() => validatePlan({ player: "model-guided", situations: [id], seeds: [0], model: setup(new Recording()) })).toThrow(/restricted/);
    expect(() => validatePlan({ player: "model-guided", situations: ["S3-local"], seeds: [100], final: true, model: setup(new Recording()) })).toThrow(/restricted/);
    expect(() => validatePlan({ player: "model-guided", situations: ["S3-local"], seeds: [100], model: setup(new Recording()) })).toThrow(/seeds/);
    for (const id of ["S3", "S4", "F"] as const) expect(() => policiesFor("model-guided", budget(), setup(new Recording()), id)).toThrow(/requires/);
  });

  it("reserves the pond walkthrough before dispatch and fails closed when it does not fit", async () => {
    const env = environmentFor("S3-local"); await env.reset(0);
    const g = new Recording(); const b = new ModelBudget({ ...defaultBudgetLimits, maxSpendUsd: 0.000001 });
    const ps = policiesFor("model-guided", b, setup(g), "S3-local");
    await expect(ps.coco.decide(await decisionInput(env, "coco"))).rejects.toThrow();
    expect(g.priced[0].system).toContain(GUIDED_POND_VERSION);
    expect(g.sent).toEqual([]);
  });

  it("records a guided S3-local run through the normal runner, validation and scratch ledger", async () => {
    const root = mkdtempSync(join(tmpdir(), "guided-pond-")); scratch.push(root);
    const ledger = SpendLedger.open(join(root, "ledger.json")); const g = new Recording();
    g.complete = async (system, user) => {
      g.sent.push({ system, user });
      const hero = JSON.parse(user).observation.hero;
      // Coco cannot Push: the ordinary role validation must refuse it.
      return { text: JSON.stringify({ notes: "fixture", actions: [hero === "Coco" ? { type: "ability", ability: "push", ticks: 5 } : { type: "wait", ticks: 1 }] }), tokens: { input: 1, output: 1 }, costUsd: 0 };
    };
    const stop = new AbortController(); let steps = 0;
    try {
      const [s] = await runSuite({ player: "model-guided", situations: ["S3-local"], seeds: [0], outDir: join(root, "out"), gitHash: "offline-guided", model: { ...setup(g), ledger }, signal: stop.signal, onTrace(l) { if (l.type === "step" && ++steps >= 2) stop.abort(); } });
      expect(s.player).toBe("model-guided"); expect(s.suiteRevision).toBe(2);
      expect(s.invalidActions.coco).toBeGreaterThan(0);
      expect(s.startHash).toBe((await environmentFor("S3-local").reset(0)).startHash);
      expect(s.policies.coco).toContain(GUIDED_POND_ID);
      const lines = readFileSync(s.trace, "utf8").trim().split("\n").map((l) => JSON.parse(l)); verifyTrace(lines);
      expect(ledger.entries()[0]).toMatchObject({ status: "settled", chargedUsd: 0 });
      expect(ledger.entries()[0].run).toContain("model-guided/S3-local/");
      for (const r of g.sent) expect(JSON.parse(r.user).observation).not.toHaveProperty("puzzles");
    } finally { ledger.close(); }
  }, 30_000);

  it("has no engine, route, navigation, or filesystem dependency in runtime guided modules", () => {
    for (const file of ["guided.ts", "guidedPondInstructions.ts"]) {
      const src = readFileSync(new URL(`../src/policies/${file}`, import.meta.url), "utf8");
      const imports = [...src.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map((m) => m[1]);
      expect(imports.some((i) => /server|shared|environment|route|navigate|node:fs/.test(i)), file).toBe(false);
      expect(src).not.toMatch(/\.step\(|\.observe\(|\.legal_actions\(|\.transition\(/);
    }
  });

  it("walkthrough data equals the frozen route constants and the authored pond geometry", () => {
    const m = POND_GUIDE.mirrors;
    expect(m).toHaveLength(4);
    m.forEach((g, i) => {
      const plan = POND_PLAN[i];
      const [solve, rest1, rest2, leave] = plan;
      expect([solve.phase, rest1.phase, rest2.phase, leave.phase]).toEqual(["solve", "rest", "rest", "leave"]);
      expect(g.mirror).toEqual([MIRROR[i].x, MIRROR[i].y]);
      expect(g.approach).toEqual(TO_MIRROR[i].map((q) => [q.x, q.y]));
      expect(g.pad).toEqual([PAD[i].x, PAD[i].y]);
      expect(g.shot).toBe(SHOT[i]);
      for (const [mine, theirs] of [[g.solve, solve], [g.rest[0], rest1], [g.rest[1], rest2]] as const) {
        expect(mine.walk).toEqual(theirs.walk);
        expect(mine.push).toBe(theirs.push);
        expect(mine.to).toBe(theirs.to);
        const [ex, ey] = mine.walk.at(-1)!;
        expect(mine.face).toBe(directionTo(g.mirror[0] - ex, g.mirror[1] - ey)); // the route's facing move
      }
      expect(g.leave).toEqual(leave.walk);
      expect(mod180(g.solve.to)).toBe(mod180(MIRROR_TARGET[i]));
      expect(mod180(g.rest[1].to)).toBe(mod180(MIRROR_REST[i]));
      // Engine geometry: station, firing spot, brazier and resting angle.
      const s = pondStations[i];
      expect([s.x / 32, s.y / 32]).toEqual(g.mirror);
      expect([s.shot.x / 32, s.shot.y / 32]).toEqual(g.pad);
      expect([s.torch.x / 32, s.torch.y / 32]).toEqual(g.brazier);
      expect(mod180((s.rest * 180) / Math.PI)).toBeCloseTo(mod180(g.rest[1].to), 6);
      expect(mod180((s.angle * 180) / Math.PI)).toBeCloseTo(mod180(g.solve.to), 6);
      // 1.5 degrees per push tick (POND_ROTATION_STEP).
      expect(g.solve.push * 1.5).toBe(67.5);
    });
    expect([pondChest.x / 32, pondChest.y / 32]).toEqual(POND_GUIDE.chest);
    expect(pondSpikeColumns.map((r) => r.x / 32 + 0.5)).toEqual([40.5, 41.5, 42.5, 43.5]);
    expect([pondSpawn("OATH").x / 32, pondSpawn("OATH").y / 32]).toEqual(POND_GUIDE.start.sieg);
    expect([pondSpawn("EMBER").x / 32, pondSpawn("EMBER").y / 32]).toEqual(POND_GUIDE.start.coco);
    expect(POND_GUIDE_CHECKPOINTS.map((c) => c[0])).toEqual(["A", "B", "C", "D1", "D2", "D3", "D4", "E"]);
  });
});

function containsInOrder(points: number[][], wanted: readonly (readonly number[])[]) {
  let i = 0;
  for (const p of points) if (i < wanted.length && p[0] === wanted[i][0] && p[1] === wanted[i][1]) i++;
  return i === wanted.length;
}
for (const seed of [0, 1]) it(`offline engineering proof: the walkthrough's route reaches the Vanity Mirror at tuning seed ${seed}`, async () => {
  const trace = new TraceWriter();
  // The trusted per-tick hook only observes braziers after the room's own tick (environment.ts "tick").
  let shot: number | null = null; const shotToLit: number[] = []; let litBefore = 0;
  const env = environmentFor("S3-local", {
    trace: (e) => trace.write(e),
    tick: (r) => {
      r.tick();
      const lit = (r.state.puzzles.mirrorPond as any)?.pond?.torches.filter(Boolean).length ?? 0;
      if (lit > litBefore && shot !== null) { shotToLit.push(r.state.serverTick - shot); shot = null; }
      litBefore = lit;
    },
  });
  await env.reset(seed);
  const room = (env as any).room;
  expect(room.state.sceneId).toBe("MIRROR_POND");
  for (const id of ["sieg", "coco"] as const) {
    const o = await env.observe(id);
    expect([o.self.x, o.self.y]).toEqual(POND_GUIDE.start[id]);
    expect(o.dialogue ?? null).toBeNull(); // no arrival conversation (checkpoint A)
  }
  const objective = Symbol("objective acquired; stop before the route's return leg");
  const seen: Record<PlayerId, number[][]> = { sieg: [], coco: [] };
  class ProofDirector extends Director {
    async go(...args: Parameters<Director["go"]>) {
      for (const id of ["sieg", "coco"] as const) { const t = args[0][id]?.to; if (t) seen[id].push([t.x, t.y]); }
      return super.go(...args);
    }
    async both(...args: Parameters<Director["both"]>) {
      if (args[1]?.type === "attack") shot = env.currentTick();
      const r = await super.both(...args);
      if ((await this.env.outcome()).status === "success") throw objective;
      return r;
    }
  }
  const d = new ProofDirector({ env });
  await expect(mirrorPond(d)).rejects.toBe(objective);
  expect(shotToLit).toEqual(POND_MEASURED.shotToLitTicks);
  expect(await env.outcome()).toMatchObject({ status: "success", invalidActions: { sieg: 0, coco: 0 } });
  expect(room.state.sceneId).toBe("MIRROR_POND");
  expect(room.state.inventory.counts.vanity_mirror).toBe(1);
  const pond = room.state.puzzles.mirrorPond.pond;
  expect(pond.torches).toEqual([true, true, true, true]);
  expect(pond.raised).toBe(true);
  pond.mirrors.forEach((a: number, i: number) => expect(mod180((a * 180) / Math.PI)).toBeCloseTo(mod180(POND_GUIDE.mirrors[i].rest[1].to), 3));
  // Coco's flight and pad legs, and Sieg's approaches, are the route's own targets.
  expect(containsInOrder(seen.coco, [[44, 31.6], [35, 31], [35, 27], [28, 12]])).toBe(true);
  expect(containsInOrder(POND_GUIDE.cocoCulvert as unknown as number[][], [[44, 31.6], [35, 31], [35, 27], [28, 12]])).toBe(true);
  expect(containsInOrder(seen.coco, [POND_GUIDE.cocoA1toA2.at(-1)!, POND_GUIDE.cocoA2toA3.at(-1)!, POND_GUIDE.cocoA3toA4.at(-1)!, POND_GUIDE.cocoA4toChest.at(-1)!])).toBe(true);
  expect(containsInOrder(seen.sieg, [POND_GUIDE.spikeMouth, ...POND_GUIDE.mirrors.flatMap((m) => m.approach), ...POND_GUIDE.siegToSanctuary])).toBe(true);
  verifyTrace(trace.lines);
}, 120_000);
