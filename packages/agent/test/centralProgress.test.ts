import { segmentHits } from "../../../apps/server/src/enemySimulation.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CentralProgress, PROGRESS } from "../src/policies/centralProgress.js";
import {
  centralizedPolicies,
  CentralizedController,
} from "../src/policies/centralized.js";
import { pullPreview, observedContact } from "../src/policies/pullPreview.js";
import { HeroMemory } from "../src/heroMemory.js";
import {
  ModelBudget,
  MeteredGateway,
  defaultBudgetLimits,
  type Gateway,
} from "../src/budget.js";
import type { Observation, ActionSpec, GameAction } from "../src/types.js";
import type { TurnReport } from "../src/policies/policy.js";
const obs = (tick = 0): Observation => ({
  player: "coco",
  hero: "Coco",
  tick,
  seconds: tick / 60,
  area: { name: "Test", widthTiles: 48, heightTiles: 40 },
  self: { x: 22.62, y: 25.63, facing: "e", hp: 28, maxHp: 100, status: [] },
  abilities: [{ key: "3", name: "Black Hole", state: "ready" }],
  screen: {
    originX: 0,
    originY: 0,
    rows: Array.from({ length: 40 }, () => ".".repeat(48)),
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
const turn = (action: GameAction): TurnReport => ({
  steps: [
    {
      action,
      status: "executed",
      result: { accepted: true, ticks: 2, feedback: [], done: false },
    },
  ],
  skipped: [],
});
const LEGAL: ActionSpec[] = [
  { type: "wait", description: "wait" },
  {
    type: "move",
    description: "move",
    params: {
      direction: { kind: "enum", values: ["n", "e", "s", "w"] },
      ticks: { kind: "int", min: 1, max: 60 },
    },
  },
  {
    type: "ability",
    description: "ability",
    params: { ability: { kind: "enum", values: ["black_hole"] } },
  },
];
function policies(reply: (u: any, n: number) => unknown) {
  const calls: any[] = [];
  const gateway: Gateway = {
    label: "mock:progress",
    worstCaseUsd: () => 0.0001,
    async complete(_s, u) {
      const data = JSON.parse(u);
      calls.push(data);
      return {
        text: JSON.stringify(reply(data, calls.length)),
        tokens: { input: 1, output: 1 },
        costUsd: 0,
      };
    },
  };
  const budget = new ModelBudget(defaultBudgetLimits);
  const p = centralizedPolicies(
    "",
    {
      sieg: new MeteredGateway(gateway, budget, "sieg"),
      coco: new MeteredGateway(gateway, budget, "coco"),
    },
    4,
    "Obtain Enchanted Shears.",
  );
  return { c: p.coco as CentralizedController, calls };
}
describe("centralized cumulative progress", () => {
  it("keeps cast plus a conditional cooldown wait in one valid order", async () => {
    const { c, calls } = policies(() => ({
      plan: "cast then await visible readiness",
      orders: [
        {
          hero: "coco",
          actions: [{ type: "ability", ability: "black_hole", direction: "e" }],
          wait_until: { seconds: 10, ability: "Black Hole" },
        },
      ],
    }));
    const cast = await c.decide({ observation: obs(), legal: LEGAL });
    expect(cast.action).toEqual({
      type: "ability",
      ability: "black_hole",
      direction: "e",
    });
    const after = obs(2);
    after.abilities[0].state = "recharging (10s)";
    const next = await c.decide({
      observation: after,
      legal: LEGAL,
      batch: turn(cast.action!),
    });
    expect(next.action?.type).toBe("wait");
    expect(calls).toHaveLength(1);
  });
  it("stops dispatching after three unchanged recovery replies", async () => {
    const { c, calls } = policies(() => ({
      plan: "hold",
      orders: [{ hero: "coco", hold: true }],
    }));
    await c.decide({ observation: obs(), legal: LEGAL });
    for (let i = 0; i < 3; i++)
      expect(
        (await c.decide({ observation: obs(1800), legal: LEGAL })).replyProblem,
      ).toMatch(/renewed hold/);
    await expect(
      c.decide({ observation: obs(1800), legal: LEGAL }),
    ).rejects.toThrow(/three recovery replies/);
    expect(calls).toHaveLength(4);
  });

  it("does not reset across refreshed 5-second waits, hold assignments, calls, damage or cooldown countdown", () => {
    const p = new CentralProgress();
    p.observe(obs());
    for (let t = 300; t <= 1800; t += 300) {
      const o = obs(t);
      o.self.hp--;
      o.abilities[0].state = `recharging (${t / 60}s)`;
      p.observe(o, turn({ type: "wait", ticks: 30 }));
      p.assignment("coco", JSON.stringify({ hold: true }));
    }
    expect(p.view("coco", 1800)).toMatchObject({
      idle_seconds: 30,
      reconsider_assignments: true,
    });
    expect(p.interrupt("coco", 1800)).toBe(true);
    expect(p.assignmentCount("coco", JSON.stringify({ hold: true }))).toBe(6);
  });
  it("interrupts renewed holds and refuses another identical passive plan instead of silently waiting", async () => {
    const { c, calls } = policies(() => ({
      plan: "hold",
      orders: [{ hero: "coco", hold: true }],
    }));
    await c.decide({ observation: obs(), legal: LEGAL });
    // Direct assignments reproduce re-holding before the old per-intention deadline.
    c.applyOrder(
      { hero: "coco", actions: [], dropped: [], hold: true },
      obs(1500),
    );
    const d = await c.decide({
      observation: obs(1800),
      legal: LEGAL,
      batch: turn({ type: "wait", ticks: 30 }),
    });
    expect(calls.at(-1).progress.coco.idle_seconds).toBe(30);
    expect(d.action).toBeUndefined();
    expect(d.replyProblem).toMatch(/renewed hold/);
    const again = await c.decide({ observation: obs(1800), legal: LEGAL });
    expect(again.replyProblem).toMatch(/renewed hold/);
  });
  it("short wait renewals trigger the cumulative watchdog and require a changed assignment", async () => {
    const { c, calls } = policies(() => ({
      plan: "wait",
      orders: [{ hero: "coco", wait_until: { seconds: 5 } }],
    }));
    await c.decide({ observation: obs(), legal: LEGAL });
    for (let tick = 300; tick < 1800; tick += 300)
      await c.decide({
        observation: obs(tick),
        legal: LEGAL,
        batch: turn({ type: "wait", ticks: 30 }),
      });
    const d = await c.decide({
      observation: obs(1800),
      legal: LEGAL,
      batch: turn({ type: "wait", ticks: 30 }),
    });
    expect(calls.at(-1).why_you_are_asked.coco.join(" ")).toMatch(
      /inactivity watchdog/,
    );
    expect(d.replyProblem).toMatch(/equivalent passive/);
  });
  it("permits a specific bounded cooldown wait, ends it at ready, and does not allow deadline extension", async () => {
    const { c } = policies((_u, n) => ({
      plan: "specific dependency",
      orders: [
        {
          hero: "coco",
          ...(n === 1
            ? { hold: true }
            : { wait_until: { seconds: 10, ability: "Black Hole" } }),
        },
      ],
    }));
    await c.decide({ observation: obs(), legal: LEGAL });
    const o = obs(1800);
    o.abilities[0].state = "recharging (5s)";
    const d = await c.decide({ observation: o, legal: LEGAL });
    expect(d.action?.type).toBe("wait");
    expect(c.planner.progress.view("coco", 1800).last_progress_tick).toBe(0);
    expect(
      c.planner.progress.permit("coco", 2000, "cooldown:Black Hole:0", 30),
    ).toBe(true);
    expect(
      c.planner.progress.view("coco", 2000).bounded_dependency?.until,
    ).toBe(2400);
    const ended = await c.decide({
      observation: obs(2100),
      legal: LEGAL,
      batch: turn({ type: "wait", ticks: 30 }),
    });
    expect(ended.replyProblem).toMatch(/not ready/);
    expect(
      c.planner.progress.permit("coco", 2400, "cooldown:Black Hole:0", 10),
    ).toBe(false);
  });
  it("rejects equivalent failed casts, while changed aim or position remains available", () => {
    const p = new CentralProgress(),
      action: GameAction = {
        type: "ability",
        ability: "black_hole",
        direction: "e",
      };
    p.observe(obs());
    p.observe(obs(2), turn(action));
    p.observe(obs(600));
    p.observe(obs(602), turn(action));
    p.observe(obs(1200));
    expect(p.repeated("coco", action, obs(1200))).toBe(true);
    expect(p.repeated("coco", { ...action, direction: "n" }, obs(1200))).toBe(
      false,
    );
    const moved = obs(1200);
    moved.self.x -= 1;
    expect(p.repeated("coco", action, moved)).toBe(false);
    expect(p.view("coco", 1200).attempted_actions[0].outcome).toMatch(
      /no relevant observable effect/,
    );
  });
  it("accepted casts and cooldown activation cannot become completed subgoals; observed effects can", () => {
    const p = new CentralProgress();
    p.observe(obs());
    const o = obs(2);
    o.abilities[0].state = "recharging (10s)";
    p.observe(
      o,
      turn({ type: "ability", ability: "black_hole", direction: "e" }),
    );
    expect(
      p.complete(["Cast succeeded", "cow parked", "observed-1"]).completed,
    ).toEqual([]);
    expect(p.view("coco", 2).attempted_actions[0]).toMatchObject({
      accepted: true,
      execution: "ability activation confirmed by visible cooldown",
      confirmed_effect_ids: [],
    });
    const item = obs(60);
    item.inventory.items = [
      { id: "token", name: "Token", count: 1, description: "visible" },
    ];
    p.observe(item);
    const e = p.facts().find((e) => e.kind === "inventory")!;
    expect(p.complete([e.id]).completed[0].text).toBe(
      "Shared inventory now contains 1 Token.",
    );
    expect(p.complete(["Quest completed"]).refused).toEqual([
      "Quest completed",
    ]);
  });
  it("does not credit autonomous creature motion, offscreen disappearance, repeating dialogue or known-floor backtracking", () => {
    const p = new CentralProgress();
    const a = obs();
    a.visible = [
      {
        ref: "creature-1",
        kind: "creature",
        name: "runner",
        x: 26,
        y: 25,
        distance: 3,
        direction: "e",
      },
    ];
    p.observe(a);
    const b = structuredClone(a);
    b.tick = 1800;
    b.visible[0].x = 28;
    p.observe(b);
    expect(p.view("coco", 1800).idle_seconds).toBe(30);
    const c = structuredClone(b);
    c.tick = 1900;
    c.visible = [];
    p.observe(c);
    expect(p.facts()).toEqual([]);
  });
  it("keeps the immutable evaluation objective distinct from the broader journal and discards unsupported claims", async () => {
    const { c, calls } = policies(() => ({
      plan: "Follow the journal",
      subgoals_done: ["Coco fired Black Hole"],
      orders: [{ hero: "coco", hold: true }],
    }));
    const o = obs();
    o.journal.current = {
      quest: "Goddess",
      step: "Recover the Divine Wig",
      done: [],
    };
    await c.decide({ observation: o, legal: LEGAL });
    const u = JSON.parse(c.planner.userMessage({}));
    expect(u.evaluation_objective.episode_briefing).toBe(
      "Obtain Enchanted Shears.",
    );
    expect(u.shared.journal.current.step).toBe("Recover the Divine Wig");
    expect(c.planner.planMemory().subgoalsDone).toEqual([]);
    expect(calls[0].evaluation_objective).toEqual(u.evaluation_objective);
  });
  it("has no hidden-state imports and does not turn hostile unobserved fields into facts", () => {
    for (const file of ["centralProgress.ts", "pullPreview.ts"]) {
      const text = readFileSync(`packages/agent/src/policies/${file}`, "utf8");
      const imports = [...text.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
      expect(
        imports.every((i) =>
          [
            "../types.js",
            "./policy.js",
            "../heroMemory.js",
            "./navigator.js",
          ].includes(i),
        ),
      ).toBe(true);
    }
    const p = new CentralProgress();
    const o = obs();
    (o as any).hidden = { solution: "secret", parked: true };
    p.observe(o);
    expect(
      JSON.stringify(p.facts()) + JSON.stringify(p.view("coco", 0)),
    ).not.toMatch(/secret|parked/);
  });
});
describe("Pilot-28 exact observed cast geometry", () => {
  function cast(x: number, y: number, cowX: number, dir: "n" | "s" | "e") {
    const o = obs();
    o.self.x = x;
    o.self.y = y;
    // The observed wall cells that stopped the boundary casts, not an engine map.
    const rows = o.screen.rows.map((r) => r.split(""));
    rows[22][22] = "#";
    rows[27][22] = "#";
    o.screen.rows = rows.map((r) => r.join(""));
    o.visible = [
      {
        ref: "creature-1",
        name: "cow",
        kind: "creature",
        x: cowX,
        y: 25,
        distance: 3,
        direction: "e",
        extent: { x: cowX === 26 ? 24 : 23.03, y: 23, w: 4, h: 4 },
      },
      {
        ref: "partner-1",
        kind: "partner",
        name: "Sieg",
        x: 22.47,
        y: 23.54,
        distance: 2,
        direction: "n",
      },
    ];
    const m = new HeroMemory("Coco");
    m.observe(o);
    return pullPreview(m, o).find((p) => p.direction === dir)!;
  }
  it.each([
    [22.62, 25.63, "n"],
    [22.62, 23.55, "s"],
    [22.62, 23.65, "n"],
    [22.62, 23.55, "s"],
  ] as const)(
    "does not promise a hit at boundary configuration (%s,%s) %s",
    (x, y, d) => {
      const p = cast(x, y, 25.02, d);
      expect(p.within_pull.some((t) => t.name === "cow")).toBe(false);
      expect(p.near_pull_boundary[0]).toMatchObject({
        name: "cow",
        range: "boundary_uncertain",
      });
      expect(p.near_pull_boundary[0].distance).toBeGreaterThan(3);
      expect(p.stops_at.y).toBeCloseTo(d === "n" ? 23.1875 : 26.8125, 2);
    },
  );
  it.each([
    [22.5, 25.63, 26],
    [22.6, 25.63, 25.02],
    [22.62, 25.53, 25.02],
  ])(
    "warns about Coco obstructing the westward pull from (%s,%s), cow x%s",
    (x, y, cowX) => {
      const p = cast(x, y, cowX, "e"),
        target = p.within_pull.find((v) => v.name === "cow")!;
      expect(target.pulled_toward).toBe("w");
      expect(target.obstructing_heroes.some((h) => h.hero === "Coco")).toBe(
        true,
      );
      expect(target.obstructing_heroes[0].explanation).toMatch(
        /stands between/,
      );
    },
  );
  it("shows the south/east pull of the early northward cast, rather than promising a northward pull", () => {
    const p = cast(27.47, 29.43, 26, "n");
    expect(p.stops_at).toMatchObject({ y: 27.188 });
    expect(p.within_pull[0].pulled_toward).toBe("se");
  });
  it("uses swept AABB contact, detects visible partner obstruction, and ignores offscreen heroes", () => {
    expect(
      observedContact(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: -1, w: 2, h: 2 },
        0.2,
      ),
    ).toBeCloseTo(0.48);
    const o = obs();
    o.self.x = 20;
    o.self.y = 25;
    o.visible = [
      {
        ref: "creature-1",
        name: "body",
        kind: "creature",
        x: 24,
        y: 25,
        extent: { x: 22, y: 23, w: 4, h: 4 },
        distance: 4,
        direction: "e",
      },
      {
        ref: "partner-1",
        name: "Sieg",
        kind: "partner",
        x: 21,
        y: 25,
        distance: 1,
        direction: "e",
      },
    ];
    const m = new HeroMemory("Coco");
    m.observe(o);
    const p = pullPreview(m, o).find((p) => p.direction === "e")!;
    expect(
      p.within_pull[0].obstructing_heroes.some((h) => h.hero === "Sieg"),
    ).toBe(true);
    o.visible = o.visible.filter((v) => v.kind !== "partner");
    expect(
      pullPreview(m, o)
        .find((p) => p.direction === "e")!
        .within_pull[0].obstructing_heroes.some((h) => h.hero === "Sieg"),
    ).toBe(false);
  });
});

it("does not postpone an expired conditional wait until the next watchdog interval", () => {
  const p = new CentralProgress();
  p.observe(obs());
  expect(p.interrupt("coco", 1800)).toBe(true);
  expect(p.permit("coco", 1800, "cooldown:visible:0", 5)).toBe(true);
  expect(p.interrupt("coco", 2099)).toBe(false);
  expect(p.interrupt("coco", 2100)).toBe(true);
  expect(p.permit("coco", 2100, "cooldown:visible:0", 30)).toBe(false);
  expect(p.view("coco", 2100).idle_seconds).toBe(35);
});
it("matches the engine's expanded-segment collision predicate on synthetic geometry", () => {
  for (let n = 0; n < 100; n++) {
    const a = { x: (n * 7) % 23, y: (n * 11) % 19 },
      b = { x: (n * 3) % 17, y: (n * 13) % 29 };
    const r = { x: n % 7, y: n % 5, w: 1 + (n % 4), h: 2 + (n % 3) },
      margin = 6 / 32;
    expect(observedContact(a, b, r, margin) !== undefined).toBe(
      segmentHits(a.x, a.y, b.x, b.y, r, margin),
    );
  }
});

it("moving a watched actor does not grant fresh passive deadlines without progress", async () => {
  const { c } = policies(() => ({
    plan: "watch",
    orders: [
      { hero: "coco", wait_until: { seconds: 5, watch: "moving actor" } },
    ],
  }));
  const make = (tick: number, x: number) => {
    const o = obs(tick);
    o.visible = [
      {
        ref: "creature-1",
        kind: "creature",
        name: "moving actor",
        x,
        y: 25,
        distance: 3,
        direction: "e",
      },
    ];
    return o;
  };
  await c.decide({ observation: make(0, 26), legal: LEGAL });
  expect(
    (await c.decide({ observation: make(1800, 27), legal: LEGAL })).action
      ?.type,
  ).toBe("wait");
  expect(
    (await c.decide({ observation: make(2100, 28), legal: LEGAL }))
      .replyProblem,
  ).toMatch(/equivalent passive/);
  expect(c.planner.progress.view("coco", 2100).idle_seconds).toBe(35);
});
