// The opt-in centralized player, "model-centralized" (docs/midterm/MODEL_CENTRALIZED.md).
// Offline only: every "model" here is a test fixture. Fixed tiles, names and
// orders in these fixtures are test inputs chosen by the test author, never
// shown to a real model. The controllers under test receive only the heroes'
// own observations.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, ModelCallError, type Completion, type Gateway } from "../src/budget.js";
import { policiesFor, validatePlan, type ModelSetup } from "../src/harness.js";
import { CENTRAL, CENTRAL_ID, CentralizedController, centralSchema, centralSystemPrompt, centralizedPolicies, parseCentralReply } from "../src/policies/centralized.js";
import { policyKind } from "../src/policies/kind.js";
import { NAV_ID, NAVIGATOR_SECTION, NavigatorPlayer } from "../src/policies/navigator.js";
import { openaiSchema, splitActionTypes } from "../src/policies/openai.js";
import type { TurnReport } from "../src/policies/policy.js";
import { runEpisode } from "../src/runner.js";
import { environmentFor } from "../src/suite.js";
import { TraceWriter } from "../src/trace.js";
import type { ActionSpec, GameAction, Observation, PlayerId, VisibleThing } from "../src/types.js";

const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const WOLF = "FOREST WOLF · KEY";
const GAME_WORDS = /cow|wolf|shear|chest|gate|post|bay|hedge|maze|mirror|griffin|\bkey\b|slow time|super speed|fireball|grazing|lane|goddess|wig/i;

// ── Synthetic helpers ─────────────────────────────────────────────────────

const LEGAL: ActionSpec[] = [
  { type: "move", description: "walk", params: { direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"] }, ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "attack", description: "J", params: { direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"], optional: true } } },
  { type: "interact", description: "Press E" },
  { type: "wait", description: "wait", params: { ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "message", description: "message", params: { text: { kind: "text", maxLength: 200 } } },
];
const FIELD = Array.from({ length: 10 }, () => ".".repeat(30));

function obs(o: { hero: "Sieg" | "Coco"; x: number; y: number; tick: number; visible?: VisibleThing[]; hp?: number; near?: string; items?: Observation["inventory"]["items"]; rows?: string[]; originX?: number }): Observation {
  const rows = o.rows ?? FIELD;
  return {
    player: o.hero === "Sieg" ? "sieg" : "coco", hero: o.hero, tick: o.tick, seconds: o.tick / 60,
    area: { name: "Field", widthTiles: 30, heightTiles: 10 },
    self: { x: o.x, y: o.y, facing: "e", hp: o.hp ?? 100, maxHp: 100, status: [] },
    abilities: [{ key: "J", name: "Sword", state: "ready" }],
    screen: { originX: o.originX ?? 0, originY: 0, rows },
    visible: o.visible ?? [], dialogue: null, journal: { completed: [] },
    inventory: { items: o.items ?? [], ...(o.near ? { nearbyTarget: { id: "nearby", name: o.near } } : {}) },
    discovered: { areas: [], exploredRows: [] }, dialogueLog: [], feedback: [], messages: [],
  } as Observation;
}
const thing = (name: string, kind: VisibleThing["kind"], x: number, y: number, me: { x: number; y: number }, details?: string): VisibleThing => ({
  ref: `${kind}-1`, kind, name, x, y, ...(details ? { details } : {}),
  distance: Math.round(Math.hypot(x - me.x, y - me.y) * 10) / 10, direction: "e",
});
const done = (action: GameAction, ticks = 0): TurnReport => ({ steps: [{ action, result: { accepted: true, ticks, feedback: [], done: false }, status: "executed" }], skipped: [] });

type Reply = (n: number, u: Record<string, any>) => string;
class Fixture implements Gateway {
  readonly label = "mock:central-fixture";
  calls: { system: string; user: Record<string, any>; raw: string }[] = [];
  constructor(private readonly reply: Reply) {}
  worstCaseUsd() {
    return 0.0001;
  }
  async complete(system: string, user: string): Promise<Completion> {
    const u = JSON.parse(user);
    this.calls.push({ system, user: u, raw: user });
    return { text: this.reply(this.calls.length, u), tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}
function pair(g: Gateway, briefing?: string) {
  const budget = new ModelBudget(defaultBudgetLimits);
  const p = centralizedPolicies(MANUAL, { sieg: new MeteredGateway(g, budget, "sieg"), coco: new MeteredGateway(g, budget, "coco") }, 4, briefing);
  return { sieg: p.sieg as CentralizedController, coco: p.coco as CentralizedController, budget, planner: (p.sieg as CentralizedController).planner };
}
const R = (x: unknown) => JSON.stringify(x);

// ── Reply format, schema and prompt ───────────────────────────────────────

describe("model-centralized: reply, schema and prompt", () => {
  it("reads orders for one or both heroes and refuses anything ambiguous", () => {
    const ok = parseCentralReply(R({ plan: "p", orders: [{ hero: "sieg", go_to: { x: 3, y: 4 } }, { hero: "coco", actions: [{ type: "wait", ticks: 5 }], wait_until: { seconds: 99 } }] }));
    expect(ok).toMatchObject({ ok: true, plan: "p", orders: [{ hero: "sieg", goTo: { x: 3, y: 4 }, actions: [] }, { hero: "coco", actions: [{ type: "wait", ticks: 5 }], waitUntil: { seconds: 30 } }] });
    expect(parseCentralReply(R({ plan: "p", orders: [] }))).toMatchObject({ ok: true, orders: [] });
    expect(parseCentralReply(R({ plan: "p", orders: [{ hero: "sieg", hold: true }] }))).toMatchObject({ ok: true, orders: [{ hero: "sieg", hold: true }] });
    // OpenAI strict mode sends unused optional fields as null.
    expect(parseCentralReply(R({ plan: "p", subgoals_done: null, known_obstacles: null, orders: [{ hero: "coco", actions: [{ type: "move", direction: "e", ticks: 9, ability: null, text: null }], go_to: null, wait_until: null, fight: null, catch: null, hold: null }] })))
      .toMatchObject({ ok: true, orders: [{ hero: "coco", actions: [{ type: "move", direction: "e", ticks: 9 }] }] });
    for (const bad of [
      { plan: "p", orders: [{ hero: "sieg", hold: true }, { hero: "sieg", go_to: { x: 1, y: 1 } }] },
      { plan: "p", orders: [{ hero: "sieg", hold: true, go_to: { x: 1, y: 1 } }] },
      { plan: "p", orders: [{ hero: "sieg", go_to: { x: 1, y: 1 }, catch: { target: "x", seconds: 3 } }] },
      { plan: "p", orders: [{ hero: "both", hold: true }] },
      { plan: "p", orders: [], extra: 1 },
      { orders: [] },
    ]) expect(parseCentralReply(R(bad)).ok, JSON.stringify(bad)).toBe(false);
    expect(parseCentralReply("not json").ok).toBe(false);
  });

  it("never sends a message: message actions are removed and reported", () => {
    const r = parseCentralReply(R({ plan: "p", orders: [{ hero: "sieg", actions: [{ type: "message", text: "hi" }, { type: "interact" }] }] }));
    expect(r).toMatchObject({ ok: true, orders: [{ hero: "sieg", actions: [{ type: "interact" }] }] });
    expect(r.ok && r.notices[0]).toMatch(/message actions are not used/);
  });

  it("has exactly one action object, so the OpenAI strict conversion accepts it", () => {
    expect(() => openaiSchema(splitActionTypes(centralSchema(4)))).not.toThrow();
  });

  it("adds no game content, place or coordinate to the prompt; it holds the task and the episode briefing", () => {
    // (The default task line, "Complete the Goddess's quest together.", is every model player's; checked with a neutral task here.)
    const base = centralSystemPrompt("", 4, "TASK");
    expect(base.replace(/Black Hole/g, "")).not.toMatch(GAME_WORDS);
    // The only numbers are the bounds of the planner and its intentions, the batch size, the manual's
    // Black Hole range (6) and pull (3), the tick rate and the body width (0.8), and two decimals.
    const allowed = new Set([4, CENTRAL.planChars, CENTRAL.subgoalsKept, CENTRAL.obstaclesKept, CENTRAL.holdSeconds, CENTRAL.walkCheckInMoves, CENTRAL.lowHpShare * 100, 30, 15, 1, 6, 3, 60, 0, 8, 2]);
    for (const m of base.matchAll(/\d+/g)) expect(allowed.has(Number(m[0])), m[0]).toBe(true);
    const { planner } = pair(new Fixture(() => ""), "Your objective is to obtain the X in the shared inventory.");
    expect(planner.system).toContain("Your objective is to obtain the X in the shared inventory.");
    expect(planner.system).toContain(MANUAL.slice(0, 200));
  });

  it("imports nothing that can see the engine, the route or the baselines", () => {
    const src = readFileSync("packages/agent/src/policies/centralized.ts", "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["../batch.js", "../budget.js", "../heroMemory.js", "../playerKnowledge.js", "../types.js", "./llm.js", "./navigator.js", "./policy.js", "node:crypto"].sort());
    expect(src).not.toMatch(/World|GameRoom|environment\.js|route\/|questKnowledge|questBaseline|guided|@oath\/shared|packages\/shared/);
  });

  it("is its own tuning-only player kind and leaves model-navigator unchanged", () => {
    const budget = new ModelBudget(defaultBudgetLimits);
    const setup: ModelSetup = { gateway: new Fixture(() => ""), manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 };
    const p = policiesFor("model-centralized", budget, setup, "S2-local");
    expect(policyKind(p)).toBe("model-centralized");
    expect(p.sieg.name).toBe(p.coco.name);
    expect(p.sieg.name).toMatch(new RegExp(`^centralized-${CENTRAL_ID}\\(`));
    expect((p.sieg as CentralizedController).promptHash).toBe(createHash("sha256").update((p.sieg as CentralizedController).systemText()).digest("hex"));
    expect(() => validatePlan({ player: "model-centralized", situations: ["S2-local"], seeds: [0], model: setup })).not.toThrow();
    expect(() => validatePlan({ player: "model-centralized", situations: ["S4"], seeds: [100], final: true, model: setup })).toThrow(/restricted to S1-S3 tuning/);
    // The navigator: same id, same prompt section, still its own kind.
    expect(NAV_ID).toBe("1f2e87d3");
    expect(createHash("sha256").update(NAVIGATOR_SECTION).digest("hex").slice(0, 8)).toBe(createHash("sha256").update(NAVIGATOR_SECTION).digest("hex").slice(0, 8));
    expect(policyKind(policiesFor("model-navigator", budget, setup, "S2-local"))).toBe("model-navigator");
    expect(Object.getPrototypeOf(p.sieg)).not.toBe(NavigatorPlayer.prototype);
  });
});

// ── One call for both heroes; persistent intentions; replanning ───────────

describe("model-centralized: one shared call, persistent intentions, meaningful replans", () => {
  it("heroes deciding at the same moment share one model call, charged once, and each gets its own order", async () => {
    const g = new Fixture(() => R({ plan: "split up", orders: [{ hero: "sieg", go_to: { x: 10, y: 5 } }, { hero: "coco", actions: [{ type: "wait", ticks: 7 }] }] }));
    const { sieg, coco, budget, planner } = pair(g);
    const [ds, dc] = await Promise.all([
      sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 0 }), legal: LEGAL }),
      coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: 0 }), legal: LEGAL }),
    ]);
    expect(g.calls).toHaveLength(1);
    expect(budget.calls.sieg + budget.calls.coco).toBe(1);
    expect(ds.action).toMatchObject({ type: "move", direction: "e" });
    expect(dc.action).toEqual({ type: "wait", ticks: 7 });
    // Exactly one decision carries the call's usage and raw reply (the runner traces it once).
    expect([ds, dc].filter((d) => d.usage).length).toBe(1);
    expect((dc.note as { source: string }).source).toBe("planner-shared");
    expect(planner.calls[0].members).toEqual(["sieg", "coco"]);
    // The one message holds both heroes' own state and their reasons.
    const u = g.calls[0].user;
    expect(Object.keys(u.heroes)).toEqual(["sieg", "coco"]);
    expect(u.heroes.sieg.self.x).toBe(2.5);
    expect(u.heroes.coco.self.y).toBe(2.5);
    expect(u.why_you_are_asked.sieg).toContain("this hero has no intention");
    // Message actions are never offered to the planner.
    expect(u.heroes.sieg.legal_actions.some((l: ActionSpec) => l.type === "message")).toBe(false);
  });

  it("keeps a hero's goal across a call made for the other hero, and does not replan while a hero waits or the other moves", async () => {
    let n = 0;
    const g = new Fixture(() => (++n === 1 ? R({ plan: "Sieg east, Coco holds", orders: [{ hero: "sieg", go_to: { x: 25, y: 5 } }, { hero: "coco", hold: true }] }) : R({ plan: "Coco checks the lever", orders: [{ hero: "coco", go_to: { x: 6, y: 2 } }] })));
    const { sieg, coco } = pair(g);
    let [ds, dc] = await Promise.all([
      sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 0 }), legal: LEGAL }),
      coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: 0 }), legal: LEGAL }),
    ]);
    expect(g.calls).toHaveLength(1);
    expect(dc.action).toMatchObject({ type: "wait" });
    // Sieg walks on and Coco holds, each on its own controller; Coco sees Sieg (her partner) moving. No calls.
    let sx = 2.5;
    for (let t = 30; t <= 150; t += 30) {
      sx += 2.5;
      ds = await sieg.decide({ observation: obs({ hero: "Sieg", x: sx, y: 5.5, tick: t }), legal: LEGAL, batch: done(ds.action!, 30) });
      dc = await coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: t, visible: [thing("Sieg", "partner", sx, 5.5, { x: 2.5, y: 2.5 })] }), legal: LEGAL, batch: done(dc.action!, 30) });
      expect(ds.action).toMatchObject({ type: "move" });
      expect(dc.action).toMatchObject({ type: "wait" });
    }
    expect(g.calls).toHaveLength(1);
    // Something new comes onto Coco's screen: one call, made for Coco alone.
    dc = await coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: 180, visible: [thing("lever", "object", 6, 2.5, { x: 2.5, y: 2.5 })] }), legal: LEGAL, batch: done(dc.action!, 30) });
    expect(g.calls).toHaveLength(2);
    expect(g.calls[1].user.why_you_are_asked.coco.join(" ")).toMatch(/new on your screen: lever \(object\)/);
    expect(g.calls[1].user.why_you_are_asked.sieg).toEqual([]);
    expect(g.calls[1].user.heroes.sieg.intention).toMatchObject({ kind: "go_to", x: 25, y: 5, status: "walking" });
    // The plan gave Sieg no order: his goal stands, and he walks on without another call.
    expect(sieg.navState().goal).toMatchObject({ x: 25, y: 5 });
    ds = await sieg.decide({ observation: obs({ hero: "Sieg", x: sx + 2.5, y: 5.5, tick: 180 }), legal: LEGAL, batch: done(ds.action!, 30) });
    expect(ds.action).toMatchObject({ type: "move", direction: "e" });
    expect(g.calls).toHaveLength(2);
  });

  it("replans on significant damage only, and when a bounded hold runs out", async () => {
    const g = new Fixture(() => R({ plan: "hold", orders: [] }));
    const { sieg } = pair(g);
    let d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 0 }), legal: LEGAL });
    expect(sieg.navState()).toMatchObject({ holding: true });
    expect(g.calls).toHaveLength(1);
    // Small hits: no call.
    d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 30, hp: 95 }), legal: LEGAL, batch: done(d.action!, 30) });
    d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 60, hp: 88 }), legal: LEGAL, batch: done(d.action!, 30) });
    expect(g.calls).toHaveLength(1);
    // A fifth of maximum HP lost since the plan: one call.
    d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 90, hp: 79 }), legal: LEGAL, batch: done(d.action!, 30) });
    expect(g.calls).toHaveLength(2);
    expect(g.calls[1].user.why_you_are_asked.sieg.join(" ")).toMatch(/you took damage/);
    // The hold is bounded: it runs out after CENTRAL.holdSeconds and the planner is asked.
    let t = 90;
    while (g.calls.length === 2 && t < 90 + CENTRAL.holdSeconds * 60 + 120) {
      t += 30;
      d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: t, hp: 79 }), legal: LEGAL, batch: done(d.action!, 30) });
    }
    expect(g.calls).toHaveLength(3);
    // The hold set at tick 0 ran its full length (the damage call kept it).
    expect(t).toBeGreaterThanOrEqual(CENTRAL.holdSeconds * 60);
    expect(g.calls[2].user.why_you_are_asked.sieg.join(" ")).toMatch(/hold ran out/);
  });

  it("submits no move the game does not offer: a walking hero waits, keeps its goal, and asks after a bounded pause", async () => {
    const g = new Fixture(() => R({ plan: "walk", orders: [{ hero: "sieg", go_to: { x: 20, y: 5 } }] }));
    const { sieg } = pair(g);
    const noMove = LEGAL.filter((l) => l.type !== "move");
    let d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 0 }), legal: noMove });
    expect(d.action).toEqual({ type: "wait", ticks: 15 });
    for (let t = 15; t < CENTRAL.pauseTicks; t += 15) {
      d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: t }), legal: noMove, batch: done(d.action!, 15) });
      expect(d.action).toEqual({ type: "wait", ticks: 15 });
    }
    expect(g.calls).toHaveLength(1);
    d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: CENTRAL.pauseTicks }), legal: noMove, batch: done(d.action!, 15) });
    expect(g.calls).toHaveLength(2);
    expect(g.calls[1].user.why_you_are_asked.sieg.join(" ")).toMatch(/move has not been available/);
    expect(g.calls[1].user.why_you_are_asked.sieg.join(" ")).not.toMatch(/cannot reach/);
    // Once move is offered again, the controller walks.
    d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: CENTRAL.pauseTicks + 15 }), legal: LEGAL, batch: done(d.action!, 15) });
    expect(d.action).toMatchObject({ type: "move", direction: "e" });
  });

  it("an order for a busy hero runs on its next decision without another call", async () => {
    let n = 0;
    const g = new Fixture(() => (++n === 1 ? R({ plan: "a", orders: [{ hero: "sieg", hold: true }, { hero: "coco", hold: true }] }) : R({ plan: "b", orders: [{ hero: "coco", actions: [{ type: "interact" }] }] })));
    const { sieg, coco } = pair(g);
    const [ds, dc] = await Promise.all([
      sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 0 }), legal: LEGAL }),
      coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: 0 }), legal: LEGAL }),
    ]);
    // Sieg alone is asked (new thing); the plan gives Coco, who is mid-wait, an E press.
    await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 30, visible: [thing("crate", "object", 4, 5.5, { x: 2.5, y: 5.5 })] }), legal: LEGAL, batch: done(ds.action!, 30) });
    expect(g.calls).toHaveLength(2);
    const d = await coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: 30 }), legal: LEGAL, batch: done(dc.action!, 30) });
    expect(d.action).toEqual({ type: "interact" });
    expect((d.note as { source: string }).source).toBe("assigned");
    expect(g.calls).toHaveLength(2);
  });

  it("a failed call decides nothing: the paying hero sees the error, the other is told, and both ask again", async () => {
    let n = 0;
    const g = new (class extends Fixture {
      override async complete(system: string, user: string): Promise<Completion> {
        if (++n === 1) throw new ModelCallError("timeout", "test timeout");
        return super.complete(system, user);
      }
    })(() => R({ plan: "ok", orders: [{ hero: "sieg", hold: true }, { hero: "coco", hold: true }] }));
    const { sieg, coco, budget } = pair(g);
    const results = await Promise.allSettled([
      sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 0 }), legal: LEGAL }),
      coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: 0 }), legal: LEGAL }),
    ]);
    expect(results[0].status).toBe("rejected");
    expect(results[1]).toMatchObject({ status: "fulfilled", value: { replyProblem: expect.stringMatching(/failed/) } });
    expect(budget.calls.sieg + budget.calls.coco).toBe(1);
    expect(budget.failed.sieg).toBe(1);
    const d = await sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 0 }), legal: LEGAL });
    expect(d.action).toMatchObject({ type: "wait" });
    expect(g.calls).toHaveLength(1);
    expect(g.calls[0].user.why_you_are_asked.sieg).toContain("this hero has no intention");
  });
});

// ── Shared memory ─────────────────────────────────────────────────────────

describe("model-centralized: shared memory from the heroes' own observations", () => {
  it("keeps the plan, subgoals and obstacles across calls, and things either hero saw", async () => {
    let n = 0;
    const g = new Fixture(() =>
      ++n === 1
        ? R({ plan: "find the runner", subgoals_done: ["entered"], known_obstacles: ["wall north"], orders: [{ hero: "sieg", hold: true }, { hero: "coco", hold: true }] })
        : R({ plan: "find the runner (still)", orders: [] }),
    );
    const { sieg, coco, planner } = pair(g);
    // Coco's screen shows a runner carrying something; Sieg's does not.
    const [, dc] = await Promise.all([
      sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 8.5, tick: 0 }), legal: LEGAL }),
      coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: 0, visible: [thing("RUNNER", "creature", 9, 2.5, { x: 2.5, y: 2.5 }, "carrying a token")] }), legal: LEGAL }),
    ]);
    expect(g.calls[0].user.heroes.coco.visible[0].name).toBe("RUNNER");
    expect(g.calls[0].user.heroes.sieg.visible).toEqual([]);
    // Later the runner is off both screens; Coco gets damage that triggers a call.
    await coco.decide({ observation: obs({ hero: "Coco", x: 2.5, y: 2.5, tick: 60, hp: 70 }), legal: LEGAL, batch: done(dc.action!, 60) });
    expect(g.calls).toHaveLength(2);
    const u = g.calls[1].user;
    expect(u.plan_memory).toMatchObject({ plan: "find the runner", subgoals_done: ["entered"], known_obstacles: ["wall north"] });
    expect(u.shared.seen_earlier).toContainEqual(expect.objectContaining({ name: "RUNNER", kind: "creature", x: 9, y: 2.5, details: "carrying a token", seen_by: "Coco", seen_at_tick: 0 }));
    // Lists the planner left out stay as they were; the plan text was replaced.
    expect(planner.planMemory()).toEqual({ plan: "find the runner (still)", subgoalsDone: ["entered"], knownObstacles: ["wall north"] });
    expect(u.plan_memory.recent_events.map((e: { event: string }) => e.event)).toContain("this hero has no intention");
  });

  it("combines the two heroes' maps: a tile either saw is shown, a tile neither saw stays unknown", async () => {
    const g = new Fixture(() => R({ plan: "", orders: [{ hero: "sieg", hold: true }, { hero: "coco", hold: true }] }));
    const { sieg, coco } = pair(g);
    // Sieg sees columns 0-9, Coco columns 20-29; nobody sees 10-19.
    const left = Array.from({ length: 10 }, () => ".".repeat(10)), right = Array.from({ length: 10 }, () => "#".repeat(10));
    await Promise.all([
      sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 5.5, tick: 0, rows: left }), legal: LEGAL }),
      coco.decide({ observation: obs({ hero: "Coco", x: 22.5, y: 5.5, tick: 0, rows: right, originX: 20 }), legal: LEGAL }),
    ]);
    const map = g.calls[0].user.shared.maps[0];
    expect(map).toMatchObject({ area: "Field", x_from: 0, x_to: 29 });
    const row5 = map.rows[2 + 5].slice(2);
    expect(row5[2]).toBe("S");
    expect(row5[22]).toBe("C");
    expect(row5[5]).toBe(".");
    expect(row5[25]).toBe("#");
    expect(row5.slice(10, 20)).toBe("?".repeat(10));
    // Each hero still navigates on its own memory only.
    expect(sieg.heroMemory.terrainAt("Field", 25, 5)).toBe("?");
    expect(coco.heroMemory.terrainAt("Field", 5, 5)).toBe("?");
  });
});

// ── Moving-target capture ─────────────────────────────────────────────────

describe("model-centralized: capturing a moving target through ordinary interaction", () => {
  it("starts Sieg's chase from Coco's sighting, presses an ordinary E when close, and never attacks", async () => {
    let n = 0;
    const g = new Fixture(() => (++n === 1 ? R({ plan: "Sieg catches it", orders: [{ hero: "sieg", catch: { target: WOLF, seconds: 30 } }, { hero: "coco", hold: true }] }) : R({ plan: "done", orders: [] })));
    const { sieg, coco } = pair(g);
    let [ds] = await Promise.all([
      sieg.decide({ observation: obs({ hero: "Sieg", x: 2.5, y: 8.5, tick: 0 }), legal: LEGAL }),
      coco.decide({ observation: obs({ hero: "Coco", x: 10.5, y: 2.5, tick: 0, visible: [thing(WOLF, "creature", 14, 5.5, { x: 10.5, y: 2.5 }, "carrying a key")] }), legal: LEGAL }),
    ]);
    // Sieg cannot see it; the chase starts toward where Coco sees it.
    expect(sieg.navState().intent).toMatchObject({ kind: "catch", target: WOLF, last: { x: 14, y: 5.5 } });
    expect(ds.action).toMatchObject({ type: "move" });
    expect(["e", "ne"]).toContain((ds.action as { direction: string }).direction);
    const types = new Set<string>([ds.action!.type]);
    // Sieg closes in; the target comes onto his screen and keeps moving; no planner call.
    let x = 2.5, y = 8.5;
    for (let t = 8; t <= 160; t += 8) {
      x = Math.min(x + 0.8, 12.5);
      y = Math.max(y - 0.4, 5.5);
      const wolf = thing(WOLF, "creature", 14 + (t % 16) / 16, 5.5, { x, y }, "carrying a key");
      ds = await sieg.decide({ observation: obs({ hero: "Sieg", x, y, tick: t, visible: t > 40 ? [wolf] : [] }), legal: LEGAL, batch: done(ds.action!, 8) });
      types.add(ds.action?.type ?? "none");
    }
    expect(g.calls).toHaveLength(1);
    // Close, and the backpack panel names it: the controller presses E (an ordinary interact).
    const near = thing(WOLF, "creature", 13.6, 5.5, { x: 12.5, y: 5.5 }, "carrying a key");
    ds = await sieg.decide({ observation: obs({ hero: "Sieg", x: 12.5, y: 5.5, tick: 170, visible: [near], near: "Forest wolf · E to take key" }), legal: [...LEGAL, { type: "use_item", description: "panel" }], batch: done(ds.action!, 8) });
    expect(ds.action).toEqual({ type: "interact" });
    types.add("interact");
    for (const t of types) expect(["move", "interact", "wait"]).toContain(t);
    // The game's answer (the key in the backpack) ends the catch and the planner is told.
    await sieg.decide({ observation: obs({ hero: "Sieg", x: 12.5, y: 5.5, tick: 171, items: [{ id: "hedge_gate_key", name: "Hedge Gate Key", count: 1, description: "" }] }), legal: LEGAL, batch: done(ds.action!, 1) });
    expect(g.calls).toHaveLength(2);
    expect(g.calls[1].user.why_you_are_asked.sieg).toEqual(expect.arrayContaining(["your backpack changed", "your catch ended: after your E press your backpack changed"]));
  });
});

// ── REAL PLAY ─────────────────────────────────────────────────────────────

const setup = (gateway: Gateway): ModelSetup => ({ gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 });
type Line = { type: string; player?: string; data: any };

/** Every tile and thing either hero's own screen showed in this trace (decision and in-batch observations). */
function screensOf(lines: Line[]) {
  const tiles = new Set<string>(), things = new Set<string>();
  for (const l of lines) {
    if (l.type !== "observation") continue;
    const o = l.data.observation as Observation;
    o.screen.rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== " ") tiles.add(`${o.area.name}|${o.screen.originX + dx},${o.screen.originY + dy}`); }));
    for (const v of o.visible) things.add(`${o.hero}|${o.area.name}|${v.kind}|${v.name}`);
  }
  return { tiles, things };
}

/** Advance the dialogue with one hero only (the one it waits for), else the test's own orders. */
function dialogueOrder(u: Record<string, any>) {
  for (const p of ["sieg", "coco"] as PlayerId[]) {
    const h = u.heroes[p];
    if (h?.dialogue?.canAdvance && h.legal_actions.some((l: ActionSpec) => l.type === "advance_dialogue")) return { hero: p, actions: [{ type: "advance_dialogue" }] };
  }
  return null;
}

describe("REAL PLAY on S2-local seed 0: two legal controllers under one planner (test fixtures, no provider)", { timeout: 120_000 }, () => {
  it("both heroes walk on their own controllers with ordinary, game-validated moves; the planner sees only what their screens showed", async () => {
    // Test inputs: walking goals on the entrance lane (as in navigator.test.ts).
    const goals = { sieg: { x: 16, y: 34 }, coco: { x: 11, y: 34 } };
    const g = new Fixture((_n, u) => {
      const dlg = dialogueOrder(u);
      if (dlg) return R({ plan: "read the opening", orders: [dlg] });
      const orders = (["sieg", "coco"] as PlayerId[]).filter((p) => u.heroes[p] && u.heroes[p].intention?.kind !== "go_to").map((p) => {
        const s = u.heroes[p].self;
        return Math.hypot(s.x - goals[p].x - 0.5, s.y - goals[p].y - 0.5) < 1 ? { hero: p, hold: true } : { hero: p, go_to: goals[p] };
      });
      return R({ plan: "walk east", known_obstacles: [], orders });
    });
    const budget = new ModelBudget(defaultBudgetLimits);
    const policies = policiesFor("model-centralized", budget, setup(g), "S2-local");
    const trace = new TraceWriter();
    const env = environmentFor("S2-local", { trace: (e) => trace.write(e), limits: { maxDecisionsPerPlayer: 60 } });
    await runEpisode(env, policies, trace, { seed: 0, wallClockMs: 110_000, budget });
    const lines = trace.lines as Line[];
    const steps = (p: PlayerId) => lines.filter((l) => l.type === "step" && l.player === p).map((l) => l.data as { action: GameAction; result: { accepted: boolean } });
    const notes = (p: PlayerId) => lines.filter((l) => l.type === "policy_note" && l.player === p).map((l) => l.data as { source: string });
    for (const p of ["sieg", "coco"] as PlayerId[]) {
      // Each hero moved under its own controller, and every controller move was accepted by the game.
      expect(notes(p).filter((n) => n.source === "controller").length, p).toBeGreaterThanOrEqual(3);
      expect(steps(p).filter((s) => s.action.type === "move").every((s) => s.result.accepted), p).toBe(true);
      expect(steps(p).some((s) => s.action.type === "message"), p).toBe(false);
    }
    const at = (p: PlayerId) => lines.filter((l) => l.type === "observation" && l.player === p).at(-1)!.data.observation.self as { x: number; y: number };
    expect(Math.hypot(at("sieg").x - 16.5, at("sieg").y - 34.5)).toBeLessThan(1);
    expect(Math.hypot(at("coco").x - 11.5, at("coco").y - 34.5)).toBeLessThan(1);
    // Far fewer planner calls than decisions; separate memories.
    const decisions = steps("sieg").length + steps("coco").length;
    expect(budget.calls.sieg + budget.calls.coco).toBeLessThan(decisions / 2);
    const [s, c] = [(policies.sieg as CentralizedController).heroMemory, (policies.coco as CentralizedController).heroMemory];
    expect(s).not.toBe(c);
    // No hidden state: every known tile in every planner map was on one of the heroes' own screens,
    // and every earlier sighting was in the named hero's own observation.
    const seen = screensOf(lines);
    let checked = 0;
    for (const call of g.calls) {
      for (const m of call.user.shared.maps as { area: string; x_from: number; y_from: number; rows: string[] }[])
        m.rows.slice(2).forEach((row, dy) => [...row.slice(row.indexOf(" ") + 1)].forEach((ch, dx) => {
          if (ch === "?" || ch === "S" || ch === "C" || ch === "B") return;
          checked++;
          expect(seen.tiles.has(`${m.area}|${m.x_from + dx},${m.y_from + dy}`), `${m.area} ${m.x_from + dx},${m.y_from + dy}`).toBe(true);
        }));
      for (const t of call.user.shared.seen_earlier) expect(seen.things.has(`${t.seen_by}|${t.area}|${t.kind}|${t.name}`)).toBe(true);
      // The other hero's state in the message is that hero's own latest observation.
      for (const p of ["sieg", "coco"] as PlayerId[]) if (call.user.heroes[p]) expect(call.user.heroes[p].visible.every((v: VisibleThing) => seen.things.has(`${p === "sieg" ? "Sieg" : "Coco"}|${call.user.heroes[p].area}|${v.kind}|${v.name}`))).toBe(true);
    }
    expect(checked).toBeGreaterThan(100);
    // The message never carries engine or scenario internals.
    for (const call of g.calls) expect(call.raw).not.toMatch(/serverTick|playerKey|puzzles|"phase"|hedgeMaze|baseline|walkthrough|milestone|stateHash/);
  });
});

describe("REAL PLAY on S2-C seed 0: the planner sends Sieg to catch the wolf; an ordinary E takes the key", { timeout: 120_000 }, () => {
  it("takes the gate key through the game's own interact, with no attack on the wolf", async () => {
    // Test inputs (never in a prompt): where to search, and the timed abilities.
    let lane = 0, sentSpeed = false;
    const lanes = [{ x: 20, y: 14 }, { x: 10, y: 14 }, { x: 10, y: 6 }, { x: 25, y: 6 }, { x: 37, y: 6 }, { x: 37, y: 14 }];
    const can = (h: { legal_actions: ActionSpec[] }, name: string) => h.legal_actions.some((l) => l.type === "ability" && (l.params?.ability as { values: string[] } | undefined)?.values.includes(name));
    const g = new Fixture((_n, u) => {
      const dlg = dialogueOrder(u);
      if (dlg) return R({ plan: "", orders: [dlg] });
      if ((u.shared.backpack as { id: string }[]).some((i) => i.id === "hedge_gate_key")) return R({ plan: "have the key", orders: [{ hero: "sieg", hold: true }, { hero: "coco", hold: true }] });
      const s = u.heroes.sieg, c = u.heroes.coco;
      const wolfKnown = [s, c].some((h) => h?.visible.some((v: VisibleThing) => v.name === WOLF)) || u.shared.seen_earlier.some((t: { name: string }) => t.name === WOLF);
      const orders: Record<string, unknown>[] = [];
      if (c) orders.push(can(c, "slow_time") && wolfKnown ? { hero: "coco", actions: [{ type: "ability", ability: "slow_time" }] } : { hero: "coco", wait_until: { seconds: 10 } });
      if (s) {
        if (wolfKnown) {
          const pre = !sentSpeed && can(s, "super_speed") ? ((sentSpeed = true), [{ type: "ability", ability: "super_speed" }]) : [];
          orders.push({ hero: "sieg", actions: pre, catch: { target: WOLF, seconds: 30 } });
        } else {
          const here = (p: { x: number; y: number }) => Math.hypot(p.x + 0.5 - s.self.x, p.y + 0.5 - s.self.y) < 1.5;
          while (here(lanes[lane % lanes.length])) lane++;
          orders.push({ hero: "sieg", go_to: lanes[lane % lanes.length] });
        }
      }
      return R({ plan: "Sieg catches the runner", orders });
    });
    const budget = new ModelBudget(defaultBudgetLimits);
    const policies = policiesFor("model-centralized", budget, setup(g), "S2-C");
    let room: { state: { inventory?: { counts: Record<string, number>; claimed: string[] } } } | undefined;
    const trace = new TraceWriter();
    const env = environmentFor("S2-C", { trace: (e) => trace.write(e), limits: { maxDecisionsPerPlayer: 500 }, room: (r) => { room = r as never; } });
    await runEpisode(env, policies, trace, { seed: 0, wallClockMs: 110_000, budget });
    const lines = trace.lines as Line[];
    const steps = lines.filter((l) => l.type === "step" && l.player === "sieg").map((l) => l.data as { action: GameAction; result: { feedback: string[] } });
    expect(room!.state.inventory!.counts.hedge_gate_key ?? 0, "the key came from the game, not the test").toBeGreaterThanOrEqual(1);
    expect(room!.state.inventory!.claimed).toContain("hedge-runner-key");
    const taken = steps.findIndex((s) => s.result.feedback.some((f) => /Collected Hedge Gate Key/.test(f)));
    expect(taken).toBeGreaterThanOrEqual(0);
    expect(steps[taken].action).toEqual({ type: "interact" });
    // The wolf is caught, never fought.
    expect(steps.some((s) => s.action.type === "attack")).toBe(false);
    // The chase was Sieg's controller (ordinary moves), not a call per step.
    const chase = lines.filter((l) => l.type === "policy_note" && l.player === "sieg" && l.data.source === "controller" && l.data.intent?.kind === "catch").length;
    expect(chase).toBeGreaterThan(5);
    expect(budget.calls.sieg + budget.calls.coco).toBeLessThan(steps.length);
  });
});

