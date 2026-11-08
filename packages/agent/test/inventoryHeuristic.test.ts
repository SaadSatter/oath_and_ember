import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { InventoryHeuristic } from "../src/policies/inventoryHeuristic.js";
import { policyKind } from "../src/policies/kind.js";
import type { Observation, ActionSpec, StepResult } from "../src/types.js";
const obs = (): Observation => ({
  player: "coco",
  hero: "Coco",
  tick: 0,
  seconds: 0,
  area: { name: "Synthetic room", widthTiles: 16, heightTiles: 16 },
  self: { x: 5.5, y: 5.5, facing: "e", hp: 100, maxHp: 100, status: [] },
  abilities: [{ key: "2", name: "Flight", state: "ready" }],
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
  "ability",
  "interact",
  "use_item",
  "attack",
  "defend",
].map((type) => ({ type: type as ActionSpec["type"], description: "test" }));
const accepted: StepResult = {
  accepted: true,
  ticks: 2,
  feedback: ["Input executed."],
  done: false,
};
const tools = (o: Observation) => {
  o.inventory = {
    nearbyTarget: {
      id: "target",
      name: "Workshop stand · apply lens and clippers",
    },
    items: [
      {
        id: "lens",
        name: "Reflective Lens",
        count: 1,
        description: "A shared tool for the workshop stand.",
      },
      {
        id: "clipper",
        name: "Silver Clippers",
        count: 1,
        description: "Keep this tool for the workshop stand.",
      },
    ],
  };
  return o;
};
describe("generic inventory-affordance baseline (synthetic observations only)", () => {
  it("has independent zero-model instances and no scenario/engine/route inputs", () => {
    const a = new InventoryHeuristic(),
      b = new InventoryHeuristic();
    expect("model" in a).toBe(false);
    expect(policyKind({ sieg: a, coco: b })).toBe(
      "baseline-inventory-heuristic",
    );
    const s = readFileSync(
      new URL("../src/policies/inventoryHeuristic.ts", import.meta.url),
      "utf8",
    ).replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(
      /Math.random|from.*(?:suite|server|shared|route)|griffin-prepared|vanity_mirror|enchanted_shears|groomingStage|wigClaimed|GRIFFIN_NEST/,
    );
  });
  it("matches arbitrary owned tool descriptions to visible target words", async () => {
    const o = tools(obs()),
      p = new InventoryHeuristic();
    const a = (await p.decide({ observation: o, legal })).action;
    expect(a?.type).toBe("use_item");
    if (a?.type === "use_item") expect(["lens", "clipper"]).toContain(a.item);
  });
  it("tries a different matching tool without a prescribed item sequence", async () => {
    const o = tools(obs()),
      p = new InventoryHeuristic();
    const a = (await p.decide({ observation: o, legal })).action;
    const b = (await p.decide({ observation: o, legal, last: accepted }))
      .action;
    expect(a?.type).toBe("use_item");
    expect(b?.type).toBe("use_item");
    expect(a).not.toEqual(b);
  });
  it("does not treat accepted item input as a verified reward", async () => {
    const o = tools(obs()),
      p = new InventoryHeuristic();
    await p.decide({ observation: o, legal });
    await p.decide({ observation: o, legal, last: accepted });
    o.tick = 10;
    const r = await p.decide({ observation: o, legal, last: accepted });
    expect(r.note?.inventoryEffect).toContain("no inventory effect confirmed");
    expect(r.note).not.toHaveProperty("completed");
  });
  it("keeps one fixed deadline across repeated dependency waits", async () => {
    const o = tools(obs()),
      p = new InventoryHeuristic();
    await p.decide({ observation: o, legal });
    await p.decide({ observation: o, legal, last: accepted });
    for (const tick of [10, 200, 1000]) {
      o.tick = tick;
      const r = await p.decide({ observation: o, legal, last: accepted });
      expect(r.note?.dependency).toMatchObject({ untilTick: 1800 });
    }
    o.tick = 1800;
    const r = await p.decide({ observation: o, legal, last: accepted });
    expect(r.note?.heuristic).not.toContain("Await observable item reaction");
  });
  it("reuses normal owned-wig offering instead of claiming success locally", async () => {
    const o = obs(),
      p = new InventoryHeuristic();
    o.inventory = {
      nearbyTarget: { id: "offer", name: "Goddess offering" },
      items: [
        { id: "wig", name: "Divine Wig", count: 1, description: "Offer it." },
      ],
    };
    expect((await p.decide({ observation: o, legal })).action).toEqual({
      type: "use_item",
      item: "wig",
    });
  });
  it("does not apply unowned items or invent absent target hints", async () => {
    const o = obs(),
      p = new InventoryHeuristic();
    o.inventory.nearbyTarget = { id: "unknown", name: "Something" };
    expect((await p.decide({ observation: o, legal })).action?.type).not.toBe(
      "use_item",
    );
  });
  it("is deterministic for identical bounded histories", async () => {
    const a = new InventoryHeuristic(),
      b = new InventoryHeuristic(),
      o = tools(obs());
    for (const tick of [0, 2, 10, 120, 240, 1800]) {
      o.tick = tick;
      expect(await a.decide({ observation: o, legal, last: accepted })).toEqual(
        await b.decide({ observation: o, legal, last: accepted }),
      );
    }
  });
});
