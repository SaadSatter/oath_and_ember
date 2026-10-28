// Regression tests for the S2 seed 0 OpenAI diagnosis (2026-10-28):
// attack presses that do nothing, world changes seen on screen, and the
// rule that events never report what the observation would not show.
// Offline. Moving both heroes into the Hedge Maze and placing them is a
// LABELLED TEST FIXTURE (room.transition and positions only). Every outcome
// below then comes from real inputs through env.step and the server's rules.
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { hedgeMazeState, mazeBurnBush } from "../../shared/src/hedgeMaze.js";
import { AgentEnvironment, noAttackLine } from "../src/environment.js";
import { onScreen, TILE } from "../src/perception.js";
import { cowLine, tickEvents, worldSnapshot } from "../src/worldEvents.js";
import type { GameAction, PlayerId, StepResult } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
const hero = (env: AgentEnvironment, id: PlayerId) =>
  Object.values(roomOf(env).state.players).find((p) => p.role === (id === "sieg" ? "OATH" : "EMBER"))!;
const NEW_LINE = /did not swing|No fireball was cast|burned away|cow moved/;

/**
 * Plays both heroes' scripts as the runner would, through env.step only. The
 * environment advances time only while both heroes have an action running,
 * so a hero whose script is done takes 1-tick waits while the partner still
 * has work. A dialogue line a hero may move on is advanced first. Returns
 * each hero's results for its own scripted actions, in order.
 */
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
const waits = (n: number, ticks = 30): GameAction[] => Array.from({ length: n }, () => ({ type: "wait", ticks }));
const lines = (r: StepResult[], re: RegExp) => r.flatMap((x) => x.feedback).filter((l) => re.test(l));

/** FIXTURE: both heroes in the Hedge Maze at the given tile positions. */
async function inMaze(at: Record<PlayerId, { x: number; y: number }>) {
  const env = new AgentEnvironment({ preset: "milestone" });
  await env.reset(0);
  roomOf(env).transition("HEDGE_MAZE");
  for (const id of ["sieg", "coco"] as PlayerId[]) Object.assign(hero(env, id), { x: at[id].x * TILE, y: at[id].y * TILE });
  return env;
}

describe("attack presses that produce nothing", () => {
  // Away from the hedge and the cow, facing open ground.
  const spots = { sieg: { x: 5, y: 34 }, coco: { x: 6.5, y: 34 } };

  it("tells a performed swing or cast from a press during recovery, for both heroes", async () => {
    const env = await inMaze(spots);
    const attack: GameAction = { type: "attack", direction: "w" };
    // Press, press again 2 ticks later (still recovering: 0.45 s / 0.6 s in
    // GameRoom), wait a full second, press again.
    const r = await play(env, { sieg: [attack, attack, { type: "wait", ticks: 60 }, attack], coco: [attack, attack, { type: "wait", ticks: 60 }, attack] });
    for (const id of ["sieg", "coco"] as PlayerId[]) {
      const role = id === "sieg" ? "OATH" : "EMBER";
      const [first, second, , third] = r[id];
      expect(first, id).toMatchObject({ accepted: true, attack: "performed" });
      expect(first.feedback.join(" "), id).not.toMatch(NEW_LINE);
      expect(second, id).toMatchObject({ accepted: true, attack: "none" });
      expect(second.feedback, id).toContain(noAttackLine(role, true));
      expect(third.attack, id).toBe("performed");
    }
    expect((await env.observe("sieg")).feedback).toContain(noAttackLine("OATH", true));
  });

  it("reports a press the game ignores even when J is not recovering", async () => {
    // Right after the goddess reset the arrival is still settling: J is
    // listed and "ready", but the server performs no swing (observed in
    // probing). The feedback tells the truth rather than implying a swing.
    const env = new AgentEnvironment({ preset: "milestone" });
    await env.reset(0);
    expect((await env.observe("sieg")).abilities[0].state).toBe("ready");
    const r = await play(env, { sieg: [{ type: "attack" }] });
    expect(r.sieg[0]).toMatchObject({ accepted: true, attack: "none" });
    expect(r.sieg[0].feedback).toContain(noAttackLine("OATH", false));
  });

  it("says only that J was recovering: no remaining time, no hit or damage", () => {
    for (const role of ["OATH", "EMBER"] as const)
      for (const recovering of [true, false]) {
        const line = noAttackLine(role, recovering);
        expect(line).not.toMatch(/\d/);
        expect(line).not.toMatch(/hit|damage|miss|enemy/i);
      }
  });

  it("each hero's no-attack line reaches only that hero, and other actions are not marked", async () => {
    const env = await inMaze(spots);
    const r = await play(env, { sieg: [{ type: "attack" }, { type: "attack" }], coco: [{ type: "move", direction: "n", ticks: 4 }] });
    expect(r.sieg[1].attack).toBe("none");
    expect(r.coco[0].attack).toBeUndefined();
    expect((await env.observe("coco")).feedback.join(" ")).not.toMatch(NEW_LINE);
  });
});

describe("world changes seen on screen", () => {
  // The dry hedge spans tiles x 18–20, y 32–36; perception lists it at (19, 34).
  const fireAtHedge = { type: "attack", direction: "e" } as const;

  it("reports the hedge burning, once, to the hero who watched it, and not to a partner elsewhere in the maze", async () => {
    const env = await inMaze({ coco: { x: 15.5, y: 34 }, sieg: { x: 35, y: 8 } });
    expect(onScreen(roomOf(env).state, hero(env, "sieg"), { x: 19 * TILE, y: 34 * TILE })).toBe(false);
    const r = await play(env, { coco: [fireAtHedge, ...waits(4)], sieg: waits(4) });
    expect(hedgeMazeState(roomOf(env).state.puzzles)!.burned).toBe(true);
    expect(lines(r.coco, /burned away/)).toEqual(["The dry hedge at (19, 34) burned away."]);
    expect(lines(r.sieg, /burned away/)).toEqual([]);
    expect((await env.observe("sieg")).feedback.join(" ")).not.toMatch(/hedge/);
  });

  it("reports it to the partner too when the hedge is on the partner's screen", async () => {
    const env = await inMaze({ coco: { x: 15.5, y: 34 }, sieg: { x: 16, y: 30 } });
    const r = await play(env, { coco: [fireAtHedge, ...waits(4)], sieg: waits(4) });
    expect(lines(r.sieg, /burned away/)).toEqual(["The dry hedge at (19, 34) burned away."]);
  });

  it("says nothing later to a hero who was not looking when it burned", async () => {
    const env = await inMaze({ coco: { x: 15.5, y: 34 }, sieg: { x: 35, y: 8 } });
    await play(env, { coco: [fireAtHedge, ...waits(4)], sieg: waits(4) });
    expect(hedgeMazeState(roomOf(env).state.puzzles)!.burned).toBe(true);
    // FIXTURE: Sieg now stands where the hedge was in plain view.
    Object.assign(hero(env, "sieg"), { x: 16 * TILE, y: 33 * TILE });
    const later = await play(env, { sieg: waits(3), coco: waits(3) });
    expect(lines(later.sieg, /burned|hedge/)).toEqual([]);
    expect((await env.observe("sieg")).feedback.join(" ")).not.toMatch(/burned|hedge/);
  });

  it("reports a cow pulled by Black Hole as one line per action, worded as drawn and never as puzzle state", async () => {
    // The scripted route's casting spot (questKnowledge MAZE_COW.cocoCast), facing east.
    const env = await inMaze({ coco: { x: 20.5, y: 25.5 }, sieg: { x: 35, y: 8 } });
    const before = { ...hedgeMazeState(roomOf(env).state.puzzles)!.cow };
    const r = await play(env, { coco: [{ type: "ability", ability: "black_hole", direction: "e" }, ...waits(10)], sieg: waits(10) });
    const cow = hedgeMazeState(roomOf(env).state.puzzles)!.cow;
    expect(cow.x).toBeLessThan(before.x);
    const perAction = r.coco.map((x) => x.feedback.filter((l) => /cow/.test(l)));
    expect(perAction.every((l) => l.length <= 1)).toBe(true);
    const all = perAction.flat();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toMatch(/^The cow moved w, from \(26, 25\) to \([\d.]+, 25\)\.$/);
    expect(all.join(" ")).not.toMatch(/park|bay|clear|lane|solved|done/i);
    expect(lines(r.sieg, /cow/)).toEqual([]);
  });

  it("never fires for the same thing seen in another area", async () => {
    const env = new AgentEnvironment({ preset: "milestone" });
    await env.reset(0);
    const w = roomOf(env).state;
    const p = hero(env, "coco");
    const before = { hedgeBurned: false, cow: { x: 26 * TILE, y: 25 * TILE } };
    const after = { hedgeBurned: true, cow: { x: 24 * TILE, y: 25 * TILE } };
    expect(p.sceneId ?? w.sceneId).toBe("GODDESS_SHRINE");
    const seen = tickEvents(before, after, w, p);
    expect(seen.lines).toEqual([]);
    expect(seen.cow).toBeUndefined();
  });

  it("agrees with the observation: the hedge event fires exactly where perceive lists the hedge", async () => {
    // Off-screen state must never be reported: for every hero position on a
    // grid across the maze, the event's visibility test and the observation's
    // `visible` list give the same answer for the hedge.
    const env = await inMaze({ coco: { x: 5, y: 34 }, sieg: { x: 4, y: 34 } });
    const w = roomOf(env).state;
    const p = hero(env, "sieg");
    const at = { x: mazeBurnBush.x + mazeBurnBush.w / 2, y: mazeBurnBush.y + mazeBurnBush.h / 2 };
    let seen = 0;
    for (let x = 1; x < 46; x += 1.5)
      for (let y = 1; y < 38; y += 1.5) {
        Object.assign(p, { x: x * TILE, y: y * TILE });
        const listed = (await env.observe("sieg")).visible.some((v) => /dry hedge/.test(v.name));
        const fires = tickEvents({ hedgeBurned: false, cow: null }, { hedgeBurned: true, cow: null }, w, p).lines.length > 0;
        expect(fires, `hero at (${x}, ${y})`).toBe(listed);
        expect(onScreen(w, p, at)).toBe(listed);
        if (listed) seen++;
      }
    expect(seen).toBeGreaterThan(0);
  });

  it("does not report a move smaller than the drawn precision", () => {
    expect(cowLine({ from: { x: 832, y: 800 }, to: { x: 831, y: 800 } })).toBeUndefined();
    expect(cowLine(undefined)).toBeUndefined();
    expect(cowLine({ from: { x: 832, y: 800 }, to: { x: 768, y: 800 } })).toBe("The cow moved w, from (26, 25) to (24, 25).");
  });

  it("snapshots nothing outside the maze", () => {
    const env = new AgentEnvironment();
    return env.reset(1).then(() => {
      const snap = worldSnapshot(roomOf(env).state);
      expect(Object.keys(snap).sort()).toEqual(["cow", "hedgeBurned"]);
    });
  });
});
