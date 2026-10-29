// The opt-in model-memory player (docs/midterm/MODEL_MEMORY.md). Offline:
// recording or scripted gateways only, no provider request, tuning scenario
// S2-local and seed 0 only (no held-out S4/F content).
//
// Three kinds of test, each labelled:
//   - SYNTHETIC: hand-written observations fed straight to HeroMemory, to pin
//     its rules exactly. No game state is involved.
//   - REAL PLAY: S2-local reached by its own real-play prefix (suite.ts), then
//     real inputs through env.step. No fixture.
//   - FIXTURE: one test moves both heroes into the Hedge Maze and places them
//     (as pilot6Fixes.test.ts does) to watch a real Black Hole pull. Every
//     outcome after that comes from real inputs and the server's own rules.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { AgentEnvironment } from "../src/environment.js";
import { HeroMemory, MAP_LEGEND, MEMORY_LIMITS } from "../src/heroMemory.js";
import { policiesFor, validatePlan, type ModelSetup } from "../src/harness.js";
import { TILE } from "../src/perception.js";
import { policyKind } from "../src/policies/kind.js";
import { LLMPlayer, MEMORY_SECTION, replySchema, systemPrompt } from "../src/policies/llm.js";
import type { TurnReport } from "../src/policies/policy.js";
import { environmentFor } from "../src/suite.js";
import type { GameAction, MovementReport, Observation, PlayerId, StepResult, VisibleThing } from "../src/types.js";
import { capturePrompts, MANUAL, promptDigest } from "./helpers/promptCapture.js";

// ── Synthetic observations ────────────────────────────────────────────────

interface Shape {
  player?: PlayerId;
  tick: number;
  area?: string;
  w?: number;
  h?: number;
  origin: [number, number];
  rows: string[];
  self: [number, number];
  visible?: Partial<VisibleThing>[];
  feedback?: string[];
}
/** SYNTHETIC: an observation with only the fields HeroMemory reads filled in meaningfully. */
function obs(s: Shape): Observation {
  const player = s.player ?? "sieg";
  return {
    player,
    hero: player === "sieg" ? "Sieg" : "Coco",
    tick: s.tick,
    seconds: s.tick / 60,
    area: { name: s.area ?? "Test Field", widthTiles: s.w ?? 30, heightTiles: s.h ?? 10 },
    self: { x: s.self[0], y: s.self[1], facing: "e", hp: 100, maxHp: 100, status: [] },
    abilities: [],
    screen: { originX: s.origin[0], originY: s.origin[1], rows: s.rows },
    visible: (s.visible ?? []).map((v, i) => ({ ref: `t-${i}`, kind: "creature", name: "thing", x: 0, y: 0, distance: 1, direction: "e", ...v }) as VisibleThing),
    dialogue: null,
    journal: { completed: [] },
    inventory: { items: [] },
    discovered: { areas: [s.area ?? "Test Field"], exploredRows: [] },
    dialogueLog: [],
    feedback: s.feedback ?? [],
    messages: [],
  };
}
const moveStep = (direction: "e" | "w" | "n" | "s", movement: MovementReport, after?: Observation): TurnReport["steps"][number] => ({
  action: { type: "move", direction, ticks: 30 },
  result: { accepted: true, ticks: 30, movement, feedback: [], done: false },
  status: "executed",
  ...(after ? { after } : {}),
});
const report = (o: Partial<MovementReport> & Pick<MovementReport, "from" | "to">): MovementReport => ({
  outcome: "full", movedTiles: 3, requestedTiles: 3, blocked: false, ticks: { applied: 30, notApplied: 0, movedByGame: 0 }, ...o,
});
const OPEN = "..........";

describe("SYNTHETIC: remembered map at tile resolution", () => {
  it("keeps tiles that left the screen, with '?' for tiles never shown", () => {
    const m = new HeroMemory("Sieg");
    m.observe(obs({ tick: 10, origin: [0, 0], rows: ["##########", "#.........", "#.........", "##########"], self: [2.5, 1.5] }));
    m.observe(obs({ tick: 20, origin: [10, 0], rows: ["##########", OPEN, "...~~.....", "##########"], self: [12.5, 1.5] }));
    expect(m.terrainAt("Test Field", 0, 0)).toBe("#");
    expect(m.terrainAt("Test Field", 1, 1)).toBe(".");
    expect(m.terrainAt("Test Field", 13, 2)).toBe("~");
    expect(m.terrainAt("Test Field", 25, 1)).toBe("?");
    expect(m.terrainAt("Test Field", 5, 8)).toBe("?");
    // Last-seen tick per tile: the first screen's tiles still say tick 10.
    expect(m.lastSeenTickAt("Test Field", 1, 1)).toBe(10);
    expect(m.lastSeenTickAt("Test Field", 13, 2)).toBe(20);
    expect(m.lastSeenTickAt("Test Field", 25, 1)).toBe(-1);
  });

  it("renders coordinates and a legend-coded grid, cropped to what was seen", () => {
    const m = new HeroMemory("Sieg");
    const now = obs({ tick: 10, origin: [8, 2], rows: ["####", "#..>", "#.o."], self: [9.5, 3.5] });
    m.observe(now);
    const map = m.view(now).remembered_map!;
    expect(map).toMatchObject({ area: "Test Field", x_from: 8, x_to: 11, y_from: 2, y_to: 4, on_screen_now: { x_from: 8, x_to: 11, y_from: 2, y_to: 4 } });
    expect(map.rows).toEqual(["    11", "  8901", "2 ####", "3 #@.>", "4 #.o."]);
    expect(Object.keys(MAP_LEGEND).sort()).toEqual(["#", "+", ".", ":", ">", "?", "@", "^", "o", "~"].sort());
  });

  it("does not store moving things as terrain: the ground under them keeps its last seen value, or ':' if never seen", () => {
    const m = new HeroMemory("Sieg");
    m.observe(obs({ tick: 10, origin: [0, 0], rows: ["....", "...."], self: [0.5, 0.5] }));
    m.observe(obs({ tick: 20, origin: [0, 0], rows: ["@.C.", ".EPC"], self: [0.5, 0.5] }));
    expect(m.terrainAt("Test Field", 2, 0)).toBe(".");
    expect(m.terrainAt("Test Field", 1, 1)).toBe(".");
    const fresh = new HeroMemory("Sieg");
    fresh.observe(obs({ tick: 10, origin: [0, 0], rows: ["@.C.", "...*"], self: [0.5, 0.5] }));
    expect(fresh.terrainAt("Test Field", 2, 0)).toBe(":");
    expect(fresh.terrainAt("Test Field", 3, 1)).toBe(":");
    expect(fresh.terrainAt("Test Field", 0, 0)).toBe(":");
  });
});

describe("SYNTHETIC: seen versus walked", () => {
  it("marks only tiles the hero stood on or walked through", () => {
    const m = new HeroMemory("Sieg");
    const a = obs({ tick: 10, origin: [0, 0], rows: [OPEN, OPEN], self: [1.5, 0.5] });
    m.observe(a);
    const b = obs({ tick: 40, origin: [0, 0], rows: [OPEN, OPEN], self: [4.5, 0.5] });
    m.recordTurn({ steps: [moveStep("e", report({ from: { x: 1.5, y: 0.5 }, to: { x: 4.5, y: 0.5 } }))], skipped: [] }, a);
    m.observe(b);
    for (const x of [1, 2, 3, 4]) expect(m.walkedAt("Test Field", x, 0), `x ${x}`).toBe(true);
    for (const x of [0, 5, 6, 9]) expect(m.walkedAt("Test Field", x, 0), `x ${x}`).toBe(false);
    expect(m.walkedAt("Test Field", 2, 1)).toBe(false);
    expect(m.view(b).remembered_map!.rows.slice(2)).toEqual(["0 .+++@.....", "1 .........."]);
  });

  it("a blocked move marks only where the hero stood; a partial one only as far as it got", () => {
    const m = new HeroMemory("Sieg");
    const a = obs({ tick: 10, origin: [0, 0], rows: [OPEN], self: [1.5, 0.5] });
    m.observe(a);
    m.recordTurn({ steps: [moveStep("e", report({ outcome: "none", movedTiles: 0, blocked: true, from: { x: 1.5, y: 0.5 }, to: { x: 1.5, y: 0.5 } }))], skipped: [] }, a);
    expect([0, 1, 2, 3].map((x) => m.walkedAt("Test Field", x, 0))).toEqual([false, true, false, false]);
    m.recordTurn({ steps: [moveStep("e", report({ outcome: "partial", movedTiles: 2, blocked: true, from: { x: 1.5, y: 0.5 }, to: { x: 3.5, y: 0.5 } }))], skipped: [] }, a);
    expect([1, 2, 3, 4, 5].map((x) => m.walkedAt("Test Field", x, 0))).toEqual([true, true, true, false, false]);
  });

  it("never fills in tiles between the ends of a move the game moved, or one that slid sideways", () => {
    const m = new HeroMemory("Sieg");
    const a = obs({ tick: 10, origin: [0, 0], rows: [OPEN, OPEN, OPEN], self: [0.5, 0.5] });
    m.observe(a);
    m.recordTurn({ steps: [moveStep("e", report({ from: { x: 0.5, y: 0.5 }, to: { x: 6.5, y: 0.5 }, ticks: { applied: 20, notApplied: 0, movedByGame: 10 } }))], skipped: [] }, a);
    expect([0, 1, 2, 3, 4, 5, 6].map((x) => m.walkedAt("Test Field", x, 0))).toEqual([true, false, false, false, false, false, true]);
    m.recordTurn({ steps: [moveStep("e", report({ outcome: "partial", from: { x: 0.5, y: 1.2 }, to: { x: 4.5, y: 2.5 } }))], skipped: [] }, a);
    expect([1, 2, 3].map((x) => m.walkedAt("Test Field", x, 1) || m.walkedAt("Test Field", x, 2))).toEqual([false, false, false]);
    expect(m.walkedAt("Test Field", 4, 2)).toBe(true);
    // A move that went backwards relative to its direction is not interpolated.
    m.recordTurn({ steps: [moveStep("w", report({ from: { x: 1.5, y: 2.5 }, to: { x: 3.5, y: 2.5 } }))], skipped: [] }, a);
    expect(m.walkedAt("Test Field", 2, 2)).toBe(false);
  });

  it("reads observations taken between batched actions, so screens seen mid-batch are kept", () => {
    const m = new HeroMemory("Sieg");
    const a = obs({ tick: 10, origin: [0, 0], rows: ["....."], self: [1.5, 0.5] });
    const mid = obs({ tick: 40, origin: [5, 0], rows: ["..#.."], self: [6.5, 0.5] });
    m.observe(a);
    m.recordTurn({ steps: [moveStep("e", report({ from: { x: 1.5, y: 0.5 }, to: { x: 6.5, y: 0.5 } }), mid), moveStep("e", report({ from: { x: 6.5, y: 0.5 }, to: { x: 6.6, y: 0.5 }, outcome: "none" }))], skipped: [] }, a);
    expect(m.terrainAt("Test Field", 7, 0)).toBe("#");
    expect(m.lastSeenTickAt("Test Field", 7, 0)).toBe(40);
  });
});

describe("SYNTHETIC: moving things and stale sightings", () => {
  const cow = (x: number, y: number): Partial<VisibleThing> => ({ kind: "creature", name: "cow", x, y });
  it("lists a thing as last seen only once it is off screen, and records a sighting at a new place as a verified move", () => {
    const m = new HeroMemory("Coco");
    const a = obs({ player: "coco", tick: 100, origin: [0, 0], rows: [OPEN, OPEN], self: [1.5, 0.5], visible: [cow(5, 1)] });
    m.observe(a);
    // Still on screen: in observation.visible, not in last_seen_things.
    expect(m.view(a).last_seen_things).toEqual([]);
    const away = obs({ player: "coco", tick: 160, origin: [20, 0], rows: [OPEN, OPEN], self: [21.5, 0.5] });
    m.observe(away);
    expect(m.view(away).last_seen_things).toEqual([{ kind: "creature", name: "cow", area: "Test Field", x: 5, y: 1, seen_at_tick: 100, seconds_ago: 1 }]);
    const back = obs({ player: "coco", tick: 400, origin: [0, 0], rows: [OPEN, OPEN], self: [1.5, 0.5], visible: [cow(2.5, 1)] });
    m.observe(back);
    const v = m.view(back);
    expect(v.last_seen_things).toEqual([]);
    expect(v.verified_events).toEqual([{ id: 1, source: "your screen", area: "Test Field", text: "cow (creature): first seen at (5, 1) at tick 100; seen at (2.5, 1) at tick 400.", tick: 400, first_tick: 100 }]);
  });

  it("drops a remembered thing when the screen shows its place again without it", () => {
    const m = new HeroMemory("Coco");
    m.observe(obs({ player: "coco", tick: 100, origin: [0, 0], rows: [OPEN], self: [1.5, 0.5], visible: [{ kind: "enemy", name: "wolf", x: 6, y: 0.5 }] }));
    m.observe(obs({ player: "coco", tick: 200, origin: [20, 0], rows: [OPEN], self: [21.5, 0.5] }));
    expect(m.size().things).toBe(1);
    const back = obs({ player: "coco", tick: 300, origin: [0, 0], rows: [OPEN], self: [1.5, 0.5] });
    m.observe(back);
    expect(m.view(back).last_seen_things).toEqual([]);
    // An enemy disappearing is not recorded as defeated or moved: nothing was seen happen.
    expect(m.verifiedEvents()).toEqual([]);
  });

  it("ignores projectiles and effects", () => {
    const m = new HeroMemory("Sieg");
    m.observe(obs({ tick: 10, origin: [0, 0], rows: [OPEN], self: [1.5, 0.5], visible: [{ kind: "projectile", name: "fireball", x: 3, y: 0 }, { kind: "effect", name: "black hole", x: 4, y: 0 }] }));
    expect(m.size().things).toBe(0);
  });
});

describe("SYNTHETIC: verified events", () => {
  it("records a terrain change between two views of the same tiles, and a later change supersedes it", () => {
    const m = new HeroMemory("Coco");
    m.observe(obs({ player: "coco", tick: 100, origin: [0, 0], rows: ["..##..", "..##.."], self: [0.5, 0.5] }));
    m.observe(obs({ player: "coco", tick: 200, origin: [0, 0], rows: ["......", "......"], self: [0.5, 0.5] }));
    expect(m.verifiedEvents().map((e) => e.text)).toEqual(['4 tiles at x 2–3, y 0–1 changed from "#" (blocked) to "." (open) between your views at tick 100 and tick 200.']);
    // Seen again much later, unchanged: still a fact, not repeated.
    for (let t = 300; t < 3000; t += 100) m.observe(obs({ player: "coco", tick: t, origin: [0, 0], rows: ["......", "......"], self: [0.5, 0.5] }));
    expect(m.verifiedEvents()).toHaveLength(1);
    m.observe(obs({ player: "coco", tick: 3100, origin: [0, 0], rows: ["...#..", "......"], self: [0.5, 0.5] }));
    const [first, second] = m.verifiedEvents();
    expect(first.supersededBy).toBe(second.id);
    expect(second.text).toBe('1 tile at x 3, y 0 changed from "." (open) to "#" (blocked) between your views at tick 2900 and tick 3100.');
  });

  it("keeps game feedback lines once, counted, with first and last tick, and skips routine action-mechanics lines", () => {
    const m = new HeroMemory("Sieg");
    const at = (tick: number, feedback: string[]) => m.observe(obs({ tick, origin: [0, 0], rows: [OPEN], self: [0.5, 0.5], feedback }));
    at(10, ["Message sent.", "You moved e only 1 of 3 tiles, from (1, 1) to (2, 1). Something stopped you."]);
    at(20, ["Message sent.", "You moved e only 1 of 3 tiles, from (1, 1) to (2, 1). Something stopped you.", "The door at (4, 4) disappeared."]);
    at(30, ["Message sent.", "You moved e only 1 of 3 tiles, from (1, 1) to (2, 1). Something stopped you.", "The door at (4, 4) disappeared."]);
    at(40, ["You moved e only 1 of 3 tiles, from (1, 1) to (2, 1). Something stopped you.", "The door at (4, 4) disappeared.", "Select the correct key.", "Select the correct key."]);
    expect(m.verifiedEvents().map((e) => [e.text, e.count, e.firstTick, e.lastTick])).toEqual([
      ["The door at (4, 4) disappeared.", 1, 20, 20],
      ["Select the correct key.", 2, 40, 40],
    ]);
  });

  it("never records an accepted action as an effect in the world", () => {
    const m = new HeroMemory("Coco");
    const a = obs({ player: "coco", tick: 10, origin: [0, 0], rows: [OPEN], self: [0.5, 0.5] });
    m.observe(a);
    const fire: StepResult = { accepted: true, ticks: 1, attack: "performed", feedback: [], done: false };
    m.recordTurn({ steps: [{ action: { type: "attack", direction: "e" }, result: fire, status: "executed" }, { action: { type: "interact" }, result: { accepted: true, ticks: 0, feedback: [], done: false }, status: "executed" }], skipped: [] }, a);
    m.observe(obs({ player: "coco", tick: 12, origin: [0, 0], rows: [OPEN], self: [0.5, 0.5] }));
    expect(m.verifiedEvents()).toEqual([]);
  });
});

describe("SYNTHETIC: sent messages", () => {
  it("records only executed message actions, from this hero to the partner, with the tick of the observation they answered", () => {
    const m = new HeroMemory("Coco");
    const a = obs({ player: "coco", tick: 500, origin: [0, 0], rows: [OPEN], self: [0.5, 0.5] });
    const mid = obs({ player: "coco", tick: 530, origin: [0, 0], rows: [OPEN], self: [0.5, 0.5] });
    m.observe(a);
    const sent = (text: string, status: "executed" | "rejected", after?: Observation): TurnReport["steps"][number] => ({
      action: { type: "message", text } as GameAction,
      result: { accepted: status === "executed", ticks: 0, feedback: [], done: false },
      status,
      ...(after ? { after } : {}),
    });
    m.recordTurn({ steps: [{ action: { type: "wait", ticks: 30 }, result: { accepted: true, ticks: 30, feedback: [], done: false }, status: "executed", after: mid }, sent("burned it", "executed"), sent("refused one", "rejected")], skipped: [{ action: { type: "message", text: "never sent" }, reason: "feedback" }] }, a);
    expect(m.sentMessages()).toEqual([{ from: "Coco", to: "Sieg", text: "burned it", tick: 530 }]);
  });
});

describe("SYNTHETIC: isolation, reset and bounds", () => {
  it("refuses another hero's observation", () => {
    expect(() => new HeroMemory("Sieg").observe(obs({ player: "coco", tick: 1, origin: [0, 0], rows: [OPEN], self: [0.5, 0.5] }))).toThrow(/Sieg's memory was given Coco's observation/);
  });

  it("starts over when game time goes back (a new episode)", () => {
    const m = new HeroMemory("Sieg");
    m.observe(obs({ tick: 900, origin: [0, 0], rows: ["##", "##"], self: [0.5, 0.5], feedback: ["Something happened."] }));
    expect(m.size()).toMatchObject({ areas: 1, events: 1 });
    m.observe(obs({ tick: 5, origin: [10, 0], rows: [".."], self: [10.5, 0.5] }));
    expect(m.terrainAt("Test Field", 0, 0)).toBe("?");
    expect(m.size()).toMatchObject({ areas: 1, events: 0, sent: 0 });
  });

  it("stays within its limits however long the episode runs", () => {
    const m = new HeroMemory("Sieg");
    let last!: Observation;
    for (let t = 1; t <= 600; t++) {
      last = obs({
        tick: t * 10,
        area: `Area ${t % 12}`,
        origin: [t % 20, 0],
        rows: [t % 2 ? "##########" : OPEN, OPEN],
        self: [(t % 20) + 0.5, 0.5],
        visible: Array.from({ length: 5 }, (_, k) => ({ kind: "creature" as const, name: `beast ${t}-${k}`, x: (t % 20) + k, y: 1 })),
        feedback: [`Unique event number ${t}.`],
      });
      m.observe(last);
      m.recordTurn({ steps: [{ action: { type: "message", text: `hello ${t}` }, result: { accepted: true, ticks: 0, feedback: [], done: false }, status: "executed" }], skipped: [] }, last);
    }
    const size = m.size();
    expect(size.areas).toBeLessThanOrEqual(MEMORY_LIMITS.areas);
    expect(size.things).toBeLessThanOrEqual(MEMORY_LIMITS.things);
    expect(size.events).toBeLessThanOrEqual(MEMORY_LIMITS.events);
    expect(size.sent).toBe(MEMORY_LIMITS.sent);
    expect(JSON.stringify(m.view(last)).length).toBeLessThan(12_000);
  });
});

// ── Real play on S2-local (no fixture) ───────────────────────────────────

/**
 * REAL PLAY: plays both heroes' scripts as the runner would (the pattern of
 * pilot6Fixes.test.ts: a waiting dialogue line is moved on, and a hero with
 * nothing left waits one tick while the other acts). After every step that
 * hero's memory takes in its own result and its own observation; nothing
 * else reaches it. `after` runs once both heroes have finished each round.
 */
async function drive(env: AgentEnvironment, mem: Record<PlayerId, HeroMemory>, script: Partial<Record<PlayerId, GameAction[]>>, after?: () => Promise<void>) {
  const ids: PlayerId[] = ["sieg", "coco"];
  const queue: Record<PlayerId, GameAction[]> = { sieg: [...(script.sieg ?? [])], coco: [...(script.coco ?? [])] };
  const busy = new Map<PlayerId, Promise<void>>();
  for (let guard = 0; guard < 5000; guard++) {
    if ((await env.outcome()).status !== "ongoing") break;
    for (const id of ids) {
      if (busy.has(id)) continue;
      const other = id === "sieg" ? "coco" : "sieg";
      let action: GameAction | undefined;
      if ((await env.legal_actions(id)).some((x) => x.type === "advance_dialogue")) action = { type: "advance_dialogue" };
      else if (queue[id].length) action = queue[id].shift();
      else if (queue[other].length || busy.has(other)) action = { type: "wait", ticks: 1 };
      if (!action) continue;
      const before = await env.observe(id);
      const a = action;
      busy.set(id, env.step(id, a).then(async (result) => {
        mem[id].recordTurn({ steps: [{ action: a, result, status: result.accepted ? "executed" : result.stale ? "stale" : "rejected" }], skipped: [] }, before);
        mem[id].observe(await env.observe(id));
        busy.delete(id);
      }));
    }
    if (!busy.size) break;
    await Promise.race(busy.values());
    await new Promise((r) => setTimeout(r, 0));
    await after?.();
  }
}

describe("REAL PLAY: fog of war and separate memories on S2-local", () => {
  it("holds only tiles each hero's own screen showed, never the partner's view or unseen map", async () => {
    const env = environmentFor("S2-local");
    await env.reset(0);
    const mem = { sieg: new HeroMemory("Sieg"), coco: new HeroMemory("Coco") };
    const shown: Record<PlayerId, Set<string>> = { sieg: new Set(), coco: new Set() };
    const record = async () => {
      for (const p of ["sieg", "coco"] as PlayerId[]) {
        const o = await env.observe(p);
        o.screen.rows.forEach((row, r) => [...row].forEach((ch, c) => ch !== " " && shown[p].add(`${o.screen.originX + c},${o.screen.originY + r}`)));
      }
    };
    for (const p of ["sieg", "coco"] as PlayerId[]) mem[p].observe(await env.observe(p));
    await record();
    // Sieg walks east along the entrance row; Coco stays put.
    await drive(env, mem, { sieg: Array.from({ length: 6 }, () => ({ type: "move", direction: "e", ticks: 40 }) as GameAction) }, record);
    const o = await env.observe("sieg");
    const { widthTiles: w, heightTiles: h, name } = o.area;
    expect(name).toBe("Hedge Maze");
    let sawOnlySieg = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const key = `${x},${y}`;
        for (const p of ["sieg", "coco"] as PlayerId[]) {
          const t = mem[p].terrainAt(name, x, y)!;
          // A tile is remembered only if this hero's own screen showed it.
          if (!shown[p].has(key)) expect(t, `${p} ${key}`).toBe("?");
          else expect(t, `${p} ${key}`).not.toBe("?");
        }
        if (shown.sieg.has(key) && !shown.coco.has(key)) sawOnlySieg++;
      }
    // Sieg's walk showed him tiles Coco never saw, and none of them reached her memory.
    expect(sawOnlySieg).toBeGreaterThan(20);
    // Most of the maze was never on either screen and stays unknown.
    const unknown = Array.from({ length: w * h }, (_, i) => mem.sieg.terrainAt(name, i % w, Math.floor(i / w))).filter((t) => t === "?").length;
    expect(unknown).toBeGreaterThan((w * h) / 2);
    // Sieg walked; Coco did not walk where Sieg went.
    expect(mem.sieg.walkedAt(name, Math.floor(o.self.x), Math.floor(o.self.y))).toBe(true);
    expect(mem.coco.walkedAt(name, Math.floor(o.self.x), Math.floor(o.self.y))).toBe(false);
    }, 30_000);

  it("the memory engine imports types only: it has no way to read World, the room or map data", () => {
    const src = readFileSync("packages/agent/src/heroMemory.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*import\s/.test(l));
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) expect(l).toMatch(/^import type /);
    const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/shared\/src|server\/src|GameRoom|World\b|hedgeMaze|mazePaths|collisionRects|perception/);
  });
});

describe("FIXTURE: a real Black Hole pull, as Coco's memory records it", () => {
  const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
  const heroOf = (env: AgentEnvironment, id: PlayerId) => Object.values(roomOf(env).state.players).find((p) => p.role === (id === "sieg" ? "OATH" : "EMBER"))!;
  it("keeps the game's cow line as a verified event and the cow's sightings with their ticks, and Sieg's memory gets none of it", async () => {
    // FIXTURE (as pilot6Fixes.test.ts): both heroes moved into the maze and placed.
    const env = new AgentEnvironment({ preset: "milestone" });
    await env.reset(0);
    roomOf(env).transition("HEDGE_MAZE");
    Object.assign(heroOf(env, "sieg"), { x: 5 * TILE, y: 34 * TILE });
    Object.assign(heroOf(env, "coco"), { x: 24.4 * TILE, y: 27.45 * TILE });
    const mem = { sieg: new HeroMemory("Sieg"), coco: new HeroMemory("Coco") };
    for (const p of ["sieg", "coco"] as PlayerId[]) mem[p].observe(await env.observe(p));
    const waits = (n: number) => Array.from({ length: n }, () => ({ type: "wait", ticks: 60 }) as GameAction);
    await drive(env, mem, { sieg: waits(5), coco: [{ type: "ability", ability: "black_hole", direction: "nw" }, ...waits(4)] });
    const o = await env.observe("coco");
    const cow = o.visible.find((v) => v.name === "cow")!;
    expect(cow.x).toBeLessThan(26);
    const texts = mem.coco.verifiedEvents().map((e) => e.text);
    expect(texts.some((t) => /^The cow moved /.test(t))).toBe(true);
    // The cow was on Coco's screen throughout, so it is not "last seen" but current.
    expect(mem.coco.view(o).last_seen_things.find((t) => t.name === "cow")).toBeUndefined();
    // Sieg, at the entrance, saw none of it.
    expect(mem.sieg.verifiedEvents().map((e) => e.text).join(" ")).not.toMatch(/cow/);
    expect(JSON.stringify(mem.coco.view(o))).not.toMatch(/parked|cleared/i);
    }, 30_000);
});

// ── The model-memory player and compatibility ───────────────────────────

/** Records what it is sent; Sieg and Coco get different, recognisable notes and messages. */
class TwoHeroes implements Gateway {
  readonly label = "mock:two";
  calls: { hero: string; system: string; user: string }[] = [];
  worstCaseUsd() {
    return 0.0001;
  }
  async complete(system: string, user: string): Promise<Completion> {
    const hero = system.startsWith("You are playing the cooperative game Oath and Ember as Sieg") ? "Sieg" : "Coco";
    this.calls.push({ hero, system, user });
    const n = this.calls.filter((c) => c.hero === hero).length;
    const text = n === 1
      ? JSON.stringify({ notes: `${hero.toUpperCase()}-PRIVATE-NOTE`, actions: [{ type: "message", text: `${hero} says hello` }, { type: "move", direction: hero === "Sieg" ? "e" : "s", ticks: 30 }] })
      : JSON.stringify({ actions: [{ type: "move", direction: "e", ticks: 30 }, { type: "wait", ticks: 20 }] });
    return { text, tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}
const setup = (gateway: Gateway): ModelSetup => ({ gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 });

describe("the model-memory player", () => {
  it("is its own player kind, named ·memory, and refused for final runs and outside S1-S3", () => {
    const g = new TwoHeroes();
    const p = policiesFor("model-memory", new ModelBudget(defaultBudgetLimits), setup(g), "S2-local");
    expect(policyKind(p)).toBe("model-memory");
    expect(p.sieg.name).toMatch(/·memory·/);
    expect(p.sieg).not.toBe(p.coco);
    expect(policyKind(policiesFor("model-history", new ModelBudget(defaultBudgetLimits), setup(g), "S2-local"))).toBe("model-history");
    expect(() => validatePlan({ player: "model-memory", situations: ["S2-local"], seeds: [0], model: setup(g) })).not.toThrow();
    expect(() => validatePlan({ player: "model-memory", situations: ["S4"], seeds: [100], final: true, model: { ...setup(g), stage: "final" } })).toThrow(/model-memory is restricted|held out/);
    expect(() => validatePlan({ player: "model-memory", situations: ["S2-local"], seeds: [100], final: true, model: { ...setup(g), stage: "final" } })).toThrow(/model-memory is restricted/);
  });

  it("gives each hero its own memory, its own sent messages, and never the partner's notes or screens", async () => {
    const gateway = new TwoHeroes();
    const budget = new ModelBudget(defaultBudgetLimits);
    const policies = policiesFor("model-memory", budget, setup(gateway), "S2-local");
    const env = environmentFor("S2-local", { limits: { maxDecisionsPerPlayer: 12 } });
    const { runEpisode } = await import("../src/runner.js");
    const { TraceWriter } = await import("../src/trace.js");
    await runEpisode(env, policies, new TraceWriter(), { seed: 0, wallClockMs: 60_000, budget });
    for (const hero of ["Sieg", "Coco"]) {
      const partner = hero === "Sieg" ? "Coco" : "Sieg";
      const mine = gateway.calls.filter((c) => c.hero === hero);
      expect(mine.length).toBeGreaterThan(2);
      for (const c of mine) expect(c.user).not.toContain(`${partner.toUpperCase()}-PRIVATE-NOTE`);
      const later = JSON.parse(mine.at(-1)!.user);
      expect(later.memory.recent_sent_messages).toEqual([{ from: hero, to: partner, text: `${hero} says hello`, tick: expect.any(Number) }]);
      // Received messages keep their meaning: only what the partner sent.
      expect(later.observation.messages.map((m: { from: string; text: string }) => [m.from, m.text])).toEqual([[partner, `${partner} says hello`]]);
      expect(later.memory.remembered_map.area).toBe("Hedge Maze");
      expect(later.memory.remembered_map.rows.join("\n")).toContain("@");
      expect(Object.keys(later)).toEqual(["your_notes", "completed_actions", "recent_rejected_actions", "last_turn", "memory", "observation", "legal_actions"]);
    }
  });

  it("is deterministic: the same seed gives the same prompts, and its memory is fresh each episode", async () => {
    const a = await capturePrompts("model-memory", 24);
    const b = await capturePrompts("model-memory", 24);
    expect(promptDigest(a.gateway.calls)).toEqual(promptDigest(b.gateway.calls));
    const first = JSON.parse(a.gateway.calls.find((c) => c.hero === "Sieg")!.user);
    expect(first.memory.recent_sent_messages).toEqual([]);
    expect(first.memory.verified_events).toEqual([]);
  });

  it("explains memory only in its own prompt, with no game content, coordinates or advice on where to go", () => {
    const history = systemPrompt("Sieg", "MANUAL", 4, "history");
    const memory = systemPrompt("Sieg", "MANUAL", 4, "persistent");
    expect(history).not.toContain(MEMORY_SECTION);
    expect(memory).toContain(MEMORY_SECTION);
    expect(memory.replace(MEMORY_SECTION, "")).toBe(history);
    expect(MEMORY_SECTION).not.toMatch(/\d/);
    expect(MEMORY_SECTION).not.toMatch(/hedge|cow|wolf|key|gate|fireball|black hole|maze|mirror|griffin|shrine|north|south|east|west/i);
    expect(replySchema(4, "persistent")).toEqual(replySchema(4, "history"));
  });
});

describe("compatibility: existing model players are unchanged", () => {
  // Pinned from 346cdd4 and 3b7115b, before the model-memory change (this
  // session): every system and user message of a scripted 40-decision
  // S2-local seed-0 episode. Never update these to make a test pass.
  it("model-history sends exactly the same prompts as before", async () => {
    const c = await capturePrompts("model-history", 40);
    expect(promptDigest(c.gateway.calls)).toEqual({ sieg: "97349d30e0a20a26", coco: "41d7ef253328e3e2", calls: 82 });
  });
  it("model-obs-only sends exactly the same prompts as before", async () => {
    const c = await capturePrompts("model-obs-only", 40);
    expect(promptDigest(c.gateway.calls)).toEqual({ sieg: "db8e03e513c8297f", coco: "18e8d8b20fd42496", calls: 82 });
  });
  it("an LLMPlayer in history mode has no memory field and the same name as before", () => {
    const p = new LLMPlayer("Coco", "MANUAL", new MeteredGateway(new TwoHeroes(), new ModelBudget(defaultBudgetLimits), "coco"));
    expect(p.name).toBe("llm(mock:two)·batch4");
    expect(p.memory).toBe("history");
  });
});
