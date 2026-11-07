import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MazeHeuristic } from "../src/policies/mazeHeuristic.js";
import { policyKind } from "../src/policies/kind.js";
import type { Observation, ActionSpec } from "../src/types.js";
const observation = (): Observation => ({
  player: "coco",
  hero: "Coco",
  tick: 0,
  seconds: 0,
  area: { name: "Test", widthTiles: 16, heightTiles: 16 },
  self: { x: 4.5, y: 4.5, facing: "e", hp: 100, maxHp: 100, status: [] },
  abilities: [{ key: "3", name: "Black Hole", state: "ready" }],
  screen: {
    originX: 0,
    originY: 0,
    rows: Array.from({ length: 16 }, () => "................"),
  },
  visible: [],
  dialogue: null,
  journal: { completed: [] },
  inventory: { items: [] },
  discovered: { areas: [], exploredRows: [] },
  dialogueLog: [],
  feedback: [],
  messages: [],
});
const legal: ActionSpec[] = [
  "move",
  "wait",
  "interact",
  "use_item",
  "ability",
  "attack",
].map((type) => ({ type: type as ActionSpec["type"], description: "test" }));
describe("deterministic maze heuristic", () => {
  it("has no gateway, random generator, engine, route or scenario access", () => {
    const p = new MazeHeuristic("Coco");
    expect("model" in p).toBe(false);
    const source = readFileSync(
      new URL("../src/policies/mazeHeuristic.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /Math.random|GameRoom|environmentFor|questKnowledge|routeConstants|from.*(?:suite|server|shared)/,
    );
  });
  it("registers independently from the frozen quest baseline", () =>
    expect(
      policyKind({
        sieg: new MazeHeuristic("Sieg"),
        coco: new MazeHeuristic("Coco"),
      }),
    ).toBe("baseline-maze-heuristic"));
  it("produces identical decisions from identical histories", async () => {
    const a = new MazeHeuristic("Coco"),
      b = new MazeHeuristic("Coco");
    for (let i = 0; i < 12; i++) {
      const o = observation();
      o.tick = i * 8;
      expect(await a.decide({ observation: o, legal })).toEqual(
        await b.decide({ observation: o, legal }),
      );
    }
  });
  it("tries a nearby target once then tests inventory instead of claiming completion", async () => {
    const p = new MazeHeuristic("Coco"),
      o = observation();
    o.inventory = {
      nearbyTarget: { id: "target", name: "locked gate" },
      items: [
        {
          id: "key",
          name: "Key",
          count: 1,
          description: "Opens the locked gate",
        },
      ],
    };
    expect((await p.decide({ observation: o, legal })).action).toEqual({
      type: "interact",
    });
    expect((await p.decide({ observation: o, legal })).action).toEqual({
      type: "use_item",
      item: "key",
    });
    expect((await p.decide({ observation: o, legal })).action?.type).toBe(
      "move",
    );
  });
  it("backtracks after a blocked exploration edge", async () => {
    const p = new MazeHeuristic("Coco"),
      o = observation();
    const first = (await p.decide({ observation: o, legal })).action;
    const last = {
      accepted: true,
      ticks: 8,
      feedback: [],
      done: false,
      movement: {
        outcome: "none" as const,
        movedTiles: 0,
        requestedTiles: 1,
        from: o.self,
        to: o.self,
        ticks: { applied: 8, notApplied: 0, movedByGame: 0 },
        blocked: true,
      },
    };
    const second = (await p.decide({ observation: o, legal, last })).action;
    expect(second).not.toEqual(first);
  });
  it("never assumes a ready spell when cooldown is visible", async () => {
    const p = new MazeHeuristic("Coco"),
      o = observation();
    o.abilities[0].state = "recharging";
    o.visible = [
      {
        ref: "cow",
        kind: "creature",
        name: "cow",
        x: 8,
        y: 8,
        distance: 5,
        direction: "se",
        extent: { x: 6, y: 6, w: 4, h: 4 },
      },
      {
        ref: "bay",
        kind: "label",
        name: "grazing bay",
        x: 3,
        y: 8,
        distance: 4,
        direction: "s",
      },
    ];
    expect(
      (await p.decide({ observation: o, legal })).action,
    ).not.toMatchObject({ type: "ability" });
  });
  for (const axis of ["x", "y"] as const)
    it(`crosses opened gate on inferred ${axis} axis and does not retry it`, async () => {
      const p = new MazeHeuristic("Coco"),
        o = observation();
      o.self = {
        ...o.self,
        x: axis === "x" ? 4.5 : 8.5,
        y: axis === "y" ? 4.5 : 8.5,
      };
      const gate = {
        ref: "gate",
        kind: "object" as const,
        name: "E · key gate",
        x: 8,
        y: 8,
        distance: 4,
        direction: "e" as const,
        details: "closed",
      };
      o.visible = [gate];
      const rows = o.screen.rows.map((r) => [...r]);
      if (axis === "x") {
        rows[7][8] = "#";
        rows[9][8] = "#";
      } else {
        rows[8][7] = "#";
        rows[8][9] = "#";
      }
      o.screen.rows = rows.map((r) => r.join(""));
      await p.decide({ observation: o, legal });
      o.tick = 20;
      o.visible = [{ ...gate, details: "open" }];
      o.inventory.nearbyTarget = { id: "gate", name: "key gate" };
      const decision = await p.decide({ observation: o, legal });
      expect(decision.action).toMatchObject({
        type: "move",
        direction: axis === "x" ? "e" : "s",
      });
      expect(decision.note?.heuristic).toContain("Cross newly opened passage");
      expect(decision.action?.type).not.toBe("interact");
    });
  it("does not infer an open gate from a merely accepted interaction", async () => {
    const p = new MazeHeuristic("Coco"),
      o = observation();
    o.visible = [
      {
        ref: "gate",
        kind: "object",
        name: "key gate",
        x: 8,
        y: 4,
        distance: 4,
        direction: "e",
        details: "closed",
      },
    ];
    const decision = await p.decide({
      observation: o,
      legal,
      last: {
        accepted: true,
        ticks: 2,
        feedback: ["You pressed E; nothing responded."],
        done: false,
      },
    });
    expect(decision.note?.heuristic).not.toContain(
      "Cross newly opened passage",
    );
  });
  it("tries ordinary E on a visible chest without a backpack target", async () => {
    const p = new MazeHeuristic("Coco"),
      o = observation();
    o.visible = [
      {
        ref: "chest",
        kind: "object",
        name: "Supply chest",
        x: 6,
        y: 4.5,
        distance: 1.5,
        direction: "e",
        details: "closed",
      },
    ];
    expect(o.inventory.nearbyTarget).toBeUndefined();
    const decision = await p.decide({ observation: o, legal });
    expect(decision.action).toEqual({ type: "interact" });
    expect(decision.note?.heuristic).toContain("ordinary E interaction");
    expect((await p.decide({ observation: o, legal })).action?.type).not.toBe(
      "interact",
    );
  });
  it("keeps approaching a chest after an ineffective interaction and retries from closer range", async () => {
    const p = new MazeHeuristic("Coco"),
      o = observation();
    o.visible = [
      {
        ref: "chest",
        kind: "object",
        name: "Supply chest",
        x: 6.3,
        y: 4.5,
        distance: 1.8,
        direction: "e",
        details: "closed",
      },
    ];
    o.inventory.nearbyTarget = { id: "nearby", name: "Supply chest" };
    expect((await p.decide({ observation: o, legal })).action).toEqual({
      type: "interact",
    });
    const last = {
      accepted: true,
      ticks: 2,
      feedback: ["You pressed E; nothing responded."],
      done: false,
    };
    await p.decide({ observation: o, legal, last });
    expect(
      (await p.decide({ observation: o, legal, last })).action,
    ).toMatchObject({ type: "move", direction: "e" });
    o.self.x = 5.2;
    expect((await p.decide({ observation: o, legal, last })).action).toEqual({
      type: "interact",
    });
  });
});
