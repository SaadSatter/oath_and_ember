// The Hedge Maze wolf and its key (owner request 2026-11-05): the wolf is
// caught, never defeated. Sieg approaches it and presses E, and the game gives
// the gate key. This file checks
//   - the clue's new place and wording (client and agent copy agree; it sits
//     on hedge, clear of the wolf's loop and the gate, and is a label with no
//     grid mark, so it blocks nothing);
//   - that a hero's ordinary observations make the interaction discoverable,
//     in real play, without giving the wolf's position beyond the screen;
//   - model-navigator's "catch" intention, and that "fight" never engages it.
// Offline only: every "model" is a test fixture. Fixture replies may name
// tiles and the wolf; they are test inputs, never shown to a real model.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { policiesFor, type ModelSetup } from "../src/harness.js";
import { MAZE_WOLF_SIGN, MAZE_WOLF_SIGN_AT } from "../src/perception.js";
import { NAV, NAVIGATOR_SECTION, NavigatorPlayer, parseNavigatorReply } from "../src/policies/navigator.js";
import { planFight, planFightTarget } from "../src/policies/combat.js";
import { QuestBaseline } from "../src/policies/questBaseline.js";
import type { TurnReport } from "../src/policies/policy.js";
import { runEpisode } from "../src/runner.js";
import { environmentFor } from "../src/suite.js";
import { TraceWriter } from "../src/trace.js";
import type { ActionSpec, GameAction, Observation, VisibleThing } from "../src/types.js";
import { inMazeLoop, mazeCellOpen, mazeGate } from "../../shared/src/hedgeMaze.js";

const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const WOLF = "FOREST WOLF · KEY";

describe("the wolf clue beside the key gate", () => {
  it("is drawn by the client with exactly the text and place the agents read", () => {
    const view = readFileSync("apps/client/src/environment/HedgeMazeView.ts", "utf8");
    const drawn = MAZE_WOLF_SIGN.split(" · ").reduce<string[]>((lines, part, i) => {
      // The client's lines are the agent text's parts, with "catch the wolf · E to take it" kept on one line.
      if (i > 0 && part === "E to take it") lines[lines.length - 1] += ` · ${part}`;
      else lines.push(part);
      return lines;
    }, []);
    expect(view).toContain(JSON.stringify(drawn.join("\n")));
    expect(view).toContain(`${MAZE_WOLF_SIGN_AT.x} * 32,\n        ${MAZE_WOLF_SIGN_AT.y} * 32,`);
    // The old clue over the top lane is gone.
    expect(view).not.toContain("E to tag");
  });

  it("says the wolf carries the key and is caught with E, in the maze's sign style", () => {
    expect(MAZE_WOLF_SIGN).toMatch(/wolf carries its key/);
    expect(MAZE_WOLF_SIGN).toMatch(/catch the wolf · E to take it/);
    expect(MAZE_WOLF_SIGN).not.toMatch(/defeat|kill|attack|fight/i);
  });

  it("sits on hedge to the right of the gate, clear of the wolf's loop: it covers no floor anyone walks", () => {
    const { x, y } = MAZE_WOLF_SIGN_AT;
    // The drawn block: four lines of 12 px text, at most about 7.5 tiles wide and 2 tall.
    for (let cx = Math.floor(x - 3.8); cx <= Math.floor(x + 3.8); cx++)
      for (let cy = Math.floor(y - 1); cy <= Math.floor(y + 1); cy++) {
        if (cy < 16) continue; // the chamber behind the gate is floor only once the gate opens, and holds only the chest far north
        expect(mazeCellOpen(cx, cy), `cell ${cx},${cy}`).toBe(false);
      }
    expect(inMazeLoop({ x: x * 32, y: y * 32 })).toBe(false);
    expect(x * 32).toBeGreaterThan(mazeGate.x);
    expect(Math.hypot(x * 32 - (mazeGate.x + mazeGate.w / 2), y * 32 - (mazeGate.y + mazeGate.h / 2)) / 32).toBeLessThan(6);
  });
});

/** One baseline-quest episode on S2-A (S2-local), traced. */
async function baseline() {
  const trace = new TraceWriter();
  const env = environmentFor("S2-local", { trace: (e) => trace.write(e) });
  const outcome = await runEpisode(env, { sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") }, trace, { seed: 0, wallClockMs: 300_000 });
  return { outcome, trace: trace.lines };
}

describe("REAL PLAY: Sieg's ordinary observations make the catch discoverable", { timeout: 120_000 }, () => {
  it("shows the clue as a label with no grid mark, the wolf as a creature carrying a key, and the E prompt beside it", async () => {
    const { outcome, trace } = await baseline();
    expect(outcome.status).toBe("success");
    const sieg = trace.filter((l) => l.type === "observation" && l.player === "sieg").map((l) => l.data as { observation: Observation; legal: ActionSpec[] });
    const sign = sieg.map((d) => d.observation.visible.find((v) => v.name === MAZE_WOLF_SIGN)).find(Boolean);
    expect(sign, "Sieg reads the clue on the way to the gate").toBeDefined();
    expect(sign!.kind).toBe("label");
    // A label has no grid mark: the cell under it stays as the terrain draws it (hedge).
    const withSign = sieg.find((d) => d.observation.visible.some((v) => v.name === MAZE_WOLF_SIGN))!.observation;
    const row = withSign.screen.rows[Math.floor(MAZE_WOLF_SIGN_AT.y) - withSign.screen.originY];
    expect(row[Math.floor(MAZE_WOLF_SIGN_AT.x) - withSign.screen.originX]).toBe("#");
    // The wolf: a creature named as drawn, carrying a key; only while on Sieg's screen.
    const wolf = sieg.map((d) => d.observation.visible.find((v) => v.name === WOLF)).find(Boolean)!;
    expect(wolf).toMatchObject({ kind: "creature", details: "carrying a key" });
    // Beside it, the backpack panel names it and how to take the key; interact is a legal action there.
    const prompt = sieg.find((d) => d.observation.inventory.nearbyTarget?.name === "Forest wolf · E to take key");
    expect(prompt, "the panel shows the wolf's E prompt").toBeDefined();
    expect(prompt!.legal.some((l) => l.type === "interact")).toBe(true);
    expect(prompt!.observation.visible.some((v) => v.name === WOLF)).toBe(true);
    // Nothing places the wolf for a hero whose screen does not show it.
    for (const d of sieg)
      if (!d.observation.visible.some((v) => v.name === WOLF)) expect(JSON.stringify(d.observation)).not.toMatch(/FOREST WOLF|Forest wolf/);
  });
});

// ── model-navigator: catch, and fight never engaging the wolf ─────────────

const LEGAL: ActionSpec[] = [
  { type: "move", description: "walk", params: { direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"] }, ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "attack", description: "J", params: { direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"], optional: true } } },
  { type: "interact", description: "Press E" },
  { type: "wait", description: "wait", params: { ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "message", description: "message", params: { text: { kind: "text", maxLength: 200 } } },
];
const WITH_PANEL: ActionSpec[] = [...LEGAL, { type: "use_item", description: "panel" }];

function obs(o: { x: number; y: number; tick: number; visible?: VisibleThing[]; near?: string; feedback?: string[]; items?: Observation["inventory"]["items"] }): Observation {
  return {
    player: "sieg", hero: "Sieg", tick: o.tick, seconds: o.tick / 60,
    area: { name: "Field", widthTiles: 30, heightTiles: 10 },
    self: { x: o.x, y: o.y, facing: "e", hp: 100, maxHp: 100, status: [] },
    abilities: [{ key: "J", name: "Sword", state: "ready" }],
    screen: { originX: 0, originY: 0, rows: Array.from({ length: 10 }, () => ".".repeat(30)) },
    visible: o.visible ?? [], dialogue: null, journal: { completed: [] },
    inventory: { items: o.items ?? [], ...(o.near ? { nearbyTarget: { id: "nearby", name: o.near } } : {}) },
    discovered: { areas: [], exploredRows: [] }, dialogueLog: [], feedback: o.feedback ?? [], messages: [],
  } as Observation;
}
const wolf = (x: number, y: number, me = { x: 2.5, y: 5.5 }): VisibleThing => ({
  ref: "creature-2", kind: "creature", name: WOLF, details: "carrying a key", x, y,
  distance: Math.round(Math.hypot(x - me.x, y - me.y) * 10) / 10, direction: "e",
});
const done = (action: GameAction, ticks = 0): TurnReport => ({ steps: [{ action, result: { accepted: true, ticks, feedback: [], done: false }, status: "executed" }], skipped: [] });

class Fixture implements Gateway {
  readonly label = "mock:catch-fixture";
  calls: Record<string, unknown>[] = [];
  constructor(private readonly reply: (n: number, u: Record<string, unknown>) => string) {}
  worstCaseUsd() {
    return 0.0001;
  }
  async complete(_s: string, user: string): Promise<Completion> {
    const u = JSON.parse(user);
    this.calls.push(u);
    return { text: this.reply(this.calls.length, u), tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}
const player = (g: Gateway) => new NavigatorPlayer("Sieg", MANUAL, new MeteredGateway(g, new ModelBudget(defaultBudgetLimits), "sieg"));
const CATCH = `{"catch":{"target":"${WOLF}","seconds":20},"actions":[]}`;
const WAIT = '{"actions":[{"type":"wait","ticks":5}]}';

describe("model-navigator: catch", () => {
  it("parses catch as one more alternative to go_to, wait_until and fight", () => {
    expect(parseNavigatorReply(CATCH)).toMatchObject({ ok: true, catch: { target: WOLF, seconds: 20 }, actions: [] });
    expect(parseNavigatorReply(`{"catch":{"target":"x","seconds":99},"actions":[]}`)).toMatchObject({ ok: true, catch: { seconds: NAV.maxCatchSeconds } });
    expect(parseNavigatorReply(`{"catch":{"target":"x","seconds":5},"go_to":{"x":1,"y":1},"actions":[]}`)).toMatchObject({ ok: false });
    expect(parseNavigatorReply(`{"catch":{"target":"x","seconds":5},"fight":{"target":"x","seconds":5},"actions":[]}`)).toMatchObject({ ok: false });
    expect(parseNavigatorReply(`{"catch":{"target":"","seconds":5},"actions":[]}`)).toMatchObject({ ok: false });
  });

  it("chases a moving target with ordinary moves and no model calls, re-aiming at it each decision", async () => {
    const g = new Fixture((n) => (n === 1 ? CATCH : WAIT));
    const p = player(g);
    let d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0, visible: [wolf(12, 5.5)] }), legal: LEGAL });
    expect(d.action).toMatchObject({ type: "move", direction: "e" });
    expect((d.action as { ticks: number }).ticks).toBeLessThanOrEqual(NAV.catchMoveTicks);
    // The wolf runs north-east; the next move turns after it. No new model call.
    d = await p.decide({ observation: obs({ x: 3.5, y: 5.5, tick: 8, visible: [wolf(9, 1.5, { x: 3.5, y: 5.5 })] }), legal: LEGAL, batch: done(d.action!, 8) });
    expect(d.action).toMatchObject({ type: "move" });
    expect(["ne", "n", "e"]).toContain((d.action as { direction: string }).direction);
    expect(g.calls).toHaveLength(1);
    expect(p.navState().intent).toMatchObject({ kind: "catch", target: WOLF, last: { x: 9, y: 1.5 } });
  });

  it("heads for where it last saw the target, reacquires it on sight, and ends only on reaching that spot with it still gone", async () => {
    const g = new Fixture((n) => (n === 1 ? CATCH : WAIT));
    const p = player(g);
    let d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0, visible: [wolf(10, 5.5)] }), legal: LEGAL });
    // Off screen: keep going to (10, 5.5).
    d = await p.decide({ observation: obs({ x: 3.3, y: 5.5, tick: 8 }), legal: LEGAL, batch: done(d.action!, 8) });
    expect(d.action).toMatchObject({ type: "move", direction: "e" });
    expect(g.calls).toHaveLength(1);
    // Back on screen elsewhere: the last-seen point follows it.
    d = await p.decide({ observation: obs({ x: 4.1, y: 5.5, tick: 16, visible: [wolf(14, 8.5, { x: 4.1, y: 5.5 })] }), legal: LEGAL, batch: done(d.action!, 8) });
    expect(p.navState().intent).toMatchObject({ last: { x: 14, y: 8.5 } });
    expect(g.calls).toHaveLength(1);
    // Off screen again and the hero reaches (14, 8.5): the chase ends and the model is told why.
    d = await p.decide({ observation: obs({ x: 13.8, y: 8.4, tick: 200 }), legal: LEGAL, batch: done(d.action!, 8) });
    expect(g.calls).toHaveLength(2);
    expect((g.calls[1].navigation as { why_you_are_asked: string[] }).why_you_are_asked.join(" ")).toMatch(/you reached where you last saw FOREST WOLF · KEY \(14, 8\.5\) and it is not on your screen/);
  });

  it("presses E (an ordinary interact) only when the target is close and the backpack panel shows a nearby target", async () => {
    const g = new Fixture((n) => (n === 1 ? CATCH : WAIT));
    const p = player(g);
    let d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0, visible: [wolf(4.5, 5.5)] }), legal: LEGAL });
    // Close, but no panel prompt: keep closing in, no E.
    expect(d.action).toMatchObject({ type: "move" });
    // Close with the panel prompt (and use_item newly available): E, with no model call.
    d = await p.decide({ observation: obs({ x: 3.2, y: 5.5, tick: 8, visible: [wolf(4.4, 5.5, { x: 3.2, y: 5.5 })], near: "Forest wolf · E to take key" }), legal: WITH_PANEL, batch: done(d.action!, 8) });
    expect(d.action).toEqual({ type: "interact" });
    expect(g.calls).toHaveLength(1);
    // The key lands in the backpack: that is news, so the model is asked.
    d = await p.decide({ observation: obs({ x: 3.2, y: 5.5, tick: 9, items: [{ id: "hedge_gate_key", name: "Hedge Gate Key", count: 1 }] as Observation["inventory"]["items"], feedback: ["Collected Hedge Gate Key."] }), legal: LEGAL, batch: done(d.action!, 1) });
    expect(g.calls).toHaveLength(2);
    const why = (g.calls[1].navigation as { why_you_are_asked: string[] }).why_you_are_asked;
    expect(why).toContain("your backpack changed");
    expect(why).toContain("your catch ended: after your E press your backpack changed");
    expect(p.navState().intent).toBeNull();
  });

  it("never attacks, uses an ability or item, or sends a message while catching", async () => {
    const g = new Fixture((n) => (n === 1 ? CATCH : WAIT));
    const p = player(g);
    let d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0, visible: [wolf(8, 5.5)] }), legal: LEGAL });
    const types = new Set<string>([d.action!.type]);
    for (let t = 8, x = 2.5; t < 400; t += 8, x = Math.min(x + 0.8, 7)) {
      d = await p.decide({ observation: obs({ x, y: 5.5, tick: t, visible: [wolf(8 + (t % 32) / 16, 5.5, { x, y: 5.5 })] }), legal: LEGAL, batch: done(d.action!, 8) });
      types.add(d.action?.type ?? "none");
    }
    for (const t of types) expect(["move", "interact", "wait"]).toContain(t);
  });
});

describe("model-navigator: fight never engages the wolf", () => {
  it("planFight and planFightTarget pick enemies only; a creature named as the target is never attacked", () => {
    const o = obs({ x: 2.5, y: 5.5, tick: 0, visible: [wolf(3.5, 5.5)] });
    expect(planFight(o)).toBeNull();
    expect(planFightTarget(o, WOLF)).toBeNull();
  });

  it("a fight on the wolf ends at once, says it is not an enemy, and attacks nothing", async () => {
    const g = new Fixture((n) => (n === 1 ? `{"fight":{"target":"${WOLF}","seconds":10},"actions":[]}` : WAIT));
    const p = player(g);
    const d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0, visible: [wolf(3.5, 5.5)] }), legal: LEGAL });
    expect(d.action).toBeUndefined();
    expect(d.replyProblem).toMatch(/FOREST WOLF · KEY is a creature, not an enemy; fight attacks only enemies and did not touch it/);
    expect(p.navState().intent).toBeNull();
  });

  it("the prompt explains catch and fight's limit without naming any game thing or new number", () => {
    expect(NAVIGATOR_SECTION).toMatch(/"catch"/);
    expect(NAVIGATOR_SECTION).toMatch(/never attacks a creature or an object/);
    expect(NAVIGATOR_SECTION.replace(/Black Hole/g, "")).not.toMatch(/cow|wolf|shear|chest|gate|post|bay|hedge|maze|mirror|griffin|key|black hole|slow time|super speed|fireball|push|grazing|lane/i);
  });
});

// ── REAL PLAY: catch under the game's own rules (S2-C, wolf free, gate shut) ──

const setup = (gateway: Gateway): ModelSetup => ({ gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 });

describe("REAL PLAY on S2-C seed 0: Sieg catches the wolf with catch and an ordinary E (test fixtures, no provider)", { timeout: 120_000 }, () => {
  it("takes the gate key through the game's own interact, with no attack on the wolf", async () => {
    // Test inputs (never in a prompt): where to look for the wolf, and when to use the timed abilities.
    let sentSpeed = false;
    let lane = 0;
    const g = new (class implements Gateway {
      readonly label = "mock:catch-real";
      calls: { hero: string; u: Record<string, unknown> }[] = [];
      worstCaseUsd() {
        return 0.0001;
      }
      async complete(system: string, user: string): Promise<Completion> {
        const hero = system.startsWith("You are playing the cooperative game Oath and Ember as Sieg") ? "Sieg" : "Coco";
        const u = JSON.parse(user);
        this.calls.push({ hero, u });
        const o = u.observation as Observation, legal = u.legal_actions as ActionSpec[];
        const ability = (name: string) => legal.some((l) => l.type === "ability" && (l.params?.ability as { values: string[] } | undefined)?.values.includes(name));
        const r = (x: unknown) => ({ text: JSON.stringify(x), tokens: { input: 1, output: 1 }, costUsd: 0 });
        if (hero === "Coco") return r(ability("slow_time") ? { actions: [{ type: "ability", ability: "slow_time" }] } : { wait_until: { seconds: 10 }, actions: [] });
        if (o.inventory.items.some((i) => i.id === "hedge_gate_key")) return r({ actions: [{ type: "wait", ticks: 60 }] });
        const seen = o.visible.some((v) => v.name === WOLF);
        const pre = !sentSpeed && ability("super_speed") && seen ? ((sentSpeed = true), [{ type: "ability", ability: "super_speed" }]) : [];
        if (seen) return r({ catch: { target: WOLF, seconds: 30 }, actions: pre });
        // Search the lanes in turn (test-only tiles).
        const lanes = [{ x: 20, y: 14 }, { x: 10, y: 14 }, { x: 10, y: 6 }, { x: 25, y: 6 }, { x: 37, y: 6 }, { x: 37, y: 14 }];
        const here = (p: { x: number; y: number }) => Math.hypot(p.x + 0.5 - o.self.x, p.y + 0.5 - o.self.y) < 1.5;
        while (here(lanes[lane % lanes.length])) lane++;
        return r({ go_to: lanes[lane % lanes.length], actions: [] });
      }
    })();
    const budget = new ModelBudget(defaultBudgetLimits);
    const policies = policiesFor("model-navigator", budget, setup(g), "S2-C");
    let room: { state: { inventory?: { counts: Record<string, number>; claimed: string[] } } } | undefined;
    const trace = new TraceWriter();
    const env = environmentFor("S2-C", { trace: (e) => trace.write(e), limits: { maxDecisionsPerPlayer: 500 }, room: (r) => { room = r as never; } });
    await runEpisode(env, policies, trace, { seed: 0, wallClockMs: 110_000, budget });
    const steps = trace.lines.filter((l) => l.type === "step" && l.player === "sieg").map((l) => l.data as { action: GameAction; result: { feedback: string[] } });
    expect(room!.state.inventory!.counts.hedge_gate_key ?? 0, "the key came from the game, not the test").toBeGreaterThanOrEqual(1);
    expect(room!.state.inventory!.claimed).toContain("hedge-runner-key");
    const taken = steps.findIndex((s) => s.result.feedback.some((f) => /Collected Hedge Gate Key/.test(f)));
    expect(taken).toBeGreaterThanOrEqual(0);
    expect(steps[taken].action).toEqual({ type: "interact" });
    // Nothing in Sieg's play attacked: the wolf is caught, never fought.
    expect(steps.some((s) => s.action.type === "attack")).toBe(false);
    // The catch was one model decision; the chase itself was the helper's ordinary moves, ending at the E press.
    const notes = trace.lines.filter((l) => l.type === "policy_note" && l.player === "sieg").map((l) => l.data as { source: string; intent?: { kind: string } });
    const chase = notes.filter((n) => n.source === "controller" && n.intent?.kind === "catch").length;
    expect(chase).toBeGreaterThan(5);
    // The successful E ended the catch.
    expect((policies.sieg as NavigatorPlayer).navState().intent?.kind).not.toBe("catch");
  });
});
