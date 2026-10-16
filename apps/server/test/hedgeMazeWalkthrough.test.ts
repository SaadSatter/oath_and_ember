import { ticksFor } from "../../../packages/shared/src/constants.js";
import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { collisionRects } from "../../../packages/shared/src/maps.js";
import {
  neutral,
  type Player,
  type InputFrame,
} from "../../../packages/shared/src/gameTypes.js";
import { hedgeMazeState } from "../../../packages/shared/src/hedgeMaze.js";
import {
  MAZE_CHEST_TARGET,
  MAZE_GATE_TARGET,
  MAZE_RUNNER_TARGET,
} from "../src/hedgeMaze.js";
it("walks both heroes from the maze spawn through all puzzle trials using authoritative intent", () => {
  const r = new GameRoom("ABC234", false, "HEDGE_MAZE"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const w = r.state,
    s = w.players[a.playerId],
    c = w.players[b.playerId],
    maze = hedgeMazeState(w.puzzles)!;
  // Combat has dedicated tests; isolate puzzle navigation without changing either player's position.
  w.enemies = {};
  function tick(actor?: Player, patch: Partial<InputFrame> = {}) {
    for (const p of [s, c]) {
      const session = r.sessions.get(p.id)!;
      r.receiveInput(p.id, {
        ...neutral(session.input.seq + 1),
        ...(p === actor ? patch : {}),
      });
    }
    r.tick();
  }
  function path(player: Player, goal: { x: number; y: number }) {
    const walls = collisionRects("HEDGE_MAZE", w.puzzles),
      allowed = (x: number, y: number) =>
        x >= 0 &&
        x < 48 &&
        y >= 0 &&
        y < 40 &&
        !walls.some(
          (rect) =>
            (x + 0.5) * 32 + 13 > rect.x &&
            (x + 0.5) * 32 - 13 < rect.x + rect.w &&
            (y + 0.5) * 32 + 13 > rect.y &&
            (y + 0.5) * 32 - 13 < rect.y + rect.h,
        );
    const start = Math.floor(player.y / 32) * 48 + Math.floor(player.x / 32),
      end = Math.floor(goal.y / 32) * 48 + Math.floor(goal.x / 32),
      prev = new Map<number, number>([[start, -1]]),
      queue = [start];
    for (let i = 0; i < queue.length && !prev.has(end); i++) {
      const key = queue[i],
        x = key % 48,
        y = Math.floor(key / 48);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const next = ny * 48 + nx;
        if (allowed(nx, ny) && !prev.has(next)) {
          prev.set(next, key);
          queue.push(next);
        }
      }
    }
    if (!prev.has(end)) throw Error(`No route from ${start} to ${end}`);
    const route: number[] = [];
    for (let key = end; key !== start; key = prev.get(key)!) route.unshift(key);
    return route.map((key) => ({
      x: ((key % 48) + 0.5) * 32,
      y: (Math.floor(key / 48) + 0.5) * 32,
    }));
  }
  function move(player: Player, goal: { x: number; y: number }) {
    for (const waypoint of path(player, goal)) {
      let n = 0;
      while (
        Math.hypot(player.x - waypoint.x, player.y - waypoint.y) > 5 &&
        n++ < 100
      ) {
        const dx = waypoint.x - player.x,
          dy = waypoint.y - player.y;
        tick(player, {
          moveX: Math.abs(dx) > 3 ? Math.sign(dx) : 0,
          moveY: Math.abs(dy) > 3 ? Math.sign(dy) : 0,
        });
      }
      if (n >= 100)
        throw Error(
          `Movement blocked ${player.x},${player.y} → ${waypoint.x},${waypoint.y}`,
        );
    }
    tick();
  }
  move(c, { x: 16.5 * 32, y: 34.5 * 32 });
  tick(c, { moveX: 1 });
  tick(c, { primaryHeld: true });
  for (let n = 0; n < ticksFor(3) && !maze.burned; n++) tick();
  expect(maze.burned).toBe(true);
  move(c, { x: 20.5 * 32, y: 25.5 * 32 });
  tick(c, { moveX: 1 });
  tick(c, { blackHoleHeld: true });
  for (let n = 0; n < ticksFor(5) && !maze.cow.parked; n++) tick();
  expect(maze.cow.parked).toBe(true);
  move(s, { x: 27.5 * 32, y: 15.5 * 32 });
  move(c, { x: 32.5 * 32, y: 18.5 * 32 });
  tick(c, { slowTimeHeld: true });
  tick(s, { sprintHeld: true });
  expect(w.slowTime).toBeDefined();
  expect(s.sprintRemaining).toBeGreaterThan(0);
  let route: { x: number; y: number }[] = [];
  for (let n = 0; n < ticksFor(9.833) && !maze.runner.caught; n++) {
    if (Math.hypot(s.x - maze.runner.x, s.y - maze.runner.y) <= 40) {
      r.useItem(s.id, {
        requestId: "walkthrough-tag",
        targetId: MAZE_RUNNER_TARGET,
      });
      break;
    }
    if (!route.length || n % 10 === 0) route = path(s, maze.runner);
    while (route.length && Math.hypot(s.x - route[0].x, s.y - route[0].y) <= 5)
      route.shift();
    const waypoint = route[0] ?? maze.runner,
      dx = waypoint.x - s.x,
      dy = waypoint.y - s.y;
    tick(s, {
      moveX: Math.abs(dx) > 3 ? Math.sign(dx) : 0,
      moveY: Math.abs(dy) > 3 ? Math.sign(dy) : 0,
    });
  }
  expect(maze.runner.caught).toBe(true);
  expect(w.inventory!.counts.hedge_gate_key).toBe(1);
  move(s, { x: 39.5 * 32, y: 14.5 * 32 });
  r.useItem(s.id, {
    requestId: "walkthrough-gate",
    targetId: MAZE_GATE_TARGET,
    itemId: "hedge_gate_key",
  });
  expect(w.puzzles.hedgeGate.complete).toBe(true);
  move(c, { x: 44.5 * 32, y: 6.5 * 32 });
  r.useItem(c.id, {
    requestId: "walkthrough-chest",
    targetId: MAZE_CHEST_TARGET,
  });
  expect(w.inventory!.counts.enchanted_shears).toBe(1);
  move(c, { x: 4.5 * 32, y: 34.5 * 32 });
  expect(w.inventory!.counts.enchanted_shears).toBe(1);
}, 45000);
