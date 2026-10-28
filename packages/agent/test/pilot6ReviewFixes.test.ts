// Regression tests for the pilot-6 review findings 1, 2 and 6 (owner approval
// 2026-10-28; review docs/midterm/agent-evidence/reviews/2026-10-28-pilot6-fixes-rules-review.md;
// audit docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-pilot6-review-fixes.md).
// Offline. Moving heroes into an area and placing them is a LABELLED TEST
// FIXTURE (room.transition and positions only). Two tests reach an engine state
// through a labelled fixture: a partner marked disconnected (the server then
// skips movement for that tick) and the server's own reconnect handler. Every
// outcome is read from what the server did.
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { shrinePoints } from "../../shared/src/shrine.js";
import { AgentEnvironment } from "../src/environment.js";
import { environmentFor } from "../src/suite.js";
import { TILE } from "../src/perception.js";
import type { GameAction, PlayerId, StepResult } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
const hero = (env: AgentEnvironment, id: PlayerId) =>
  Object.values(roomOf(env).state.players).find((p) => p.role === (id === "sieg" ? "OATH" : "EMBER"))!;
const COLLISION = /You did not move|You moved .* only/;
const NOT_TAKEN = /did not take your movement input/;
const GAME_MOVED = /the game moved your hero/;
const WALK = 190 / 32 / 60; // tiles per tick at walking speed
const wait = (ticks: number): GameAction => ({ type: "wait", ticks });

/** Plays both heroes' scripts as the runner would (see s2Feedback.test.ts). */
async function play(env: AgentEnvironment, script: Partial<Record<PlayerId, GameAction[]>>, between?: (id: PlayerId, k: number) => void) {
  const ids: PlayerId[] = ["sieg", "coco"];
  const queue: Record<PlayerId, GameAction[]> = { sieg: [...(script.sieg ?? [])], coco: [...(script.coco ?? [])] };
  const out: Record<PlayerId, StepResult[]> = { sieg: [], coco: [] };
  const busy = new Map<PlayerId, Promise<void>>();
  for (let guard = 0; guard < 20000; guard++) {
    if ((await env.outcome()).status !== "ongoing") break;
    for (const id of ids) {
      if (busy.has(id)) continue;
      const other = id === "sieg" ? "coco" : "sieg";
      let action: GameAction | undefined;
      let scripted = false;
      if ((await env.legal_actions(id)).some((x) => x.type === "advance_dialogue")) action = { type: "advance_dialogue" };
      else if (queue[id].length) [action, scripted] = [queue[id].shift(), true];
      else if (queue[other].length || busy.has(other)) action = wait(1);
      if (!action) continue;
      if (scripted) between?.(id, out[id].length);
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
async function inMaze(at: Record<PlayerId, { x: number; y: number }>) {
  const env = new AgentEnvironment({ preset: "milestone" });
  await env.reset(0);
  roomOf(env).transition("HEDGE_MAZE");
  for (const id of ["sieg", "coco"] as PlayerId[]) Object.assign(hero(env, id), { x: at[id].x * TILE, y: at[id].y * TILE });
  return env;
}
// Open floor of the maze's entrance row: x 0–18, y 32–36 (hedge from y 36).
const ENTRANCE = { sieg: { x: 5, y: 34 }, coco: { x: 9, y: 34 } };
const lines = (r: StepResult, re: RegExp) => r.feedback.filter((l) => re.test(l));
/** Every tick of a move is sorted exactly once. */
const sorted = (r: StepResult) => r.movement!.ticks.applied + r.movement!.ticks.notApplied + r.movement!.ticks.movedByGame;

describe("Slow Time and movement outcomes (review finding 1)", () => {
  for (const ticks of [10, 30])
    it(`a ${ticks}-tick open-ground move starting on the tick Slow Time begins is full (reproduces the confirmed false "partial")`, async () => {
      const env = await inMaze(ENTRANCE);
      const r = await play(env, { sieg: [{ type: "move", direction: "e", ticks }], coco: [{ type: "ability", ability: "slow_time" }] });
      const move = r.sieg[0];
      expect(roomOf(env).state.slowTime).toBeTruthy();
      expect(move.movement).toMatchObject({ outcome: "full", ticks: { applied: ticks, notApplied: 0, movedByGame: 0 } });
      // Every tick ran slowed, at one fifth of walking speed.
      expect(move.movement!.requestedTiles).toBeCloseTo((ticks * WALK) / 5, 1);
      expect(move.movement!.movedTiles).toBe(move.movement!.requestedTiles);
      expect(lines(move, COLLISION)).toEqual([]);
    });

  it("an open-ground move spanning the end of Slow Time is full", async () => {
    const env = await inMaze(ENTRANCE);
    const room = roomOf(env);
    // Long waits for both heroes (the milestone preset allows 400 decisions per hero).
    const waits = [...Array.from({ length: 9 }, () => wait(60)), wait(43)];
    const r = await play(env, { sieg: [wait(2), ...waits], coco: [{ type: "ability", ability: "slow_time" }, ...waits] });
    expect(r.sieg.length).toBe(11);
    const left = room.state.slowTime!.endsTick - room.state.serverTick;
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(30);
    const [move] = (await play(env, { sieg: [{ type: "move", direction: "e", ticks: 30 }] })).sieg;
    expect(room.state.slowTime).toBeUndefined();
    expect(move.movement?.outcome).toBe("full");
    // Part slowed, part at walking speed.
    expect(move.movement!.requestedTiles).toBeGreaterThan((30 * WALK) / 5);
    expect(move.movement!.requestedTiles).toBeLessThan(30 * WALK);
    expect(lines(move, COLLISION)).toEqual([]);
  }, 60_000);

  it("a genuine collision under Slow Time is still reported, first partial, then none", async () => {
    // From y 35 south: the body (half 13/32) meets the hedge at y 36 after 0.59 tiles.
    const env = await inMaze({ sieg: { x: 5, y: 35 }, coco: { x: 9, y: 34 } });
    const r = await play(env, {
      sieg: [{ type: "move", direction: "s", ticks: 60 }, { type: "move", direction: "s", ticks: 60 }],
      coco: [{ type: "ability", ability: "slow_time" }],
    });
    expect(roomOf(env).state.slowTime).toBeTruthy();
    expect(r.sieg[0].movement).toMatchObject({ outcome: "partial" });
    expect(r.sieg[0].movement!.requestedTiles).toBeCloseTo((60 * WALK) / 5, 1);
    expect(r.sieg[0].movement!.movedTiles).toBeCloseTo(36 - 13 / 32 - 35, 1);
    expect(lines(r.sieg[0], COLLISION)).toHaveLength(1);
    expect(r.sieg[1].movement).toMatchObject({ outcome: "none", movedTiles: 0 });
    expect(lines(r.sieg[1], COLLISION)).toHaveLength(1);
  });
});

describe("Super Speed", () => {
  it("counts double walking speed on open ground, and Sieg keeps normal speed under Slow Time while Coco is slowed", async () => {
    const env = await inMaze({ sieg: { x: 3, y: 33 }, coco: { x: 3, y: 35 } });
    const fast = await play(env, { sieg: [{ type: "ability", ability: "super_speed" }, { type: "move", direction: "e", ticks: 20 }] });
    expect(fast.sieg[1].movement?.outcome).toBe("full");
    expect(fast.sieg[1].movement!.requestedTiles).toBeCloseTo(2 * 20 * WALK, 1);
    const slowed = await play(env, {
      sieg: [wait(2), { type: "move", direction: "e", ticks: 20 }],
      coco: [{ type: "ability", ability: "slow_time" }, { type: "move", direction: "e", ticks: 20 }],
    });
    expect(slowed.sieg[1].movement?.outcome).toBe("full");
    expect(slowed.sieg[1].movement!.requestedTiles).toBeCloseTo(20 * WALK, 1);
    expect(slowed.coco[1].movement?.outcome).toBe("full");
    expect(slowed.coco[1].movement!.requestedTiles).toBeCloseTo((20 * WALK) / 5, 1);
    for (const m of [fast.sieg[1], slowed.sieg[1], slowed.coco[1]]) expect(m.feedback.join(" ")).not.toMatch(COLLISION);
  });
});

describe("interrupted and superseded movement (review finding 2)", () => {
  it("an interrupted move is measured over the ticks that ran", async () => {
    // Walk at the maze's first mossling until a hit interrupts the move.
    const env = await inMaze({ sieg: { x: 13, y: 25.5 }, coco: { x: 5, y: 34 } });
    let hit: StepResult | undefined;
    for (let k = 0; k < 12 && !hit; k++) {
      const [r] = (await play(env, { sieg: [{ type: "move", direction: k % 2 ? "e" : "w", ticks: 30 }] })).sieg;
      if (r.interrupted?.startsWith("You took")) hit = r;
    }
    expect(hit, "no hit within 12 moves").toBeDefined();
    expect(hit!.ticks).toBeLessThan(30);
    expect(sorted(hit!)).toBe(hit!.ticks);
    expect(hit!.movement!.requestedTiles).toBeCloseTo(hit!.movement!.ticks.applied * WALK, 1);
  });

  it("ticks the server does not move the hero on are counted as not taken, never as a collision", async () => {
    const env = await inMaze(ENTRANCE);
    const coco = hero(env, "coco");
    // FIXTURE: Coco marked disconnected for Sieg's second move; the server's tick then skips movement (GameRoom.tick).
    const r = await play(env, { sieg: [{ type: "move", direction: "e", ticks: 10 }, { type: "move", direction: "e", ticks: 10 }] }, (id, k) => {
      if (id === "sieg") coco.connected = k !== 1;
    });
    coco.connected = true;
    expect(r.sieg[0].movement).toMatchObject({ outcome: "full", ticks: { applied: 10 } });
    const skipped = r.sieg[1];
    expect(skipped.movement).toMatchObject({ outcome: "not_applied", requestedTiles: 0, ticks: { applied: 0, notApplied: 10, movedByGame: 0 } });
    expect(skipped.movement!.from).toEqual(skipped.movement!.to);
    expect(lines(skipped, NOT_TAKEN)).toEqual(["For 10 of 10 ticks your hero did not take your movement input."]);
    expect(lines(skipped, COLLISION)).toEqual([]);
  });

  it("a tick in which the game places the hero is counted as moved by the game, not as walking", async () => {
    const env = await inMaze(ENTRANCE);
    const room = roomOf(env);
    const me = hero(env, "sieg");
    const session = room.sessions.get(me.id)!;
    // FIXTURE: the server's own reconnect handler runs mid-move; it starts a new movement epoch (GameRoom.resume).
    let calls = 0;
    const realTick = room.tick.bind(room);
    room.tick = () => {
      if (++calls === 5) room.resume(me.id, session.token, session.socketId ?? "test-socket");
      realTick();
    };
    const [move] = (await play(env, { sieg: [{ type: "move", direction: "e", ticks: 10 }] })).sieg;
    room.tick = realTick;
    expect(move.movement!.ticks.movedByGame).toBeGreaterThanOrEqual(1);
    expect(sorted(move)).toBe(10);
    expect(lines(move, GAME_MOVED)).toHaveLength(1);
    expect(lines(move, COLLISION)).toEqual([]);
  });

  it("ticks on which the story walks the hero are not counted as the hero's own walking", async () => {
    // FIXTURE: the milestone preset's heroes moved to the shrine while its story still walks them into place.
    const env = new AgentEnvironment({ preset: "milestone" });
    await env.reset(0);
    roomOf(env).transition("GODDESS_SHRINE");
    Object.assign(hero(env, "coco"), { x: 20 * TILE, y: 22 * TILE });
    const r = await play(env, { sieg: [wait(60)], coco: [{ type: "move", direction: "s", ticks: 60 }] });
    const walk = r.coco[0];
    expect(walk.movement).toMatchObject({ outcome: "not_applied", movedTiles: 0, ticks: { applied: 0, notApplied: 60 } });
    // The hero did move, but not by this input; the report says so and claims no collision.
    expect(walk.movement!.to).not.toEqual(walk.movement!.from);
    expect(lines(walk, NOT_TAKEN)).toHaveLength(1);
    expect(lines(walk, COLLISION)).toEqual([]);
  });

  it("an area transition during a move reports no movement", async () => {
    // S2's start (after the opening scene): Sieg uses the shrine's east exit while Coco walks; the party travels.
    const env = environmentFor("S2");
    await env.reset(0);
    Object.assign(hero(env, "sieg"), { x: shrinePoints.east.x - 0.4 * TILE, y: shrinePoints.east.y });
    const r = await play(env, { sieg: [wait(5), { type: "interact" }], coco: [{ type: "move", direction: "s", ticks: 60 }] });
    const walk = r.coco[0];
    expect(walk.interrupted).toMatch(/You arrived at Hedge Maze/);
    expect(walk.movement).toBeUndefined();
    expect(walk.feedback.join(" ")).not.toMatch(new RegExp(`${COLLISION.source}|${NOT_TAKEN.source}|${GAME_MOVED.source}`));
  });
});
