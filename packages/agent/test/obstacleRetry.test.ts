// model-centralized: observation-grounded retrying of blocked ways
// (owner request 2026-11-06, after docs/midterm/COW_PASSAGE_DIAGNOSIS.md).
// Offline; every "model" is a fixture. Synthetic areas only: the rules are
// general and must not name any place, body or puzzle of the game.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { CentralProgress } from "../src/policies/centralProgress.js";
import { centralizedPolicies, centralSystemPrompt, type CentralizedController } from "../src/policies/centralized.js";
import type { TurnReport } from "../src/policies/policy.js";
import type { ActionSpec, GameAction, Observation, VisibleThing } from "../src/types.js";

const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const GAME_WORDS = /cow|wolf|shear|chest|gate|post|bay|hedge|maze|mirror|griffin|\bkey\b|slow time|super speed|fireball|grazing|lane|goddess|wig|black hole/i;
const FIELD = Array.from({ length: 10 }, () => ".".repeat(30));
const LEGAL: ActionSpec[] = [
  { type: "move", description: "walk", params: { direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"] }, ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "wait", description: "wait", params: { ticks: { kind: "int", min: 1, max: 60 } } },
];

function obs(o: { x: number; y: number; tick: number; visible?: VisibleThing[]; rows?: string[] }): Observation {
  return {
    player: "sieg", hero: "Sieg", tick: o.tick, seconds: o.tick / 60,
    area: { name: "Field", widthTiles: 30, heightTiles: 10 },
    self: { x: o.x, y: o.y, facing: "e", hp: 100, maxHp: 100, status: [] },
    abilities: [], screen: { originX: 0, originY: 0, rows: o.rows ?? FIELD },
    visible: o.visible ?? [], dialogue: null, journal: { completed: [] }, inventory: { items: [] },
    discovered: { areas: [], exploredRows: [] }, dialogueLog: [], feedback: [], messages: [],
  };
}
const body = (x: number): VisibleThing => ({ ref: "creature-1", kind: "creature", name: "big animal", x: x + 2, y: 5, extent: { x, y: 3, w: 4, h: 4 }, distance: 5, direction: "e" });
const sign: VisibleThing = { ref: "label-1", kind: "label", name: "too wide to pass", x: 12, y: 8, distance: 4, direction: "s" };
const moved = (action: GameAction, to: { x: number; y: number }, blocked: boolean): TurnReport => ({
  steps: [{ action, status: "executed", result: { accepted: true, ticks: 10, feedback: [], done: false, movement: { outcome: blocked ? "partial" : "full", movedTiles: 0.5, requestedTiles: 1, from: to, to, ticks: { applied: 10, notApplied: 0, movedByGame: 0 }, blocked } } }],
  skipped: [],
});

describe("CentralProgress: evidence that a blocked way may have changed", () => {
  it("records a body moving off tiles as a route_change fact to test, not a completed subgoal, and it does not restart the inactivity clock", () => {
    const p = new CentralProgress();
    p.observe(obs({ x: 2.5, y: 5.5, tick: 0, visible: [body(10)] }));
    p.observe(obs({ x: 2.5, y: 5.5, tick: 30, visible: [body(10)] }));
    const since = p.view("sieg", 30).last_progress_tick;
    p.observe(obs({ x: 2.5, y: 5.5, tick: 60, visible: [body(7)] }));
    const fact = p.facts().find((f) => f.kind === "route_change")!;
    expect(fact.text).toMatch(/no longer cover x 11–13, y 3–6 in Field/);
    expect(fact.text).toMatch(/may be passable now; walking there is the test/);
    expect(fact.completion).toBe(false);
    expect(p.complete([fact.id]).refused).toEqual([fact.id]);
    expect(p.view("sieg", 60).last_progress_tick).toBe(since);
  });

  it("records standing on a tile a body covered, or where this hero's move was stopped, as completion-eligible traversal evidence", () => {
    const p = new CentralProgress();
    p.observe(obs({ x: 2.5, y: 5.5, tick: 0, visible: [body(10)] }));
    // A move east was stopped short just before the body.
    p.observe(obs({ x: 9.4, y: 5.5, tick: 40, visible: [body(10)] }), moved({ type: "move", direction: "e", ticks: 40 }, { x: 9.4, y: 5.5 }, true));
    expect(p.facts().some((f) => f.kind === "traversal")).toBe(false);
    p.observe(obs({ x: 9.4, y: 5.5, tick: 100, visible: [body(4)] }));
    p.observe(obs({ x: 11.5, y: 5.5, tick: 140 }), moved({ type: "move", direction: "e", ticks: 20 }, { x: 11.5, y: 5.5 }, false));
    const fact = p.facts().find((f) => f.kind === "traversal")!;
    expect(fact.text).toMatch(/Sieg at \(11.5, 5.5\) in Field, on a tile this hero saw blocked or was stopped by at tick \d+: the way through it is passable now/);
    expect(fact.completion).toBe(true);
    expect(p.complete([fact.id]).refused).toEqual([]);
    expect(p.view("sieg", 140).last_progress_tick).toBe(140);
  });

  it("no longer tells the planner that an observed change proves nothing", () => {
    const p = new CentralProgress();
    p.observe(obs({ x: 2.5, y: 5.5, tick: 0, visible: [body(10)] }));
    p.observe(obs({ x: 2.5, y: 5.5, tick: 2, visible: [body(10)] }), { steps: [{ action: { type: "ability", ability: "pull" } as unknown as GameAction, status: "executed", result: { accepted: true, ticks: 1, feedback: [], done: false } }], skipped: [] });
    p.observe(obs({ x: 2.5, y: 5.5, tick: 60, visible: [body(8)] }));
    const texts = [...p.facts().map((f) => f.text), ...p.view("sieg", 60).attempted_actions.map((a) => a.outcome)].join(" ");
    expect(texts).toMatch(/Observed big animal move from/);
    expect(texts).not.toMatch(/does not confirm|not assumed/);
    expect(texts).toMatch(/walking through it is the test; a subgoal still needs its own observed result/);
  });

  it("views are copies, so a traced view never changes afterwards", () => {
    const p = new CentralProgress();
    p.observe(obs({ x: 2.5, y: 5.5, tick: 0 }));
    p.observe(obs({ x: 2.5, y: 5.5, tick: 1 }), { steps: [{ action: { type: "attack", direction: "e" }, status: "executed", result: { accepted: true, ticks: 1, feedback: [], done: false } }], skipped: [] });
    const a = p.view("sieg", 1).attempted_actions[0], b = p.view("sieg", 2).attempted_actions[0];
    expect(a.confirmed_effect_ids).not.toBe(b.confirmed_effect_ids);
    expect(a.action).not.toBe(b.action);
  });
});

describe("centralized planner prompt: general retry rules", () => {
  const rules = centralSystemPrompt("(manual)").split("The public player manual follows.")[0];
  it("allows testing a changed way without proof, keeps completion evidence-only, and treats signs as descriptions", () => {
    expect(rules).toMatch(/You do not need proof that a way is open before trying it; trying is how you find out\./);
    expect(rules).toMatch(/Trying a way is a test, not a claim\. Do not mark an obstacle solved in subgoals_done/);
    expect(rules).toMatch(/Signs, captions and other text in the world describe things; they are not measurements of what blocks movement now\./);
    expect(rules).toMatch(/rather than avoiding that place for good/);
    expect(rules).toMatch(/"subgoals_done" must contain only IDs of completion-eligible facts/);
  });
  it("the new rules name no place, body, direction or puzzle of the game", () => {
    const added = rules.slice(rules.indexOf("- Obstacles can change."), rules.indexOf("- A Black Hole pulls"));
    expect(added.split("\n").filter(Boolean)).toHaveLength(4);
    expect(added).not.toMatch(GAME_WORDS);
    expect(added).not.toMatch(/\b(north|south|east|west)\b|\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*\)/i);
  });
});

class Fixture implements Gateway {
  readonly label = "mock:retry-fixture";
  calls: Record<string, any>[] = [];
  constructor(private readonly reply: (n: number) => string) {}
  worstCaseUsd() { return 0.0001; }
  async complete(_s: string, user: string): Promise<Completion> {
    this.calls.push(JSON.parse(user));
    return { text: this.reply(this.calls.length), tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}

describe("centralized planner input: unreachable goals and whether the hero's map changed since", () => {
  it("reports an unreachable go_to with its observable reason, then marks the map changed once the blocking tiles open", async () => {
    const wall = FIELD.map((r) => r.slice(0, 15) + "#" + r.slice(16));
    const g = new Fixture(() => JSON.stringify({ plan: "p", known_obstacles: [], orders: [{ hero: "sieg", actions: [], go_to: { x: 20, y: 5 } }] }));
    const budget = new ModelBudget(defaultBudgetLimits);
    const p = centralizedPolicies(MANUAL, { sieg: new MeteredGateway(g, budget, "sieg"), coco: new MeteredGateway(g, budget, "coco") }, 4);
    const sieg = p.sieg as CentralizedController;
    const d1 = await sieg.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0, rows: wall, visible: [sign] }), legal: LEGAL });
    expect(d1.action).toBeUndefined(); // nothing could start: no path through the wall
    await sieg.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 1, rows: wall, visible: [sign] }), legal: LEGAL, batch: { steps: [], skipped: [], replyProblem: d1.replyProblem } });
    const second = g.calls[1];
    expect(second.why_you_are_asked.sieg.join(" ")).toMatch(/cannot reach your goal: no path to \(20, 5\) on your map/);
    expect(second.heroes.sieg.unreachable_goals).toEqual([expect.objectContaining({ goal: { x: 20, y: 5 }, times: 1, map_changed_near_the_way_since: false })]);
    // The wall opens on the hero's own screen: the same goal is now worth testing, and walking starts.
    const d3 = await sieg.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 60, rows: FIELD, visible: [sign] }), legal: LEGAL, batch: { steps: [], skipped: [] } });
    const view = sieg.plannerView()!;
    expect(view.unreachable_goals?.[0]?.map_changed_near_the_way_since ?? true).toBe(true);
    expect(d3.action?.type ?? (await sieg.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 61, rows: FIELD }), legal: LEGAL })).action?.type).toBe("move");
  });
});
