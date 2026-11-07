// model-navigator after the 2026-11-05 paid-run review: wait_until, fight,
// edge-triggered motion events, and the Black Hole aim preview. Offline; every
// "model" is a test fixture. The fixture file holds Coco's own observations
// from that run (scripts/midterm/extract-black-hole-casts.ts).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { HeroMemory } from "../src/heroMemory.js";
import { aimPreview, MOTION_LINE, NAV, NavigatorPlayer, parseNavigatorReply } from "../src/policies/navigator.js";
import type { TurnReport } from "../src/policies/policy.js";
import type { ActionSpec, GameAction, Observation, VisibleThing } from "../src/types.js";

const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const CASTS = JSON.parse(readFileSync("packages/agent/test/fixtures/navigator-run-2026-11-05-black-hole.json", "utf8")).casts as {
  tick: number; direction: string; observation: Observation; cowBefore: { x: number; y: number } | null; vortex: { x: number; y: number } | null; cowAfter: { x: number; y: number } | null;
}[];

const LEGAL: ActionSpec[] = [
  { type: "move", description: "walk", params: { direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"] }, ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "wait", description: "wait", params: { ticks: { kind: "int", min: 1, max: 60 } } },
  { type: "attack", description: "J", params: { direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"], optional: true } } },
  { type: "message", description: "message", params: { text: { kind: "text", maxLength: 200 } } },
];

function obs(o: { x: number; y: number; tick: number; visible?: VisibleThing[]; messages?: Observation["messages"]; feedback?: string[]; hp?: number; hero?: "Sieg" | "Coco"; jReady?: boolean }): Observation {
  const hero = o.hero ?? "Sieg";
  return {
    player: hero === "Sieg" ? "sieg" : "coco", hero, tick: o.tick, seconds: o.tick / 60,
    area: { name: "Field", widthTiles: 30, heightTiles: 10 },
    self: { x: o.x, y: o.y, facing: "e", hp: o.hp ?? 100, maxHp: 100, status: [] },
    abilities: [{ key: "J", name: "Sword", state: o.jReady === false ? "recovering" : "ready" }],
    screen: { originX: 0, originY: 0, rows: Array.from({ length: 10 }, () => ".".repeat(30)) },
    visible: o.visible ?? [], dialogue: null, journal: { completed: [] }, inventory: { items: [] },
    discovered: { areas: [], exploredRows: [] }, dialogueLog: [], feedback: o.feedback ?? [], messages: o.messages ?? [],
  };
}
const done = (action: GameAction, ticks = 0): TurnReport => ({ steps: [{ action, result: { accepted: true, ticks, feedback: [], done: false }, status: "executed" }], skipped: [] });

class Fixture implements Gateway {
  readonly label = "mock:intent-fixture";
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
const player = (g: Gateway, hero: "Sieg" | "Coco" = "Sieg") => new NavigatorPlayer(hero, MANUAL, new MeteredGateway(g, new ModelBudget(defaultBudgetLimits), hero === "Sieg" ? "sieg" : "coco"));
const cow = (x: number): VisibleThing => ({ ref: "creature-1", kind: "creature", name: "big animal", x, y: 5, extent: { x: x - 2, y: 3, w: 4, h: 4 }, distance: 5, direction: "e" });

describe("wait_until", () => {
  it("waits with ordinary waits and no model calls until the watched thing moves", async () => {
    const g = new Fixture((n) => (n === 1 ? '{"wait_until":{"seconds":20,"watch":"big animal"},"actions":[]}' : '{"actions":[{"type":"wait","ticks":5}]}'));
    const p = player(g);
    let d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0, visible: [cow(20)] }), legal: LEGAL });
    expect(d.action).toEqual({ type: "wait", ticks: NAV.waitChunkTicks });
    for (let k = 1; k <= 8; k++) {
      d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: k * 30, visible: [cow(20)] }), legal: LEGAL, batch: done(d.action!, 30) });
      expect(d.action).toEqual({ type: "wait", ticks: NAV.waitChunkTicks });
    }
    expect(g.calls).toHaveLength(1);
    d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 270, visible: [cow(19.2)] }), legal: LEGAL, batch: done(d.action!, 30) });
    expect(g.calls).toHaveLength(2);
    expect((g.calls[1].navigation as { why_you_are_asked: string[] }).why_you_are_asked.join(" ")).toMatch(/big animal, which you were watching, moved from \(20, 5\) to \(19.2, 5\)/);
  });

  it("is bounded: it ends when its time runs out, and a new partner message wakes it", async () => {
    const g = new Fixture((n) => (n === 1 || n === 3 ? '{"wait_until":{"seconds":1},"actions":[]}' : '{"actions":[{"type":"wait","ticks":5}]}'));
    const p = player(g);
    let d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0 }), legal: LEGAL });
    d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 30 }), legal: LEGAL, batch: done(d.action!, 30) });
    expect(d.action).toEqual({ type: "wait", ticks: 30 });
    d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 60 }), legal: LEGAL, batch: done(d.action!, 30) });
    expect((g.calls[1].navigation as { why_you_are_asked: string[] }).why_you_are_asked).toContain("your wait_until time ran out");
    // A capped request: 500 s becomes the 30 s maximum.
    expect(parseNavigatorReply('{"wait_until":{"seconds":500},"actions":[]}')).toMatchObject({ ok: true, waitUntil: { seconds: NAV.maxWaitSeconds } });
    d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 70 }), legal: LEGAL, batch: done(d.action!, 5) });
    expect(g.calls).toHaveLength(3);
    d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 100, messages: [{ from: "Coco", text: "It moved!", tick: 95 }] }), legal: LEGAL, batch: done(d.action!, 30) });
    expect(g.calls).toHaveLength(4);
    expect((g.calls[3].navigation as { why_you_are_asked: string[] }).why_you_are_asked).toContain("new message from Coco");
  });
});

describe("fight", () => {
  const slime = (x: number, y = 5.5): VisibleThing => ({ ref: "enemy-1", kind: "enemy", name: "slime", x, y, distance: Math.abs(x - 2.5), direction: "e" });
  it("closes in and attacks the chosen enemy without model calls, waits out J recovery, ignores small hits, and ends when the target is gone", async () => {
    const g = new Fixture((n) => (n === 1 ? '{"fight":{"target":"slime","seconds":10},"actions":[]}' : '{"actions":[{"type":"wait","ticks":5}]}'));
    const p = player(g);
    let d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0, visible: [slime(6.5)] }), legal: LEGAL });
    expect(d.action).toMatchObject({ type: "move", direction: "e" });
    d = await p.decide({ observation: obs({ x: 5, y: 5.5, tick: 20, visible: [slime(6.5)] }), legal: LEGAL, batch: done(d.action!, 20) });
    expect(d.action).toEqual({ type: "attack", direction: "e" });
    // Hit for 10 of 100 HP: below the fight's threshold, so no call.
    d = await p.decide({ observation: obs({ x: 5, y: 5.5, tick: 25, hp: 90, jReady: false, visible: [slime(6.5)] }), legal: LEGAL, batch: done(d.action!, 0) });
    expect(d.action).toEqual({ type: "wait", ticks: 6 });
    expect(g.calls).toHaveLength(1);
    d = await p.decide({ observation: obs({ x: 5, y: 5.5, tick: 31, hp: 90, visible: [] }), legal: LEGAL, batch: done(d.action!, 6) });
    expect(g.calls).toHaveLength(2);
    expect((g.calls[1].navigation as { why_you_are_asked: string[] }).why_you_are_asked.join(" ")).toMatch(/slime is not on your screen any more/);
  });

  it("stops when the hero has lost a quarter of its HP since the fight began", async () => {
    const g = new Fixture((n) => (n === 1 ? '{"fight":{"target":"slime","seconds":10},"actions":[]}' : '{"actions":[{"type":"wait","ticks":5}]}'));
    const p = player(g);
    const d = await p.decide({ observation: obs({ x: 5, y: 5.5, tick: 0, visible: [slime(6.5)] }), legal: LEGAL });
    await p.decide({ observation: obs({ x: 5, y: 5.5, tick: 10, hp: 70, visible: [slime(6.5)] }), legal: LEGAL, batch: done(d.action!, 0) });
    expect(g.calls).toHaveLength(2);
    expect((g.calls[1].navigation as { why_you_are_asked: string[] }).why_you_are_asked.join(" ")).toMatch(/took damage \(HP 100 → 70\)/);
  });
});

describe("edge-triggered motion feedback", () => {
  it("turns a run of 'X moved' lines into one start event and one stop event", async () => {
    const g = new Fixture(() => '{"wait_until":{"seconds":30},"actions":[]}');
    const p = player(g);
    const lines = ["The cow moved w, from (26, 25) to (25.2, 25).", "The cow moved w, from (25.2, 25) to (24.3, 25).", "The cow moved w, from (24.3, 25) to (24, 25).", "The cow moved w, from (24, 25) to (23.9, 25)."];
    expect(MOTION_LINE.test(`new feedback: ${lines[0]}`)).toBe(true);
    let d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 0 }), legal: LEGAL });
    const fb: string[] = [];
    for (let k = 0; k < lines.length; k++) {
      fb.push(lines[k]);
      d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 30 * (k + 1), feedback: [...fb] }), legal: LEGAL, batch: done(d.action!, 30) });
    }
    // One call at the start of the movement (plus the first call), none for the following lines.
    expect(g.calls).toHaveLength(2);
    expect((g.calls[1].navigation as { why_you_are_asked: string[] }).why_you_are_asked).toEqual(["cow started moving (from (26, 25) to (25.2, 25))"]);
    d = await p.decide({ observation: obs({ x: 2.5, y: 5.5, tick: 300, feedback: [...fb] }), legal: LEGAL, batch: done(d.action!, 30) });
    expect(g.calls).toHaveLength(3);
    expect((g.calls[2].navigation as { why_you_are_asked: string[] }).why_you_are_asked).toEqual(["cow stopped moving, last reported at (23.9, 25)"]);
  });
});

describe("Black Hole aim preview, against the 2026-11-05 run's actual casts", () => {
  const preview = (c: (typeof CASTS)[number]) => {
    const m = new HeroMemory("Coco");
    m.observe(c.observation);
    return aimPreview(m, c.observation);
  };
  it("predicts where each of the five casts stopped, within half a tile", () => {
    expect(CASTS).toHaveLength(5);
    for (const c of CASTS) {
      const line = preview(c).find((l) => l.direction === c.direction)!;
      expect(c.vortex, `cast at ${c.tick}`).not.toBeNull();
      expect(Math.hypot(line.stops_at.x - c.vortex!.x, line.stops_at.y - c.vortex!.y), `cast at ${c.tick} (${c.direction}): predicted ${JSON.stringify(line.stops_at)}, seen ${JSON.stringify(c.vortex)}`).toBeLessThanOrEqual(0.5);
    }
  });

  it("shows that the cast which parked the cow had the cow within its pull, pulled west, and the misses did not", () => {
    const parked = CASTS.find((c) => c.tick === 2265)!;
    const hit = preview(parked).find((l) => l.direction === "e")!;
    expect(hit.stopped_by).toBe("the body of cow");
    // The straight pull toward the vortex (the manual's rule). The game then
    // moves the cow only sideways, a puzzle reaction the preview does not claim to know.
    expect(hit.within_pull.find((t) => t.name === "cow")).toMatchObject({ pulled_toward: "nw" });
    expect(parked.cowAfter!.x).toBeLessThan(parked.cowBefore!.x - 2);
    for (const c of CASTS.filter((x) => x.tick !== 2265 && x.cowBefore)) {
      const line = preview(c).find((l) => l.direction === c.direction)!;
      const cowInPull = line.within_pull.find((t) => t.name === "cow");
      // Either out of the 3-tile pull, or the cow did not move (the game's own result).
      if (cowInPull) expect(c.cowAfter).toMatchObject({ x: c.cowBefore!.x });
    }
  });

  it("is only offered while the ability is in legal_actions, and never names a target or a place", async () => {
    const c = CASTS[2];
    const legal: ActionSpec[] = [...LEGAL, { type: "ability", description: "ability", params: { ability: { kind: "enum", values: ["slow_time", "flight", "black_hole"] }, direction: { kind: "enum", values: ["n", "ne", "e", "se", "s", "sw", "w", "nw"], optional: true } } }];
    const g = new Fixture(() => '{"actions":[{"type":"wait","ticks":5}]}');
    const p = player(g, "Coco");
    await p.decide({ observation: c.observation, legal });
    const nav = g.calls[0].navigation as { aim_preview?: unknown[] };
    expect(nav.aim_preview).toHaveLength(8);
    const g2 = new Fixture(() => '{"actions":[{"type":"wait","ticks":5}]}');
    await player(g2, "Coco").decide({ observation: c.observation, legal: LEGAL });
    expect((g2.calls[0].navigation as { aim_preview?: unknown }).aim_preview).toBeUndefined();
    expect(JSON.stringify(nav.aim_preview)).not.toMatch(/bay|park|grazing|post/i);
  });
});
