// Regression tests for the pilot-6 fixes (owner approval 2026-10-28; audit
// docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-pilot6-fixes.md):
// movement outcomes, the cow and its fixed sign, the hero's position, and
// the prompt lines that every scenario shares. Offline: no provider request.
// Moving both heroes into the Hedge Maze and placing them is a LABELLED TEST
// FIXTURE (room.transition and positions only). Every outcome below then comes
// from real inputs through env.step and the server's own rules.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { maps } from "../../shared/src/maps.js";
import { batchStop } from "../src/batch.js";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { AgentEnvironment } from "../src/environment.js";
import { policiesFor, type ModelSetup } from "../src/harness.js";
import { movementLines, movementReport, newTally, openGroundStep, tallyApplied } from "../src/movementReport.js";
import { TILE, truncate2 } from "../src/perception.js";
import { asTuned } from "../src/policies/navigate.js";
import { LLMPlayer, systemPrompt } from "../src/policies/llm.js";
import { S2_BRIEFING, type SituationId } from "../src/suite.js";
import type { GameAction, MovementReport, Observation, PlayerId, StepResult } from "../src/types.js";

const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
const hero = (env: AgentEnvironment, id: PlayerId) =>
  Object.values(roomOf(env).state.players).find((p) => p.role === (id === "sieg" ? "OATH" : "EMBER"))!;
const MOVE_LINE = /You did not move|You moved .* only/;

/** Plays both heroes' scripts as the runner would (see s2Feedback.test.ts). */
async function play(env: AgentEnvironment, script: Partial<Record<PlayerId, GameAction[]>>) {
  const ids: PlayerId[] = ["sieg", "coco"];
  const queue: Record<PlayerId, GameAction[]> = { sieg: [...(script.sieg ?? [])], coco: [...(script.coco ?? [])] };
  const out: Record<PlayerId, StepResult[]> = { sieg: [], coco: [] };
  const busy = new Map<PlayerId, Promise<void>>();
  for (let guard = 0; guard < 5000; guard++) {
    if ((await env.outcome()).status !== "ongoing") break;
    for (const id of ids) {
      if (busy.has(id)) continue;
      const other = id === "sieg" ? "coco" : "sieg";
      let action: GameAction | undefined;
      let scripted = false;
      if ((await env.legal_actions(id)).some((x) => x.type === "advance_dialogue")) action = { type: "advance_dialogue" };
      else if (queue[id].length) [action, scripted] = [queue[id].shift(), true];
      else if (queue[other].length || busy.has(other)) action = { type: "wait", ticks: 1 };
      if (!action) continue;
      busy.set(id, env.step(id, action).then((r) => {
        if (scripted) out[id].push(r);
        busy.delete(id);
      }));
    }
    if (!busy.size) break;
    await Promise.race(busy.values());
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

/** FIXTURE: both heroes in the Hedge Maze at the given tile positions. */
async function inMaze(at: Record<PlayerId, { x: number; y: number }>, labels?: "as-drawn" | "names-only") {
  const env = new AgentEnvironment({ preset: "milestone", ...(labels ? { labels } : {}) });
  await env.reset(0);
  roomOf(env).transition("HEDGE_MAZE");
  for (const id of ["sieg", "coco"] as PlayerId[]) Object.assign(hero(env, id), { x: at[id].x * TILE, y: at[id].y * TILE });
  return env;
}
// Open floor of the maze's entrance row (paths [2,32,18,4] and [0,32,2,4]):
// open from x 0 to 18 and from y 32 to 36, away from the cow and the guards.
const ENTRANCE = { sieg: { x: 5, y: 34 }, coco: { x: 9, y: 34 } };
const WALK = 190 / 32 / 60; // tiles per tick at walking speed (SPEED 190 px/s)

describe("movement outcome on move results", () => {
  it("reports a clear move as full, with no extra feedback line, so a batch of clear moves continues", async () => {
    const env = await inMaze(ENTRANCE);
    const before = await env.observe("sieg");
    const [r] = (await play(env, { sieg: [{ type: "move", direction: "e", ticks: 30 }] })).sieg;
    expect(r).toMatchObject({ accepted: true, ticks: 30 });
    expect(r.movement).toMatchObject({ outcome: "full", from: { x: 5, y: 34 } });
    expect(r.movement!.requestedTiles).toBeCloseTo(30 * WALK, 1);
    expect(r.movement!.movedTiles).toBeCloseTo(30 * WALK, 1);
    expect(r.feedback.join(" ")).not.toMatch(MOVE_LINE);
    expect(batchStop(before, r, await env.observe("sieg"))).toBeUndefined();
  });

  it("measures open ground at the hero's real speed: Slow Time is not mistaken for a blocked move", async () => {
    const env = await inMaze(ENTRANCE);
    // Coco casts Slow Time (a real ability), then both walk east on open floor.
    const r = await play(env, {
      sieg: [{ type: "wait", ticks: 4 }, { type: "move", direction: "e", ticks: 30 }],
      coco: [{ type: "ability", ability: "slow_time" }, { type: "move", direction: "e", ticks: 30 }],
    });
    for (const id of ["sieg", "coco"] as PlayerId[]) {
      const move = r[id][1];
      expect(move.movement?.outcome, id).toBe("full");
      // One fifth of walking speed (manual: Slow Time runs movement at one fifth).
      expect(move.movement!.requestedTiles, id).toBeCloseTo((30 * WALK) / 5, 1);
      expect(move.feedback.join(" "), id).not.toMatch(MOVE_LINE);
    }
  });

  it("reports a move stopped partway as partial, and a move against the obstacle as none, without naming it", async () => {
    const env = await inMaze(ENTRANCE);
    // South from y 34: the hedge starts at y 36, so the body (half 13/32 tile) stops near y 35.59.
    const r = (await play(env, { sieg: [{ type: "move", direction: "s", ticks: 30 }, { type: "move", direction: "s", ticks: 30 }] })).sieg;
    expect(r[0].accepted).toBe(true);
    expect(r[0].movement).toMatchObject({ outcome: "partial", from: { x: 5, y: 34 } });
    expect(r[0].movement!.movedTiles).toBeCloseTo(36 - 13 / 32 - 34, 1);
    expect(r[0].movement!.requestedTiles).toBeCloseTo(30 * WALK, 1);
    const partial = r[0].feedback.find((l) => MOVE_LINE.test(l))!;
    expect(partial).toMatch(/^You moved s only [\d.]+ of [\d.]+ tiles, from \(5, 34\) to \(5, 35\.\d+\)\. Something stopped you\.$/);

    expect(r[1].accepted).toBe(true);
    expect(r[1].movement).toMatchObject({ outcome: "none", movedTiles: 0 });
    const none = r[1].feedback.find((l) => MOVE_LINE.test(l))!;
    expect(none).toMatch(/^You did not move s \(0 of [\d.]+ tiles\); you are still at \(5, 35\.\d+\)\. Something blocked your way\.$/);
    for (const line of [partial, none]) expect(line).not.toMatch(/hedge|wall|cow|tree|rock|edge|creature/i);
    // Such a line is feedback, so it stops a batch (batch.ts rule 4).
    const o = await env.observe("sieg");
    expect(batchStop(o, r[1], o)).toBe("feedback");
    // And it is in the hero's own recent feedback, never the partner's.
    expect((await env.observe("sieg")).feedback.some((l) => MOVE_LINE.test(l))).toBe(true);
    expect((await env.observe("coco")).feedback.some((l) => MOVE_LINE.test(l))).toBe(false);
  });

  it("only reports movement for move actions", async () => {
    const env = await inMaze(ENTRANCE);
    const r = (await play(env, { sieg: [{ type: "wait", ticks: 10 }, { type: "defend", ticks: 10 }, { type: "attack", direction: "w" }] })).sieg;
    for (const x of r) expect(x.movement).toBeUndefined();
  });

  it("measures open ground on a copy: the hero and the room are untouched", async () => {
    const env = await inMaze(ENTRANCE);
    const me = hero(env, "sieg");
    const room = JSON.stringify(roomOf(env).state);
    const step = openGroundStep(me, { moveX: 1, moveY: 0 }, maps.HEDGE_MAZE, false);
    expect(step).toBeCloseTo(190 / 60, 6);
    expect(JSON.stringify(roomOf(env).state)).toBe(room);
    // A hero at the very edge of the map still has open ground ahead in the replay.
    const edge = structuredClone(me);
    edge.x = 13;
    expect(openGroundStep(edge, { moveX: -1, moveY: 0 }, maps.HEDGE_MAZE, false)).toBeCloseTo(190 / 60, 6);
  });

  it("classifies by progress in the requested direction, and stays silent when nothing could move", () => {
    const at = (x: number, y: number) => ({ x: x * TILE, y: y * TILE });
    // One applied tick from (10, 10) to `to`, against `open` world units of open ground.
    const one = (d: "n" | "ne", to: { x: number; y: number }, open: number) => {
      const t = newTally();
      tallyApplied(t, d, at(10, 10), to, open);
      return movementReport(at(10, 10), to, t);
    };
    expect(one("n", at(10, 4), 6 * TILE).outcome).toBe("full");
    expect(one("n", at(10, 9), 6 * TILE).outcome).toBe("partial");
    // A sideways slide off a corner is movement, but no progress north.
    expect(one("n", at(10.3, 10), 6 * TILE)).toMatchObject({ outcome: "partial", movedTiles: 0 });
    expect(one("n", at(10, 10), 6 * TILE).outcome).toBe("none");
    expect(one("ne", at(14, 6), 4 * Math.SQRT2 * TILE).outcome).toBe("full");
    const still = one("n", at(10, 10), 0);
    expect(movementLines("n", still, at(10, 10), at(10, 10))).toEqual([]);
    // No applied tick at all: the input was never taken. Not a collision.
    const idle = newTally();
    idle.notApplied = 5;
    const r = movementReport(at(10, 10), at(10, 10), idle);
    expect(r).toMatchObject({ outcome: "not_applied", requestedTiles: 0, ticks: { applied: 0, notApplied: 5, movedByGame: 0 } });
    expect(movementLines("n", r, at(10, 10), at(10, 10))).toEqual(["For 5 of 5 ticks your hero did not take your movement input."]);
  });
});

describe("movement in the model's history", () => {
  class Capture implements Gateway {
    users: string[] = [];
    readonly label = "openai:test";
    worstCaseUsd() {
      return 0.001;
    }
    async complete(_system: string, user: string): Promise<Completion> {
      this.users.push(user);
      return { text: '{"actions":[{"type":"wait","ticks":5}]}', tokens: { input: 1, output: 1 }, costUsd: 0 };
    }
  }

  it("keeps each executed move's outcome in completed_actions", async () => {
    const env = await inMaze(ENTRANCE);
    const gateway = new Capture();
    const player = new LLMPlayer("Sieg", MANUAL, new MeteredGateway(gateway, new ModelBudget(defaultBudgetLimits), "sieg"));
    const movement: MovementReport = {
      outcome: "partial",
      movedTiles: 1.59,
      requestedTiles: 2.97,
      from: { x: 5, y: 34 },
      to: { x: 5, y: 35.59 },
      ticks: { applied: 30, notApplied: 0, movedByGame: 0 },
    };
    const result: StepResult = { accepted: true, ticks: 30, movement, feedback: ["You moved s only 1.59 of 2.97 tiles."], done: false };
    const action: GameAction = { type: "move", direction: "s", ticks: 30 };
    await player.decide({
      observation: await env.observe("sieg"),
      legal: await env.legal_actions("sieg"),
      batch: { steps: [{ action, result, status: "executed" }], skipped: [], stopped: "feedback" },
    });
    const sent = JSON.parse(gateway.users[0]);
    expect(sent.completed_actions).toEqual([{ action, ticks: 30, movement }]);
    expect(sent.last_turn.results[0].result.movement).toEqual(movement);
  });
});

describe("the cow and its sign, as the client draws them", () => {
  it("lists a neutral cow at its live position and the sign fixed where it is drawn, with no grid mark for the sign", async () => {
    const env = await inMaze({ sieg: { x: 25.5, y: 29.5 }, coco: { x: 26.5, y: 29.5 } });
    const o = await env.observe("sieg");
    const cow = o.visible.find((v) => v.kind === "creature" && v.name === "cow")!;
    expect(cow).toMatchObject({ x: 26, y: 25 });
    expect(cow.details).toBeUndefined();
    const sign = o.visible.find((v) => v.name === "Harmless cow · blocks the lane")!;
    expect(sign).toMatchObject({ kind: "object", x: 26, y: 27.7 });
    expect(o.visible.filter((v) => v.kind === "creature").map((v) => v.name)).not.toContain("Harmless cow · blocks the lane");
    // Tile (26, 27) under the sign is open floor and stays "." on the grid.
    expect(o.screen.rows[27 - o.screen.originY][26 - o.screen.originX]).toBe(".");
    expect(JSON.stringify(o)).not.toMatch(/parked|cleared/i);
  });

  it("after a real Black Hole pull, the cow is listed where it now is and the sign has not moved", async () => {
    // Coco casts north-west from the lane's south-west corner (as in pilot-6,
    // tick 2229). y 27.45: the server pulls the cow only while no hero is
    // within 77 px of it (hedgeMaze.ts), and 27.4 is 76.8 px away.
    const env = await inMaze({ sieg: { x: 5, y: 34 }, coco: { x: 24.4, y: 27.45 } });
    await play(env, {
      sieg: [{ type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }],
      coco: [{ type: "ability", ability: "black_hole", direction: "nw" }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }],
    });
    const o = await env.observe("coco");
    const cow = o.visible.find((v) => v.name === "cow")!;
    expect(cow.x).toBeLessThan(26);
    expect(o.visible.find((v) => v.name === "Harmless cow · blocks the lane")).toMatchObject({ x: 26, y: 27.7 });
    expect(JSON.stringify(o)).not.toMatch(/parked|cleared/i);
  });

  it("names-only mode keeps the cow neutral and names the sign without its text", async () => {
    const env = await inMaze({ sieg: { x: 25.5, y: 29.5 }, coco: { x: 26.5, y: 29.5 } }, "names-only");
    const names = (await env.observe("sieg")).visible.map((v) => v.name);
    expect(names).toContain("cow");
    expect(names).toContain("lane sign");
    expect(names.join(" ")).not.toMatch(/blocks the lane/);
  });
});

describe("the hero's position", () => {
  it("is truncated to two decimals, so its whole part is the cell '@' is drawn in", () => {
    expect(truncate2(25.996)).toBe(25.99);
    expect(truncate2(25.96)).toBe(25.96);
    // Exact truncation of the stored double: 0.29 is stored as 0.28999… (review fixes, 2026-10-28).
    expect(truncate2(0.29)).toBe(0.28);
    expect(truncate2(0.75)).toBe(0.75);
    expect(truncate2(26)).toBe(26);
    expect(truncate2(26 - 1e-12)).toBe(25.99);
  });

  it("matches the '@' cell on screen even just short of a tile edge (pilot-6: 25.96 was shown as 26)", async () => {
    for (const x of [25.96, 25.996, 25.5, 26.01]) {
      const env = await inMaze({ sieg: { x, y: 29.5 }, coco: { x: 5, y: 34 } });
      const o = await env.observe("sieg");
      expect(o.self.x, String(x)).toBe(truncate2(x));
      const row = o.screen.rows[Math.floor(o.self.y) - o.screen.originY];
      expect(row.indexOf("@"), String(x)).toBe(Math.floor(o.self.x) - o.screen.originX);
    }
  });

  it("is rounded back to one decimal for the scripted players, as they were tuned (frozen behaviour)", () => {
    const o = (x: number, y: number) => ({ self: { x, y } }) as unknown as Observation;
    expect(asTuned(o(25.96, 27.44)).self).toMatchObject({ x: 26, y: 27.4 });
    expect(asTuned(o(25.95, 27.45)).self).toMatchObject({ x: 26, y: 27.5 });
    expect(asTuned(o(25.94, 0.04)).self).toMatchObject({ x: 25.9, y: 0 });
  });
});

describe("prompt lines shared by every scenario and provider", () => {
  const COMMUNICATE = "Tell your partner when your plan changes or when you observe an important change in the world.";
  class Recording implements Gateway {
    systems: string[] = [];
    constructor(readonly label: string) {}
    worstCaseUsd() {
      return 0.001;
    }
    async complete(system: string): Promise<Completion> {
      this.systems.push(system);
      return { text: '{"actions":[{"type":"wait","ticks":5}]}', tokens: { input: 1, output: 1 }, costUsd: 0 };
    }
  }
  const setup = (gateway: Gateway): ModelSetup => ({ gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 });
  async function systems(id: SituationId, label: string, kind: "model-history" | "model-obs-only" = "model-history") {
    const g = new Recording(label);
    const policies = policiesFor(kind, new ModelBudget(defaultBudgetLimits), setup(g), id);
    const env = new AgentEnvironment({ preset: "milestone" });
    await env.reset(0);
    for (const pid of ["sieg", "coco"] as PlayerId[]) await policies[pid].decide({ observation: await env.observe(pid), legal: await env.legal_actions(pid) });
    return g.systems;
  }

  it("gives the communication line and the screen legend to both heroes in every tuning scenario, for both providers and both memories", async () => {
    // Only the prompt is built; no episode is run, and S4/F are not touched.
    for (const id of ["S1", "S2", "S3"] as SituationId[])
      for (const label of ["openai:gpt-6-luna@medium", "anthropic:claude-haiku-5-5@medium"])
        for (const kind of ["model-history", "model-obs-only"] as const) {
          const [sieg, coco] = await systems(id, label, kind);
          for (const s of [sieg, coco]) {
            expect(s, `${id} ${label} ${kind}`).toContain(COMMUNICATE);
            expect(s).toContain("Your body is a square about 0.8 tiles wide");
            expect(s).toContain("cut off rather than rounded");
            expect(s.includes("=== Episode briefing ==="), id).toBe(id === "S2");
          }
        }
  });

  it("keeps the general prompt free of scenario content", () => {
    for (const hero of ["Sieg", "Coco"] as const)
      for (const memory of ["history", "none"] as const) {
        const s = systemPrompt(hero, MANUAL, 4, memory).replace(MANUAL, "");
        expect(s.split(COMMUNICATE).length, `${hero} ${memory}`).toBe(2);
        expect(s).not.toMatch(/Mirror Pond|Hedge Maze|Bridge Ruins|Vanity Mirror|cow|grazing/i);
      }
    expect(systemPrompt("Sieg", MANUAL, 4, "none")).not.toContain("A move's result includes movement");
    expect(systemPrompt("Sieg", MANUAL, 4, "history")).toContain("A move's result includes movement");
  });

  it("revises the S2 briefing as approved: only the shrine's START / RETURN sign is out of scope; no route given", () => {
    expect(S2_BRIEFING).toContain('Only the shrine\'s "START / RETURN · E · Puzzle Map 2" sign leads back to it.');
    expect(S2_BRIEFING).toContain("Every other area's RETURN exit leads back to the shrine. You may use those exits.");
    expect(S2_BRIEFING).toMatch(/Hedge Maze, is not a failure/);
    expect(S2_BRIEFING).toContain("Only the Vanity Mirror completes this episode.");
    expect(S2_BRIEFING).not.toMatch(/do not return/i);
    expect(S2_BRIEFING).not.toMatch(/\b(north|south|east|west|left|right|up|down)\b|\(\s*\d/i);
  });
});
