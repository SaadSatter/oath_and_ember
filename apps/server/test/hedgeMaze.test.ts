import { describe, expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import {
  burnMazeBush,
  pullMazeCow,
  tickMazeRunner,
  mazeWolf,
  updateHedgeMazeTargets,
  MAZE_RUNNER_TARGET,
  MAZE_GATE_TARGET,
  MAZE_CHEST_TARGET,
} from "../src/hedgeMaze.js";
import {
  hedgeMazeState,
  mazeCowRect,
  mazeHedges,
  mazeBurnBush,
} from "../../../packages/shared/src/hedgeMaze.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import {
  constrainMotion,
  stepMovement,
} from "../../../packages/shared/src/movement.js";
import { DT, ticksFor } from "../../../packages/shared/src/constants.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { tickBlackHoles } from "../src/blackHoles.js";
import { tickEnemies } from "../src/enemySimulation.js";
function setup() {
  const room = new GameRoom("ABC234", false, "HEDGE_MAZE"),
    a = room.add("a"),
    b = room.add("b");
  room.select(a.playerId, "OATH");
  room.select(b.playerId, "EMBER");
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  return {
    room,
    w: room.state,
    s: room.state.players[a.playerId],
    c: room.state.players[b.playerId],
    maze: hedgeMazeState(room.state.puzzles)!,
  };
}
const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
describe("Hedge Maze cooperative sequence", () => {
  it("uses the approved layout and exactly five guards, including the charged-beam golem", () => {
    const { w, room } = setup();
    expect(
      Object.values(w.enemies)
        .map((e) => e.type)
        .sort(),
    ).toEqual(
      [
        "mossling",
        "mossling",
        "cinder_wisp",
        "cinder_wisp",
        "ironbound_sentinel",
      ].sort(),
    );
    const sentinel = w.enemies["maze-sentinel"];
    expect(sentinel.passive).not.toBe(true);
    w.players[Object.keys(w.players)[0]].x = sentinel.x;
    w.players[Object.keys(w.players)[0]].y = sentinel.y + 20;
    let damage = 0;
    for (let i = 0; i < ticksFor(5); i++) {
      w.serverTick++;
      tickEnemies(w, () => damage++);
    }
    expect(sentinel.attackSeq).toBeGreaterThan(0);
    expect(sentinel.attackKind).toBe("melee");
    expect(damage).toBeGreaterThan(0);
    expect(room.inventory.targets.has(MAZE_CHEST_TARGET)).toBe(true);
  });
  it("only Coco fireballs burn the marked bush; walls and flight cannot bypass it", () => {
    const { w, s, c, maze } = setup(),
      from = { x: mazeBurnBush.x - 10, y: 34 * 32 },
      to = { x: mazeBurnBush.x + 10, y: 34 * 32 };
    expect(burnMazeBush(w, s.id, from, to)).toBe(false);
    const blocked = constrainMotion(
      from,
      { x: 100, y: 0 },
      maps.HEDGE_MAZE,
      collisionRects("HEDGE_MAZE", w.puzzles),
    );
    expect(blocked.x).toBeLessThan(mazeBurnBush.x);
    Object.assign(c, from, { flightRemaining: 10 });
    stepMovement(
      c,
      { ...neutral(), moveX: 1 },
      maps.HEDGE_MAZE,
      collisionRects("HEDGE_MAZE", w.puzzles),
      1,
    );
    expect(c.x).toBeLessThan(mazeBurnBush.x);
    expect(
      burnMazeBush(
        w,
        c.id,
        { x: 19 * 32, y: 30 * 32 },
        { x: 19 * 32, y: 35 * 32 },
      ),
    ).toBe(false);
    expect(burnMazeBush(w, c.id, from, to)).toBe(true);
    expect(maze.burned).toBe(true);
    expect(
      constrainMotion(
        from,
        { x: 100, y: 0 },
        maps.HEDGE_MAZE,
        collisionRects("HEDGE_MAZE", w.puzzles),
      ).x,
    ).toBe(from.x + 100);
  });
  it("pulls a harmless large cow physically into its bay without clipping or damaging players", () => {
    const { w, c, s, maze } = setup();
    maze.burned = true;
    w.enemies = {};
    Object.assign(c, { x: 20.5 * 32, y: 25 * 32 });
    Object.assign(s, { x: 27 * 32, y: 34 * 32 });
    const before = maze.cow.x;
    w.blackHoles = {
      test: {
        id: "test",
        owner: c.id,
        sceneId: "HEDGE_MAZE",
        x: c.x,
        y: c.y,
        vx: 340,
        vy: 0,
        remainingRange: 192,
        phase: "travel",
        startedTick: 0,
        life: 4,
        damaged: [],
      },
    };
    for (let i = 0; i < ticksFor(6); i++) {
      const old = maze.cow.x;
      tickBlackHoles(w);
      expect(Math.abs(maze.cow.x - old)).toBeLessThanOrEqual(100 * DT + 1e-6);
      expect(mazeHedges.some((r) => overlaps(mazeCowRect(maze), r))).toBe(
        false,
      );
    }
    expect(maze.cow.x).toBeLessThan(before - 60);
    expect(maze.cow.parked).toBe(true);
    expect(c.hp).toBe(100);
    expect(s.hp).toBe(100);
    const clear = constrainMotion(
      { x: 27 * 32, y: 28 * 32 },
      { x: 0, y: -6 * 32 },
      maps.HEDGE_MAZE,
      collisionRects("HEDGE_MAZE", w.puzzles),
    );
    expect(clear.y).toBe(22 * 32);
  });
  it("does not pull the cow through a wall or an occupied player position", () => {
    const { w, s, c, maze } = setup();
    Object.assign(s, { x: 23 * 32, y: 25 * 32 });
    Object.assign(c, { x: 20.5 * 32, y: 25 * 32 });
    for (let n = 0; n < ticksFor(3.333); n++)
      pullMazeCow(w, { x: 23.8 * 32, y: 25 * 32, sceneId: "HEDGE_MAZE" }, 100);
    expect(maze.cow.x - s.x).toBeGreaterThanOrEqual(77);
    expect(maze.cow.parked).toBe(false);
    const old = maze.cow.x;
    pullMazeCow(w, { x: 26 * 32, y: 21 * 32, sceneId: "HEDGE_MAZE" }, 100);
    expect(maze.cow.x).toBe(old);
  });
  it("wolf detects distant heroes and accelerates for Super Speed while remaining catchable in Slow Time", () => {
    const measure = (sprint: boolean, slow: boolean) => {
      const { w, s, c, maze } = setup();
      // A long, open row gives an unclamped movement sample.
      Object.assign(maze.runner, {
        x: 800,
        y: 464,
        waypoint: { x: 600, y: 464 },
        fleeing: true,
      });
      Object.assign(s, { x: 100, y: 464, sprintRemaining: sprint ? 10 : 0 });
      c.connected = false;
      if (slow) w.slowTime = { owner: c.id, startedTick: 0, endsTick: ticksFor(10) };
      tickMazeRunner(w);
      return 800 - maze.runner.x;
    };
    expect(mazeWolf.detectionRadius).toBeGreaterThan(420 * 2);
    expect(measure(false, false)).toBeCloseTo(mazeWolf.speed * DT);
    expect(measure(true, false)).toBeCloseTo(mazeWolf.alertSpeed * DT);
    expect(mazeWolf.speed).toBeGreaterThan(190);
    expect(mazeWolf.alertSpeed).toBeGreaterThan(380);
    expect(measure(true, true)).toBeCloseTo(mazeWolf.alertSpeed * DT * 0.2);
    expect(measure(true, true)).toBeLessThan(190 * DT);
    // Beyond detection the wolf never flees; it only roams at a trot.
    const { w, s, c, maze } = setup();
    c.connected = false;
    Object.assign(s, { x: maze.runner.x + 1001, y: maze.runner.y });
    const before = { x: maze.runner.x, y: maze.runner.y };
    tickMazeRunner(w);
    expect(maze.runner.fleeing).toBe(false);
    expect(
      Math.hypot(maze.runner.x - before.x, maze.runner.y - before.y),
    ).toBeLessThanOrEqual(mazeWolf.roamSpeed * DT + 1e-9);
  });
  it("roams its section while no hero can reach it, instead of standing still", () => {
    const { room, maze } = setup();
    const visited = new Set<string>();
    let travelled = 0,
      last = { x: maze.runner.x, y: maze.runner.y };
    for (let n = 0; n < ticksFor(10); n++) {
      room.tick();
      travelled += Math.hypot(maze.runner.x - last.x, maze.runner.y - last.y);
      last = { x: maze.runner.x, y: maze.runner.y };
      visited.add(`${Math.floor(last.x / 32)},${Math.floor(last.y / 32)}`);
      expect(maze.runner.fleeing).toBe(false);
    }
    // Ten seconds at a trot covers real ground across many maze cells.
    expect(travelled).toBeGreaterThan(mazeWolf.roamSpeed * 10 * 0.5);
    expect(visited.size).toBeGreaterThan(10);
    for (const cell of visited) {
      const [x, y] = cell.split(",").map(Number);
      expect(
        collisionRects("HEDGE_MAZE", room.state.puzzles).some((r) =>
          overlaps(r, { x: x * 32 + 16, y: y * 32 + 16, w: 0.001, h: 0.001 }),
        ),
      ).toBe(false);
    }
  });
  it("roams identically for identical sessions", () => {
    const run = () => {
      const { room, maze } = setup();
      for (let n = 0; n < ticksFor(4); n++) room.tick();
      return { x: maze.runner.x, y: maze.runner.y };
    };
    expect(run()).toEqual(run());
  });
  it("flees a hero who can reach it even while the other hero cannot", () => {
    const { w, s, c, maze } = setup();
    // Coco stays at the separate entrance area; Sieg stands beside the wolf.
    Object.assign(s, { x: maze.runner.x + 64, y: maze.runner.y });
    const start = Math.hypot(s.x - maze.runner.x, s.y - maze.runner.y);
    for (let n = 0; n < ticksFor(0.5); n++) tickMazeRunner(w);
    expect(maze.runner.fleeing).toBe(true);
    expect(Math.hypot(s.x - maze.runner.x, s.y - maze.runner.y)).toBeGreaterThan(
      start + 64,
    );
    expect(c.y).toBeGreaterThan(704);
  });
  it("runner flees both heroes, respects walls, slows to .2, and requires the cooperative tag", () => {
    const { room, w, s, c, maze } = setup();
    Object.assign(s, { x: 24 * 32, y: 14.5 * 32 });
    Object.assign(c, { x: 26 * 32, y: 18 * 32 });
    const start = maze.runner.x;
    for (let i = 0; i < ticksFor(1); i++) {
      tickMazeRunner(w);
      expect(
        collisionRects("HEDGE_MAZE", w.puzzles).some((r) =>
          overlaps(
            { x: maze.runner.x - 13, y: maze.runner.y - 13, w: 26, h: 26 },
            r,
          ),
        ),
      ).toBe(false);
    }
    expect(maze.runner.x).toBeLessThan(start - 32);
    const fast = setup(),
      slow = setup();
    for (const game of [fast, slow]) {
      Object.assign(game.s, { x: 24 * 32, y: 14.5 * 32 });
      Object.assign(game.c, { x: 26 * 32, y: 18 * 32 });
    }
    slow.w.slowTime = { owner: slow.c.id, startedTick: 0, endsTick: ticksFor(10) };
    const fx = fast.maze.runner.x,
      sx = slow.maze.runner.x;
    tickMazeRunner(fast.w);
    tickMazeRunner(slow.w);
    expect(Math.abs(slow.maze.runner.x - sx)).toBeCloseTo(
      Math.abs(fast.maze.runner.x - fx) * 0.2,
    );
    // Stand beside the wolf on whichever side has a clear line to it; where it
    // ends after a second of fleeing depends on the corridor it reached.
    const walls = collisionRects("HEDGE_MAZE", w.puzzles);
    const [dx, dy] = [
      [24, 0],
      [-24, 0],
      [0, 24],
      [0, -24],
    ].find(([dx, dy]) => {
      const line = {
        x: Math.min(maze.runner.x, maze.runner.x + dx) - 0.5,
        y: Math.min(maze.runner.y, maze.runner.y + dy) - 0.5,
        w: Math.abs(dx) + 1,
        h: Math.abs(dy) + 1,
      };
      return !walls.some((r) => overlaps(line, r));
    })!;
    Object.assign(s, { x: maze.runner.x + dx, y: maze.runner.y + dy });
    updateHedgeMazeTargets(w, room.inventory);
    const intent = { requestId: "tag-fail", targetId: MAZE_RUNNER_TARGET };
    expect(() => room.useItem(s.id, intent)).toThrow("Solve");
    w.slowTime = { owner: c.id, startedTick: 0, endsTick: ticksFor(10) };
    s.sprintRemaining = 10;
    // Move target snapshot to the actual authoritative runner position.
    room.inventory.targets.get(MAZE_RUNNER_TARGET)!.x = maze.runner.x;
    room.inventory.targets.get(MAZE_RUNNER_TARGET)!.y = maze.runner.y;
    const tag = { ...intent, requestId: "tag" };
    room.useItem(s.id, tag);
    room.useItem(s.id, tag);
    expect(w.inventory!.counts.hedge_gate_key).toBe(1);
    expect(maze.runner.caught).toBe(true);
    Object.assign(c, { x: 44 * 32, y: 6 * 32 });
    expect(() =>
      room.useItem(c.id, { requestId: "early", targetId: MAZE_CHEST_TARGET }),
    ).toThrow("Solve");
    Object.assign(s, { x: 39 * 32, y: 14 * 32 });
    room.useItem(s.id, {
      requestId: "gate",
      targetId: MAZE_GATE_TARGET,
      itemId: "hedge_gate_key",
    });
    expect(w.puzzles.hedgeGate.complete).toBe(true);
    expect(w.inventory!.counts.hedge_gate_key).toBe(0);
    room.useItem(c.id, { requestId: "chest", targetId: MAZE_CHEST_TARGET });
    room.useItem(c.id, { requestId: "chest2", targetId: MAZE_CHEST_TARGET });
    expect(w.inventory!.counts.enchanted_shears).toBe(1);
    room.transition("FOREST_RUINS", true);
    room.transition("HEDGE_MAZE");
    expect(hedgeMazeState(w.puzzles)!.runner.caught).toBe(true);
    expect(w.inventory!.counts.enchanted_shears).toBe(1);
  });
});
