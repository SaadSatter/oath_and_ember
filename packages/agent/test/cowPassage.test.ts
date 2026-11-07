// Hedge Maze cow passage: root-cause investigation, 2026-11-06
// (docs/midterm/COW_PASSAGE_DIAGNOSIS.md). Deterministic and offline: the real
// S2-B (cow in the lane) and S2-C (cow pulled into its bay) starts at seed 0,
// both reached by replaying recorded play; ordinary legal actions only; the
// go_to controller is the real model-navigator one, given a fixed goal by a
// test fixture instead of a model. No model is called. Raw authoritative state
// is read only by these trusted assertions, never by a player.
//
// The "clearance" block evaluates the real collision functions at hypothetical
// cow positions on a copy of the puzzle state. It writes nothing to any World.
// The trace block is the regression test for the trace-integrity failure of
// the 2026-11-06 model-centralized run (fixed in trace.ts and
// centralProgress.ts). The go_to block covers the oscillation fix.

import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { HALF } from "../../../packages/shared/src/constants.js";
import { hedgeMazeState, mazeCowPosts, mazeCowRect, MAZE_POST_GAP, type HedgeMazeState } from "../../../packages/shared/src/hedgeMaze.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import { constrainMotion } from "../../../packages/shared/src/movement.js";
import { environmentFor } from "../src/suite.js";
import type { AgentEnvironment } from "../src/environment.js";
import { NavigatorPlayer } from "../src/policies/navigator.js";
import { MeteredGateway, ModelBudget, defaultBudgetLimits, type Completion, type Gateway } from "../src/budget.js";
import type { TurnReport } from "../src/policies/policy.js";
import { CentralProgress } from "../src/policies/centralProgress.js";
import { TraceWriter, verifyTrace, type TraceLine } from "../src/trace.js";
import type { GameAction, Observation, PlayerId, StepResult } from "../src/types.js";

const T = 32;
const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const SLOW = { timeout: 180_000 };

async function start(id: "S2-B" | "S2-C") {
  let room!: GameRoom;
  const env = environmentFor(id, { room: (r) => { room = r; } });
  await env.reset(0);
  return { env, room };
}
const cow = (room: GameRoom) => ({ ...hedgeMazeState(room.state.puzzles)!.cow });

type Ctx = { obs: () => Promise<Observation>; legal: () => ReturnType<AgentEnvironment["legal_actions"]>; last: () => StepResult | undefined };
type Script = (c: Ctx) => AsyncGenerator<GameAction>;

/** Ordinary moves toward a tile point, steering by the hero's own observed position (one axis at a time). */
async function* walkTo(c: Ctx, x: number, y: number, tol = 0.1): AsyncGenerator<GameAction> {
  const speed = 190 / T / 60;
  for (let i = 0; i < 40; i++) {
    const s = (await c.obs()).self, dx = x - s.x, dy = y - s.y;
    if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) return;
    if (Math.abs(dx) > tol) yield { type: "move", direction: dx > 0 ? "e" : "w", ticks: Math.max(1, Math.min(60, Math.round(Math.abs(dx) / speed))) };
    else yield { type: "move", direction: dy > 0 ? "s" : "n", ticks: Math.max(1, Math.min(60, Math.round(Math.abs(dy) / speed))) };
  }
}

/** Both heroes act through the environment's barrier; a hero without a script waits. */
async function play(env: AgentEnvironment, room: GameRoom, scripts: Partial<Record<PlayerId, Script>>) {
  const log: { hero: PlayerId; action: GameAction; result: StepResult; self: { x: number; y: number } }[] = [];
  const done: Record<PlayerId, boolean> = { sieg: !scripts.sieg, coco: !scripts.coco };
  const t0 = room.state.serverTick;
  await Promise.all((["sieg", "coco"] as PlayerId[]).map(async (p) => {
    let last: StepResult | undefined;
    const c: Ctx = { obs: () => env.observe(p), legal: () => env.legal_actions(p), last: () => last };
    if (scripts[p])
      for await (const a of scripts[p]!(c)) {
        last = await env.step(p, a);
        log.push({ hero: p, action: a, result: last, self: { ...(await c.obs()).self } });
        if (last.done || room.state.serverTick - t0 > 6000) break;
      }
    done[p] = true;
    while (!(done.sieg && done.coco) && room.state.serverTick - t0 <= 6000)
      if ((await env.step(p, { type: "wait", ticks: 5 })).done) return;
    env.stop("manual_stop");
  }));
  return log;
}

/** The fixed goal the fixture "model" sends on every call, so the controller alone does the walking. */
class GoToFixture implements Gateway {
  readonly label = "mock:cow-passage-go_to";
  asked: string[] = [];
  /** How the latest go_to ended: the reason the controller asked with, or the problem it returned at once. */
  ended = "";
  constructor(private readonly goal: { x: number; y: number }) {}
  worstCaseUsd() { return 0.0001; }
  async complete(_system: string, user: string): Promise<Completion> {
    this.asked.push((JSON.parse(user).navigation?.why_you_are_asked ?? []).join(" | "));
    return { text: JSON.stringify({ notes: "", go_to: this.goal, actions: [] }), tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}
const navigator = (hero: "Sieg" | "Coco", fixture: GoToFixture) =>
  new NavigatorPlayer(hero, MANUAL, new MeteredGateway(fixture, new ModelBudget(defaultBudgetLimits), hero === "Sieg" ? "sieg" : "coco"));
/** Drive one NavigatorPlayer until the fixture is told the goal was reached or cannot be reached. */
function goTo(hero: "Sieg" | "Coco", goal: { x: number; y: number }, fixture: GoToFixture, player = navigator(hero, fixture)): Script {
  return async function* (c) {
    let batch: TurnReport | undefined;
    const calls = fixture.asked.length;
    for (let k = 0; k < 120; k++) {
      const d = await player.decide({ observation: await c.obs(), legal: await c.legal(), ...(batch ? { batch } : {}) });
      if (fixture.asked.length > calls && /you reached your walking goal|cannot reach your goal/.test(fixture.asked.at(-1) ?? "")) { fixture.ended = fixture.asked.at(-1)!; return; }
      // A re-sent goal that ends at once comes back as the reply's problem (shown to the model next turn).
      if (!d.action) { fixture.ended = d.replyProblem ?? fixture.asked.at(-1) ?? ""; return; }
      yield d.action;
      batch = { steps: [{ action: d.action, result: c.last()!, status: "executed" }], skipped: [] };
    }
  };
}
const northMoves = (c: Ctx, x: number): AsyncGenerator<GameAction> => (async function* () {
  yield* walkTo(c, x, 30.5, 0.02);
  for (let i = 0; i < 4; i++) yield { type: "move", direction: "n", ticks: 60 } as GameAction;
})();

describe("cow passage geometry (real collision code, no world writes)", () => {
  it("the post gap and the cow rectangle are what the engine collides with", () => {
    expect(HALF).toBe(13); // heroes are 26 px squares
    expect(MAZE_POST_GAP).toEqual({ x: 830, w: 56 });
    expect(mazeCowPosts).toEqual([
      { x: 768, y: 712, w: 62, h: 20 }, { x: 886, y: 712, w: 10, h: 20 },
      { x: 768, y: 868, w: 62, h: 20 }, { x: 886, y: 868, w: 10, h: 20 },
    ]);
    // The lane is x 768..896; the unmoved cow (centre 832, 800) is a 128 px square filling it.
    expect(mazeCowRect({ cow: { x: 832, y: 800, parked: false } } as HedgeMazeState)).toEqual({ x: 768, y: 736, w: 128, h: 128 });
  });

  it("a hero fits north through both post rows only while the cow's centre is at x <= 796 (36 px moved)", () => {
    // A hero walking north at x: in the post rows it needs 830+13 <= x <= 886-13,
    // beside the cow x >= cow.x+64+13. Hence passable iff cow.x <= 873-77 = 796.
    const through = (cowX: number, heroX: number) => {
      const puzzles = { hedgeMaze: { complete: false, maze: { burned: true, cow: { x: cowX, y: 800, parked: false }, runner: { x: 0, y: 0, facing: 0, caught: false } } }, hedgeGate: { complete: false } };
      return constrainMotion({ x: heroX, y: 29.5 * T }, { x: 0, y: -10 * T }, maps.HEDGE_MAZE, collisionRects("HEDGE_MAZE", puzzles as never)).y;
    };
    const best = (cowX: number) => Math.min(...Array.from({ length: 61 }, (_, i) => through(cowX, 830 + i)));
    expect(best(796)).toBeLessThan(22 * T); // clear of the north posts
    expect(best(797)).toBeGreaterThan(27 * T); // stopped below the cow
    expect(best(832)).toBe(864 + 13); // unmoved: stopped at the cow's south edge
    // The parked cow (centre 763.1) leaves hero centres x 843..873: 0.94 tile of slack.
    const open = Array.from({ length: 61 }, (_, i) => 830 + i).filter((x) => through(763.1, x) < 22 * T);
    expect([open[0], open.at(-1)]).toEqual([843, 873]);
    // Tile column 27's centre (x 880) is drawn "." in the post rows (its centre is
    // outside the 886 px post) but a hero centred there overlaps the post.
    expect(through(763.1, 880)).toBe(888 + 13);
  });
});

describe("S2-B: the cow still in the lane (seed 0)", () => {
  it("blocks both heroes with direct moves at y 27.4, the cow's south edge", SLOW, async () => {
    for (const hero of ["sieg", "coco"] as const) {
      const { env, room } = await start("S2-B");
      expect(cow(room)).toEqual({ x: 832, y: 800, parked: false });
      const log = await play(env, room, { [hero]: (c: Ctx) => northMoves(c, 26.5) });
      expect(log.at(-1)!.self.y).toBe(27.4);
      expect(log.at(-1)!.result.movement?.outcome).toBe("none");
    }
  });

  it("Coco's Black Hole cast east from (20.5, 25.5) parks the cow; from (22.5, 25) it stops short and the lane stays shut", SLOW, async () => {
    const castFrom = async (x: number, y: number) => {
      const { env, room } = await start("S2-B");
      await play(env, room, {
        coco: async function* (c) {
          yield* walkTo(c, 20.5, (await c.obs()).self.y, 0.05);
          yield* walkTo(c, 20.5, y, 0.05);
          yield* walkTo(c, x, y, 0.05);
          for (let i = 0; i < 20 && (await c.obs()).abilities.find((a) => a.name === "Black Hole")?.state !== "ready"; i++) yield { type: "wait", ticks: 30 };
          yield { type: "ability", ability: "black_hole", direction: "e" };
          for (let i = 0; i < 10; i++) yield { type: "wait", ticks: 30 };
        },
      });
      return cow(room);
    };
    const good = await castFrom(20.5, 25.5);
    expect(good.parked).toBe(true);
    expect(good.x).toBeLessThanOrEqual(796);
    // Coco stands within 77 px (64 + HALF) of where the cow would go: the pull stops.
    const close = await castFrom(22.5, 25);
    expect(close.parked).toBe(false);
    expect(close.x).toBeGreaterThan(796);
    expect(close.x).toBeLessThan(832);
  });
});

describe("S2-C: the cow pulled into its bay (seed 0)", () => {
  it("lets a hero walk straight north through both post rows; x 27.5 slides onto the post edge; x 26 hits a post", SLOW, async () => {
    const endAt = async (x: number) => {
      const { env, room } = await start("S2-C");
      expect(cow(room).parked).toBe(true);
      const log = await play(env, room, { sieg: (c: Ctx) => northMoves(c, x) });
      return log.at(-1)!.self;
    };
    expect((await endAt(26.5)).y).toBe(12.4); // the top of the lane
    expect(await endAt(27.5)).toEqual(expect.objectContaining({ x: 27.28, y: 12.4 }));
    expect((await endAt(26.0)).y).toBe(28.15); // 888 + 13 px: the south post
  });

  it("the model-navigator go_to controller walks through the opening, and two heroes cross each other in it", SLOW, async () => {
    const { env, room } = await start("S2-C");
    const s = new GoToFixture({ x: 26.5, y: 19.5 }), c = new GoToFixture({ x: 26.5, y: 31.5 });
    const log = await play(env, room, {
      sieg: async function* (k) { yield* walkTo(k, 20.5, 34.5); yield* walkTo(k, 26.5, 34.5); yield* goTo("Sieg", { x: 26.5, y: 19.5 }, s)(k); },
      coco: async function* (k) { yield* goTo("Coco", { x: 26.5, y: 31.5 }, c)(k); },
    });
    expect(s.asked.at(-1)).toMatch(/you reached your walking goal/);
    expect(c.asked.at(-1)).toMatch(/you reached your walking goal/);
    const end = (p: PlayerId) => log.filter((e) => e.hero === p).at(-1)!.self;
    expect(Math.abs(end("sieg").y - 19.5)).toBeLessThan(0.45);
    expect(Math.abs(end("coco").y - 31.5)).toBeLessThan(0.45);
    // Heroes do not collide with each other. The only stop is the controller
    // aiming down column 27 (drawn "." in the post rows) and sliding onto the
    // post's edge at x 27.28 (873 px), as in the live runs; the move continues.
    const stops = log.filter((e) => e.result.movement?.blocked).map((e) => ({ hero: e.hero, to: e.result.movement!.to }));
    expect(stops.length).toBeLessThanOrEqual(2);
    for (const s of stops) expect(s.to.x).toBe(27.28);
  });
});

describe("go_to when the way is shut, and after it opens (S2-B, seed 0)", () => {
  it("ends unreachable with the observed body as the reason instead of oscillating, retries once unchanged, then opens after the cow moves", SLOW, async () => {
    const { env, room } = await start("S2-B");
    const fixture = new GoToFixture({ x: 26.5, y: 19.5 });
    const sieg = navigator("Sieg", fixture);
    const goal = { x: 26.5, y: 19.5 };
    const t0 = room.state.serverTick;
    // 1. Shut: one walk, ending with a clear reason. Before the fix this
    // alternated between two tiles for over 1,100 ticks without ending.
    const log = await play(env, room, { sieg: async function* (c) { yield* walkTo(c, 26.5, 30.5); yield* goTo("Sieg", goal, fixture, sieg)(c); } });
    const shut = fixture.ended;
    expect(shut).toMatch(/cannot reach your goal/);
    expect(shut).toMatch(/only the body of cow \(creature\).*closes the way/);
    expect(room.state.serverTick - t0).toBeLessThan(1500);
    // No tile was entered three times in a row of back-and-forth moves.
    const cells = log.filter((e) => e.hero === "sieg").map((e) => `${Math.floor(e.self.x)},${Math.floor(e.self.y)}`);
    const flips = cells.filter((c, i) => i >= 2 && c === cells[i - 2] && c !== cells[i - 1]).length;
    expect(flips).toBeLessThan(4);
    expect(cow(room).x).toBe(832); // the shut lane really is shut
  });

  it("an unchanged retry is bounded; after Coco's Black Hole moves the cow the same go_to arrives", SLOW, async () => {
    const { env, room } = await start("S2-B");
    const fixture = new GoToFixture({ x: 26.5, y: 19.5 });
    const sieg = navigator("Sieg", fixture);
    const goal = { x: 26.5, y: 19.5 };
    const reasons: string[] = [];
    let arrived = "", triesDone = false, castDone = false, parkedAtRetry = false;
    // One episode: Sieg tries three times, Coco then casts, then Sieg sends the same goal again.
    await play(env, room, {
      sieg: async function* (c) {
        yield* walkTo(c, 26.5, 30.5);
        for (let n = 0; n < 3; n++) { yield* goTo("Sieg", goal, fixture, sieg)(c); reasons.push(fixture.ended); }
        triesDone = true;
        while (!castDone) yield { type: "wait", ticks: 30 };
        parkedAtRetry = cow(room).parked;
        yield* goTo("Sieg", goal, fixture, sieg)(c);
        arrived = fixture.ended;
      },
      coco: async function* (c) {
        while (!triesDone) yield { type: "wait", ticks: 30 };
        yield* walkTo(c, 20.5, (await c.obs()).self.y, 0.05);
        yield* walkTo(c, 20.5, 25.5, 0.05);
        for (let i = 0; i < 20 && (await c.obs()).abilities.find((a) => a.name === "Black Hole")?.state !== "ready"; i++) yield { type: "wait", ticks: 30 };
        yield { type: "ability", ability: "black_hole", direction: "e" };
        for (let i = 0; i < 4; i++) yield { type: "wait", ticks: 30 };
        castDone = true;
      },
    });
    expect(reasons).toHaveLength(3);
    for (const r of reasons) expect(r).toMatch(/cannot reach/);
    // The third send, with nothing changed on Sieg's map, ends at once with the earlier reason.
    expect(reasons[2]).toMatch(/still unreachable: nothing on your map near the way changed since tick/);
    expect(parkedAtRetry).toBe(true);
    expect(arrived).toMatch(/you reached your walking goal/);
  });
});

describe("trace integrity: records are snapshots (regression for the 2026-11-06 failure at line 118)", () => {
  const obs = (tick: number, rows: string[]): Observation => ({
    player: "coco", hero: "Coco", tick, seconds: tick / 60, area: { name: "Test", widthTiles: 10, heightTiles: 3 },
    self: { x: 2.5, y: 1.5, facing: "e", hp: 100, maxHp: 100, status: [] }, abilities: [{ key: "J", name: "Fireball", state: "ready" }], screen: { originX: 0, originY: 0, rows },
    visible: [], dialogue: null, journal: { completed: [] }, inventory: { items: [] }, discovered: { areas: [], exploredRows: [] }, dialogueLog: [], feedback: [], messages: [],
  });
  const fire = { steps: [{ action: { type: "attack", direction: "e" } as GameAction, status: "executed" as const, result: { accepted: true, ticks: 1, feedback: [], done: false, attack: "performed" as const } }], skipped: [] };

  it("a progress note traced before its attempt gains effects still verifies in memory and on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "cow-trace-"));
    try {
      const path = join(dir, "trace.jsonl");
      const p = new CentralProgress();
      const w = new TraceWriter(path);
      // As in the run: Coco fires at a blocked hedge, the planner note is traced...
      p.observe(obs(0, ["..........", "....##....", ".........."]));
      p.observe(obs(2, ["..........", "....##....", ".........."]), fire);
      const before = p.view("coco", 2).attempted_actions[0].confirmed_effect_ids;
      expect(before).toEqual([]);
      w.write({ type: "policy_note", tick: 2, player: "coco", data: { progress: p.view("coco", 2) } });
      // ...then the hedge is seen burned, and the tracker adds effect ids to that attempt.
      p.observe(obs(60, ["..........", "....,.....".replace(",", "."), ".........."]));
      expect(p.view("coco", 60).attempted_actions[0].confirmed_effect_ids.length).toBeGreaterThan(0);
      expect(before).toEqual([]); // a view is a copy
      w.write({ type: "outcome", tick: 61, data: { outcome: { status: "terminated", reason: "manual_stop" } } });
      expect(() => verifyTrace(w.lines)).not.toThrow();
      const disk = readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l) as TraceLine);
      expect(() => verifyTrace(disk)).not.toThrow();
      expect(disk).toEqual(w.lines);
      expect((w.lines[0].data as { progress: { attempted_actions: { confirmed_effect_ids: string[] }[] } }).progress.attempted_actions[0].confirmed_effect_ids).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("mutating any object after it was written changes neither the kept line nor its hash; the format is unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "cow-trace-"));
    try {
      const path = join(dir, "trace.jsonl");
      const effects: string[] = [];
      const data = { progress: { attempted_actions: [{ confirmed_effect_ids: effects }] }, n: 1 };
      const w = new TraceWriter(path);
      w.write({ type: "policy_note", tick: 1, data });
      effects.push("observed-13");
      data.n = 2;
      expect(() => verifyTrace(w.lines)).not.toThrow();
      expect(w.lines[0].data).toEqual({ progress: { attempted_actions: [{ confirmed_effect_ids: [] }] }, n: 1 });
      // Same fields in the same order as before the fix, and the same digest.
      const [line] = readFileSync(path, "utf8").trim().split("\n");
      expect(Object.keys(JSON.parse(line))).toEqual(["seq", "type", "tick", "data", "wallMs", "prev", "hash"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
