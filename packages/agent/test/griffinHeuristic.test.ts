import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { GriffinHeuristic } from "../src/policies/griffinHeuristic.js";
import { environmentFor } from "../src/suite.js";
import { episodes } from "../src/evaluator.js";
import { policyKind } from "../src/policies/kind.js";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import type { Observation, ActionSpec } from "../src/types.js";
const ID = "griffin-unprepared-return-v1";
const obs = (): Observation => ({
  player: "coco",
  hero: "Coco",
  tick: 0,
  seconds: 0,
  area: { name: "Test", widthTiles: 20, heightTiles: 20 },
  self: { x: 5.5, y: 5.5, facing: "e", hp: 100, maxHp: 100, status: [] },
  abilities: [
    { key: "3", name: "Black Hole", state: "ready" },
    { key: "J", name: "Fireball", state: "ready" },
  ],
  screen: {
    originX: 0,
    originY: 0,
    rows: Array.from({ length: 20 }, () => "...................."),
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
  "attack",
  "defend",
  "ability",
  "interact",
  "use_item",
].map((type) => ({ type: type as ActionSpec["type"], description: "test" }));
describe("Griffin rule-aware baseline", () => {
  it("has separate zero-model instances and no hidden mechanics or route inputs", () => {
    const a = new GriffinHeuristic(),
      b = new GriffinHeuristic();
    expect(policyKind({ sieg: a, coco: b })).toBe("baseline-griffin-heuristic");
    expect("model" in a).toBe(false);
    const src = readFileSync(
      new URL("../src/policies/griffinHeuristic.ts", import.meta.url),
      "utf8",
    ).replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(
      /Math.random|GameRoom|from.*(?:suite|server|shared|route|questKnowledge)|grounded|landingY|PULLED|GRIFFIN_MAX_HP/,
    );
  });
  it("uses a general organic pull even without airborne information", async () => {
    const p = new GriffinHeuristic(),
      o = obs();
    o.visible = [
      {
        ref: "enemy",
        kind: "creature",
        name: "organic hostile",
        x: 10,
        y: 5.5,
        distance: 4.5,
        direction: "e",
        details: "HP 100/100",
      },
    ];
    expect((await p.decide({ observation: o, legal })).action).toEqual({
      type: "ability",
      ability: "black_hole",
      direction: "e",
    });
  });
  it("does not cast an unavailable pull", async () => {
    const p = new GriffinHeuristic(),
      o = obs();
    o.abilities[0].state = "recharging";
    o.visible = [
      {
        ref: "enemy",
        kind: "creature",
        name: "organic hostile",
        x: 10,
        y: 5.5,
        distance: 4.5,
        direction: "e",
        details: "HP 100/100",
      },
    ];
    expect(
      (await p.decide({ observation: o, legal })).action,
    ).not.toMatchObject({ type: "ability", ability: "black_hole" });
  });
  it("uses an owned wig at an observed offering, with no route", async () => {
    const p = new GriffinHeuristic(),
      o = obs();
    o.inventory = {
      nearbyTarget: { id: "offering", name: "Goddess offering" },
      items: [
        {
          id: "griffin_wig",
          name: "Divine Wig",
          count: 1,
          description: "An offering",
        },
      ],
    };
    expect((await p.decide({ observation: o, legal })).action).toEqual({
      type: "use_item",
      item: "griffin_wig",
    });
  });
  it("is deterministic for identical observation histories", async () => {
    const a = new GriffinHeuristic(),
      b = new GriffinHeuristic();
    for (let i = 0; i < 20; i++) {
      const o = obs();
      o.tick = i * 10;
      expect(await a.decide({ observation: o, legal })).toEqual(
        await b.decide({ observation: o, legal }),
      );
    }
  });
});
describe("B legal checkpoint and authoritative return success", () => {
  it("pins the independent B definition without modifying frozen A/C", () => {
    const d = JSON.parse(
      readFileSync(
        new URL(
          "../../../docs/midterm/evaluation-abc/B-unprepared-return-definition.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const hash = d.definitionSha256;
    delete d.definitionSha256;
    const canonical = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(canonical)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, canonical(v)]),
            )
          : v;
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(canonical(d)).replace(
            /[^\x00-\x7f]/g,
            (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
          ),
        )
        .digest("hex"),
    ).toBe(hash);
    expect(hash).toBe(
      "b224f75d2ec71ad61082fe0cba4617057b73cd9feb5173c52f7f32dcd86ed6f1",
    );
  });

  it("resets identically with fresh encounter, normal heroes and no tools or wig", async () => {
    let room!: GameRoom;
    const env = environmentFor(ID, { room: (r) => (room = r) });
    const a = await env.reset(0),
      b = await env.reset(0);
    expect(a.startHash).toBe(b.startHash);
    expect(a.startHash).toBe(
      "45b1a6aa2c164b2c31885d6e5d514fc8d7eae190ef76d7aad4422445f38db9b8",
    );
    expect(room.state.sceneId).toBe("GRIFFIN_ENCLOSURE");
    expect(room.state.puzzles.griffin?.griffin).toMatchObject({
      hp: 640,
      phase: "NEST",
      wigClaimed: false,
    });
    for (const hero of ["sieg", "coco"] as const) {
      const o = await env.observe(hero);
      expect(o.self.hp).toBe(100);
      expect(
        o.inventory.items.filter((i) =>
          /^(vanity_mirror|enchanted_shears|griffin_wig)$/.test(i.id),
        ),
      ).toEqual([]);
      expect(o.visible.some((v) => v.name === "nest")).toBe(false);
    }
    expect((await env.outcome()).status).toBe("ongoing");
  }, 30000);
  it("requires actual defeat, reward acquisition and chapter0.complete, not a peaceful wig or shrine entry", async () => {
    // Evaluator UNIT FIXTURE only: never used by a policy or checkpoint.
    let room!: GameRoom;
    const env = environmentFor(ID, { room: (r) => (room = r) });
    await env.reset(0);
    const w = room.state,
      g = w.puzzles.griffin!.griffin!;
    g.hp = 0;
    g.wigClaimed = true;
    expect(episodes[ID].success(w)).toBe(false);
    w.story!.flags.push("chapter0.complete");
    expect(episodes[ID].success(w)).toBe(true);
    g.hp = 640;
    expect(episodes[ID].success(w)).toBe(false);
    g.hp = 0;
    g.wigClaimed = false;
    expect(episodes[ID].success(w)).toBe(false);
  });
  it("terminates on authoritative knockout even though the game respawns at full health", async () => {
    // Damage UNIT FIXTURE: normal server damage handles the lethal hit.
    let lethal = false;
    const env = environmentFor(ID, {
      tick: (room) => {
        room.tick();
        if (lethal) {
          lethal = false;
          room.damage(Object.values(room.state.players)[0], 10000);
        }
      },
    });
    await env.reset(0);
    lethal = true;
    await Promise.all([
      env.step("sieg", { type: "wait", ticks: 2 }),
      env.step("coco", { type: "wait", ticks: 2 }),
    ]);
    expect((await env.outcome()).reason).toBe("knocked_out");
    expect((await env.observe("sieg")).self.hp).toBe(100);
  });
  it("lists only the already-drawn nest when it is actually on screen", async () => {
    let room!: GameRoom;
    const env = environmentFor(ID, { room: (r) => (room = r) });
    await env.reset(0);
    expect(
      (await env.observe("coco")).visible.some((v) => v.name === "nest"),
    ).toBe(false);
    // Visibility UNIT FIXTURE only, never part of checkpoint or a player run.
    const hero = Object.values(room.state.players).find(
      (p) => p.role === "EMBER",
    )!;
    hero.x = 640;
    hero.y = 180;
    expect(
      (await env.observe("coco")).visible.find((v) => v.name === "nest"),
    ).toMatchObject({ kind: "object", x: 20, y: 3.5 });
  });
});
