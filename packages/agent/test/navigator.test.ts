// The opt-in model-navigator player (docs/midterm/MODEL_NAVIGATOR.md).
// Offline only: every "model" here is a test fixture. Fixed goal coordinates
// in these fixtures are test inputs chosen by the test author, never shown to
// a real model, and the controller under test receives only the hero's own
// observations.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { policiesFor, validatePlan, type ModelSetup } from "../src/harness.js";
import { HeroMemory } from "../src/heroMemory.js";
import { policyKind } from "../src/policies/kind.js";
import { aimPreview, BLACK_HOLE, aStar, buildGrid, detectEvents, goalCells, NAV, NAVIGATOR_SECTION, NavigatorPlayer, nextMove, parseNavigatorReply } from "../src/policies/navigator.js";
import type { TurnReport } from "../src/policies/policy.js";
import { runEpisode } from "../src/runner.js";
import { environmentFor } from "../src/suite.js";
import { TraceWriter } from "../src/trace.js";
import type { ActionSpec, GameAction, Observation, StepResult, VisibleThing } from "../src/types.js";

const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const heroOf = (system: string) => (system.startsWith("You are playing the cooperative game Oath and Ember as Sieg") ? "Sieg" : "Coco");

/** A synthetic observation: `rows` is the whole screen, drawn from (0, 0). */
function obs(o: { x: number; y: number; rows: string[]; tick?: number; visible?: VisibleThing[]; messages?: Observation["messages"]; feedback?: string[]; hp?: number; area?: string; hero?: "Sieg" | "Coco" }): Observation {
  const hero = o.hero ?? "Sieg";
  return {
    player: hero === "Sieg" ? "sieg" : "coco",
    hero,
    tick: o.tick ?? 0,
    seconds: (o.tick ?? 0) / 60,
    area: { name: o.area ?? "Test Field", widthTiles: o.rows[0].length, heightTiles: o.rows.length },
    self: { x: o.x, y: o.y, facing: "e", hp: o.hp ?? 100, maxHp: 100, status: [] },
    abilities: [],
    screen: { originX: 0, originY: 0, rows: o.rows },
    visible: o.visible ?? [],
    dialogue: null,
    journal: { completed: [] },
    inventory: { items: [] },
    discovered: { areas: [], exploredRows: [] },
    dialogueLog: [],
    feedback: o.feedback ?? [],
    messages: o.messages ?? [],
  };
}
const LEGAL: ActionSpec[] = [
  { type: "move", description: "walk", params: { direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"] }, ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "wait", description: "wait", params: { ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "message", description: "message", params: { text: { kind: "text", maxLength: 200 } } },
];

/** Replies in turn from a fixed list per hero, and records what it was sent. */
class Fixture implements Gateway {
  readonly label = "mock:navigator-fixture";
  calls: { hero: string; user: string; system: string }[] = [];
  constructor(private readonly replies: Record<"Sieg" | "Coco", (n: number, user: Record<string, unknown>) => string>) {}
  worstCaseUsd() {
    return 0.0001;
  }
  async complete(system: string, user: string): Promise<Completion> {
    const hero = heroOf(system);
    this.calls.push({ hero, user, system });
    const n = this.calls.filter((c) => c.hero === hero).length;
    return { text: this.replies[hero](n, JSON.parse(user)), tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}
const setup = (gateway: Gateway): ModelSetup => ({ gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 });
function player(gateway: Gateway, hero: "Sieg" | "Coco" = "Sieg") {
  const budget = new ModelBudget(defaultBudgetLimits);
  return new NavigatorPlayer(hero, MANUAL, new MeteredGateway(gateway, budget, hero === "Sieg" ? "sieg" : "coco"));
}
/** What a move did, as the runner reports it. */
function moved(action: GameAction, from: { x: number; y: number }, to: { x: number; y: number }, blocked = false): TurnReport {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const result: StepResult = {
    accepted: true,
    ticks: action.type === "move" ? action.ticks : 0,
    feedback: [],
    done: false,
    movement: { outcome: blocked ? (dist < 0.1 ? "none" : "partial") : "full", movedTiles: dist, requestedTiles: action.type === "move" ? action.ticks * 0.099 : 0, from, to, ticks: { applied: action.type === "move" ? action.ticks : 0, notApplied: 0, movedByGame: 0 }, blocked },
  };
  return { steps: [{ action, result, status: "executed" }], skipped: [] };
}

describe("path planning on the hero's own map", () => {
  const field = [
    "##########",
    "#........#",
    "#.######.#",
    "#........#",
    "##########",
  ];
  it("goes around a wall it has seen, without cutting corners", () => {
    const m = new HeroMemory("Sieg");
    const o = obs({ x: 1.5, y: 1.5, rows: field });
    m.observe(o);
    const grid = buildGrid(m, o, new Map());
    const found = aStar(grid, { x: 1, y: 1 }, [{ x: 1, y: 3 }])!;
    expect(found).not.toBeNull();
    for (const c of found.path) expect(field[c.y][c.x]).not.toBe("#");
    // Through the column at x=1 (direct) rather than through the wall row.
    expect(found.path.map((c) => `${c.x},${c.y}`)).toEqual(["1,2", "1,3"]);
  });

  it("plans through tiles it has never seen, at a higher cost, and reports no path when seen walls close every way", () => {
    const m = new HeroMemory("Sieg");
    // Only the left half was on screen.
    const rows = ["#####     ", "#....     ", "#####     "];
    const o = { ...obs({ x: 1.5, y: 1.5, rows: rows.map((r) => r.padEnd(10, " ")) }), area: { name: "Fog", widthTiles: 10, heightTiles: 3 } };
    m.observe(o);
    const grid = buildGrid(m, o, new Map());
    expect(grid.unknown(8, 1)).toBe(true);
    const found = aStar(grid, { x: 1, y: 1 }, [{ x: 8, y: 1 }]);
    expect(found?.path.at(-1)).toEqual({ x: 8, y: 1 });
    const closed = new HeroMemory("Sieg");
    const c = obs({ x: 1.5, y: 1.5, rows: ["#####", "#..##", "#####"] });
    closed.observe(c);
    expect(aStar(buildGrid(closed, c, new Map()), { x: 1, y: 1 }, [{ x: 3, y: 1 }])).toBeNull();
  });

  it("never walks into a creature's drawn body and approaches a blocked goal from beside it", () => {
    const rows = ["........", "........", "........", "........"];
    const cow: VisibleThing = { ref: "creature-1", kind: "creature", name: "big animal", x: 4, y: 1, extent: { x: 3, y: 0, w: 2, h: 4 }, distance: 3, direction: "e" };
    const m = new HeroMemory("Sieg");
    const o = obs({ x: 0.5, y: 1.5, rows, visible: [cow] });
    m.observe(o);
    const grid = buildGrid(m, o, new Map());
    // The body spans the whole field's height: no way past it.
    expect(aStar(grid, { x: 0, y: 1 }, [{ x: 7, y: 1 }])).toBeNull();
    const { cells, onCell } = goalCells(grid, { x: 3, y: 1 });
    expect(onCell).toBe(false);
    expect(cells.every((c) => c.x < 3 || c.x > 4)).toBe(true);
  });

  it("turns a path into one straight move per run, lining up first when far off the cell centre", () => {
    const path = [2, 3, 4, 5, 6].map((x) => ({ x, y: 1 }));
    expect(nextMove({ x: 1.5, y: 1.5 }, path, { x: 6.5, y: 1.5 }, true, 0.1)).toEqual({ direction: "e", ticks: 50 });
    expect(nextMove({ x: 1.5, y: 1.9 }, path, { x: 6.5, y: 1.5 }, true, 0.1)).toEqual({ direction: "n", ticks: 4 });
    expect(nextMove({ x: 1.5, y: 1.5 }, Array.from({ length: 30 }, (_, k) => ({ x: 2 + k, y: 1 })), { x: 31.5, y: 1.5 }, true, 0.1).ticks).toBe(60);
  });
});

describe("events and messages", () => {
  it("asks again for new things, damage and a new partner message, but not for a message it already had", () => {
    const rows = ["........"];
    const seen = new Set<string>();
    const texts = new Set<string>();
    const a = obs({ x: 1.5, y: 0.5, rows, messages: [{ from: "Coco", text: "On my way", tick: 1 }] });
    expect(detectEvents(undefined, a, LEGAL, seen, texts)).toContain("new message from Coco");
    texts.add("on my way");
    const snap = { area: a.area.name, hp: 100, bag: "[]", journal: JSON.stringify(a.journal), feedback: [], legalTypes: new Set(["move", "wait", "message"]), closeEnemies: new Set<string>(), dialogue: null };
    // The same text again (resent or still listed): not news.
    const b = obs({ x: 2.5, y: 0.5, rows, messages: [{ from: "Coco", text: "On my way", tick: 1 }, { from: "Coco", text: "on my  way", tick: 90 }] });
    expect(detectEvents(snap, b, LEGAL, seen, texts)).toEqual([]);
    const enemy: VisibleThing = { ref: "enemy-1", kind: "enemy", name: "slime", x: 3, y: 0, distance: 1.5, direction: "e" };
    const c = obs({ x: 1.5, y: 0.5, rows, hp: 90, visible: [enemy] });
    const ev = detectEvents(snap, c, [...LEGAL, { type: "interact", description: "E" }], seen, texts);
    expect(ev).toEqual(expect.arrayContaining([expect.stringMatching(/new on your screen: slime/), expect.stringMatching(/took damage/), expect.stringMatching(/slime \(enemy\) is close/), "a new action is available: interact"]));
  });

  it("keeps the walking goal when a message arrives and the model answers it without a new goal", async () => {
    const rows = ["##########################################", "#........................................#", "##########################################"];
    const g = new Fixture({
      Sieg: (n) => (n === 1 ? '{"notes":"","go_to":{"x":38,"y":1},"actions":[]}' : '{"actions":[{"type":"message","text":"Got it."}]}'),
      Coco: () => "{}",
    });
    const p = player(g);
    let o = obs({ x: 1.5, y: 1.5, rows });
    let d = await p.decide({ observation: o, legal: LEGAL });
    expect(g.calls.length).toBe(1);
    expect(d.action).toMatchObject({ type: "move", direction: "e" });
    let at = { x: 1.5, y: 1.5 };
    // Walk a few controller moves without any model call.
    for (let k = 0; k < 2; k++) {
      const to = { x: at.x + (d.action as { ticks: number }).ticks * 0.099, y: 1.5 };
      o = obs({ x: to.x, y: 1.5, rows, tick: (k + 1) * 60 });
      d = await p.decide({ observation: o, legal: LEGAL, batch: moved(d.action!, at, to) });
      at = to;
    }
    expect(g.calls.length).toBe(1);
    expect(d.note).toMatchObject({ source: "controller" });
    // A partner message: the model is asked, answers the message, and the goal survives.
    const to = { x: at.x + (d.action as { ticks: number }).ticks * 0.099, y: 1.5 };
    o = obs({ x: to.x, y: 1.5, rows, tick: 300, messages: [{ from: "Coco", text: "Wait for me at the gate", tick: 280 }] });
    d = await p.decide({ observation: o, legal: LEGAL, batch: moved(d.action!, at, to) });
    at = to;
    expect(g.calls.length).toBe(2);
    expect(JSON.parse(g.calls[1].user).navigation.why_you_are_asked).toContain("new message from Coco");
    expect(d.action).toEqual({ type: "message", text: "Got it." });
    expect(p.navState().goal).toMatchObject({ x: 38, y: 1 });
    // Next decision: back to walking without a call (the message is already known).
    const msgDone: TurnReport = { steps: [{ action: d.action!, result: { accepted: true, ticks: 0, feedback: [], done: false }, status: "executed" }], skipped: [] };
    o = obs({ x: at.x, y: 1.5, rows, tick: 301, messages: [{ from: "Coco", text: "Wait for me at the gate", tick: 280 }] });
    d = await p.decide({ observation: o, legal: LEGAL, batch: msgDone });
    expect(g.calls.length).toBe(2);
    expect(d.action).toMatchObject({ type: "move", direction: "e" });
  });

  it("does not resend a message identical to one sent in the last 10 game-seconds, and tells the model", async () => {
    const rows = ["........"];
    const g = new Fixture({ Sieg: () => '{"actions":[{"type":"message","text":"Ready!"},{"type":"wait","ticks":10}]}', Coco: () => "{}" });
    const p = player(g);
    const d1 = await p.decide({ observation: obs({ x: 1.5, y: 0.5, rows, tick: 0 }), legal: LEGAL });
    expect(d1.action).toEqual({ type: "message", text: "Ready!" });
    const sent: TurnReport = {
      steps: [
        { action: d1.action!, result: { accepted: true, ticks: 0, feedback: [], done: false }, status: "executed" },
        { action: d1.then![0], result: { accepted: true, ticks: 10, feedback: [], done: false }, status: "executed" },
      ],
      skipped: [],
    };
    const d2 = await p.decide({ observation: obs({ x: 1.5, y: 0.5, rows, tick: 10 }), legal: LEGAL, batch: sent });
    expect(d2.action).toEqual({ type: "wait", ticks: 10 });
    expect(d2.note).toMatchObject({ notices: [expect.stringMatching(/Not sent: your message "Ready!"/)] });
    const d3 = await p.decide({ observation: obs({ x: 1.5, y: 0.5, rows, tick: 20 }), legal: LEGAL, batch: { steps: [{ action: d2.action!, result: { accepted: true, ticks: 10, feedback: [], done: false }, status: "executed" }], skipped: [] } });
    expect(JSON.parse(g.calls[2].user).navigation.notices[0]).toMatch(/Not sent/);
    expect(d3.action).toBeDefined();
  });

  it("declares a goal unreachable after its moves keep stopping short, and asks the model", async () => {
    const rows = ["............"];
    const g = new Fixture({ Sieg: (n) => (n === 1 ? '{"go_to":{"x":10,"y":0},"actions":[]}' : '{"actions":[{"type":"wait","ticks":5}]}'), Coco: () => "{}" });
    const p = player(g);
    let o = obs({ x: 1.5, y: 0.5, rows });
    let d = await p.decide({ observation: o, legal: LEGAL });
    let k = 0;
    // An invisible obstacle: every move goes nowhere.
    while (g.calls.length === 1 && k++ < 30) {
      o = obs({ x: 1.5, y: 0.5, rows, tick: k * 10 });
      d = await p.decide({ observation: o, legal: LEGAL, batch: moved(d.action!, { x: 1.5, y: 0.5 }, { x: 1.5, y: 0.5 }, true) });
    }
    expect(g.calls.length).toBe(2);
    expect(k).toBeLessThanOrEqual(NAV.maxReplans + 3);
    const why = JSON.parse(g.calls[1].user).navigation;
    expect(why.status).toBe("unreachable");
    expect(why.why_you_are_asked.join(" ")).toMatch(/cannot reach/);
  });

  it("parses go_to and stop_navigation, treats null as absent, and refuses malformed goals", () => {
    expect(parseNavigatorReply('{"go_to":{"x":3,"y":4},"actions":[]}')).toMatchObject({ ok: true, goTo: { x: 3, y: 4 }, actions: [] });
    expect(parseNavigatorReply('{"notes":null,"go_to":null,"stop_navigation":null,"actions":[{"type":"wait","ticks":5}]}')).toMatchObject({ ok: true, stop: false, actions: [{ type: "wait", ticks: 5 }] });
    expect(parseNavigatorReply('{"stop_navigation":true,"actions":[]}')).toMatchObject({ ok: true, stop: true });
    expect(parseNavigatorReply('{"actions":[]}')).toMatchObject({ ok: false });
    expect(parseNavigatorReply('{"go_to":{"x":"far","y":1},"actions":[]}')).toMatchObject({ ok: false });
    expect(parseNavigatorReply('{"go_to":{"x":1,"y":1,"via":2},"actions":[]}')).toMatchObject({ ok: false });
  });
});

describe("boundaries", () => {
  it("imports nothing that can see the engine, the route or the baselines", () => {
    const src = readFileSync("packages/agent/src/policies/navigator.ts", "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["../batch.js", "../budget.js", "../heroMemory.js", "../playerKnowledge.js", "../types.js", "./combat.js", "./llm.js", "./navigate.js", "./policy.js", "node:crypto"].sort());
    expect(src).not.toMatch(/World|GameRoom|environment\.js|route\/|questKnowledge|questBaseline|guided|@oath\/shared|packages\/shared/);
  });

  it("adds no game content, coordinates or puzzle steps to the prompt", () => {
    // No puzzle content. The one ability it names is the manual's own (for the aim preview).
    expect(NAVIGATOR_SECTION.replace(/Black Hole/g, "")).not.toMatch(/cow|wolf|shear|chest|gate|post|bay|hedge|maze|mirror|griffin|key|black hole|slow time|super speed|fireball|push|grazing|lane/i);
    // The only numbers are the controller's own bounds and the manual's range (6) and pull radius (3) tiles.
    const allowed = new Set([NAV.dupMessageTicks / 60, NAV.maxControllerMoves, NAV.maxWaitSeconds, NAV.maxFightSeconds, 1, BLACK_HOLE.rangeTiles, BLACK_HOLE.pullTiles]);
    for (const m of NAVIGATOR_SECTION.matchAll(/\d+/g)) expect(allowed.has(Number(m[0])), m[0]).toBe(true);
  });

  it("is its own player kind, tuning-only, with separate heroes", () => {
    const g = new Fixture({ Sieg: () => "{}", Coco: () => "{}" });
    const p = policiesFor("model-navigator", new ModelBudget(defaultBudgetLimits), setup(g), "S2-local");
    expect(policyKind(p)).toBe("model-navigator");
    expect(p.sieg).not.toBe(p.coco);
    expect((p.sieg as NavigatorPlayer).heroMemory).not.toBe((p.coco as NavigatorPlayer).heroMemory);
    expect(p.sieg.name).toMatch(/^navigator-[0-9a-f]{8}\(mock:navigator-fixture\)·batch4·memory·tutorial-/);
    expect(() => validatePlan({ player: "model-navigator", situations: ["S2-local"], seeds: [0], model: setup(g) })).not.toThrow();
    expect(() => validatePlan({ player: "model-navigator", situations: ["S2-local"], seeds: [100], final: true, model: { ...setup(g), stage: "final" } })).toThrow(/model-navigator is restricted/);
  });
});

/** Stand-in players: each moves its own dialogue lines on and otherwise waits; Sieg sets one goal. */
function realFixture(goal: { x: number; y: number }) {
  let goalSent = false;
  const talk = (u: Record<string, unknown>, note: string) => {
    const o = u.observation as Observation, legal = u.legal_actions as ActionSpec[];
    if (o.dialogue?.canAdvance && legal.some((l) => l.type === "advance_dialogue")) return `{"notes":"${note}","actions":[{"type":"advance_dialogue"}]}`;
    if (o.dialogue) return `{"notes":"${note}","actions":[{"type":"wait","ticks":30}]}`;
    return undefined;
  };
  return new Fixture({
    Sieg: (_n, u) => talk(u, "SIEG-NOTE") ?? (goalSent ? '{"actions":[{"type":"wait","ticks":30}]}' : ((goalSent = true), `{"notes":"SIEG-NOTE","go_to":${JSON.stringify(goal)},"actions":[]}`)),
    Coco: (_n, u) => talk(u, "COCO-NOTE") ?? '{"notes":"COCO-NOTE","actions":[{"type":"wait","ticks":60}]}',
  });
}
async function realRun(g: Fixture, decisions: number) {
  const budget = new ModelBudget(defaultBudgetLimits);
  const policies = policiesFor("model-navigator", budget, setup(g), "S2-local");
  const env = environmentFor("S2-local", { limits: { maxDecisionsPerPlayer: decisions } });
  const trace = new TraceWriter();
  await runEpisode(env, policies, trace, { seed: 0, wallClockMs: 120_000, budget });
  const sieg = g.calls.filter((c) => c.hero === "Sieg").map((c) => JSON.parse(c.user) as { navigation: { status: string; why_you_are_asked: string[]; detail?: string }; observation: Observation });
  const notes = trace.lines.filter((l) => l.type === "policy_note" && l.player === "sieg").map((l) => l.data as { source: string });
  const steps = trace.lines.filter((l) => l.type === "step" && l.player === "sieg").map((l) => (l.data as { action: GameAction; result: StepResult }));
  return { policies, env, trace, sieg, controller: notes.filter((n) => n.source === "controller").length, steps };
}

describe("REAL PLAY on S2-local seed 0 (test fixtures, no provider)", () => {
  it("walks a long observed corridor on one model call and keeps the heroes' memories apart", async () => {
    // Test input: 12 tiles east along the entrance lane, on screen at the start.
    const g = realFixture({ x: 16, y: 34 });
    const { policies, env, sieg, controller } = await realRun(g, 40);
    const arrived = sieg.findIndex((u) => u.navigation.status === "arrived");
    expect(arrived, "Sieg reached the goal").toBeGreaterThan(0);
    const goalCall = sieg.findIndex((u) => u.navigation.why_you_are_asked.includes("you have no walking goal") && !u.observation.dialogue);
    // Between setting the goal and arriving, every call had an event; walking itself needed none.
    for (const u of sieg.slice(goalCall + 1, arrived + 1)) expect(u.navigation.why_you_are_asked.length).toBeGreaterThan(0);
    expect(controller).toBeGreaterThanOrEqual(2);
    // Apart from the opening dialogue (which needs the player), at most three events interrupted the walk
    // (seed 0: an exit coming within reach, then enemies and a sign coming into view).
    const dialogue = /dialogue|advance_dialogue/;
    const walkCalls = sieg.slice(goalCall + 1, arrived).filter((u) => !u.navigation.why_you_are_asked.some((w) => dialogue.test(w)));
    expect(walkCalls.length).toBeLessThanOrEqual(3);
    expect(sieg.slice(goalCall + 1, arrived + 1).some((u) => u.navigation.why_you_are_asked.some((w) => /walking moves since/.test(w)))).toBe(false);
    const at = sieg[arrived].observation.self;
    expect(Math.hypot(at.x - 16.5, at.y - 34.5)).toBeLessThanOrEqual(NAV.arriveTiles + 0.01);
    // Independent memories: Coco never walked east, so far tiles only Sieg saw stay unknown to her.
    const s = (policies.sieg as NavigatorPlayer).heroMemory, c = (policies.coco as NavigatorPlayer).heroMemory;
    expect(s.terrainAt("Hedge Maze", 23, 34)).not.toBe("?");
    expect(c.terrainAt("Hedge Maze", 23, 34)).toBe("?");
    for (const call of g.calls) expect(call.user).not.toContain(call.hero === "Sieg" ? "COCO-NOTE" : "SIEG-NOTE");
    void env;
  }, 60_000);

  it("gives up on a goal behind an obstacle it has seen, after a bounded search, and asks the model", async () => {
    // Test input: a tile beyond the burnable hedge that closes the entrance lane.
    const g = realFixture({ x: 27, y: 34 });
    const { sieg, steps } = await realRun(g, 60);
    const end = sieg.findIndex((u) => u.navigation.status === "unreachable");
    expect(end, "the helper declared the goal unreachable").toBeGreaterThan(0);
    expect(sieg[end].navigation.detail).toMatch(/no path|did not get closer|kept stopping/);
    // Bounded: the search ended within the walking budget, and the hero never walked past the hedge.
    expect(end).toBeLessThan(20);
    for (const st of steps) if (st.result.movement) expect(st.result.movement.to.x).toBeLessThan(18);
  }, 60_000);
});

describe("the fenced cow on S2-A version 2 (committed baseline trace)", () => {
  it("never plans a path through the cow's drawn body, wherever Sieg stood while it was on his screen", () => {
    // Sieg's own observations from the committed reference run, fed in order
    // into a fresh memory: exactly what a navigator for Sieg would have had.
    const lines = readFileSync("midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-v2/trace.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const mine = lines.filter((l) => l.type === "observation" && l.player === "sieg").map((l) => l.data.observation as Observation);
    const m = new HeroMemory("Sieg");
    let checked = 0, blockedBody = 0;
    for (const o of mine) {
      m.observe(o);
      const cow = o.visible.find((v) => v.kind === "creature" && v.extent && /cow/i.test(v.name));
      if (!cow || o.area.name !== "Hedge Maze") continue;
      const e = cow.extent!;
      const body = new Set<string>();
      for (let y = Math.floor(e.y); y < Math.ceil(e.y + e.h); y++) for (let x = Math.floor(e.x); x < Math.ceil(e.x + e.w); x++) body.add(`${x},${y}`);
      const grid = buildGrid(m, o, new Map());
      // A goal just beyond the body on the far side from Sieg.
      const above = o.self.y > e.y + e.h / 2;
      const goal = { x: Math.floor(e.x + e.w / 2), y: above ? Math.floor(e.y) - 2 : Math.ceil(e.y + e.h) + 1 };
      const found = aStar(grid, { x: Math.floor(o.self.x), y: Math.floor(o.self.y) }, goalCells(grid, goal).cells);
      checked++;
      if (!found) { blockedBody++; continue; }
      for (const c of found.path) expect(body.has(`${c.x},${c.y}`), `tick ${o.tick}: path through the cow at ${c.x},${c.y}`).toBe(false);
    }
    expect(checked).toBeGreaterThan(10);
    void blockedBody;
  });
});
