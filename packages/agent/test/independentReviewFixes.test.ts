// Regression tests for the independent-review fixes (owner approval
// 2026-10-28; review docs/midterm/agent-evidence/reviews/2026-10-28-pilot6-independent-review.md;
// audit docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-independent-review-fixes.md).
// Offline. LABELLED TEST FIXTURES set up the area (room.transition), hero
// positions, a hero's HP before a hit, and one story walk mark; every outcome
// comes from real inputs and the server's own ticks.
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { AgentEnvironment, KNOCKED_OUT } from "../src/environment.js";
import { TILE, truncate2 } from "../src/perception.js";
import { asTuned } from "../src/policies/navigate.js";
import { environmentFor } from "../src/suite.js";
import type { GameAction, Observation, PlayerId, StepResult } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
const hero = (env: AgentEnvironment, id: PlayerId) =>
  Object.values(roomOf(env).state.players).find((p) => p.role === (id === "sieg" ? "OATH" : "EMBER"))!;
const COLLISION = /blocked at once|You moved .* only|Something (blocked|stopped)/;
const GAME_MOVED = /the game moved your hero/;
const NOT_TAKEN = /did not take your movement input/;
const WALK = 190 / 32 / 60;
const wait = (ticks: number): GameAction => ({ type: "wait", ticks });
const move = (direction: "n" | "s" | "e" | "w", ticks: number): GameAction => ({ type: "move", direction, ticks });

/** Plays both heroes' scripts as the runner would (see s2Feedback.test.ts). */
async function play(env: AgentEnvironment, script: Partial<Record<PlayerId, GameAction[]>>) {
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
const ENTRANCE = { sieg: { x: 5, y: 34 }, coco: { x: 9, y: 34 } };
const lines = (r: StepResult, re: RegExp) => r.feedback.filter((l) => re.test(l));

describe("short moves are judged against open ground, not display rounding (finding 1)", () => {
  for (const slowed of [false, true])
    for (const ticks of [1, 3])
      it(`a ${ticks}-tick open-ground move${slowed ? " under Slow Time" : ""} is full for both heroes, with no collision line`, async () => {
        const env = await inMaze(ENTRANCE);
        if (slowed) await play(env, { coco: [{ type: "ability", ability: "slow_time" }], sieg: [wait(2)] });
        expect(!!roomOf(env).state.slowTime).toBe(slowed);
        const r = await play(env, { sieg: [move("e", ticks)], coco: [move("e", ticks)] });
        for (const id of ["sieg", "coco"] as PlayerId[]) {
          const m = r[id][0].movement!;
          // Sieg keeps normal speed under Slow Time only with Super Speed, which is not active here.
          expect(m.requestedTiles, id).toBeCloseTo((ticks * WALK) / (slowed ? 5 : 1), 2);
          expect(m, id).toMatchObject({ outcome: "full", blocked: false });
          expect(lines(r[id][0], COLLISION), id).toEqual([]);
        }
      });

  it("a short move straight into a wall is still reported as blocked, for both heroes, with and without Slow Time", async () => {
    // Start pressed against the hedge at y 36: the body edge is at 36.
    const env = await inMaze({ sieg: { x: 5, y: 36 - 13 / 32 }, coco: { x: 9, y: 36 - 13 / 32 } });
    const plain = await play(env, { sieg: [move("s", 3)], coco: [move("s", 3)] });
    await play(env, { coco: [{ type: "ability", ability: "slow_time" }], sieg: [wait(2)] });
    const slow = await play(env, { sieg: [move("s", 1)], coco: [move("s", 1)] });
    for (const r of [plain, slow])
      for (const id of ["sieg", "coco"] as PlayerId[]) {
        expect(r[id][0].movement, id).toMatchObject({ outcome: "none", blocked: true, movedTiles: 0 });
        expect(lines(r[id][0], COLLISION), id).toHaveLength(1);
      }
  });
});

describe("lethal hits are reported (finding 2)", () => {
  /** FIXTURE: Sieg with 1 HP beside the maze's first mossling. Every outcome then comes from real ticks. */
  async function nearMossling() {
    const env = await inMaze({ sieg: { x: 10, y: 25.5 }, coco: { x: 5, y: 34 } });
    hero(env, "sieg").hp = 1;
    return env;
  }

  it("during a move: one defeat line, the respawn is moved by the game, never walking or a collision; deterministic", async () => {
    const runOnce = async () => {
      const env = await nearMossling();
      const results: StepResult[] = [];
      for (let k = 0; k < 20 && !results.some((r) => r.feedback.includes(KNOCKED_OUT)); k++)
        results.push(...(await play(env, { sieg: [move(k % 2 ? "e" : "w", 30)] })).sieg);
      return { results, hash: env.evaluatorReport().stateHash, me: hero(env, "sieg") };
    };
    const a = await runOnce();
    const hit = a.results.find((r) => r.feedback.includes(KNOCKED_OUT));
    expect(hit, "no lethal hit within 20 moves").toBeDefined();
    expect(hit!.feedback.filter((l) => l === KNOCKED_OUT)).toHaveLength(1);
    expect(hit!.movement!.ticks.movedByGame).toBeGreaterThanOrEqual(1);
    expect(lines(hit!, GAME_MOVED)).toHaveLength(1);
    expect(a.me.hp).toBe(100);
    // The respawn jump is not counted as progress: progress cannot exceed what open ground allows.
    expect(hit!.movement!.movedTiles).toBeLessThanOrEqual(hit!.movement!.requestedTiles + 0.01);
    expect(KNOCKED_OUT).not.toMatch(/mossling|enemy|damage|\d/i);
    const b = await runOnce();
    expect(b.hash).toBe(a.hash);
    expect(b.results.map((r) => r.feedback)).toEqual(a.results.map((r) => r.feedback));
  });

  it("during a wait: the defeat line is reported, though the hero was not moving", async () => {
    const env = await nearMossling();
    const results: StepResult[] = [];
    for (let k = 0; k < 20 && !results.some((r) => r.feedback.includes(KNOCKED_OUT)); k++) results.push(...(await play(env, { sieg: [wait(30)] })).sieg);
    const hit = results.find((r) => r.feedback.includes(KNOCKED_OUT));
    expect(hit, "no lethal hit within 20 waits").toBeDefined();
    expect(hit!.movement).toBeUndefined();
    expect(hero(env, "sieg").hp).toBe(100);
    // Only the hero who fell is told.
    expect((await env.observe("coco")).feedback).not.toContain(KNOCKED_OUT);
    expect((await env.observe("sieg")).feedback).toContain(KNOCKED_OUT);
  });
});

describe("listed coordinates of moving things match their marked cell (finding 3)", () => {
  for (const x of [25.96, 25.996, 25.5, 26.01])
    it(`a partner at x ${x} is listed truncated, in the cell its P is drawn in`, async () => {
      const env = await inMaze({ sieg: { x: 24.5, y: 31 }, coco: { x, y: 31 } });
      const o = await env.observe("sieg");
      const partner = o.visible.find((v) => v.kind === "partner")!;
      expect(partner.x).toBe(truncate2(x));
      const row = o.screen.rows[Math.floor(partner.y) - o.screen.originY];
      expect(row[Math.floor(partner.x) - o.screen.originX]).toBe("P");
    });

  it("enemies and creatures are truncated too; fixed signs keep one decimal; nothing new is listed", async () => {
    const env = await inMaze({ sieg: { x: 25.5, y: 31.5 }, coco: { x: 24.5, y: 31.5 } });
    const o = await env.observe("sieg");
    for (const v of o.visible.filter((v) => ["enemy", "creature", "partner"].includes(v.kind))) {
      expect(Math.round(v.x * 100) / 100).toBe(v.x);
      const row = o.screen.rows[Math.floor(v.y) - o.screen.originY];
      if (row) expect("EPC").toContain(row[Math.floor(v.x) - o.screen.originX]);
    }
    expect(o.visible.find((v) => v.name === "Harmless cow · blocks the lane")).toMatchObject({ x: 26, y: 27.7 });
    // Exactly what the pre-change code lists here (checked at 6448dc1): truncation changes formatting only.
    expect(o.visible.map((v) => `${v.kind}:${v.name}`).sort()).toEqual([
      "enemy:cinder wisp",
      "enemy:ironbound sentinel",
      "enemy:mossling",
      "object:FIREBALL · dry hedge",
      "object:Harmless cow · blocks the lane",
      "partner:Coco",
    ]);
  });

  it("scripted players get the moving things back at one decimal (asTuned), and the observation is not changed", () => {
    const o = { self: { x: 25.96, y: 27.44 }, visible: [{ kind: "enemy", x: 25.96, y: 29.95 }, { kind: "object", x: 22.2, y: 22.2 }] } as unknown as Observation;
    const before = JSON.stringify(o);
    const t = asTuned(o);
    expect(t.visible.map((v) => [v.x, v.y])).toEqual([[26, 30], [22.2, 22.2]]);
    expect(JSON.stringify(o)).toBe(before);
  });
});

describe("Slow Time carry is moved by the game (finding 4)", () => {
  it("Coco carried by Sieg (Super Speed under Slow Time) counts carried ticks as game-moved, with no collision line", async () => {
    // The review's reproduction: entrance row, Sieg at (3, 33), Coco 27 px east.
    const env = await inMaze({ sieg: { x: 3, y: 33 }, coco: { x: 3 + 27 / TILE, y: 33 } });
    await play(env, { sieg: [{ type: "ability", ability: "super_speed" }], coco: [wait(2)] });
    await play(env, { coco: [{ type: "ability", ability: "slow_time" }], sieg: [wait(2)] });
    const r = await play(env, { sieg: [move("e", 30)], coco: [move("s", 30)] });
    const coco = r.coco[0].movement!;
    expect(coco.ticks.movedByGame).toBeGreaterThan(0);
    expect(coco.ticks.applied + coco.ticks.notApplied + coco.ticks.movedByGame).toBe(r.coco[0].ticks);
    expect(lines(r.coco[0], GAME_MOVED)).toHaveLength(1);
    expect(lines(r.coco[0], COLLISION)).toEqual([]);
  });
});

describe("a story walk in the same direction as the move is not the hero's walking (finding 5)", () => {
  it("counts the walked ticks as not taken, even when the walk's direction equals the move's", async () => {
    const env = environmentFor("S2");
    await env.reset(0);
    const w = roomOf(env).state;
    const me = hero(env, "sieg");
    // FIXTURE: a story walk mark 4 tiles due east of Sieg, at his exact y, starting next tick.
    // The server's story walk then gives exactly the input (1, 0) that "move e" sends.
    w.story!.walks = { ...(w.story!.walks ?? {}), [me.id]: { x: me.x + 4 * TILE, y: me.y, facing: 0, start: w.serverTick + 1 } };
    const r = await play(env, { sieg: [move("e", 10)], coco: [wait(10)] });
    const m = r.sieg[0].movement!;
    expect(m.ticks.notApplied).toBe(10);
    expect(m.ticks.applied).toBe(0);
    expect(m.outcome).toBe("not_applied");
    // The hero did move east, but by the story's walk.
    expect(m.to.x).toBeGreaterThan(m.from.x);
    expect(lines(r.sieg[0], NOT_TAKEN)).toHaveLength(1);
    expect(lines(r.sieg[0], COLLISION)).toEqual([]);
  });
});
