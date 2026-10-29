// Offline tests. Scripted reachability proof is an engineering oracle, NOT a
// guided LLM result. Only current S2-local tuning seeds 0/1 are reset/played.
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { policiesFor, runSuite, validatePlan, type ModelSetup } from "../src/harness.js";
import { defaultBudgetLimits, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { environmentFor, situation, SITUATIONS } from "../src/suite.js";
import { briefingBlock, systemPrompt } from "../src/policies/llm.js";
import { tutorialBlock } from "../src/playerKnowledge.js";
import { GuidedMazePlayer } from "../src/policies/guidedMaze.js";
import { GUIDED_MAZE_ID, GUIDED_MAZE_VERSION, guidedMazeInstructions, MAZE_GUIDE_CHECKPOINTS, MAZE_GUIDE_LEGS } from "../src/policies/guidedMazeInstructions.js";
import { OpenAIGateway, openaiPrices } from "../src/policies/openai.js";
import { policyKind } from "../src/policies/kind.js";
import { stateHash } from "../src/evaluator.js";
import { SpendLedger } from "../src/ledger.js";
import { TraceWriter, verifyTrace } from "../src/trace.js";
import { Director } from "../src/route/director.js";
import { hedgeMaze } from "../src/route/fullQuest.js";
import { mazeCellOpen, mazeBurnBush, mazeGate } from "../../shared/src/hedgeMaze.js";
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

describe("instruction-guided Maze policy", () => {
  it("adds persistent role-specific system instructions only to the opt-in player; history/obs-only are byte-identical", async () => {
    const env = environmentFor("S2-local"); await env.reset(0);
    const initial = (env as any).room.state;
    const hash = stateHash(initial);
    const inputs = { sieg: await decisionInput(env, "sieg"), coco: await decisionInput(env, "coco") };
    const def = situation("S2-local");
    const g = new Recording(); const guided = policiesFor("model-guided", budget(), setup(g), "S2-local");
    expect(policyKind(guided)).toBe("model-guided");
    expect(guided.sieg).not.toBe(guided.coco);
    for (const id of ["sieg", "coco"] as const) {
      const hero = id === "sieg" ? "Sieg" : "Coco";
      await guided[id].decide(inputs[id]); await guided[id].decide(inputs[id]);
      const requests = g.sent.slice(-2);
      for (const r of requests) {
        expect(r.system).toContain(guidedMazeInstructions(hero));
        expect(r.system).toContain(`YOU ARE ${hero.toUpperCase()}`);
        expect(r.system).not.toContain(`YOU ARE ${id === "sieg" ? "COCO" : "SIEG"}`);
        expect(r.system.split(GUIDED_MAZE_VERSION)).toHaveLength(2);
        expect(JSON.parse(r.user).observation).toEqual(inputs[id].observation);
        expect(r.user).not.toContain("INSTRUCTION-GUIDED");
        expect(JSON.parse(r.user)).not.toHaveProperty("world");
      }
      expect(JSON.parse(requests[0].user).your_notes).toBe("");
      expect(JSON.parse(requests[1].user).your_notes).toBe("private fixture note");
    }
    expect(g.priced).toEqual(g.sent); // price exactly the augmented dispatched prompt
    expect(stateHash(initial)).toBe(hash); // decide did not step or mutate the game
    for (const kind of ["model-history", "model-obs-only"] as const) {
      const plain = new Recording(); const ps = policiesFor(kind, budget(), setup(plain), "S2-local");
      const memory = kind === "model-history" ? "history" : "none";
      for (const id of ["sieg", "coco"] as const) {
        await ps[id].decide(inputs[id]);
        expect(plain.sent.at(-1)!.system).toBe(systemPrompt(id === "sieg" ? "Sieg" : "Coco", MANUAL, 4, memory) + tutorialBlock(def.tutorial!) + briefingBlock(def.briefing!));
        expect(plain.sent.at(-1)!.system).not.toContain(GUIDED_MAZE_VERSION);
      }
      expect(policyKind(ps)).toBe(kind);
    }
    expect(GUIDED_MAZE_ID).toMatch(/^[a-f0-9]{12}$/);
    expect(guided.sieg.name).toContain(GUIDED_MAZE_ID);
  });

  it("accepts only the current local Maze tuning scenario, without changing registry definitions", () => {
    expect(situation("S2-local")).toMatchObject({ revision: 2, heldOut: false, title: "Hedge Maze — local start" });
    for (const seed of [0, 1]) expect(() => validatePlan({ player: "model-guided", situations: ["S2-local"], seeds: [seed], model: setup(new Recording()) })).not.toThrow();
    for (const id of ["S1", "S2", "S3", "S3-local", "S2-local-v1"] as const)
      expect(() => validatePlan({ player: "model-guided", situations: [id], seeds: [0], model: setup(new Recording()) })).toThrow(/restricted/);
    expect(() => validatePlan({ player: "model-guided", situations: ["S2-local"], seeds: [100], final: true, model: setup(new Recording()) })).toThrow(/restricted/);
    expect(() => policiesFor("model-guided", budget(), setup(new Recording()), "S3-local")).toThrow(/requires/);
    expect(() => new GuidedMazePlayer("Sieg", "coco", new Recording(), budget(), MANUAL)).toThrow(/identity/);
    expect(SITUATIONS).toHaveLength(7);
  });

  it("reserves the walkthrough before dispatch and fails closed when it does not fit", async () => {
    const env = environmentFor("S2-local"); await env.reset(0);
    const g = new Recording(); const b = new ModelBudget({ ...defaultBudgetLimits, maxSpendUsd: 0.000001 });
    const ps = policiesFor("model-guided", b, setup(g), "S2-local");
    await expect(ps.sieg.decide(await decisionInput(env, "sieg"))).rejects.toThrow();
    expect(g.priced[0].system).toContain(GUIDED_MAZE_VERSION);
    expect(g.sent).toEqual([]);
  });

  it("cannot dispatch a paid provider through the guided wrapper without persistent authorization", async () => {
    const network = vi.fn(async () => { throw Error("network forbidden in offline test"); });
    vi.stubGlobal("fetch", network);
    const provider = new OpenAIGateway("gpt-6-luna", openaiPrices["gpt-6-luna"], "offline-fixture-not-a-credential", "medium");
    const env = environmentFor("S2-local"); await env.reset(0);
    const b = budget(); const ps = policiesFor("model-guided", b, setup(provider), "S2-local");
    await expect(ps.sieg.decide(await decisionInput(env, "sieg"))).rejects.toThrow(/persistent episode and per-call authorization/);
    expect(network).not.toHaveBeenCalled();
    expect(b.records[0].chargedUsd).toBe(b.records[0].reservedUsd);
    expect(b.records[0].reservedUsd).toBeGreaterThan(0);
  });

  it("charges unknown usage at the complete guided prompt reservation", async () => {
    const env = environmentFor("S2-local"); await env.reset(0);
    const g = new Recording(); g.reply = { ...g.reply, tokens: null, costUsd: null };
    const b = budget(); const ps = policiesFor("model-guided", b, setup(g), "S2-local");
    await ps.sieg.decide(await decisionInput(env, "sieg"));
    const r = b.records[0];
    expect(r.chargedUsd).toBe(r.reservedUsd);
    expect(r.reservedUsd).toBe(Buffer.byteLength(g.sent[0].system) / 1e6);
    expect(r.tokens).toBeNull();
  });

  it("records a model-guided run and uses normal role/action validation and a persistent scratch ledger", async () => {
    const root = mkdtempSync(join(tmpdir(), "guided-maze-")); scratch.push(root);
    const ledger = SpendLedger.open(join(root, "ledger.json")); const g = new Recording();
    g.complete = async (system, user) => {
      g.sent.push({ system, user });
      const hero = JSON.parse(user).observation.hero;
      return { text: JSON.stringify({ notes: "fixture", actions: [hero === "Sieg" ? { type: "ability", ability: "flight" } : { type: "wait", ticks: 1 }] }), tokens: { input: 1, output: 1 }, costUsd: 0 };
    };
    const stop = new AbortController(); let steps = 0;
    try {
      const [s] = await runSuite({ player: "model-guided", situations: ["S2-local"], seeds: [0], outDir: join(root, "out"), gitHash: "offline-guided", model: { ...setup(g), ledger }, signal: stop.signal, onTrace(l) { if (l.type === "step" && ++steps >= 2) stop.abort(); } });
      expect(s.player).toBe("model-guided"); expect(s.suiteRevision).toBe(2);
      expect(s.invalidActions.sieg).toBeGreaterThan(0); // no guided bypass for Sieg's illegal Flight
      expect(s.startHash).toBe((await environmentFor("S2-local").reset(0)).startHash);
      expect(s.policies.sieg).toContain(GUIDED_MAZE_ID);
      const manifest = JSON.parse(readFileSync(join(root, "out/run.json"), "utf8"));
      expect(manifest.player).toBe("model-guided");
      const lines = readFileSync(s.trace, "utf8").trim().split("\n").map(l => JSON.parse(l)); verifyTrace(lines);
      expect(ledger.entries()[0]).toMatchObject({ status: "settled", chargedUsd: 0 });
      expect(ledger.entries()[0].run).toContain("model-guided/S2-local/");
      for (const r of g.sent) expect(JSON.parse(r.user).observation).not.toHaveProperty("puzzles");
    } finally { ledger.close(); }
  }, 30_000);

  it("has no engine, route, automatic navigation, or filesystem dependency in runtime guided modules", () => {
    for (const file of ["guidedMaze.ts", "guidedMazeInstructions.ts"]) {
      const src = readFileSync(new URL(`../src/policies/${file}`, import.meta.url), "utf8");
      const imports = [...src.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map(m => m[1]);
      expect(imports.some(i => /server|shared|environment|route|navigate|node:fs/.test(i))).toBe(false);
      expect(src).not.toMatch(/\.step\(|\.observe\(|\.legal_actions\(|\.transition\(/);
    }
  });
});

function containsInOrder(points: number[][], wanted: readonly (readonly number[])[]) {
  let i = 0;
  for (const p of points) if (i < wanted.length && p[0] === wanted[i][0] && p[1] === wanted[i][1]) i++;
  return i === wanted.length;
}
for (const seed of [0, 1]) it(`offline engineering proof: guide legs and checkpoints match the real Maze route at tuning seed ${seed}`, async () => {
  const trace = new TraceWriter();
  const env = environmentFor("S2-local", { trace: e => trace.write(e) }); await env.reset(seed);
  const room = (env as any).room;
  expect(room.state.sceneId).toBe("HEDGE_MAZE");
  expect(Object.values(room.state.players).map((p: any) => [p.x / 32, p.y / 32])).toEqual([[4, 34], [5.5625, 34]]);
  const objective = Symbol("objective acquired; stop before route's return-to-shrine leg");
  const seen: Record<PlayerId, number[][]> = { sieg: [], coco: [] };
  class ProofDirector extends Director {
    async go(...args: Parameters<Director["go"]>) {
      for (const id of ["sieg", "coco"] as const) { const t = args[0][id]?.to; if (t) seen[id].push([t.x, t.y]); }
      return super.go(...args);
    }
    async both(...args: Parameters<Director["both"]>) {
      const r = await super.both(...args);
      if ((await this.env.outcome()).status === "success") throw objective;
      return r;
    }
  }
  const d = new ProofDirector({ env });
  expect(await d.untilDialogue(30)).toBe(true); await d.dialogue();
  await expect(hedgeMaze(d)).rejects.toBe(objective);
  expect(await env.outcome()).toMatchObject({ status: "success" });
  expect(room.state.sceneId).toBe("HEDGE_MAZE"); // no return or other quest area
  expect(room.state.inventory.counts.enchanted_shears).toBe(1);
  expect(room.state.inventory.counts.hedge_gate_key).toBe(0);
  expect(room.state.puzzles.hedgeGate.complete).toBe(true);
  expect(room.state.puzzles.hedgeMaze.maze).toMatchObject({ burned: true, cow: { parked: true }, runner: { caught: true } });
  for (const key of ["cowApproach", "aroundCow", "cocoStage", "cocoGate", "cocoChest"] as const) expect(containsInOrder(seen.coco, MAZE_GUIDE_LEGS[key]), key).toBe(true);
  expect(containsInOrder(seen.sieg, MAZE_GUIDE_LEGS.siegNorth)).toBe(true);
  expect(containsInOrder(seen.sieg, MAZE_GUIDE_LEGS.gateUpper) || containsInOrder(seen.sieg, MAZE_GUIDE_LEGS.gateLower)).toBe(true);
  for (const points of Object.values(MAZE_GUIDE_LEGS)) for (const [x, y] of points) expect(mazeCellOpen(Math.floor(x), Math.floor(y)), `${x},${y}`).toBe(true);
  for (const x of [11.5, 39.5]) for (let y = 4.5; y <= 12.5; y += 0.25) expect(mazeCellOpen(Math.floor(x), Math.floor(y))).toBe(true);
  expect(mazeBurnBush).toMatchObject({ x: 18 * 32, y: 32 * 32 });
  expect(mazeGate).toMatchObject({ x: 40 * 32, y: 12 * 32 });
  expect(MAZE_GUIDE_CHECKPOINTS.map(c => c[0])).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  verifyTrace(trace.lines);
}, 60_000);
